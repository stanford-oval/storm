import os
import re
import logging
import requests
from urllib.parse import urlparse
from typing import Union, List, Dict, Any

import dspy
from langchain_community.utilities.duckduckgo_search import DuckDuckGoSearchAPIWrapper

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
        """Generate domain restriction from Wikipedia standard."""
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

        except FileNotFoundError:
            logger.warning(
                "Wikipedia sources file not found. Domain restrictions will not be applied."
            )
        except IOError as e:
            logger.error(f"Error reading Wikipedia sources file: {e}")
        except Exception as e:
            logger.error(f"Unexpected error in _generate_domain_restriction: {e}")

    def _is_valid_wikipedia_source(self, url):
        parsed_url = urlparse(url)
        domain = parsed_url.netloc.split(".")[-2]  # Get the domain name
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
        self.ddg_search = DuckDuckGoSearchAPIWrapper()
        self.searxng_base_url = os.getenv("SEARXNG_BASE_URL", "http://localhost:8080")

    def _rank_results(self, results: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        # Implement your ranking logic here
        # For example, you could rank based on the presence of certain keywords,
        # the length of the snippet, or the domain authority of the source
        return sorted(results, key=lambda x: self._calculate_relevance(x), reverse=True)

    def _calculate_relevance(self, result: Dict[str, Any]) -> float:
        # Implement your relevance calculation here
        # This is a simple example; you might want to use more sophisticated methods
        relevance = 0.0
        if "wikipedia.org" in result["url"]:
            relevance += 1.0
        relevance += len(result["snippets"][0]) / 1000  # Favor longer snippets
        return relevance

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
            try:
                # Try DuckDuckGo first
                results = self._search_duckduckgo(query)
            except Exception as e:
                logger.warning(
                    f"DuckDuckGo search failed: {str(e)}. Falling back to SearxNG."
                )
                try:
                    # Fallback to SearxNG
                    results = self._search_searxng(query)
                except Exception as e:
                    logger.error(f"SearxNG search also failed: {str(e)}")
                    results = []

            all_results.extend(results)

        # Filter results
        filtered_results = [
            r
            for r in all_results
            if r["url"] not in exclude_urls
            and self._is_valid_wikipedia_source(r["url"])
        ]

        ranked_results = self._rank_results(filtered_results)
        return ranked_results[: self.max_results]

    def _search_duckduckgo(self, query: str) -> List[Dict[str, Any]]:
        ddg_results = self.ddg_search.results(query, max_results=self.max_results)
        return [
            {
                "description": result.get("snippet", ""),
                "snippets": [result.get("snippet", "")],
                "title": result.get("title", ""),
                "url": result["link"],
            }
            for result in ddg_results
        ]

    def _search_searxng(self, query: str) -> List[Dict[str, Any]]:
        params = {
            "q": query,
            "format": "json",
        }
        response = requests.get(self.searxng_base_url + "/search", params=params)
        if response.status_code != 200:
            raise Exception(
                f"SearxNG search failed with status code {response.status_code}"
            )

        search_results = response.json()
        if search_results.get("error"):
            raise Exception(f"SearxNG search error: {search_results['error']}")

        results = search_results.get("results", [])
        return [
            {
                "description": result.get("content", ""),
                "snippets": [result.get("content", "")],
                "title": result.get("title", ""),
                "url": result["url"],
                "engine": result.get("engine", ""),
                "score": result.get("score", 0),
            }
            for result in results[: self.max_results]
        ]
