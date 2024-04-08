"""Write Wikipedia page by simulating conversations to explore the topic."""
import logging
from typing import List, Union, Optional

import dspy
import numpy as np
from modules.topic_expert import TopicExpert
from modules.utils import (DialogueTurn, BaseCallbackHandler, remove_citations, limit_word_count_preserve_newline,
                           clean_up_section, clean_up_outline)
from modules.wiki_writer import GeneralWikiWriter, WikiWriterWithPersona
from sentence_transformers import SentenceTransformer
from sklearn.metrics.pairwise import cosine_similarity


# Simulate conversation.
class GeneralConvSimulator(dspy.Module):
    """Simulate a conversation between a general Wikipedia writer and an expert."""

    def __init__(self, topic_expert_engine: Union[dspy.dsp.LM, dspy.dsp.HFModel],
                 question_asker_engine: Union[dspy.dsp.LM, dspy.dsp.HFModel], search_top_k, max_turn):
        super().__init__()
        self.wiki_writer = GeneralWikiWriter(engine=question_asker_engine)
        self.topic_expert = TopicExpert(engine=topic_expert_engine, search_top_k=search_top_k)
        self.max_turn = max_turn

    def forward(self, topic: str, ground_truth_url: str, callback_handler: BaseCallbackHandler):
        """
        topic: The topic to research.
        ground_truth_url: The ground_truth_url will be excluded from search to avoid ground truth leakage in evaluation.
        """
        dlg_history: List[DialogueTurn] = []
        for _ in range(self.max_turn):
            user_utterance = self.wiki_writer(topic=topic, dialogue_turns=dlg_history).question
            if user_utterance == '':
                logging.error('Simulated Wikipedia writer utterance is empty.')
                break
            if user_utterance.startswith('Thank you so much for your help!'):
                break
            expert_output = self.topic_expert(topic=topic, question=user_utterance, ground_truth_url=ground_truth_url)
            dlg_turn = DialogueTurn(
                agent_utterance=expert_output.answer,
                user_utterance=user_utterance,
                search_queries=expert_output.queries,
                search_results=expert_output.searched_results
            )
            dlg_history.append(dlg_turn)
            callback_handler.on_dialogue_turn_end(dlg_turn=dlg_turn)

        return dspy.Prediction(dlg_history=dlg_history)


class PersonaConvSimulator(dspy.Module):
    """Simulate a conversation between a Wikipedia writer with specific persona and an expert."""

    def __init__(self, topic_expert_engine: Union[dspy.dsp.LM, dspy.dsp.HFModel],
                 question_asker_engine: Union[dspy.dsp.LM, dspy.dsp.HFModel], search_top_k, max_turn):
        super().__init__()
        self.wiki_writer = WikiWriterWithPersona(engine=question_asker_engine)
        self.topic_expert = TopicExpert(engine=topic_expert_engine, search_top_k=search_top_k)
        self.max_turn = max_turn

    def forward(self, topic: str, persona: str, ground_truth_url: str, callback_handler: BaseCallbackHandler):
        """
        topic: The topic to research.
        persona: The persona of the Wikipedia writer.
        ground_truth_url: The ground_truth_url will be excluded from search to avoid ground truth leakage in evaluation.
        """
        dlg_history: List[DialogueTurn] = []
        for _ in range(self.max_turn):
            user_utterance = self.wiki_writer(topic=topic, persona=persona, dialogue_turns=dlg_history).question
            if user_utterance == '':
                logging.error('Simulated Wikipedia writer utterance is empty.')
                break
            if user_utterance.startswith('Thank you so much for your help!'):
                break
            expert_output = self.topic_expert(topic=topic, question=user_utterance, ground_truth_url=ground_truth_url)
            dlg_turn = DialogueTurn(
                agent_utterance=expert_output.answer,
                user_utterance=user_utterance,
                search_queries=expert_output.queries,
                search_results=expert_output.searched_results
            )
            dlg_history.append(dlg_turn)
            callback_handler.on_dialogue_turn_end(dlg_turn=dlg_turn)

        return dspy.Prediction(dlg_history=dlg_history)


