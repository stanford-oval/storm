import concurrent.futures
import functools
import json
import logging
import os
import time
from concurrent.futures import as_completed
from dataclasses import dataclass, field

from modules import (GeneralConvSimulator, CreateWriterWithPersona, PersonaConvSimulator, WriteOutline,
                     SearchCollectedInfo, ConvToSection, PolishPageModule, UserGuidedQuestionAnswerModule)
from modules.utils import (LLMConfigs, clean_up_citation, dump_json, DialogueTurn, write_str, process_table_of_contents,
                           convert_outline_into_queries, convert_outline_into_str, unify_citations_across_sections,
                           load_json, load_str, BaseCallbackHandler)

logging.basicConfig(level=logging.INFO, format='%(name)s : %(levelname)-8s : %(message)s')
logger = logging.getLogger(__name__)


def log_execution_time(func):
    """Decorator to log the execution time of a function."""

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        end_time = time.time()
        execution_time = end_time - start_time
        logger.info(f"{func.__name__} executed in {execution_time:.4f} seconds")
        return result

    return wrapper


@dataclass
class DeepSearchRunnerArguments:
    """Arguments for controlling the STORM pipeline."""
    output_dir: str = field(
        metadata={"help": "Output directory for the results."},
    )
    max_conv_turn: int = field(
        default=3,
        metadata={"help": "Maximum number of questions in conversational question asking."},
    )
    max_perspective: int = field(
        default=5,
        metadata={"help": "Maximum number of perspectives to consider in perspective-guided question asking."},
    )
    disable_perspective: bool = field(
        default=False,
        metadata={"help": "If True, disable perspective-guided question asking."},
    )
    search_top_k: int = field(
        default=3,
        metadata={"help": "Top k search results to consider for each search query."},
    )
    retrieve_top_k: int = field(
        default=5,
        metadata={"help": "Top k collected references for each section title."},
    )


