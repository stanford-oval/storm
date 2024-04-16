import logging
import os
import re
import requests
from typing import Union, List
from urllib.parse import urlparse
import dspy
import newspaper
from langchain_community.utilities.duckduckgo_search import DuckDuckGoSearchAPIWrapper
from langchain_community.utilities.tavily_search import TavilySearchAPIWrapper


__all__ = ["DuckDuckGoSearchAPI", "TavilySearchAPI", "YouSearchAPI"]
script_dir = os.path.dirname(os.path.abspath(__file__))

class WebSearchAPIWrapper(dspy.Retrieve):
    def __init__(self, max_results=3):
        super().__init__()
        
        self.max_results = max_results
        
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

    def _is_valid_wikipedia_source(self, url):
        parsed_url = urlparse(url)
        # Check if the URL is from a reliable domain
        combined_set = self.generally_unreliable | self.deprecated | self.blacklisted
        for domain in combined_set:
            if domain in parsed_url.netloc:
                return False

        return True
    
    def forward(self, query_or_queries: Union[str, List[str]], exclude_urls: List[str]) -> List[str]:
        
        pass
        

class DuckDuckGoSearchAPI(WebSearchAPIWrapper):
    
    def __init__(self, max_results=3, use_snippet=False, timeout=120):
        super().__init__(max_results)
        self.retrieve = DuckDuckGoSearchAPIWrapper()
        self.use_snippet = use_snippet
        self.timeout = timeout
    
    def forward(self, query_or_queries: Union[str, List[str]], exclude_urls: List[str]) -> List[str]:
        """Search with https://duckduckgo.com for self.max_results top passages for query or queries

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
                retrieve_results = self.retrieve.results(query, max_results=5, source='text')
                results = []
                for result in retrieve_results:
                    url = result.get('link', '')
                    if self.use_snippet:
                        reference = result.get('snippet', '')
                    else:
                        # To extract the complete content using newspaper
                        article = newspaper.article(url, timeout=self.timeout)
                        reference = article.text or result.get('snippet', '')
                                
                    target_result = {'description': result.get('snippet', ''), 'snippets': [reference], 'title': result.get('title', ''), 'url': url}
                    results.append(target_result)
                    
                collected_results += results[:self.max_results]
                
            except Exception as e:
                logging.error(f'Error occurs when searching query {query}: {e}')
                
        if exclude_urls:
            collected_results = [r for r in collected_results if r['url'] not in exclude_urls]

        return collected_results
    
    
class TavilySearchAPI(WebSearchAPIWrapper):
    
    def __init__(self, tavily_api_key=None, max_results=3, use_snippet=False, timeout=120):
        super().__init__(max_results)
        if not tavily_api_key and not os.environ.get("TAVILY_API_KEY"):
            raise RuntimeError("You must supply tavily_api_key or set environment variable TAVILY_API_KEY")
        elif tavily_api_key:
            self.tavily_api_key = tavily_api_key
        else:
            self.tavily_api_key = os.environ["TAVILY_API_KEY"]
            
        self.retrieve = TavilySearchAPIWrapper(tavily_api_key=self.tavily_api_key)
        self.timeout = timeout
        self.use_snippet = use_snippet
        
    
    def forward(self, query_or_queries: Union[str, List[str]], exclude_urls: List[str]) -> List[str]:
        """Search with https://api.tavily.com for self.max_results top passages for query or queries

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
                raw_search_results = self.retrieve.raw_results(
                    query,
                    max_results=5,
                    search_depth='advanced',
                    include_raw_content=True,
                )
                
                retrieve_results = raw_search_results['results']
                results = []
                for result in retrieve_results:
                    if self.use_snippet:
                        reference = result.get('content', '')
                    else:
                        reference = result.get('raw_content', '')
                    target_result = {'description': result.get('content', ''), 'snippets': [reference], 'title': result.get('title', ''), 'url': result.get('url', '')}
                    results.append(target_result)
                    
                collected_results += results[:self.max_results]
                
            except Exception as e:
                logging.error(f'Error occurs when searching query {query}: {e}')
                
        if exclude_urls:
            collected_results = [r for r in collected_results if r['url'] not in exclude_urls]

        return collected_results
    
        
class YouSearchAPI(WebSearchAPIWrapper):
    def __init__(self, ydc_api_key=None, max_results=3):
        super().__init__(max_results)
        if not ydc_api_key and not os.environ.get("YDC_API_KEY"):
            raise RuntimeError("You must supply ydc_api_key or set environment variable YDC_API_KEY")
        elif ydc_api_key:
            self.ydc_api_key = ydc_api_key
        else:
            self.ydc_api_key = os.environ["YDC_API_KEY"]

    
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

