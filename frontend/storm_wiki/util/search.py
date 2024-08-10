import os
import re
import json
import requests
import xml.etree.ElementTree as ET
from urllib.parse import urlparse
from typing import Union, List, Dict, Any
import dspy
import streamlit as st
from langchain_community.utilities.duckduckgo_search import DuckDuckGoSearchAPIWrapper

from pages_util.Settings import load_search_options

import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class CombinedSearchAPI(dspy.Retrieve):
    def __init__(self, max_results=20):
        super().__init__()
        self.max_results = max_results
        self.search_options = load_search_options()
        self.primary_engine = self.search_options["primary_engine"]
        self.fallback_engine = self.search_options["fallback_engine"]
        self.ddg_search = DuckDuckGoSearchAPIWrapper()
        self.searxng_base_url = (
            self.search_options.get("engine_settings", {})
            .get("searxng", {})
            .get("base_url", "http://localhost:8080")
        )
        self.search_engines = self._initialize_search_engines()
        self._initialize_domain_restrictions()

    def _initialize_search_engines(self):
        return {
            "duckduckgo": self._search_duckduckgo,
            "searxng": self._search_searxng,
            "arxiv": self._search_arxiv,
        }

    def _initialize_domain_restrictions(self):
        self.generally_unreliable = set()
        self.deprecated = set()
        self.blacklisted = set()

        try:
            script_dir = os.path.dirname(os.path.abspath(__file__))
            file_path = os.path.join(
                script_dir,
                "Wikipedia_Reliable sources_Perennial sources - Wikipedia.html",
            )

            if not os.path.exists(file_path):
                logger.warning(f"File not found: {file_path}")
                return

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
            logger.error(f"Error in _initialize_domain_restrictions: {e}")

    def _is_valid_wikipedia_source(self, url):
        if not url:
            return False
        parsed_url = urlparse(url)
        if not parsed_url.netloc:
            return False
        domain = parsed_url.netloc.split(".")[-2]
        combined_set = self.generally_unreliable | self.deprecated | self.blacklisted
        return (
            domain not in combined_set or "wikipedia.org" in url
        )  # Allow Wikipedia URLs

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

        if filtered_results:
            ranked_results = sorted(
                filtered_results, key=self._calculate_relevance, reverse=True
            )
            return ranked_results[: self.max_results]
        else:
            logger.warning(f"No results found for query: {query_or_queries}")
            return []

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
                    results = []
            else:
                logger.error("No fallback search engine specified or available.")
                results = []

        return results

    def _search(self, engine: str, query: str) -> List[Dict[str, Any]]:
        if engine not in self.search_engines:
            raise ValueError(f"Unsupported or unavailable search engine: {engine}")

        search_engine = self.search_engines[engine]
        results = search_engine(query)

        logger.info(f"Raw results from {engine}: {results}")
        return results

    def _search_duckduckgo(self, query: str) -> List[Dict[str, Any]]:
        ddg_results = self.ddg_search.results(query, max_results=self.max_results)
        return [
            {
                "description": result.get("snippet", ""),
                "snippets": [result.get("snippet", "")],
                "title": result.get("title", ""),
                "url": result.get("link", ""),
            }
            for result in ddg_results
        ]

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

        return [
            {
                "title": result.get("title", ""),
                "url": result.get("url", ""),
                "snippets": [result.get("content", "No content available")],
                "description": result.get("content", "No content available"),
            }
            for result in search_results.get("results", [])
        ]

    def _search_arxiv(self, query: str) -> List[Dict[str, Any]]:
        base_url = "http://export.arxiv.org/api/query"
        params = {
            "search_query": f"all:{query}",
            "start": 0,
            "max_results": self.max_results,
        }

        response = requests.get(base_url, params=params)

        if response.status_code != 200:
            raise Exception(
                f"ArXiv search failed with status code {response.status_code}"
            )

        root = ET.fromstring(response.content)

        results = []
        for entry in root.findall("{http://www.w3.org/2005/Atom}entry"):
            title = entry.find("{http://www.w3.org/2005/Atom}title").text
            summary = entry.find("{http://www.w3.org/2005/Atom}summary").text
            url = entry.find("{http://www.w3.org/2005/Atom}id").text

            results.append(
                {
                    "title": title,
                    "url": url,
                    "snippets": [summary],
                    "description": summary,
                }
            )

        return results

    def _calculate_relevance(self, result: Dict[str, Any]) -> float:
        relevance = 0.0
        if "wikipedia.org" in result["url"]:
            relevance += 1.0
        elif "arxiv.org" in result["url"]:
            relevance += (
                0.8  # Give ArXiv results a slightly lower priority than Wikipedia
            )
        relevance += len(result.get("description", "")) / 1000
        return relevance
