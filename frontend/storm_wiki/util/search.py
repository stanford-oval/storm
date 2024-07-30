import os
import re
import json
import requests
from urllib.parse import urlparse
from typing import Union, List, Dict, Any
import dspy
import streamlit as st
from langchain_community.utilities.duckduckgo_search import DuckDuckGoSearchAPIWrapper
from knowledge_storm.rm import YouRM, BingSearch
from knowledge_storm.utils import load_api_key
from pages_util.Settings import load_search_options

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class WebSearchAPIWrapper(dspy.Retrieve):
    def __init__(self, max_results=3):
        super().__init__()
        self.max_results = max_results
        self.generally_unreliable = set()
        self.deprecated = set()
        self.blacklisted = set()
        self._generate_domain_restriction()

    def _generate_domain_restriction(self):
        try:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            file_path = os.path.join(
                script_dir,
                "Wikipedia_Reliable sources_Perennial sources - Wikipedia.html",
            )

            with open(file_path, "r", encoding="utf-8") as file:
                content = file.read()

            patterns = {
                "generally_unreliable": r'<tr class="s-gu"[^>]*id="([^"]+)"',
                "deprecated": r'<tr class="s-d"[^>]*id="([^"]+)"',
                "blacklisted": r'<tr class="s-b"[^>]*id="([^"]+)"',
            }

            for category, pattern in patterns.items():
                matches = re.findall(pattern, content)
                processed_ids = [id_str.replace("&#39;", "'") for id_str in matches]
                setattr(
                    self,
                    category,
                    set(id_str.split("_(")[0] for id_str in processed_ids),
                )

        except Exception as e:
            logger.error(f"Error in _generate_domain_restriction: {e}")

    def _is_valid_wikipedia_source(self, url):
        if not url:
            return False
        parsed_url = urlparse(url)
        if not parsed_url.netloc:
            return False
        domain = parsed_url.netloc.split(".")[-2]
        combined_set = self.generally_unreliable | self.deprecated | self.blacklisted
        return domain not in combined_set

    def forward(
        self, query_or_queries: Union[str, List[str]], exclude_urls: List[str] = []
    ) -> List[Dict[str, Any]]:
        if not dspy.settings.rm:
            raise ValueError("No RM is loaded. Please load a Retrieval Model first.")
        return super().forward(query_or_queries, exclude_urls=exclude_urls)


class CombinedSearchAPI(WebSearchAPIWrapper):
    def __init__(self, max_results=20):
        super().__init__(max_results)
        self.search_options = load_search_options()
        self.primary_engine = self.search_options["primary_engine"]
        self.fallback_engine = self.search_options["fallback_engine"]
        self.ddg_search = DuckDuckGoSearchAPIWrapper()
        self.searxng_base_url = st.secrets.get(
            "SEARXNG_BASE_URL", "http://localhost:8080"
        )
        self.search_engines = self._initialize_search_engines()

    def _initialize_search_engines(self):
        search_engines = {
            "duckduckgo": self.ddg_search,
            "searxng": self.searxng_base_url,
        }
        if "BING_SEARCH_API_KEY" in st.secrets:
            search_engines["bing"] = BingSearch(
                bing_search_api=st.secrets["BING_SEARCH_API_KEY"], k=self.max_results
            )
        if "YDC_API_KEY" in st.secrets:
            search_engines["yourdm"] = YouRM(
                ydc_api_key=st.secrets["YDC_API_KEY"], k=self.max_results
            )
        return search_engines

    def forward(
        self, query_or_queries: Union[str, List[str]], exclude_urls: List[str] = []
    ) -> List[Dict[str, Any]]:
        queries = (
            [query_or_queries]
            if isinstance(query_or_queries, str)
            else query_or_queries
        )
        all_results = []

        for query in queries:
            results = self._search_with_fallback(query)
            all_results.extend(results)

        filtered_results = [
            r
            for r in all_results
            if r["url"] not in exclude_urls
            and self._is_valid_wikipedia_source(r["url"])
        ]
        ranked_results = sorted(
            filtered_results, key=lambda x: self._calculate_relevance(x), reverse=True
        )
        return ranked_results[: self.max_results]

    def _search_with_fallback(self, query: str) -> List[Dict[str, Any]]:
        try:
            results = self._search(self.primary_engine, query)
        except Exception as e:
            logger.warning(
                f"{self.primary_engine} search failed: {str(e)}. Falling back to {self.fallback_engine}."
            )
            if self.fallback_engine:
                try:
                    results = self._search(self.fallback_engine, query)
                except Exception as e:
                    logger.error(f"{self.fallback_engine} search also failed: {str(e)}")
                    return []
            else:
                logger.error("No fallback search engine specified or available.")
                return []
        return results

    def _search(self, engine: str, query: str) -> List[Dict[str, Any]]:
        if engine not in self.search_engines:
            raise ValueError(f"Unsupported or unavailable search engine: {engine}")

        search_engine = self.search_engines[engine]

        if engine == "duckduckgo":
            results = search_engine.results(query, max_results=self.max_results)
        elif engine in ["bing", "yourdm"]:
            results = search_engine.search(query)
        elif engine == "searxng":
            results = self._search_searxng(query)
        else:
            raise NotImplementedError(f"Search method for {engine} is not implemented")

        logger.info(f"Raw results from {engine}: {results}")

        return self._format_results(engine, results)

    def _search_searxng(self, query: str) -> List[Dict[str, Any]]:
        params = {"q": query, "format": "json"}
        response = requests.get(self.searxng_base_url + "/search", params=params)
        if response.status_code != 200:
            raise Exception(
                f"SearxNG search failed with status code {response.status_code}"
            )

        search_results = response.json()
        if search_results.get("error"):
            raise Exception(f"SearxNG search error: {search_results['error']}")

        return search_results.get("results", [])

    def _format_results(
        self, engine: str, results: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        formatted_results = []
        for result in results:
            if engine in ["bing", "yourdm", "duckduckgo"]:
                link_key, snippet_key = "link", "snippet"
            elif engine == "searxng":
                link_key, snippet_key = "url", "content"
            else:
                raise ValueError(f"Unsupported engine: {engine}")

            snippet = result.get(snippet_key, "No snippet available")
            formatted_result = {
                "title": result.get("title", ""),
                "url": result.get(link_key, ""),
                "snippets": [snippet],
                "description": snippet,
            }
            formatted_results.append(formatted_result)

        return formatted_results

    def _calculate_relevance(self, result: Dict[str, Any]) -> float:
        relevance = 0.0
        if "wikipedia.org" in result["url"]:
            relevance += 1.0
        relevance += len(result.get("snippet", "")) / 1000
        return relevance
