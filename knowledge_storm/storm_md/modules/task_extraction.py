from typing import Union, Dict, List, OrderedDict
import re
import dspy
from typing import Optional
from .callback import BaseCallbackHandler
from ...interface import TaskExtractionModule, InformationTable


class StormTaskExtractionModule(TaskExtractionModule):
    """
    Module for extracting AI tasks from markdown content.
    """

    def __init__(self, task_extraction_lm: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        super().__init__()

    def extract_tasks(
        self, topic: str, information_table: InformationTable, **kwargs
    ) -> List[Dict[str, str]]:
        """
        Extracts AI tasks from the markdown content.

        Args:
            topic (str): The main topic of interest.
            information_table (InformationTable): Knowledge curation data.
            **kwargs: Additional keyword arguments, including:
                - combined_content (OrderedDict[str, Dict]): An OrderedDict containing the markdown content.
                - callback_handler (BaseCallbackHandler): An optional callback handler.

        Returns:
            List[Dict[str, str]]: A list of dictionaries containing task information.
        """
        combined_content = kwargs.get("combined_content", dict())
        callback_handler = kwargs.get("callback_handler")

        if callback_handler is not None:
            callback_handler.on_task_extraction_start()

        # Create a collapsed plain text version of the full markdown content
        # combined_content = self._combine_markdown_content(markdown_content)
        # combined_content = "\n\n".join(markdown_content.values())

        extracted_tasks = []
        tasks = self._extract_tasks_from_text(combined_content)

        for task in tasks:
            extracted_tasks.append(
                {
                    "task": task,
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
        return re.findall(r"\{\{(.+?)\}\}", text)
