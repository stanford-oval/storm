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
                    url = r['url']
                    if url in url_to_info:
                        url_to_info[url]['snippets'].extend(r['snippets'])
                    else:
                        url_to_info[url] = r
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
            persona_conv_simulator = Persona
