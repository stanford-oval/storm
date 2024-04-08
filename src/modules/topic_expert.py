import logging
import os
import re
from typing import Union, List
from urllib.parse import urlparse

import requests
from modules.utils import DialogueTurn, limit_word_count_preserve_newline, remove_uncompleted_sentences_with_citations

import dspy

script_dir = os.path.dirname(os.path.abspath(__file__))

class MyYouRM(dspy.Retrieve):
    def __init__(self, ydc_api_key=None, k=3):
        super().__init__(k=k)
        if not ydc_api_key and not os.environ.get("YDC_API_KEY"):
            raise RuntimeError("You must supply ydc_api_key or set environment variable YDC_API_KEY")
        elif ydc_api_key:
            self.ydc_api_key = ydc_api_key
        else:
            self.ydc_api_key = os.environ["YDC_API_KEY"]

        # The Wikipedia standard for sources.
        self.generally_unreliable = None
        self.deprecated = None
        self.blacklisted = None

        self._generate_domain_restriction()

    def _generate_domain_restriction(self):
        """Generate domain restriction from Wikipedia standard."""

        # Load the content of the file
        file_path = os.path.join(script_dir, 'Wikipedia_Reliable sources_Perennial sources - Wikipedia.html')

        with open(file_path, 'r', encoding='utf-8') as file:
            content = file.read()

        # Define the regular expression pattern to find the specified HTML tags
        generally_unreliable = r'<tr class="s-gu" id="[^"]+">|<id="[^"]+" tr class="s-gu" >'
        deprecate = r'<tr class="s-d" id="[^"]+">|<id="[^"]+" tr class="s-d" >'
        blacklist = r'<tr class="s-b" id="[^"]+">|<id="[^"]+" tr class="s-b" >'

        # find instance
        gu = re.findall(generally_unreliable, content)
        d = re.findall(deprecate, content)
        b = re.findall(blacklist, content)

        # extract id
        s_gu = [re.search(r'id="([^"]+)"', match).group(1) for match in gu]
        s_d = [re.search(r'id="([^"]+)"', match).group(1) for match in d]
        s_b = [re.search(r'id="([^"]+)"', match).group(1) for match in b]

        # complete list
        generally_unreliable = [id_str.replace('&#39;', "'") for id_str in s_gu]
        deprecated = [id_str.replace('&#39;', "'") for id_str in s_d]
        blacklisted = [id_str.replace('&#39;', "'") for id_str in s_b]

        # for now, when encountering Fox_News_(politics_and_science), we exclude the entire domain Fox_News and we can later increase the complexity of the rule to distinguish between different cases
        generally_unreliable_f = set(id_str.split('_(')[0] for id_str in generally_unreliable)
        deprecated_f = set(id_str.split('_(')[0] for id_str in deprecated)
        blacklisted_f = set(id_str.split('_(')[0] for id_str in blacklisted)

        self.generally_unreliable = generally_unreliable_f
        self.deprecated = deprecated_f
        self.blacklisted = blacklisted_f

    def is_valid_wikipedia_source(self, url):
        parsed_url = urlparse(url)
        # Check if the URL is from a reliable domain
        combined_set = self.generally_unreliable | self.deprecated | self.blacklisted
        for domain in combined_set:
            if domain in parsed_url.netloc:
                return False

        return True

    def forward(self, query_or_queries: Union[str, List[str]], exclude_urls: List[str]):
        """Search with You.com for self.k top passages for query or queries

        Args:
            query_or_queries (Union[str, List[str]]): The query or queries to search for.
            exclude_urls (List[str]): A list of urls to exclude from the search results.

        Returns:
            a list of Dicts, each dict has keys of 'description', 'snippets' (list of strings), 'title', 'url'
        """
        queries = (
            [query_or_queries]
            if isinstance(query_or_queries, str)
            else query_or_queries
        )
        collected_results = []
        for query in queries:
            try:
                headers = {"X-API-Key": self.ydc_api_key}
                results = requests.get(
                    f"https://api.ydc-index.io/search?query={query}",
                    headers=headers,
                ).json()

                authoritative_results = []
                for r in results['hits']:
                    if self.is_valid_wikipedia_source(r['url']):
                        authoritative_results.append(r)
                if 'hits' in results:
                    collected_results.extend(authoritative_results[:self.k])
            except Exception as e:
                logging.error(f'Error occurs when searching query {query}: {e}')

        if exclude_urls:
            collected_results = [r for r in collected_results if r['url'] not in exclude_urls]

        return collected_results


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
        self.retrieve = MyYouRM(k=search_top_k)
        self.answer_question = dspy.Predict(AnswerQuestion)
        self.engine = engine

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
