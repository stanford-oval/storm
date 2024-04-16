import logging
import os
import re
from typing import Union, List
from urllib.parse import urlparse

import requests
import dspy
from modules.utils import DialogueTurn, limit_word_count_preserve_newline, remove_uncompleted_sentences_with_citations
from modules.web_search_provider import DuckDuckGoSearchAPI, TavilySearchAPI, YouSearchAPI


script_dir = os.path.dirname(os.path.abspath(__file__))

class QuestionToQuery(dspy.Signature):
    """You want to answer the question using Google search. What do you type in the search box?
        Write the queries you will use in the following format:
        - query 1
        - query 2
        ...
        - query n"""

    topic = dspy.InputField(prefix='Topic you are discussing about: ', format=str)
    question = dspy.InputField(prefix='Question you want to answer: ', format=str)
    queries = dspy.OutputField()


class AnswerQuestion(dspy.Signature):
    """You are an expert who can use information effectively. You are chatting with a Wikipedia writer who wants to write a Wikipedia page on topic you know. You have gathered the related information and will now use the information to form a response.
    Make your response as informative as possible and make sure every sentence is supported by the gathered information."""

    topic = dspy.InputField(prefix='Topic you are discussing about:', format=str)
    conv = dspy.InputField(prefix='Question:\n', format=str)
    info = dspy.InputField(
        prefix='Gathered information:\n', format=str)
    answer = dspy.OutputField(
        prefix='Now give your response. (Try to use as many different sources as possible and add do not hallucinate.)\n')


class TopicExpert(dspy.Module):
    """Answer questions using search-based retrieval and answer generation. This module conducts the following steps:
    1. Generate queries from the question.
    2. Search for information using the queries.
    3. Filter out unreliable sources.
    4. Generate an answer using the retrieved information.
    """

    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel],
                 search_top_k):
        super().__init__()
        self.generate_queries = dspy.Predict(QuestionToQuery)
        self.answer_question = dspy.Predict(AnswerQuestion)
        self.engine = engine
        
        web_search_api = os.environ.get("WEB_SEARCH_API")
        if not web_search_api:
            raise RuntimeError("You must set environment variable WEB_SEARCH_API")
        
        if web_search_api == "DuckDuckGoSearchAPI":
            self.retrieve = DuckDuckGoSearchAPI(max_results=search_top_k, use_snippet=False, timeout=120)
        elif web_search_api == "TavilySearchAPI":
            self.retrieve = TavilySearchAPI(max_results=search_top_k, use_snippet=False, timeout=120)
        elif web_search_api == "YouSearchAPI":
            self.retrieve = YouSearchAPI(max_results=search_top_k)
        else:
            raise NotImplementedError(f"Except WEB_SEARCH_API as one of ['DuckDuckGoSearchAPI', 'TavilySearchAPI', 'YouSearchAPI'], but got {web_search_api} instead.")
            

    def forward(self, topic: str, question: str, ground_truth_url: str):
        with dspy.settings.context(lm=self.engine):
            # Identify: Break down question into queries.
            queries = self.generate_queries(topic=topic, question=question).queries
            queries = [q.replace('-', '').strip().strip('"').strip('"').strip() for q in queries.split('\n')][:5]
            # Search
            searched_results = self.retrieve(list(set(queries)), exclude_urls=[ground_truth_url])
            if len(searched_results) > 0:
                # Evaluate: Simplify this part by directly using the top 1 snippet.
                info = ''
                for n, r in enumerate(searched_results):
                    info += '\n'.join(f'[{n + 1}]: {s}' for s in r['snippets'][:1])
                    info += '\n\n'

                info = limit_word_count_preserve_newline(info, 1000)

                try:
                    answer = self.answer_question(topic=topic, conv=question, info=info).answer
                    answer = remove_uncompleted_sentences_with_citations(answer)
                except Exception as e:
                    logging.error(f'Error occurs when generating answer: {e}')
                    answer = 'Sorry, I cannot answer this question. Please ask another question.'
            else:
                # When no information is found, the expert shouldn't hallucinate.
                answer = 'Sorry, I cannot find information for this question. Please ask another question.'

        return dspy.Prediction(queries=queries, searched_results=searched_results, answer=answer)
