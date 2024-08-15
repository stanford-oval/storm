import json
import logging
import os
from dataclasses import dataclass, field
from typing import Union, Literal, Optional, Dict, List, Tuple
from collections import OrderedDict
import dspy

from .modules.article_generation import StormArticleGenerationModule
from .modules.article_polish import StormArticlePolishingModule
from .modules.callback import BaseCallbackHandler
from .modules.outline_generation import StormOutlineGenerationModule
from .modules.storm_dataclass import StormArticle
from .modules.article_completion import StormArticleCompletionModule
from ..interface import Engine, LMConfigs, InformationTable
from ..lm import OpenAIModel
from ..utils import FileIOHelper, makeStringRed
from ..utils import ArticleTextProcessing


@dataclass
class MarkdownSTORMRunnerArguments:
    """Arguments for controlling the Markdown STORM pipeline."""

    output_dir: str = field(
        metadata={"help": "Output directory for the results."},
    )
    max_thread_num: int = field(
        default=10,
        metadata={"help": "Maximum number of threads to use for parallel processing."},
    )


class MarkdownSTORMRunner(Engine):
    """Markdown STORM pipeline runner."""

    def __init__(self, args: MarkdownSTORMRunnerArguments, lm_configs: LMConfigs, markdown_folder: str):
        super().__init__(lm_configs=lm_configs)
        self.args = args
        self.lm_configs = lm_configs
        self.markdown_folder = markdown_folder
        self.text_processor = ArticleTextProcessing()

        self.storm_outline_generation_module = StormOutlineGenerationModule(
            outline_gen_lm=self.lm_configs.outline_gen_lm
        )
        self.storm_article_generation = StormArticleGenerationModule(
            article_gen_lm=self.lm_configs.article_gen_lm,
            max_thread_num=self.args.max_thread_num,
        )
        self.storm_article_polishing_module = StormArticlePolishingModule(
            article_gen_lm=self.lm_configs.article_gen_lm, article_polish_lm=self.lm_configs.article_polish_lm
        )
        self.storm_article_completion = StormArticleCompletionModule(
            article_completion_lm=self.lm_configs.article_gen_lm
        )

        self.lm_configs.init_check()
        self.apply_decorators()

    def process_markdown_input(self) -> Dict[str, str]:
        try:
            markdown_files = FileIOHelper.load_markdown_files(self.markdown_folder)
            markdown_content = self.text_processor.combine_markdown_contents(markdown_files)

            # Save the processed information
            FileIOHelper.dump_json(
                markdown_content, os.path.join(self.article_output_dir, "processed_markdown_input.json")
            )
            return markdown_content
        except Exception as e:
            logging.error(f"Error processing markdown input: {str(e)}")
            raise

    def run(
        self,
        topic: str,
        do_process_markdown: bool = True,
        do_generate_outline: bool = True,
        do_generate_article: bool = True,
        do_polish_article: bool = True,
        remove_duplicate: bool = False,
        callback_handler: Optional[BaseCallbackHandler] = None,
    ):
        """
        Run the Markdown STORM pipeline.

        Args:
            topic: The topic to generate content for.
            do_process_markdown: If True, process the markdown files; if False, expect processed_markdown_input.json to exist in the output directory.
            do_generate_outline: If True, generate an outline for the topic; if False, expect storm_gen_outline.txt to exist in the output directory.
            do_generate_article: If True, generate an article for the topic; if False, expect storm_gen_article.txt to exist in the output directory.
            do_polish_article: If True, polish the article by adding a summarization section and (optionally) removing duplicated content.
            remove_duplicate: If True, remove duplicated content during article polishing.
            callback_handler: A callback handler to handle the intermediate results.
        """
        assert (
            do_process_markdown or do_generate_outline or do_generate_article or do_polish_article
        ), makeStringRed(
            "No action is specified. Please set at least one of --do-process-markdown, --do-generate-outline, --do-generate-article, --do-polish-article"
        )

        self.topic = topic
        self.article_dir_name = topic.replace(" ", "_").replace("/", "_")
        self.article_output_dir = os.path.join(self.args.output_dir, self.article_dir_name)
        os.makedirs(self.article_output_dir, exist_ok=True)

        # Process markdown input
        markdown_content: Dict[str, str] = {}

        # Article generation module
        draft_article: Optional[StormArticle] = None
        if do_process_markdown:
            markdown_content = self.process_markdown_input()
            # Generate the initial article structure
            draft_article = StormArticle(topic_name=topic)
            draft_article.insert_or_create_section(article_dict=markdown_content)

        if draft_article is None:
            draft_article = self._load_draft_article_from_local_fs(
                topic=topic,
                draft_article_path=os.path.join(self.article_output_dir, "storm_gen_article_completed.txt"),
                markdown_sources_path=os.path.join(self.article_output_dir, "markdown_sources.json"),
            )

        if do_generate_article:
            draft_article = self.run_article_completion_module(
                draft_article=draft_article,
                information_table=InformationTable,
                callback_handler=callback_handler,
            )

        # Article polishing module
        if do_polish_article:
            self.run_article_polishing_module(draft_article=draft_article, remove_duplicate=remove_duplicate)

        self.post_run()

    def run_outline_generation_module(
        self, markdown_content: Dict[str, str], callback_handler: Optional[BaseCallbackHandler] = None
    ) -> StormArticle:
        outline, draft_outline = self.storm_outline_generation_module.generate_outline(
            topic=self.topic,
            markdown_content=markdown_content,
            return_draft_outline=True,
            callback_handler=callback_handler,
        )
        outline.dump_outline_to_file(os.path.join(self.article_output_dir, "storm_gen_outline.txt"))
        draft_outline.dump_outline_to_file(os.path.join(self.article_output_dir, "direct_gen_outline.txt"))
        return outline

    def run_article_generation_module(
        self,
        outline: StormArticle,
        markdown_content: Dict[str, str],
        callback_handler: Optional[BaseCallbackHandler] = None,
    ) -> StormArticle:
        draft_article = self.storm_article_generation.generate_article(
            topic=self.topic,
            markdown_content=markdown_content,
            article_with_outline=outline,
            callback_handler=callback_handler,
        )
        draft_article.dump_article_as_plain_text(
            os.path.join(self.article_output_dir, "storm_gen_article.txt")
        )
        draft_article.dump_reference_to_file(os.path.join(self.article_output_dir, "markdown_sources.json"))
        return draft_article

    def run_article_completion_module(
        self,
        draft_article: StormArticle,
        information_table: InformationTable,
        callback_handler: Optional[BaseCallbackHandler] = None,
    ) -> StormArticle:
        completed_article = self.storm_article_completion.complete_article(
            article=draft_article,
            information_table=information_table,
            callback_handler=callback_handler,
        )
        completed_article.dump_article_as_plain_text(
            os.path.join(self.article_output_dir, "storm_gen_article_completed.txt")
        )
        return completed_article

    def run_article_polishing_module(
        self, draft_article: StormArticle, remove_duplicate: bool = False
    ) -> StormArticle:
        polished_article = self.storm_article_polishing_module.polish_article(
            topic=self.topic, draft_article=draft_article, remove_duplicate=remove_duplicate
        )
        FileIOHelper.write_str(
            polished_article.to_string(),
            os.path.join(self.article_output_dir, "storm_gen_article_polished.txt"),
        )
        return polished_article

    def _load_outline_from_local_fs(self, topic: str, outline_local_path: str) -> StormArticle:
        assert os.path.exists(outline_local_path), f"{outline_local_path} does not exist."
        return StormArticle.from_outline_file(topic=topic, file_path=outline_local_path)

    def _load_draft_article_from_local_fs(
        self, topic: str, draft_article_path: str, markdown_sources_path: str
    ) -> StormArticle:
        assert os.path.exists(draft_article_path), f"{draft_article_path} does not exist."
        assert os.path.exists(markdown_sources_path), f"{markdown_sources_path} does not exist."
        article_text = FileIOHelper.load_str(draft_article_path)
        references = FileIOHelper.load_json(markdown_sources_path)
        return StormArticle.from_string(topic_name=topic, article_text=article_text, references=references)

    def post_run(self):
        """
        Post-run operations, including:
        1. Dumping the run configuration.
        2. Dumping the LLM call history.
        """
        config_log = self.lm_configs.log()
        FileIOHelper.dump_json(config_log, os.path.join(self.article_output_dir, "run_config.json"))

        llm_call_history = self.lm_configs.collect_and_reset_lm_history()
        with open(os.path.join(self.article_output_dir, "llm_call_history.jsonl"), "w") as f:
            for call in llm_call_history:
                if "kwargs" in call:
                    call.pop("kwargs")  # All kwargs are dumped together to run_config.json.
                f.write(json.dumps(call) + "\n")

    def run_knowledge_curation_module(self, *args, **kwargs):
        # Implement this method or leave it as a pass if not needed
        pass
