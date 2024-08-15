import concurrent.futures
from collections import OrderedDict
import copy
import logging
import dspy
from concurrent.futures import as_completed
from typing import List, Union, Dict, Optional


from .callback import BaseCallbackHandler
from .storm_dataclass import StormArticle
from ...interface import ArticleGenerationModule
from ...utils import ArticleTextProcessing


class StormArticleGenerationModule(ArticleGenerationModule):
    """
    The interface for article generation stage. Given topic, collected information from
    knowledge curation stage, generated outline from outline generation stage,
    """

    def __init__(
        self,
        article_gen_lm=Union[dspy.dsp.LM, dspy.dsp.HFModel],
        max_thread_num: int = 10,
    ):
        super().__init__()
        self.article_gen_lm = article_gen_lm
        self.max_thread_num = max_thread_num
        self.section_gen = MarkdownToSection(engine=self.article_gen_lm)
        self.task_completion = CompleteTask(engine=self.article_gen_lm)

    def generate_section(self, topic, section_name, markdown_content, section_outline):
        output = self.section_gen(
            topic=topic, outline=section_outline, section=section_name, markdown_content=markdown_content
        )
        return {
            "section_name": section_name,
            "section_content": output.section,
        }

    def generate_article(
        self,
        topic: str,
        markdown_content: Dict[str, str],
        article_with_outline: StormArticle,
        tasks: List[Dict[str, str]],
        callback_handler: BaseCallbackHandler = None,
    ) -> StormArticle:
        """
        Generate article for the topic based on the markdown content, article outline, and extracted tasks.

        Args:
            topic (str): The topic of the article.
            markdown_content (Dict[str, str]): The markdown content containing the article sections.
            article_with_outline (StormArticle): The article with specified outline.
            tasks (List[Dict[str, str]]): A list of dictionaries containing task information.
            callback_handler (BaseCallbackHandler): An optional callback handler that can be used to trigger
                custom callbacks at various stages of the article generation process. Defaults to None.
        """
        if article_with_outline is None:
            article_with_outline = StormArticle(topic_name=topic)

        sections_to_write = article_with_outline.get_first_level_section_names()

        section_output_dict_collection = []
        if len(sections_to_write) == 0:
            logging.error(f"No outline for {topic}. Will directly use the topic.")
            section_output_dict = self.generate_section(
                topic=topic,
                section_name=topic,
                markdown_content="\n\n".join(markdown_content.values()),
                section_outline="",
            )
            section_output_dict_collection = [section_output_dict]
        else:
            with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_thread_num) as executor:
                future_to_sec_title = {}
                for section_title in sections_to_write:
                    if section_title.lower().strip() in ["introduction", "conclusion", "summary"]:
                        continue
                    section_outline = "\n".join(
                        article_with_outline.get_outline_as_list(
                            root_section_name=section_title, add_hashtags=True
                        )
                    )
                    future_to_sec_title[
                        executor.submit(
                            self.generate_section,
                            topic,
                            section_title,
                            self._combine_markdown_content(markdown_content),
                            section_outline,
                        )
                    ] = section_title

                for future in as_completed(future_to_sec_title):
                    section_output_dict_collection.append(future.result())

        article = copy.deepcopy(article_with_outline)
        for section_output_dict in section_output_dict_collection:
            article.update_section(
                parent_section_name=topic,
                current_section_content=section_output_dict["section_content"],
                current_section_info_list=None,
            )

        # Complete tasks and integrate results into the article
        completed_article = self._complete_tasks_and_integrate(article, tasks, callback_handler)

        completed_article.post_processing()
        return completed_article

    def _complete_tasks_and_integrate(self, article, tasks, callback_handler):
        for task in tasks:
            task_result = self.task_completion(
                task=task["task"], description=task["description"], context=task["context"]
            )
            # Integrate task result into the appropriate section
            # This part depends on how you want to structure your article
            # You might need to modify this based on your specific requirements
            for section in article.sections:
                if task["task"] in section.content:
                    section.content = section.content.replace(f"{{{task['task']}}}", task_result.completion)

        return article

    def _combine_markdown_content(self, markdown_content: OrderedDict[str, Dict]) -> str:
        combined = []
        for file_name, content in markdown_content.items():
            file_content = self._flatten_content(content)
            combined.append(f"# {file_name}\n\n{file_content}")
        return "\n\n".join(combined)

    def _flatten_content(self, content: Dict) -> str:
        flattened = ""
        for section, section_content in content.items():
            flattened += f"## {section}\n\n{section_content.get('content', '')}\n\n"
            for subsection, subsection_content in section_content.get("subsections", {}).items():
                flattened += f"### {subsection}\n\n{subsection_content.get('content', '')}\n\n"
        return flattened.strip()


class MarkdownToSection(dspy.Module):
    """Use the markdown content to write a section."""

    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        super().__init__()
        self.write_section = dspy.Predict(WriteSectionFromMarkdown)
        self.engine = engine

    def forward(self, topic: str, outline: str, section: str, markdown_content: str):
        markdown_content = ArticleTextProcessing.limit_word_count_preserve_newline(markdown_content, 1500)

        with dspy.settings.context(lm=self.engine):
            section = ArticleTextProcessing.clean_up_section(
                self.write_section(topic=topic, markdown_content=markdown_content, section=section).output
            )

        return dspy.Prediction(section=section)


class WriteSectionFromMarkdown(dspy.Signature):
    """Write a Wikipedia section based on the provided markdown content.

    Here is the format of your writing:
        1. Use "#" Title" to indicate section title, "##" Title" to indicate subsection title, "###" Title" to indicate subsubsection title, and so on.
        2. You don't need to include citations, as the content is already from reliable sources.
    """

    markdown_content = dspy.InputField(prefix="The markdown content:\n", format=str)
    topic = dspy.InputField(prefix="The topic of the page: ", format=str)
    section = dspy.InputField(prefix="The section you need to write: ", format=str)
    output = dspy.OutputField(
        prefix="Write the section (Start your writing with # section title. Don't include the page title or try to write other sections):\n",
        format=str,
    )


class CompleteTask(dspy.Module):
    """Complete an AI task based on its description and context."""

    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        super().__init__()
        self.complete_task = dspy.Predict(CompleteTaskSignature)
        self.engine = engine

    def forward(self, task: str, description: str, context: str):
        with dspy.settings.context(lm=self.engine):
            result = self.complete_task(task=task, description=description, context=context)
        return dspy.Prediction(completion=result.completion)


class CompleteTaskSignature(dspy.Signature):
    """Complete an AI task based on its description and context. Return the completion"""

    task: str = dspy.InputField(prefix="Task to be completed: ")
    description: str = dspy.InputField(prefix="Task description: ")
    context: str = dspy.InputField(prefix="Relevant context: ")
    completion: str = dspy.OutputField(
        prefix="Complete the task. Return only the text pertinent to the provided task. "
    )
