import logging
import os
from typing import Callable, Union, List

import backoff
import dspy
import requests
from dsp import backoff_hdlr, giveup_hdlr

from .utils import WebPageHelper


class YouRM(dspy.Retrieve):
    def __init__(self, ydc_api_key=None, k=3, is_valid_source: Callable = None):
        super().__init__(k=k)
        if not ydc_api_key and not os.environ.get("YDC_API_KEY"):
            raise RuntimeError(
                "You must supply ydc_api_key or set environment variable YDC_API_KEY"
            )
        elif ydc_api_key:
            self.ydc_api_key = ydc_api_key
        else:
            self.ydc_api_key = os.environ["YDC_API_KEY"]
        self.usage = 0

        # If not None, is_valid_source shall be a function that takes a URL and returns a boolean.
        if is_valid_source:
            self.is_valid_source = is_valid_source
        else:
            self.is_valid_source = lambda x: True

    def get_usage_and_reset(self):
        usage = self.usage
        self.usage = 0

        return {"YouRM": usage}

    def forward(
        self, query_or_queries: Union[str, List[str]], exclude_urls: List[str] = []
    ):
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
        self.usage += len(queries)
        collected_results = []
        for query in queries:
            try:
                headers = {"X-API-Key": self.ydc_api_key}
                results = requests.get(
                    f"https://api.ydc-index.io/search?query={query}",
                    headers=headers,
                ).json()

                authoritative_results = []
                for r in results["hits"]:
                    if self.is_valid_source(r["url"]) and r["url"] not in exclude_urls:
                        authoritative_results.append(r)
                if "hits" in results:
                    collected_results.extend(authoritative_results[: self.k])
            except Exception as e:
                logging.error(f"Error occurs when searching query {query}: {e}")

        return collected_results


