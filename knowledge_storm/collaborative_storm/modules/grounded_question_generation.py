"""
This module handles question generation within the Co-STORM framework, specifically designed to support the Moderator role.

The Moderator generates insightful, thought-provoking questions that introduce new directions into the conversation. 
By leveraging uncited or unused snippets of information retrieved during the discussion, the Moderator ensures the conversation remains dynamic and avoids repetitive or overly niche topics.

For more detailed information, refer to Section 3.5 of the Co-STORM paper: https://www.arxiv.org/pdf/2408.15232.
"""

import dspy
from typing import List, Union

from .collaborative_storm_utils import (
    format_search_results,
    extract_and_remove_citations,
    keep_first_and_last_paragraph,
    extract_cited_storm_info,
)
from ...dataclass import ConversationTurn, KnowledgeBase
from ...interface import Information


class KnowledgeBaseSummmary(dspy.Signature):
    """Your job is to give brief summary of what's been discussed in a roundtable conversation. Contents are themantically organized into hierarchical sections.
    You will be presented with these sections where "#" denotes level of section.
    """

    topic = dspy.InputField(prefix="topic: ", format=str)
    structure = dspy.InputField(prefix="Tree structure: \n", format=str)
    output = dspy.OutputField(prefix="Now give brief summary:\n", format=str)


class ConvertUtteranceStyle(dspy.Signature):
    """
    You are an invited speaker in the round table conversation.
    Your task is to make the question or the response more conversational and engaging to facilicate the flow of conversation.
    Note that this is ongoing conversation so no need to have welcoming and concluding words. Previous speaker utterance is provided only for making the conversation more natural.
    Note that do not hallucinate and keep the citation index like [1] as it is. Also,
    """

    expert = dspy.InputField(prefix="You are inivited as: ", format=str)
    action = dspy.InputField(
        prefix="You want to contribute to conversation by: ", format=str
    )
    prev = dspy.InputField(prefix="Previous speaker said: ", format=str)
    content = dspy.InputField(
        prefix="Question or response you want to say: ", format=str
    )
    utterance = dspy.OutputField(
        prefix="Your utterance (keep the information as much as you can with citations, prefer shorter answers without loss of information): ",
        format=str,
    )


class GroundedQuestionGeneration(dspy.Signature):
    """Your job is to find next discussion focus in a roundtable conversation. You will be given previous conversation summary and some information that might assist you discover new discussion focus.
    Note that the new discussion focus should bring new angle and perspective to the discussion and avoid repetition. The new discussion focus should be grounded on the available information and push the boundaries of the current discussion for broader exploration.
    The new discussion focus should have natural flow from last utterance in the conversation.
    Use [1][2] in line to ground your question.
    """

    topic = dspy.InputField(prefix="topic: ", format=str)
    summary = dspy.InputField(prefix="Discussion history: \n", format=str)
    information = dspy.InputField(prefix="Available information: \n", format=str)
    last_utterance = dspy.InputField(
        prefix="Last utterance in the conversation: \n", format=str
    )
    output = dspy.OutputField(
        prefix="Now give next discussion focus in the format of one sentence question:\n",
        format=str,
    )


class GroundedQuestionGenerationModule(dspy.Module):
    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.engine = engine
        self.gen_focus = dspy.Predict(GroundedQuestionGeneration)
        self.polish_style = dspy.Predict(ConvertUtteranceStyle)
        self.gen_summary = dspy.Predict(KnowledgeBaseSummmary)

    def forward(
        self,
        topic: str,
        knowledge_base: KnowledgeBase,
        last_conv_turn: ConversationTurn,
        unused_snippets: List[Information],
    ):
        information, index_to_information_mapping = format_search_results(
            unused_snippets, info_max_num_words=1000
        )
        summary = knowledge_base.get_knowledge_base_summary()
        last_utterance, _ = extract_and_remove_citations(last_conv_turn.utterance)
        with dspy.settings.context(lm=self.engine, show_guidelines=False):
            raw_utterance = self.gen_focus(
                topic=topic,
                summary=summary,
                information=information,
                last_utterance=last_utterance,
            ).output
            utterance = self.polish_style(
                expert="Roundtable conversation moderator",
                action="Raising a new question by natural transit from previous utterance.",
                prev=keep_first_and_last_paragraph(last_utterance),
                content=raw_utterance,
            ).utterance
            cited_searched_results = extract_cited_storm_info(
                response=utterance, index_to_storm_info=index_to_information_mapping
            )
            return dspy.Prediction(
                raw_utterance=raw_utterance,
                utterance=utterance,
                cited_info=cited_searched_results,
            )