class DeepSearchRunner:
    def __init__(self,
                 args: DeepSearchRunnerArguments,
                 llm_configs: LLMConfigs):
        self.args = args
        self.llm_configs = llm_configs
        # Caveat: DeepSearchRunner does not support multi-threading.
        self.article_dir_name = None

    def user_guided_question_asking(self, topic, user_utterance, ground_truth_url):
        """
        Provide answer for user guided question asking

        Args:
            topic: The topic to research.
            user_utterance: The user provided question
            ground_truth_url: A ground truth URL including a curated article about the topic. The URL will be excluded.

        Returns:
            conversation: The information-seeking conversation, which is a list of DialogueTurn (of size 1)
            url_to_info: see documentation of self._research_topic(...)
        """
        persona_conv_simulator = UserGuidedQuestionAnswerModule(
            topic_expert_engine=self.llm_configs.conv_simulator_lm,
            search_top_k=self.args.search_top_k
        )
        conversation = persona_conv_simulator(topic=topic, user_utterance=user_utterance,
                                              ground_truth_url=ground_truth_url)
        conversation = clean_up_citation(conversation).dlg_history
        url_to_info = DeepSearchRunner.extract_url_to_info_from_conversation([conversation])
        return conversation, url_to_info

    @staticmethod
    def extract_url_to_info_from_conversation(conversations):
        url_to_info = {}

        for conv in conversations:
            for turn in conv:
                for r in turn.search_results:
                    if r['url'] in url_to_info:
                        url_to_info[r['url']]['snippets'].extend(r['snippets'])
                    else:
                        url_to_info[r['url']] = r
        for k in url_to_info:
            url_to_info[k]['snippets'] = list(set(url_to_info[k]['snippets']))
        return url_to_info

    @log_execution_time
    def _research_topic(self,
                        topic: str,
                        ground_truth_url: str = '',
                        callback_handler: BaseCallbackHandler = None):
        """
        Research the topic through question asking and search-augmented question answering.

        Args:
            topic: The topic to research.
            ground_truth_url: A ground truth URL including a curated article about the topic. The URL will be excluded.
            callback_handler: A callback handler to handle the intermediate results.
        Returns:
            conversations: A list of information-seeking conversations, each of which is a list of DialogueTurn.
            url_to_info:
                {
                    url1: {'url': str, 'title': str, 'snippets': List[str]},
                    ...
                }
        """
        conversations = []

        if self.args.disable_perspective:
            general_conv_simulator = GeneralConvSimulator(
                topic_expert_engine=self.llm_configs.conv_simulator_lm,
                question_asker_engine=self.llm_configs.question_asker_lm,
                search_top_k=self.args.search_top_k,
                max_turn=self.args.max_conv_turn
            )
            callback_handler.on_information_gathering_start()
            general_conv = general_conv_simulator(
                topic=topic,
                ground_truth_url=ground_truth_url,
                callback_handler=callback_handler
            )
            general_conv = clean_up_citation(general_conv).dlg_history
            conversations.append(general_conv)
            conversation_log = [
                {
                    'perspective': '',
                    'dlg_turns': [turn.log() for turn in general_conv]
                }
            ]
            dump_json(conversation_log,
                      os.path.join(self.args.output_dir, self.article_dir_name, 'conversation_log.json'))
        else:
            callback_handler.on_identify_perspective_start()
            create_writer_with_persona = CreateWriterWithPersona(engine=self.llm_configs.question_asker_lm)
            personas = create_writer_with_persona(topic=topic)
            default_persona = 'Basic fact writer: Basic fact writer focusing on broadly covering the basic facts about the topic.'
            considered_personas = [default_persona] + personas.personas[:self.args.max_perspective]
            callback_handler.on_identify_perspective_end(perspectives=considered_personas)
            callback_handler.on_information_gathering_start()
            persona_conv_simulator = PersonaConvSimulator(
                topic_expert_engine=self.llm_configs.conv_simulator_lm,
                question_asker_engine=self.llm_configs.question_asker_lm,
                search_top_k=self.args.search_top_k,
                max_turn=self.args.max_conv_turn
            )

            def run_persona_conv(persona):
                return persona_conv_simulator(
                    topic=topic,
                    ground_truth_url=ground_truth_url,
                    persona=persona,
                    callback_handler=callback_handler
                )

            with concurrent.futures.ThreadPoolExecutor(max_workers=len(considered_personas)) as executor:
                future_to_persona = {executor.submit(run_persona_conv, persona): persona for persona in
                                     considered_personas}

                for future in as_completed(future_to_persona):
                    persona_conv = future.result()
                    conversations.append(clean_up_citation(persona_conv).dlg_history)

            conversation_log = []
            for persona, persona_conv in zip(considered_personas, conversations):
                conversation_log.append(
                    {
                        'perspective': persona,
                        'dlg_turns': [turn.log() for turn in persona_conv]
                    }
                )
                dump_json(conversation_log,
                          os.path.join(self.args.output_dir, self.article_dir_name, 'conversation_log.json'))

        # Collect search results.
        url_to_info = DeepSearchRunner.extract_url_to_info_from_conversation(conversations)
        dump_json(url_to_info, os.path.join(self.args.output_dir, self.article_dir_name, 'raw_search_results.json'))
        callback_handler.on_information_gathering_end()

        return conversations, url_to_info

    @log_execution_time
    def _generate_outline(self,
                          topic: str,
                          conversations: list[list[DialogueTurn]],
                          callback_handler: BaseCallbackHandler):
        """
        Generate an outline of the topic based on the models' internal knowledge and the information-seeking
         conversations.

        Args:
            topic: The topic to research.
            conversations: A list of information-seeking conversations, each of which is a list of DialogueTurn.
            callback_handler: A callback handler to handle the intermediate results.
        Returns:
            outline: The final outline.
        """
        callback_handler.on_information_organization_start()
        write_outline = WriteOutline(engine=self.llm_configs.outline_gen_lm)
        result = write_outline(topic=topic, dlg_history=sum(conversations, []), callback_handler=callback_handler)
        write_str(result.outline, os.path.join(self.args.output_dir, self.article_dir_name, 'storm_gen_outline.txt'))
        write_str(result.old_outline,
                  os.path.join(self.args.output_dir, self.article_dir_name, 'direct_gen_outline.txt'))

        return result.outline

    @log_execution_time
    def _generate_article(self,
                          topic: str,
                          outline: str,
                          url_to_info: dict,
                          callback_handler: BaseCallbackHandler):
        """
        Generate a curated article for the topic based on the outline and the collected references in a
         section-by-section way.

        Args:
            topic: The topic to research.
            outline: The outline for the topic.
            url_to_info: A dictionary of collected references.
            callback_handler: A callback handler to handle the intermediate results.
        Returns:
            article: The final article.
        """
        collected_urls = []
        collected_snippets = []
        for url, info in url_to_info.items():
            for snippet in info['snippets']:
                collected_urls.append(url)
                collected_snippets.append(snippet)
        search_collected_info = SearchCollectedInfo(
            collected_urls=collected_urls, collected_snippets=collected_snippets, search_top_k=self.args.retrieve_top_k)
        section_gen = ConvToSection(engine=self.llm_configs.article_gen_lm)
        outline_tree = process_table_of_contents(outline)
        sections = []
        search_results = []
        if len(outline_tree) == 0:
            logging.error(f'No outline for {topic}. Will directly search with the topic.')
            search_queries = [topic]
            searched_url_to_snippets = search_collected_info.search(search_queries)
            output = section_gen(
                topic=topic, outline=outline, section=topic, searched_url_to_snippets=searched_url_to_snippets)
            sections.append(output.section)
            search_results.append(
                [{'url': url, 'snippets': searched_url_to_snippets[url]} for url in searched_url_to_snippets.items()])
        else:
            if len(outline_tree) == 1:
                # We don't want the topic to be a section title.
                outline_tree = list(outline_tree.values())[0]

            def gen_section(sec_title):
                search_qs = [sec_title]
                search_qs.extend(convert_outline_into_queries(outline_tree[sec_title]))
                url_to_snippets = search_collected_info.search(search_qs)
                section_outline = f'# {sec_title}\n' + convert_outline_into_str(outline_tree[sec_title], 2)
                sec_gen_output = section_gen(
                    topic=topic, outline=section_outline, section=sec_title,
                    searched_url_to_snippets=url_to_snippets)
                sec_result = sec_gen_output.section
                sec_refs = [{'url': url, 'snippets': url_to_snippets[url]} for url in url_to_snippets]

                return sec_result, sec_refs

            with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
                future_to_sec_title = {}
                sections = {}
                search_results = {}
                for section_title in outline_tree:
                    if section_title.lower().strip() == 'introduction':
                        continue  # We don't want to write a separate introduction section.
                    if section_title.lower().strip().startswith(
                            'conclusion') or section_title.lower().strip().startswith('summary'):
                        continue  # We don't want to write a separate conclusion section.
                    future_to_sec_title[executor.submit(gen_section, section_title)] = section_title
                    sections[section_title] = None
                    search_results[section_title] = None

                for future in as_completed(future_to_sec_title):
                    section_result, section_refs = future.result()
                    section_title = future_to_sec_title[future]
                    sections[section_title] = section_result
                    search_results[section_title] = section_refs
            sections = list(sections.values())
            search_results = list(search_results.values())

        updated_sections, url_to_unified_index, used_url_to_info = unify_citations_across_sections(sections,
                                                                                                   search_results)
        for url in url_to_unified_index:
            used_url_to_info[url]['title'] = url_to_info[url]['title']
        article = '\n\n'.join(updated_sections)
        write_str(article, os.path.join(self.args.output_dir, self.article_dir_name, 'storm_gen_article.txt'))
        dump_json({
            'url_to_unified_index': url_to_unified_index,
            'url_to_info': used_url_to_info
        }, os.path.join(self.args.output_dir, self.article_dir_name, 'url_to_info.json'))

        return article

    @log_execution_time
    def _polish_article(self,
                        topic: str,
                        article: str,
                        remove_duplicate: bool,
                        callback_handler: BaseCallbackHandler):
        """
        Polish the article by adding a summarization section and (optionally) removing duplicated content.

        Args:
            topic: The topic to research.
            article: The article to polish.
            remove_duplicate: If True, remove duplicated content.
            callback_handler: A callback handler to handle the intermediate results.
        Returns:
            polished_article: The polished article.

        """
        polish_page = PolishPageModule(
            write_lead_engine=self.llm_configs.article_gen_lm,
            polish_engine=self.llm_configs.article_polish_lm
        )
        polish_result = polish_page(topic=topic, draft_page=article, polish_whole_page=remove_duplicate)
        polished_article = '\n\n'.join([polish_result.lead_section, polish_result.page])
        write_str(polished_article,
                  os.path.join(self.args.output_dir, self.article_dir_name, 'storm_gen_article_polished.txt'))

        return polished_article

    def post_run(self):
        """
        Post-run operations, including:
        1. Dumping the run configuration.
        2. Dumping the LLM call history.
        """
        config_log = self.llm_configs.log()
        dump_json(config_log, os.path.join(self.args.output_dir, self.article_dir_name, 'run_config.json'))

        llm_call_history = self.llm_configs.collect_and_reset_lm_history()
        with open(os.path.join(self.args.output_dir, self.article_dir_name, 'llm_call_history.jsonl'), 'w') as f:
            for call in llm_call_history:
                if 'kwargs' in call:
                    call.pop('kwargs')  # All kwargs are dumped together to run_config.json.
                f.write(json.dumps(call) + '\n')

    def run(self,
            topic: str,
            ground_truth_url: str = '',
            do_research: bool = True,
            do_generate_outline: bool = True,
            do_generate_article: bool = True,
            do_polish_article: bool = True,
            remove_duplicate: bool = False,
            callback_handler: BaseCallbackHandler = BaseCallbackHandler()):
        """
        Run the STORM pipeline.

        Args:
            topic: The topic to research.
            ground_truth_url: A ground truth URL including a curated article about the topic. The URL will be excluded.
            do_research: If True, research the topic through information-seeking conversation;
             if False, expect conversation_log.json and raw_search_results.json to exist in the output directory.
            do_generate_outline: If True, generate an outline for the topic;
             if False, expect storm_gen_outline.txt to exist in the output directory.
            do_generate_article: If True, generate a curated article for the topic;
             if False, expect storm_gen_article.txt to exist in the output directory.
            do_polish_article: If True, polish the article by adding a summarization section and (optionally) removing
             duplicated content.
            remove_duplicate: If True, remove duplicated content.
            callback_handler: A callback handler to handle the intermediate results.
        """
        self.article_dir_name = topic.replace(' ', '_').replace('/', '_')
        os.makedirs(os.path.join(self.args.output_dir, self.article_dir_name), exist_ok=True)

        conversations, url_to_info = None, None
        if do_research:
            conversations, url_to_info = self._research_topic(topic, ground_truth_url, callback_handler)

        outline = None
        if do_generate_outline:
            if conversations is None:
                conversation_log = load_json(
                    os.path.join(self.args.output_dir, self.article_dir_name, 'conversation_log.json'))
                conversations = [[DialogueTurn(**turn) for turn in item['dlg_turns']] for item in conversation_log]
            outline = self._generate_outline(topic, conversations, callback_handler)

        article = None
        if do_generate_article:
            if url_to_info is None:
                url_to_info = load_json(
                    os.path.join(self.args.output_dir, self.article_dir_name, 'raw_search_results.json'))
            if outline is None:
                outline = load_str(os.path.join(self.args.output_dir, self.article_dir_name, 'storm_gen_outline.txt'))
            article = self._generate_article(topic, outline, url_to_info, callback_handler)

        if do_polish_article:
            if article is None:
                article = load_str(os.path.join(self.args.output_dir, self.article_dir_name, 'storm_gen_article.txt'))
            polished_article = self._polish_article(topic, article, remove_duplicate, callback_handler)