class BingSearch(dspy.Retrieve):
    def __init__(
        self,
        bing_search_api_key=None,
        k=3,
        is_valid_source: Callable = None,
        min_char_count: int = 150,
        snippet_chunk_size: int = 1000,
        webpage_helper_max_threads=10,
        mkt="en-US",
        language="en",
        **kwargs,
    ):
        """
        Params:
            min_char_count: Minimum character count for the article to be considered valid.
            snippet_chunk_size: Maximum character count for each snippet.
            webpage_helper_max_threads: Maximum number of threads to use for webpage helper.
            mkt, language, **kwargs: Bing search API parameters.
            - Reference: https://learn.microsoft.com/en-us/bing/search-apis/bing-web-search/reference/query-parameters
        """
        super().__init__(k=k)
        if not bing_search_api_key and not os.environ.get("BING_SEARCH_API_KEY"):
            raise RuntimeError(
                "You must supply bing_search_subscription_key or set environment variable BING_SEARCH_API_KEY"
            )
        elif bing_search_api_key:
            self.bing_api_key = bing_search_api_key
        else:
            self.bing_api_key = os.environ["BING_SEARCH_API_KEY"]
        self.endpoint = "https://api.bing.microsoft.com/v7.0/search"
        self.params = {"mkt": mkt, "setLang": language, "count": k, **kwargs}
        self.webpage_helper = WebPageHelper(
            min_char_count=min_char_count,
            snippet_chunk_size=snippet_chunk_size,
            max_thread_num=webpage_helper_max_threads,
        )
        self.usage = 0

        # If not None, is_valid_source shall be a function that takes a URL and returns a boolean.
        if is_valid_source:
            self.is_valid_source = is_valid_source
        else:
            self.is_valid_source = lambda x: True

    def get_usage_and_reset(self):
        usage = self.usage
        self.usage = 0

        return {"BingSearch": usage}

    def forward(
        self, query_or_queries: Union[str, List[str]], exclude_urls: List[str] = []
    ):
        """Search with Bing for self.k top passages for query or queries

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
        self.usage += len(queries)

        url_to_results = {}

        headers = {"Ocp-Apim-Subscription-Key": self.bing_api_key}

        for query in queries:
            try:
                results = requests.get(
                    self.endpoint, headers=headers, params={**self.params, "q": query}
                ).json()

                for d in results["webPages"]["value"]:
                    if self.is_valid_source(d["url"]) and d["url"] not in exclude_urls:
                        url_to_results[d["url"]] = {
                            "url": d["url"],
                            "title": d["name"],
                            "description": d["snippet"],
                        }
            except Exception as e:
                logging.error(f"Error occurs when searching query {query}: {e}")

        valid_url_to_snippets = self.webpage_helper.urls_to_snippets(
            list(url_to_results.keys())
        )
        collected_results = []
        for url in valid_url_to_snippets:
            r = url_to_results[url]
            r["snippets"] = valid_url_to_snippets[url]["snippets"]
            collected_results.append(r)

        return collected_results


class VectorRM(dspy.Retrieve):
    """Retrieve information from custom documents using Qdrant.

    To be compatible with STORM, the custom documents should have the following fields:
        - content: The main text content of the document.
        - title: The title of the document.
        - url: The URL of the document. STORM use url as the unique identifier of the document, so ensure different
            documents have different urls.
        - description (optional): The description of the document.
    The documents should be stored in a CSV file.
    """

    def __init__(
        self,
        collection_name: str,
        embedding_model: str,
        device: str = "mps",
        k: int = 3,
    ):
        from langchain_huggingface import HuggingFaceEmbeddings

        """
        Params:
            collection_name: Name of the Qdrant collection.
            embedding_model: Name of the Hugging Face embedding model.
            device: Device to run the embeddings model on, can be "mps", "cuda", "cpu".
            k: Number of top chunks to retrieve.
        """
        super().__init__(k=k)
        self.usage = 0
        # check if the collection is provided
        if not collection_name:
            raise ValueError("Please provide a collection name.")
        # check if the embedding model is provided
        if not embedding_model:
            raise ValueError("Please provide an embedding model.")

        model_kwargs = {"device": device}
        encode_kwargs = {"normalize_embeddings": True}
        self.model = HuggingFaceEmbeddings(
            model_name=embedding_model,
            model_kwargs=model_kwargs,
            encode_kwargs=encode_kwargs,
        )

        self.collection_name = collection_name
        self.client = None
        self.qdrant = None

    def _check_collection(self):
        from langchain_qdrant import Qdrant

        """
        Check if the Qdrant collection exists and create it if it does not.
        """
        if self.client is None:
            raise ValueError("Qdrant client is not initialized.")
        if self.client.collection_exists(collection_name=f"{self.collection_name}"):
            print(
                f"Collection {self.collection_name} exists. Loading the collection..."
            )
            self.qdrant = Qdrant(
                client=self.client,
                collection_name=self.collection_name,
                embeddings=self.model,
            )
        else:
            raise ValueError(
                f"Collection {self.collection_name} does not exist. Please create the collection first."
            )

    def init_online_vector_db(self, url: str, api_key: str):
        from qdrant_client import QdrantClient

        """
        Initialize the Qdrant client that is connected to an online vector store with the given URL and API key.

        Args:
            url (str): URL of the Qdrant server.
            api_key (str): API key for the Qdrant server.
        """
        if api_key is None:
            if not os.getenv("QDRANT_API_KEY"):
                raise ValueError("Please provide an api key.")
            api_key = os.getenv("QDRANT_API_KEY")
        if url is None:
            raise ValueError("Please provide a url for the Qdrant server.")

        try:
            self.client = QdrantClient(url=url, api_key=api_key)
            self._check_collection()
        except Exception as e:
            raise ValueError(f"Error occurs when connecting to the server: {e}")

    def init_offline_vector_db(self, vector_store_path: str):
        from qdrant_client import QdrantClient

        """
        Initialize the Qdrant client that is connected to an offline vector store with the given vector store folder path.

        Args:
            vector_store_path (str): Path to the vector store.
        """
        if vector_store_path is None:
            raise ValueError("Please provide a folder path.")

        try:
            self.client = QdrantClient(path=vector_store_path)
            self._check_collection()
        except Exception as e:
            raise ValueError(f"Error occurs when loading the vector store: {e}")

    def get_usage_and_reset(self):
        usage = self.usage
        self.usage = 0

        return {"VectorRM": usage}

    def get_vector_count(self):
        """
        Get the count of vectors in the collection.

        Returns:
            int: Number of vectors in the collection.
        """
        return self.qdrant.client.count(collection_name=self.collection_name)

    def forward(self, query_or_queries: Union[str, List[str]], exclude_urls: List[str]):
        """
        Search in your data for self.k top passages for query or queries.

        Args:
            query_or_queries (Union[str, List[str]]): The query or queries to search for.
            exclude_urls (List[str]): Dummy parameter to match the interface. Does not have any effect.

        Returns:
            a list of Dicts, each dict has keys of 'description', 'snippets' (list of strings), 'title', 'url'
        """
        queries = (
            [query_or_queries]
            if isinstance(query_or_queries, str)
            else query_or_queries
        )
        self.usage += len(queries)
        collected_results = []
        for query in queries:
            related_docs = self.qdrant.similarity_search_with_score(query, k=self.k)
            for i in range(len(related_docs)):
                doc = related_docs[i][0]
                collected_results.append(
                    {
                        "description": doc.metadata["description"],
                        "snippets": [doc.page_content],
                        "title": doc.metadata["title"],
                        "url": doc.metadata["url"],
                    }
                )

        return collected_results


class StanfordOvalArxivRM(dspy.Retrieve):
    """[Alpha] This retrieval class is for internal use only, not intended for the public."""

    def __init__(self, endpoint, k=3, rerank=True):
        super().__init__(k=k)
        self.endpoint = endpoint
        self.usage = 0
        self.rerank = rerank

    def get_usage_and_reset(self):
        usage = self.usage
        self.usage = 0

        return {"StanfordOvalArxivRM": usage}

    def _retrieve(self, query: str):
        payload = {"query": query, "num_blocks": self.k, "rerank": self.rerank}

        response = requests.post(
            self.endpoint, json=payload, headers={"Content-Type": "application/json"}
        )

        # Check if the request was successful
        if response.status_code == 200:
            response_data_list = response.json()[0]["results"]
            results = []
            for response_data in response_data_list:
                result = {
                    "title": response_data["document_title"],
                    "url": response_data["url"],
                    "snippets": [response_data["content"]],
                    "description": response_data.get("description", "N/A"),
                    "meta": {
                        key: value
                        for key, value in response_data.items()
                        if key not in ["document_title", "url", "content"]
                    },
                }

                results.append(result)

            return results
        else:
            raise Exception(
                f"Error: Unable to retrieve results. Status code: {response.status_code}"
            )

    def forward(
        self, query_or_queries: Union[str, List[str]], exclude_urls: List[str] = []
    ):
        collected_results = []
        queries = (
            [query_or_queries]
            if isinstance(query_or_queries, str)
            else query_or_queries
        )

        for query in queries:
            try:
                results = self._retrieve(query)
                collected_results.extend(results)
            except Exception as e:
                logging.error(f"Error occurs when searching query {query}: {e}")
        return collected_results


class SerperRM(dspy.Retrieve):
    """Retrieve information from custom queries using Serper.dev."""

    def __init__(
        self,
        serper_search_api_key=None,
        k=3,
        query_params=None,
        ENABLE_EXTRA_SNIPPET_EXTRACTION=False,
        min_char_count: int = 150,
        snippet_chunk_size: int = 1000,
        webpage_helper_max_threads=10,
    ):
        """Args:
        serper_search_api_key str: API key to run serper, can be found by creating an account on https://serper.dev/
        query_params (dict or list of dict): parameters in dictionary or list of dictionaries that has a max size of 100 that will be used to query.
            Commonly used fields are as follows (see more information in https://serper.dev/playground):
                q str: query that will be used with google search
                type str: type that will be used for browsing google. Types are search, images, video, maps, places, etc.
                gl str: Country that will be focused on for the search
                location str: Country where the search will originate from. All locates can be found here: https://api.serper.dev/locations.
                autocorrect bool: Enable autocorrect on the queries while searching, if query is misspelled, will be updated.
                results int: Max number of results per page.
                page int: Max number of pages per call.
                tbs str: date time range, automatically set to any time by default.
                qdr:h str: Date time range for the past hour.
                qdr:d str: Date time range for the past 24 hours.
                qdr:w str: Date time range for past week.
                qdr:m str: Date time range for past month.
                qdr:y str: Date time range for past year.
        """
        super().__init__(k=k)
        self.usage = 0
        self.query_params = None
        self.ENABLE_EXTRA_SNIPPET_EXTRACTION = ENABLE_EXTRA_SNIPPET_EXTRACTION
        self.webpage_helper = WebPageHelper(
            min_char_count=min_char_count,
            snippet_chunk_size=snippet_chunk_size,
            max_thread_num=webpage_helper_max_threads,
        )

        if query_params is None:
            self.query_params = {"num": k, "autocorrect": True, "page": 1}
        else:
            self.query_params = query_params
            self.query_params.update({"num": k})
        self.serper_search_api_key = serper_search_api_key
        if not self.serper_search_api_key and not os.environ.get("SERPER_API_KEY"):
            raise RuntimeError(
                "You must supply a serper_search_api_key param or set environment variable SERPER_API_KEY"
            )

        elif self.serper_search_api_key:
            self.serper_search_api_key = serper_search_api_key

        else:
            self.serper_search_api_key = os.environ["SERPER_API_KEY"]

        self.base_url = "https://google.serper.dev"

    def serper_runner(self, query_params):
        self.search_url = f"{self.base_url}/search"

        headers = {
            "X-API-KEY": self.serper_search_api_key,
            "Content-Type": "application/json",
        }

        response = requests.request(
            "POST", self.search_url, headers=headers, json=query_params
        )

        if response == None:
            raise RuntimeError(
                f"Error had occurred while running the search process.\n Error is {response.reason}, had failed with status code {response.status_code}"
            )

        return response.json()

    def get_usage_and_reset(self):
        usage = self.usage
        self.usage = 0
        return {"SerperRM": usage}

    def forward(self, query_or_queries: Union[str, List[str]], exclude_urls: List[str]):
        """
        Calls the API and searches for the query passed in.


        Args:
            query_or_queries (Union[str, List[str]]): The query or queries to search for.
            exclude_urls (List[str]): Dummy parameter to match the interface. Does not have any effect.

        Returns:
            a list of dictionaries, each dictionary has keys of 'description', 'snippets' (list of strings), 'title', 'url'
        """
        queries = (
            [query_or_queries]
            if isinstance(query_or_queries, str)
            else query_or_queries
        )

        self.usage += len(queries)
        self.results = []
        collected_results = []
        for query in queries:
            if query == "Queries:":
                continue
            query_params = self.query_params

            # All available parameters can be found in the playground: https://serper.dev/playground
            # Sets the json value for query to be the query that is being parsed.
            query_params["q"] = query

            # Sets the type to be search, can be images, video, places, maps etc that Google provides.
            query_params["type"] = "search"

            self.result = self.serper_runner(query_params)
            self.results.append(self.result)

        # Array of dictionaries that will be used by Storm to create the jsons
        collected_results = []

        if self.ENABLE_EXTRA_SNIPPET_EXTRACTION:
            urls = []
            for result in self.results:
                organic_results = result.get("organic", [])
                for organic in organic_results:
                    url = organic.get("link")
                    if url:
                        urls.append(url)
            valid_url_to_snippets = self.webpage_helper.urls_to_snippets(urls)
        else:
            valid_url_to_snippets = {}

        for result in self.results:
            try:
                # An array of dictionaries that contains the snippets, title of the document and url that will be used.
                organic_results = result.get("organic")
                knowledge_graph = result.get("knowledgeGraph")
                for organic in organic_results:
                    snippets = [organic.get("snippet")]
                    if self.ENABLE_EXTRA_SNIPPET_EXTRACTION:
                        snippets.extend(
                            valid_url_to_snippets.get(url, {}).get("snippets", [])
                        )
                    collected_results.append(
                        {
                            "snippets": snippets,
                            "title": organic.get("title"),
                            "url": organic.get("link"),
                            "description": (
                                knowledge_graph.get("description")
                                if knowledge_graph is not None
                                else ""
                            ),
                        }
                    )
            except:
                continue

        return collected_results


class BraveRM(dspy.Retrieve):
    def __init__(
        self, brave_search_api_key=None, k=3, is_valid_source: Callable = None
    ):
        super().__init__(k=k)
        if not brave_search_api_key and not os.environ.get("BRAVE_API_KEY"):
            raise RuntimeError(
                "You must supply brave_search_api_key or set environment variable BRAVE_API_KEY"
            )
        elif brave_search_api_key:
            self.brave_search_api_key = brave_search_api_key
        else:
            self.brave_search_api_key = os.environ["BRAVE_API_KEY"]
        self.usage = 0

        # If not None, is_valid_source shall be a function that takes a URL and returns a boolean.
        if is_valid_source:
            self.is_valid_source = is_valid_source
        else:
            self.is_valid_source = lambda x: True

    def get_usage_and_reset(self):
        usage = self.usage
        self.usage = 0

        return {"BraveRM": usage}

    def forward(
        self, query_or_queries: Union[str, List[str]], exclude_urls: List[str] = []
    ):
        """Search with api.search.brave.com for self.k top passages for query or queries

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
        self.usage += len(queries)
        collected_results = []
        for query in queries:
            try:
                headers = {
                    "Accept": "application/json",
                    "Accept-Encoding": "gzip",
                    "X-Subscription-Token": self.brave_search_api_key,
                }
                response = requests.get(
                    f"https://api.search.brave.com/res/v1/web/search?result_filter=web&q={query}",
                    headers=headers,
                ).json()
                results = response.get("web", {}).get("results", [])

                for result in results:
                    collected_results.append(
                        {
                            "snippets": result.get("extra_snippets", []),
                            "title": result.get("title"),
                            "url": result.get("url"),
                            "description": result.get("description"),
                        }
                    )
            except Exception as e:
                logging.error(f"Error occurs when searching query {query}: {e}")

        return collected_results


class SearXNG(dspy.Retrieve):
    def __init__(
        self,
        searxng_api_url,
        searxng_api_key=None,
        k=3,
        is_valid_source: Callable = None,
    ):
        """Initialize the SearXNG search retriever.
        Please set up SearXNG according to https://docs.searxng.org/index.html.

        Args:
            searxng_api_url (str): The URL of the SearXNG API. Consult SearXNG documentation for details.
            searxng_api_key (str, optional): The API key for the SearXNG API. Defaults to None. Consult SearXNG documentation for details.
            k (int, optional): The number of top passages to retrieve. Defaults to 3.
            is_valid_source (Callable, optional): A function that takes a URL and returns a boolean indicating if the
            source is valid. Defaults to None.
        """
        super().__init__(k=k)
        if not searxng_api_url:
            raise RuntimeError("You must supply searxng_api_url")
        self.searxng_api_url = searxng_api_url
        self.searxng_api_key = searxng_api_key
        self.usage = 0

        if is_valid_source:
            self.is_valid_source = is_valid_source
        else:
            self.is_valid_source = lambda x: True

    def get_usage_and_reset(self):
        usage = self.usage
        self.usage = 0
        return {"SearXNG": usage}

    def forward(
        self, query_or_queries: Union[str, List[str]], exclude_urls: List[str] = []
    ):
        """Search with SearxNG for self.k top passages for query or queries

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
        self.usage += len(queries)
        collected_results = []
        headers = (
            {"Authorization": f"Bearer {self.searxng_api_key}"}
            if self.searxng_api_key
            else {}
        )

        for query in queries:
            try:
                params = {"q": query, "format": "json"}
                response = requests.get(
                    self.searxng_api_url, headers=headers, params=params
                )
                results = response.json()

                for r in results["results"]:
                    if self.is_valid_source(r["url"]) and r["url"] not in exclude_urls:
                        collected_results.append(
                            {
                                "description": r.get("content", ""),
                                "snippets": [r.get("content", "")],
                                "title": r.get("title", ""),
                                "url": r["url"],
                            }
                        )
            except Exception as e:
                logging.error(f"Error occurs when searching query {query}: {e}")

        return collected_results


class DuckDuckGoSearchRM(dspy.Retrieve):
    """Retrieve information from custom queries using DuckDuckGo."""

    def __init__(
        self,
        k: int = 3,
        is_valid_source: Callable = None,
        min_char_count: int = 150,
        snippet_chunk_size: int = 1000,
        webpage_helper_max_threads=10,
        safe_search: str = "On",
        region: str = "us-en",
    ):
        """
        Params:
            min_char_count: Minimum character count for the article to be considered valid.
            snippet_chunk_size: Maximum character count for each snippet.
            webpage_helper_max_threads: Maximum number of threads to use for webpage helper.
            **kwargs: Additional parameters for the OpenAI API.
        """
        super().__init__(k=k)
        try:
            from duckduckgo_search import DDGS
        except ImportError as err:
            raise ImportError(
                "Duckduckgo requires `pip install duckduckgo_search`."
            ) from err
        self.k = k
        self.webpage_helper = WebPageHelper(
            min_char_count=min_char_count,
            snippet_chunk_size=snippet_chunk_size,
            max_thread_num=webpage_helper_max_threads,
        )
        self.usage = 0
        # All params for search can be found here:
        #   https://duckduckgo.com/duckduckgo-help-pages/settings/params/

        # Sets the backend to be api
        self.duck_duck_go_backend = "api"

        # Only gets safe search results
        self.duck_duck_go_safe_search = safe_search

        # Specifies the region that the search will use
        self.duck_duck_go_region = region

        # If not None, is_valid_source shall be a function that takes a URL and returns a boolean.
        if is_valid_source:
            self.is_valid_source = is_valid_source
        else:
            self.is_valid_source = lambda x: True

        # Import the duckduckgo search library found here: https://github.com/deedy5/duckduckgo_search
        self.ddgs = DDGS()

    def get_usage_and_reset(self):
        usage = self.usage
        self.usage = 0
        return {"DuckDuckGoRM": usage}

    @backoff.on_exception(
        backoff.expo,
        (Exception,),
        max_time=1000,
        max_tries=8,
        on_backoff=backoff_hdlr,
        giveup=giveup_hdlr,
    )
    def request(self, query: str):
        results = self.ddgs.text(
            query, max_results=self.k, backend=self.duck_duck_go_backend
        )
        return results

    def forward(
        self, query_or_queries: Union[str, List[str]], exclude_urls: List[str] = []
    ):
        """Search with DuckDuckGoSearch for self.k top passages for query or queries
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
        self.usage += len(queries)

        collected_results = []

        for query in queries:
            #  list of dicts that will be parsed to return
            results = self.request(query)

            for d in results:
                # assert d is dict
                if not isinstance(d, dict):
                    print(f"Invalid result: {d}\n")
                    continue

                try:
                    # ensure keys are present
                    url = d.get("href", None)
                    title = d.get("title", None)
                    description = d.get("description", title)
                    snippets = [d.get("body", None)]

                    # raise exception of missing key(s)
                    if not all([url, title, description, snippets]):
                        raise ValueError(f"Missing key(s) in result: {d}")
                    if self.is_valid_source(url) and url not in exclude_urls:
                        result = {
                            "url": url,
                            "title": title,
                            "description": description,
                            "snippets": snippets,
                        }
                        collected_results.append(result)
                    else:
                        print(f"invalid source {url} or url in exclude_urls")
                except Exception as e:
                    print(f"Error occurs when processing {result=}: {e}\n")
                    print(f"Error occurs when searching query {query}: {e}")

        return collected_results


class TavilySearchRM(dspy.Retrieve):
    """Retrieve information from custom queries using Tavily. Documentation and examples can be found at https://docs.tavily.com/docs/python-sdk/tavily-search/examples"""

    def __init__(
        self,
        tavily_search_api_key=None,
        k: int = 3,
        is_valid_source: Callable = None,
        min_char_count: int = 150,
        snippet_chunk_size: int = 1000,
        webpage_helper_max_threads=10,
        include_raw_content=False,
    ):
        """
        Params:
            tavily_search_api_key str: API key for tavily that can be retrieved from https://tavily.com/
            min_char_count: Minimum character count for the article to be considered valid.
            snippet_chunk_size: Maximum character count for each snippet.
            webpage_helper_max_threads: Maximum number of threads to use for webpage helper.
            include_raw_content bool: Boolean that is used to determine if the full text should be returned.
        """
        super().__init__(k=k)
        try:
            from tavily import TavilyClient
        except ImportError as err:
            raise ImportError("Tavily requires `pip install tavily-python`.") from err

        if not tavily_search_api_key and not os.environ.get("TAVILY_API_KEY"):
            raise RuntimeError(
                "You must supply tavily_search_api_key or set environment variable TAVILY_API_KEY"
            )
        elif tavily_search_api_key:
            self.tavily_search_api_key = tavily_search_api_key
        else:
            self.tavily_search_api_key = os.environ["TAVILY_API_KEY"]

        self.k = k
        self.webpage_helper = WebPageHelper(
            min_char_count=min_char_count,
            snippet_chunk_size=snippet_chunk_size,
            max_thread_num=webpage_helper_max_threads,
        )

        self.usage = 0

        # Creates client instance that will use search. Full search params are here:
        # https://docs.tavily.com/docs/python-sdk/tavily-search/examples
        self.tavily_client = TavilyClient(api_key=self.tavily_search_api_key)

        self.include_raw_content = include_raw_content

        # If not None, is_valid_source shall be a function that takes a URL and returns a boolean.
        if is_valid_source:
            self.is_valid_source = is_valid_source
        else:
            self.is_valid_source = lambda x: True

    def get_usage_and_reset(self):
        usage = self.usage
        self.usage = 0
        return {"TavilySearchRM": usage}

    def forward(
        self, query_or_queries: Union[str, List[str]], exclude_urls: List[str] = []
    ):
        """Search with TavilySearch for self.k top passages for query or queries
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
        self.usage += len(queries)

        collected_results = []

        for query in queries:
            args = {
                "max_results": self.k,
                "include_raw_contents": self.include_raw_content,
            }
            #  list of dicts that will be parsed to return
            responseData = self.tavily_client.search(query)
            results = responseData.get("results")
            for d in results:
                # assert d is dict
                if not isinstance(d, dict):
                    print(f"Invalid result: {d}\n")
                    continue

                try:
                    # ensure keys are present
                    url = d.get("url", None)
                    title = d.get("title", None)
                    description = d.get("content", None)
                    snippets = []
                    if d.get("raw_body_content"):
                        snippets.append(d.get("raw_body_content"))
                    else:
                        snippets.append(d.get("content"))

                    # raise exception of missing key(s)
                    if not all([url, title, description, snippets]):
                        raise ValueError(f"Missing key(s) in result: {d}")
                    if self.is_valid_source(url) and url not in exclude_urls:
                        result = {
                            "url": url,
                            "title": title,
                            "description": description,
                            "snippets": snippets,
                        }
                        collected_results.append(result)
                    else:
                        print(f"invalid source {url} or url in exclude_urls")
                except Exception as e:
                    print(f"Error occurs when processing {result=}: {e}\n")
                    print(f"Error occurs when searching query {query}: {e}")

        return collected_results


class GoogleSearch(dspy.Retrieve):
    def __init__(
        self,
        google_search_api_key=None,
        google_cse_id=None,
        k=3,
        is_valid_source: Callable = None,
        min_char_count: int = 150,
        snippet_chunk_size: int = 1000,
        webpage_helper_max_threads=10,
    ):
        """
        Params:
            google_search_api_key: Google API key. Check out https://developers.google.com/custom-search/v1/overview
                "API key" section
            google_cse_id: Custom search engine ID. Check out https://developers.google.com/custom-search/v1/overview
                "Search engine ID" section
            k: Number of top results to retrieve.
            is_valid_source: Optional function to filter valid sources.
            min_char_count: Minimum character count for the article to be considered valid.
            snippet_chunk_size: Maximum character count for each snippet.
            webpage_helper_max_threads: Maximum number of threads to use for webpage helper.
        """
        super().__init__(k=k)
        try:
            from googleapiclient.discovery import build
        except ImportError as err:
            raise ImportError(
                "GoogleSearch requires `pip install google-api-python-client`."
            ) from err
        if not google_search_api_key and not os.environ.get("GOOGLE_SEARCH_API_KEY"):
            raise RuntimeError(
                "You must supply google_search_api_key or set the GOOGLE_SEARCH_API_KEY environment variable"
            )
        if not google_cse_id and not os.environ.get("GOOGLE_CSE_ID"):
            raise RuntimeError(
                "You must supply google_cse_id or set the GOOGLE_CSE_ID environment variable"
            )

        self.google_search_api_key = (
            google_search_api_key or os.environ["GOOGLE_SEARCH_API_KEY"]
        )
        self.google_cse_id = google_cse_id or os.environ["GOOGLE_CSE_ID"]

        if is_valid_source:
            self.is_valid_source = is_valid_source
        else:
            self.is_valid_source = lambda x: True

        self.service = build(
            "customsearch", "v1", developerKey=self.google_search_api_key
        )
        self.webpage_helper = WebPageHelper(
            min_char_count=min_char_count,
            snippet_chunk_size=snippet_chunk_size,
            max_thread_num=webpage_helper_max_threads,
        )
        self.usage = 0

    def get_usage_and_reset(self):
        usage = self.usage
        self.usage = 0
        return {"GoogleSearch": usage}

    def forward(
        self, query_or_queries: Union[str, List[str]], exclude_urls: List[str] = []
    ):
        """Search using Google Custom Search API for self.k top results for query or queries.

        Args:
            query_or_queries (Union[str, List[str]]): The query or queries to search for.
            exclude_urls (List[str]): A list of URLs to exclude from the search results.

        Returns:
            A list of dicts, each dict has keys: 'title', 'url', 'snippet', 'description'.
        """
        queries = (
            [query_or_queries]
            if isinstance(query_or_queries, str)
            else query_or_queries
        )
        self.usage += len(queries)

        url_to_results = {}

        for query in queries:
            try:
                response = (
                    self.service.cse()
                    .list(
                        q=query,
                        cx=self.google_cse_id,
                        num=self.k,
                    )
                    .execute()
                )

                for item in response.get("items", []):
                    if (
                        self.is_valid_source(item["link"])
                        and item["link"] not in exclude_urls
                    ):
                        url_to_results[item["link"]] = {
                            "title": item["title"],
                            "url": item["link"],
                            # "snippet": item.get("snippet", ""),  # Google search snippet is very short.
                            "description": item.get("snippet", ""),
                        }

            except Exception as e:
                logging.error(f"Error occurred while searching query {query}: {e}")

        valid_url_to_snippets = self.webpage_helper.urls_to_snippets(
            list(url_to_results.keys())
        )
        collected_results = []
        for url in valid_url_to_snippets:
            r = url_to_results[url]
            r["snippets"] = valid_url_to_snippets[url]["snippets"]
            collected_results.append(r)

        return collected_results


class AzureAISearch(dspy.Retrieve):
    """Retrieve information from custom queries using Azure AI Search.

    General Documentation: https://learn.microsoft.com/en-us/azure/search/search-create-service-portal.
    Python Documentation: https://learn.microsoft.com/en-us/python/api/overview/azure/search-documents-readme?view=azure-python.
    """

    def __init__(
        self,
        azure_ai_search_api_key=None,
        azure_ai_search_url=None,
        azure_ai_search_index_name=None,
        k=3,
        is_valid_source: Callable = None,
    ):
        """
        Params:
            azure_ai_search_api_key: Azure AI Search API key. Check out https://learn.microsoft.com/en-us/azure/search/search-security-api-keys?tabs=rest-use%2Cportal-find%2Cportal-query
                "API key" section
            azure_ai_search_url: Custom Azure AI Search Endpoint URL. Check out https://learn.microsoft.com/en-us/azure/search/search-create-service-portal#name-the-service
            azure_ai_search_index_name: Custom Azure AI Search Index Name. Check out https://learn.microsoft.com/en-us/azure/search/search-how-to-create-search-index?tabs=portal
            k: Number of top results to retrieve.
            is_valid_source: Optional function to filter valid sources.
            min_char_count: Minimum character count for the article to be considered valid.
            snippet_chunk_size: Maximum character count for each snippet.
            webpage_helper_max_threads: Maximum number of threads to use for webpage helper.
        """
        super().__init__(k=k)

        try:
            from azure.core.credentials import AzureKeyCredential
            from azure.search.documents import SearchClient
        except ImportError as err:
            raise ImportError(
                "AzureAISearch requires `pip install azure-search-documents`."
            ) from err

        if not azure_ai_search_api_key and not os.environ.get(
            "AZURE_AI_SEARCH_API_KEY"
        ):
            raise RuntimeError(
                "You must supply azure_ai_search_api_key or set environment variable AZURE_AI_SEARCH_API_KEY"
            )
        elif azure_ai_search_api_key:
            self.azure_ai_search_api_key = azure_ai_search_api_key
        else:
            self.azure_ai_search_api_key = os.environ["AZURE_AI_SEARCH_API_KEY"]

        if not azure_ai_search_url and not os.environ.get("AZURE_AI_SEARCH_URL"):
            raise RuntimeError(
                "You must supply azure_ai_search_url or set environment variable AZURE_AI_SEARCH_URL"
            )
        elif azure_ai_search_url:
            self.azure_ai_search_url = azure_ai_search_url
        else:
            self.azure_ai_search_url = os.environ["AZURE_AI_SEARCH_URL"]

        if not azure_ai_search_index_name and not os.environ.get(
            "AZURE_AI_SEARCH_INDEX_NAME"
        ):
            raise RuntimeError(
                "You must supply azure_ai_search_index_name or set environment variable AZURE_AI_SEARCH_INDEX_NAME"
            )
        elif azure_ai_search_index_name:
            self.azure_ai_search_index_name = azure_ai_search_index_name
        else:
            self.azure_ai_search_index_name = os.environ["AZURE_AI_SEARCH_INDEX_NAME"]

        self.usage = 0

        # If not None, is_valid_source shall be a function that takes a URL and returns a boolean.
        if is_valid_source:
            self.is_valid_source = is_valid_source
        else:
            self.is_valid_source = lambda x: True

    def get_usage_and_reset(self):
        usage = self.usage
        self.usage = 0

        return {"AzureAISearch": usage}

    def forward(
        self, query_or_queries: Union[str, List[str]], exclude_urls: List[str] = []
    ):
        """Search with Azure Open AI for self.k top passages for query or queries

        Args:
            query_or_queries (Union[str, List[str]]): The query or queries to search for.
            exclude_urls (List[str]): A list of urls to exclude from the search results.

        Returns:
            a list of Dicts, each dict has keys of 'description', 'snippets' (list of strings), 'title', 'url'
        """
        try:
            from azure.core.credentials import AzureKeyCredential
            from azure.search.documents import SearchClient
        except ImportError as err:
            raise ImportError(
                "AzureAISearch requires `pip install azure-search-documents`."
            ) from err
        queries = (
            [query_or_queries]
            if isinstance(query_or_queries, str)
            else query_or_queries
        )
        self.usage += len(queries)
        collected_results = []

        client = SearchClient(
            self.azure_ai_search_url,
            self.azure_ai_search_index_name,
            AzureKeyCredential(self.azure_ai_search_api_key),
        )
        for query in queries:
            try:
                # https://learn.microsoft.com/en-us/python/api/azure-search-documents/azure.search.documents.searchclient?view=azure-python#azure-search-documents-searchclient-search
                results = client.search(search_text=query, top=1)

                for result in results:
                    document = {
                        "url": result["metadata_storage_path"],
                        "title": result["title"],
                        "description": "N/A",
                        "snippets": [result["chunk"]],
                    }
                    collected_results.append(document)
            except Exception as e:
                logging.error(f"Error occurs when searching query {query}: {e}")

        return collected_results