class UserGuidedQuestionAnswerModule(dspy.Module):
    """Answer user-provided question."""

    def __init__(self, topic_expert_engine: Union[dspy.dsp.LM, dspy.dsp.HFModel], search_top_k):
        super().__init__()
        self.topic_expert = TopicExpert(engine=topic_expert_engine, search_top_k=search_top_k)

    def forward(self, topic: str, user_utterance: str, ground_truth_url: str):
        """
        topic: The topic to write.
        user_utterance: The user-provided question.
        ground_truth_url: The ground_truth_url will be excluded from search to avoid ground truth leakage in evaluation.
        """
        dlg_history: List[DialogueTurn] = []

        expert_output = self.topic_expert(topic=topic, question=user_utterance, ground_truth_url=ground_truth_url)
        dlg_turn = DialogueTurn(
            agent_utterance=expert_output.answer,
            user_utterance=user_utterance,
            search_queries=expert_output.queries,
            search_results=expert_output.searched_results
        )

        dlg_history.append(dlg_turn)

        return dspy.Prediction(dlg_history=dlg_history)


# Generate outline.
class WritePageOutline(dspy.Signature):
    """Write an outline for a Wikipedia page.
        Here is the format of your writing:
        1. Use "#" Title" to indicate section title, "##" Title" to indicate subsection title, "###" Title" to indicate subsubsection title, and so on.
        2. Do not include other information.
    """

    topic = dspy.InputField(prefix="The topic you want to write: ", format=str)
    outline = dspy.OutputField(prefix="Write the Wikipedia page outline:\n")


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
    """

    topic = dspy.InputField(prefix="The topic you want to write: ", format=str)
    conv = dspy.InputField(prefix="Conversation history:\n", format=str)
    old_outline = dspy.OutputField(prefix="Current outline:\n", format=str)
    outline = dspy.OutputField(
        prefix='Write the Wikipedia page outline (Use "#" Title" to indicate section title, "##" Title" to indication subsection title, ...):\n')


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
        conv = remove_citations(conv)
        conv = limit_word_count_preserve_newline(conv, 5000)

        with dspy.settings.context(lm=self.engine):
            if old_outline is None:
                old_outline = clean_up_outline(self.draft_page_outline(topic=topic).outline)
                if callback_handler:
                    callback_handler.on_direct_outline_generation_end(outline=old_outline)
            outline = clean_up_outline(self.write_page_outline(topic=topic, old_outline=old_outline, conv=conv).outline)
            if callback_handler:
                callback_handler.on_outline_refinement_end(outline=outline)

        return dspy.Prediction(outline=outline, old_outline=old_outline)


# Generate article.
class WriteSection(dspy.Signature):
    """Write a Wikipedia section based on the collected information.

        Here is the format of your writing:
            1. Use "#" Title" to indicate section title, "##" Title" to indicate subsection title, "###" Title" to indicate subsubsection title, and so on.
            2. Use [1], [2], ..., [n] in line (for example, "The capital of the United States is Washington, D.C.[1][3]."). You DO NOT need to include a References or Sources section to list the sources at the end.
    """

    info = dspy.InputField(prefix="The collected information:\n", format=str)
    topic = dspy.InputField(prefix="The topic of the page: ", format=str)
    section = dspy.InputField(prefix="The section you need to write: ", format=str)
    output = dspy.OutputField(
        prefix="Write the section with proper inline citations (Start your writing with # section title. Don't include the page tile or try to write other sections):\n")


class SearchCollectedInfo:
    def __init__(self, collected_urls, collected_snippets, search_top_k):
        self.encoder = SentenceTransformer('paraphrase-MiniLM-L6-v2')
        self.collected_urls = collected_urls
        self.collected_snippets = collected_snippets
        self.encoded_snippets = self.encoder.encode(self.collected_snippets, show_progress_bar=False)
        self.search_top_k = search_top_k

    def search(self, queries: Union[List[str], str]):
        selected_urls = []
        selected_snippets = []
        if type(queries) is str:
            queries = [queries]
        for query in queries:
            encoded_query = self.encoder.encode(query, show_progress_bar=False)
            sim = cosine_similarity([encoded_query], self.encoded_snippets)[0]
            sorted_indices = np.argsort(sim)
            for i in sorted_indices[-self.search_top_k:][::-1]:
                selected_urls.append(self.collected_urls[i])
                selected_snippets.append(self.collected_snippets[i])

        url_to_snippets = {}
        for url, snippet in zip(selected_urls, selected_snippets):
            if url not in url_to_snippets:
                url_to_snippets[url] = []
            url_to_snippets[url].append(snippet)

        for url in url_to_snippets:
            url_to_snippets[url] = list(set(url_to_snippets[url]))

        return url_to_snippets


class ConvToSection(dspy.Module):
    """Use the information collected from the information-seeking conversation to write a section."""

    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        super().__init__()
        self.write_section = dspy.Predict(WriteSection)
        self.engine = engine

    def forward(self, topic: str, outline: str, section: str, searched_url_to_snippets: dict):
        info = ''
        for n, r in enumerate(searched_url_to_snippets.values()):
            info += f'[{n + 1}]\n' + '\n'.join(r)
            info += '\n\n'

        info = limit_word_count_preserve_newline(info, 1500)

        with dspy.settings.context(lm=self.engine):
            section = clean_up_section(
                self.write_section(topic=topic, info=info, section=section).output)

        return dspy.Prediction(section=section)


class WriteLeadSection(dspy.Signature):
    """Write a lead section for the given Wikipedia page with the following guidelines:
        1. The lead should stand on its own as a concise overview of the article's topic. It should identify the topic, establish context, explain why the topic is notable, and summarize the most important points, including any prominent controversies.
        2. The lead section should be concise and contain no more than four well-composed paragraphs.
        3. The lead section should be carefully sourced as appropriate. Add inline citations (e.g., "Washington, D.C., is the capital of the United States.[1][3].") where necessary."""

    topic = dspy.InputField(prefix="The topic of the page: ", format=str)
    draft_page = dspy.InputField(prefix="The draft page:\n", format=str)
    lead_section = dspy.OutputField(prefix="Write the lead section:\n")


class PolishPage(dspy.Signature):
    """You are a faithful text editor that is good at finding repeated information in the article and deleting them to make sure there is no repetition in the article. You won't delete any non-repeated part in the article. You will keep the inline citations and article structure (indicated by "#", "##", etc.) appropriately. Do your job for the following article."""

    draft_page = dspy.InputField(prefix="The draft article:\n", format=str)
    page = dspy.OutputField(prefix="Your revised article:\n")


class PolishPageModule(dspy.Module):
    def __init__(self, write_lead_engine: Union[dspy.dsp.LM, dspy.dsp.HFModel],
                 polish_engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        super().__init__()
        self.write_lead_engine = write_lead_engine
        self.polish_engine = polish_engine
        self.write_lead = dspy.Predict(WriteLeadSection)
        self.polish_page = dspy.Predict(PolishPage)

    def forward(self, topic: str, draft_page: str, polish_whole_page: bool = True):
        with dspy.settings.context(lm=self.write_lead_engine):
            lead_section = self.write_lead(topic=topic, draft_page=draft_page).lead_section
            if "The lead section:" in lead_section:
                lead_section = lead_section.split("The lead section:")[1].strip()
        if polish_whole_page:
            with dspy.settings.context(lm=self.polish_engine):
                page = self.polish_page(draft_page=draft_page).page
        else:
            page = draft_page

        return dspy.Prediction(lead_section=lead_section, page=page)
