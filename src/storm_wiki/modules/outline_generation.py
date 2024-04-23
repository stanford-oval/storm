from typing import Union, Optional, Tuple

import dspy
from interface import OutlineGenerationModule
from storm_wiki.modules.callback import BaseCallbackHandler
from storm_wiki.modules.storm_dataclass import StormInformationTable, StormArticle
from utils import ArticleTextProcessing


class StormOutlineGenerationModule(OutlineGenerationModule):
    """
    The interface for outline generation stage. Given topic, collected information from knowledge
    curation stage, generate outline for the article.
    """

    def __init__(self,
                 outline_gen_lm: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        super().__init__()
        self.outline_gen_lm = outline_gen_lm
        self.write_outline = WriteOutline(engine=self.outline_gen_lm)

    def generate_outline(self,
                         topic: str,
                         information_table: StormInformationTable,
                         old_outline: Optional[StormArticle] = None,
                         callback_handler: BaseCallbackHandler = None,
                         return_draft_outline=False) -> Union[StormArticle, Tuple[StormArticle, StormArticle]]:
        """
        Generates an outline for an article based on the specified topic and the information
        gathered during the knowledge curation stage. This method can optionally return both the
        final article outline and a draft outline if required.

        Args:
            topic (str): The topic of the article.
            information_table (StormInformationTable): The information table containing the collected information.
            old_outline (Optional[StormArticle]): An optional previous version of the article outline that can 
                be used for reference or comparison. Defaults to None.
            callback_handler (BaseCallbackHandler): An optional callback handler that can be used to trigger 
                custom callbacks at various stages of the outline generation process, such as when the information 
                organization starts. Defaults to None.
            return_draft_outline (bool): A flag indicating whether the method should return both the final article 
                outline and a draft version of the outline. If False, only the final article outline is returned. 
                Defaults to False.

        Returns:
            Union[StormArticle, Tuple[StormArticle, StormArticle]]: Depending on the value of `return_draft_outline`, 
                this method returns either a single `StormArticle` object containing the final outline or a tuple of 
                two  `StormArticle` objects, the first containing the final outline and the second containing the 
                draft outline.
        """
        if callback_handler is not None:
            callback_handler.on_information_organization_start()

        concatenated_dialogue_turns = sum([conv for (_, conv) in information_table.conversations], [])
        result = self.write_outline(topic=topic, dlg_history=concatenated_dialogue_turns,
                                    callback_handler=callback_handler)
        article_with_outline_only = StormArticle.from_outline_str(topic=topic, outline_str=result.outline)
        article_with_draft_outline_only = StormArticle.from_outline_str(topic=topic,
                                                                        outline_str=result.old_outline)
        if not return_draft_outline:
            return article_with_outline_only
        return article_with_outline_only, article_with_draft_outline_only


class WriteOutline(dspy.Module):
    """Generate the outline for the Wikipedia page."""

    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        super().__init__()
        self.draft_page_outline = dspy.Predict(WritePageOutline)
        self.write_page_outline = dspy.Predict(WritePageOutlineFromConv)
        self.engine = engine

    def forward(self, topic: str, dlg_history, old_outline: Optional[str] = None,
                callback_handler: BaseCallbackHandler = None):
        trimmed_dlg_history = []
        for turn in dlg_history:
            if 'topic you' in turn.agent_utterance.lower() or 'topic you' in turn.user_utterance.lower():
                continue
            trimmed_dlg_history.append(turn)
        conv = '\n'.join([f'Wikipedia Writer: {turn.user_utterance}\nExpert: {turn.agent_utterance}' for turn in
                          trimmed_dlg_history])
        conv = ArticleTextProcessing.remove_citations(conv)
        conv = ArticleTextProcessing.limit_word_count_preserve_newline(conv, 5000)

        with dspy.settings.context(lm=self.engine):
            if old_outline is None:
                old_outline = ArticleTextProcessing.clean_up_outline(self.draft_page_outline(topic=topic).outline)
                if callback_handler:
                    callback_handler.on_direct_outline_generation_end(outline=old_outline)
            outline = ArticleTextProcessing.clean_up_outline(
                self.write_page_outline(topic=topic, old_outline=old_outline, conv=conv).outline)
            if callback_handler:
                callback_handler.on_outline_refinement_end(outline=outline)

        return dspy.Prediction(outline=outline, old_outline=old_outline)


class WritePageOutline(dspy.Signature):
    """Write an outline for a Wikipedia page.
        Here is the format of your writing:
        1. Use "#" Title" to indicate section title, "##" Title" to indicate subsection title, "###" Title" to indicate subsubsection title, and so on.
        2. Do not include other information.
        3. Do not include topic name itself in the outline.
    """

    topic = dspy.InputField(prefix="The topic you want to write: ", format=str)
    outline = dspy.OutputField(prefix="Write the Wikipedia page outline:\n", format=str)


class NaiveOutlineGen(dspy.Module):
    """Generate the outline with LLM's parametric knowledge directly."""

    def __init__(self):
        super().__init__()
        self.write_outline = dspy.Predict(WritePageOutline)

    def forward(self, topic: str):
        outline = self.write_outline(topic=topic).outline

        return dspy.Prediction(outline=outline)


class WritePageOutlineFromConv(dspy.Signature):
    """Improve an outline for a Wikipedia page. You already have a draft outline that covers the general information. Now you want to improve it based on the information learned from an information-seeking conversation to make it more informative.
        Here is the format of your writing:
        1. Use "#" Title" to indicate section title, "##" Title" to indicate subsection title, "###" Title" to indicate subsubsection title, and so on.
        2. Do not include other information.
        3. Do not include topic name itself in the outline.
    """

    topic = dspy.InputField(prefix="The topic you want to write: ", format=str)
    conv = dspy.InputField(prefix="Conversation history:\n", format=str)
    old_outline = dspy.OutputField(prefix="Current outline:\n", format=str)
    outline = dspy.OutputField(
        prefix='Write the Wikipedia page outline (Use "#" Title" to indicate section title, "##" Title" to indicate subsection title, ...):\n',
        format=str
    )
