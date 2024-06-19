import json
import os
from typing import Union, List
from urllib.parse import urlparse

import dspy
import storm_wiki.modules.storm_dataclass as storm_dataclass
from interface import Retriever, Information
from rm import YouRM
from utils import ArticleTextProcessing

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))
with open(os.path.join(SCRIPT_DIR, 'internet_source_restrictions.json')) as f:
    domain_restriction_dict = json.load(f)
    GENERALLY_UNRELIABLE = set(domain_restriction_dict["generally_unreliable"])
    DEPRECATED = set(domain_restriction_dict["deprecated"])
    BLACKLISTED = set(domain_restriction_dict["blacklisted"])


def is_valid_wikipedia_source(url):
    parsed_url = urlparse(url)
    # Check if the URL is from a reliable domain
    combined_set = GENERALLY_UNRELIABLE | DEPRECATED | BLACKLISTED
    for domain in combined_set:
        if domain in parsed_url.netloc:
            return False

    return True


class StormRetriever(Retriever):
    def __init__(self, rm: dspy.Retrieve, k=3):
        super().__init__(search_top_k=k)
        self._rm = rm
        if hasattr(rm, 'is_valid_source'):
            rm.is_valid_source = is_valid_wikipedia_source

    def retrieve(self, query: Union[str, List[str]], exclude_urls: List[str] = []) -> List[Information]:
        retrieved_data_list = self._rm(query_or_queries=query, exclude_urls=exclude_urls)
        for data in retrieved_data_list:
            for i in range(len(data['snippets'])):
                # STORM generate the article with citations. We do not consider multi-hop citations.
                # Remove citations in the source to avoid confusion.
                data['snippets'][i] = ArticleTextProcessing.remove_citations(data['snippets'][i])
        return [storm_dataclass.StormInformation.from_dict(data) for data in retrieved_data_list]
