import logging
import os
import re
from typing import List, Union

import requests
from bs4 import BeautifulSoup
from modules.utils import remove_citations, DialogueTurn, limit_word_count_preserve_newline
from sentence_transformers import SentenceTransformer

import dspy


class FindRelatedTopic(dspy.Signature):
    """I'm writing a Wikipedia page for a topic mentioned below. Please identify and recommend some Wikipedia pages on closely related subjects. I'm looking for examples that provide insights into interesting aspects commonly associated with this topic, or examples that help me understand the typical content and structure included in Wikipedia pages for similar topics.
     Please list the urls in separate lines."""

    topic = dspy.InputField(prefix='Topic of interest:', format=str)
    related_topics = dspy.OutputField()


class GenPersona(dspy.Signature):
    """You need to select a group of Wikipedia editors who will work together to create a comprehensive article on the topic. Each of them represents a different perspective, role, or affiliation related to this topic. You can use other Wikipedia pages of related topics for inspiration. For each editor, add description of what they will focus on.
    Give your answer in the following format: 1. short summary of editor 1: description\n2. short summary of editor 2: description\n...
    """

    topic = dspy.InputField(prefix='Topic of interest:', format=str)
    examples = dspy.InputField(prefix='Wiki page outlines of related topics for inspiration:\n', format=str)
    personas = dspy.OutputField()


def get_wiki_page_title_and_toc(url):
    """Get the main title and table of contents from an url of a Wikipedia page."""

    response = requests.get(url)
    soup = BeautifulSoup(response.content, 'html.parser')

    # Get the main title from the first h1 tag
    main_title = soup.find('h1').text.replace('[edit]', '').strip().replace('\xa0', ' ')

    toc = ""
    levels = []
    excluded_sections = {'Contents', 'See also', 'Notes', 'References', 'External links'}

    # Start processing from h2 to exclude the main title from TOC
    for header in soup.find_all(['h2', 'h3', "h4", "h5", "h6"]):
        level = int(header.name[1])  # Extract the numeric part of the header tag (e.g., '2' from 'h2')
        section_title = header.text.replace('[edit]', '').strip().replace('\xa0', ' ')
        if section_title in excluded_sections:
            continue

        while levels and level <= levels[-1]:
            levels.pop()
        levels.append(level)

        indentation = "  " * (len(levels) - 1)
        toc += f"{indentation}{section_title}\n"

    return main_title, toc.strip()


class CreateWriterWithPersona(dspy.Module):
    """Discover different perspectives of researching the topic by reading Wikipedia pages of related topics."""

    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        super().__init__()
        self.find_related_topic = dspy.ChainOfThought(FindRelatedTopic)
        self.gen_persona = dspy.ChainOfThought(GenPersona)
        self.engine = engine

    def forward(self, topic: str, draft=None):
        with dspy.settings.context(lm=self.engine):
            # Get section names from wiki pages of relevant topics for inspiration.
            related_topics = self.find_related_topic(topic=topic).related_topics
            urls = [s[s.find('http'):] for s in related_topics.split('\n')]
            examples = []
            for url in urls:
                try:
                    title, toc = get_wiki_page_title_and_toc(url)
                    examples.append(f'Title: {title}\nTable of Contents: {toc}')
                except Exception as e:
                    logging.error(f'Error occurs when processing {url}: {e}')
                    continue
            if len(examples) == 0:
                examples.append('N/A')
            gen_persona_output = self.gen_persona(topic=topic, examples='\n----------\n'.join(examples)).personas

        personas = []
        for s in gen_persona_output.split('\n'):
            match = re.search(r'\d+\.\s*(.*)', s)
            if match:
                personas.append(match.group(1))

        sorted_personas = personas

        return dspy.Prediction(personas=personas, raw_personas_output=sorted_personas, related_topics=related_topics)


class AskQuestionWithPersona(dspy.Signature):
    """You are an experienced Wikipedia writer and want to edit a specific page. Besides your identity as a Wikipedia writer, you have specific focus when researching the topic.
    Now, you are chatting with an expert to get information. Ask good questions to get more useful information.
    When you have no more question to ask, say "Thank you so much for your help!" to end the conversation.
    Please only ask a question at a time and don't ask what you have asked before. Your questions should be related to the topic you want to write."""

    topic = dspy.InputField(prefix='Topic you want to write: ', format=str)
    persona = dspy.InputField(prefix='Your persona besides being a Wikipedia writer: ', format=str)
    conv = dspy.InputField(prefix='Conversation history:\n', format=str)
    question = dspy.OutputField()


class WikiWriterWithPersona(dspy.Module):
    """Perspective-guided question asking in conversational setup.

    The asked question will be used to start a next round of information seeking."""

    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        super().__init__()
        self.ask_question = dspy.ChainOfThought(AskQuestionWithPersona)
        self.engine = engine

    def forward(self, topic: str, persona: str, dialogue_turns: List[DialogueTurn], draft_page=None):
        conv = []
        for turn in dialogue_turns[:-4]:
            conv.append(f'You: {turn.user_utterance}\nExpert: Omit the answer here due to space limit.')
        for turn in dialogue_turns[-4:]:
            conv.append(f'You: {turn.user_utterance}\nExpert: {remove_citations(turn.agent_utterance)}')
        conv = '\n'.join(conv)
        conv = conv.strip() or 'N/A'
        conv = limit_word_count_preserve_newline(conv, 2500)

        with dspy.settings.context(lm=self.engine):
            question = self.ask_question(topic=topic, persona=persona, conv=conv).question

        return dspy.Prediction(question=question)


# Below is the implementation of "w/ perspective" for ablation studies.
class AskQuestion(dspy.Signature):
    """You are an experienced Wikipedia writer. You are chatting with an expert to get information for the topic you want to contribute. Ask good questions to get more useful information relevant to the topic.
    When you have no more question to ask, say "Thank you so much for your help!" to end the conversation.
    Please only ask a question at a time and don't ask what you have asked before. Your questions should be related to the topic you want to write."""

    topic = dspy.InputField(prefix='Topic you want to write: ', format=str)
    conv = dspy.InputField(prefix='Conversation history:\n', format=str)
    question = dspy.OutputField()


class GeneralWikiWriter(dspy.Module):
    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        super().__init__()
        self.ask_question = dspy.ChainOfThought(AskQuestion)
        self.engine = engine

    def forward(self, topic: str, dialogue_turns: List[DialogueTurn]):
        conv = []
        for turn in dialogue_turns[:-4]:
            conv.append(f'You: {turn.user_utterance}\nExpert: Omit the answer here due to space limit.')
        for turn in dialogue_turns[-4:]:
            conv.append(f'You: {turn.user_utterance}\nExpert: {remove_citations(turn.agent_utterance)}')
        conv = '\n'.join(conv)
        conv = conv.strip() or 'N/A'
        conv = limit_word_count_preserve_newline(conv, 2500)

        with dspy.settings.context(lm=self.engine):
            question = self.ask_question(topic=topic, conv=conv).question

        return dspy.Prediction(question=question)

