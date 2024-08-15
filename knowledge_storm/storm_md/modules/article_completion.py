import re
import dspy
from typing import Union, List, Dict, Optional
from .storm_dataclass import StormArticle
from .callback import BaseCallbackHandler
from ...interface import ArticleCompletionModule, TaskExtractionModule, InformationTable
from ...utils import ArticleTextProcessing


class StormTaskExtractionModule(TaskExtractionModule):
    """
    Module for extracting AI tasks from markdown content.
    """

    def __init__(self, task_extraction_lm: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        super().__init__()
        self.task_extraction_lm = task_extraction_lm

    def extract_tasks(
        self, topic: str, information_table: InformationTable, **kwargs
    ) -> List[Dict[str, str]]:
        """
        Extracts AI tasks from the markdown content.

        Args:
            topic (str): The main topic of interest.
            information_table (InformationTable): Knowledge curation data.
            **kwargs: Additional keyword arguments, including:
                - combined_content (str): The combined markdown content.
                - callback_handler (BaseCallbackHandler): An optional callback handler.

        Returns:
            List[Dict[str, str]]: A list of dictionaries containing task information.
        """
        combined_content = kwargs.get("combined_content", "")
        callback_handler = kwargs.get("callback_handler")

        if callback_handler is not None:
            callback_handler.on_task_extraction_start()

        extracted_tasks = []
        tasks = self._extract_tasks_from_text(combined_content)

        for task in tasks:
            extracted_tasks.append(
                {
                    "task": task,
                    "description": f"Complete the task: {task}",
                    "context": combined_content,
                }
            )

        if callback_handler is not None:
            callback_handler.on_task_extraction_end(tasks=extracted_tasks)

        return extracted_tasks

    def _extract_tasks_from_text(self, text: str) -> List[str]:
        """
        Extracts tasks enclosed in double curly brackets from the text.
        """
        return re.findall(r"\{\{([\s\S]+?)\}\}", text)


class StormArticleCompletionModule(ArticleCompletionModule):
    def __init__(
        self,
        article_completion_lm: Union[dspy.dsp.LM, dspy.dsp.HFModel],
    ):
        super().__init__()
        self.article_completion_lm = article_completion_lm
        self.task_completion = CompleteTask(engine=self.article_completion_lm)
        self.task_extraction = StormTaskExtractionModule(task_extraction_lm=article_completion_lm)

    def complete_article(
        self,
        article: StormArticle,
        information_table: InformationTable,
        callback_handler: Optional[BaseCallbackHandler] = None,
    ) -> StormArticle:
        """
        Extract tasks, complete them, and update the article.

        Args:
            article (StormArticle): The article to be completed.
            information_table (InformationTable): Knowledge curation data.
            callback_handler (Optional[BaseCallbackHandler]): An optional callback handler.

        Returns:
            StormArticle: The completed article.
        """
        combined_content = article.to_string()
        tasks = self.task_extraction.extract_tasks(
            topic=article.root.section_name,
            information_table=information_table,
            combined_content=combined_content,
            callback_handler=callback_handler,
        )
        completed_article = self._complete_tasks_and_integrate(article, tasks)
        completed_article.post_processing()
        return completed_article

    def _complete_tasks_and_integrate(
        self, article: StormArticle, tasks: List[Dict[str, str]]
    ) -> StormArticle:
        for task in tasks:
            task_result = self.task_completion(
                task=task["task"],
                description=task["description"],
                context=self._get_context(article, task["task"]),
            )
            self._update_article_content(article, task["task"], task_result.completion)
        return article

    def _get_context(self, article: StormArticle, task: str) -> str:
        # Get the full article content as context
        return article.to_string()

    def _update_article_content(self, article: StormArticle, task: str, completion: str):
        def update_node_content(node):
            if node.content:
                task_placeholder = f"{{{{{task}}}}}"
                if task_placeholder in node.content:
                    # Replace only if the exact task placeholder is found
                    # make sure its wrapped in newlines
                    node.content = node.content.replace(task_placeholder, "\n" + completion + "\n")
            for child in node.children:
                update_node_content(child)

        update_node_content(article.root)


class CompleteTask(dspy.Module):
    """Complete an AI task based on its description and context."""

    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        super().__init__()
        self.complete_task = dspy.Predict(CompleteTaskSignature)
        self.engine = engine

    def forward(self, task: str, description: str, context: str):
        with dspy.settings.context(lm=self.engine):
            result = self.complete_task(task=task, description=description, context=context)
        return dspy.Prediction(completion=result.output)


class CompleteTaskSignature(dspy.Signature):
    """Complete an AI task based on its description and context. Return the completion"""

    task: str = dspy.InputField(prefix="Task to be completed: ")
    description: str = dspy.InputField(prefix="Task description: ")
    context: str = dspy.InputField(prefix="Relevant context: ")
    scratchpad: str = dspy.OutputField(
        prefix="Draft your thought process here. Step by step ensure you have covered everything in the task: "
    )
    output: str = dspy.OutputField(
        prefix="Review the scratchpad and provide the final answer. Return only the text pertinent to the provided task. Avoid outputting input fields, introductions, or wrappers"
    )
