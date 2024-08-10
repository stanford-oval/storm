import pytest
from unittest.mock import patch, MagicMock
import streamlit as st
from util.search import CombinedSearchAPI


@pytest.fixture
def mock_file_content():
    return """
    <tr class="s-gu" id="unreliable_source">
    <tr class="s-d" id="deprecated_source">
    <tr class="s-b" id="blacklisted_source">
    """


@pytest.fixture
def mock_load_search_options():
    with patch("util.search.load_search_options") as mock:
        mock.return_value = {
            "primary_engine": "duckduckgo",
            "fallback_engine": None,
            "search_top_k": 3,
            "retrieve_top_k": 3,
        }
        yield mock


@pytest.fixture(scope="session")
def mock_secrets():
    return {"SEARXNG_BASE_URL": "http://localhost:8080"}


@pytest.fixture(autouse=True)
def mock_streamlit_secrets(mock_secrets):
    with patch.object(st, "secrets", mock_secrets):
        yield


class TestCombinedSearchAPI:
    @pytest.fixture
    def combined_search_api(
        self, tmp_path, mock_file_content, mock_load_search_options
    ):
        html_file = (
            tmp_path / "Wikipedia_Reliable sources_Perennial sources - Wikipedia.html"
        )
        html_file.write_text(mock_file_content)
        with patch("os.path.dirname", return_value=str(tmp_path)):
            return CombinedSearchAPI(max_results=3)

    def test_initialization(self, combined_search_api):
        assert combined_search_api.max_results == 3
        assert "unreliable_source" in combined_search_api.generally_unreliable
        assert "deprecated_source" in combined_search_api.deprecated
        assert "blacklisted_source" in combined_search_api.blacklisted

    def test_is_valid_wikipedia_source(self, combined_search_api):
        assert combined_search_api._is_valid_wikipedia_source(
            "https://en.wikipedia.org/wiki/Test"
        )
        assert not combined_search_api._is_valid_wikipedia_source(
            "https://unreliable_source.com"
        )
        assert not combined_search_api._is_valid_wikipedia_source(
            "https://deprecated_source.org"
        )
        assert not combined_search_api._is_valid_wikipedia_source(
            "https://blacklisted_source.net"
        )

    @patch("util.search.DuckDuckGoSearchAPIWrapper")
    @patch("requests.get")
    def test_duckduckgo_failure_searxng_success(
        self, mock_requests_get, mock_ddg_wrapper, combined_search_api
    ):
        combined_search_api.primary_engine = "duckduckgo"
        combined_search_api.fallback_engine = "searxng"

        # Mock DuckDuckGo failure
        mock_ddg_instance = MagicMock()
        mock_ddg_instance.results.side_effect = Exception("DuckDuckGo failed")
        mock_ddg_wrapper.return_value = mock_ddg_instance
        combined_search_api.ddg_search = mock_ddg_instance

        # Mock SearxNG success
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.json.return_value = {
            "results": [
                {
                    "url": "https://en.wikipedia.org/wiki/Example",
                    "content": "Example content",
                    "title": "Example Title",
                }
            ]
        }
        mock_requests_get.return_value = mock_response

        results = combined_search_api.forward("test query", [])

        assert len(results) > 0
        assert results[0]["snippets"][0] == "Example content"
        assert results[0]["title"] == "Example Title"
        assert results[0]["url"] == "https://en.wikipedia.org/wiki/Example"

    @patch("util.search.DuckDuckGoSearchAPIWrapper")
    def test_duckduckgo_success(self, mock_ddg_wrapper, combined_search_api):
        combined_search_api.primary_engine = "duckduckgo"
        mock_ddg_instance = MagicMock()
        mock_ddg_instance.results.return_value = [
            {
                "link": "https://en.wikipedia.org/wiki/Example",
                "snippet": "Example snippet",
                "title": "Example Title",
            }
        ]
        mock_ddg_wrapper.return_value = mock_ddg_instance
        combined_search_api.ddg_search = mock_ddg_instance

        results = combined_search_api.forward("test query", [])
        assert len(results) > 0
        assert results[0]["snippets"][0] == "Example snippet"
        assert results[0]["title"] == "Example Title"
        assert results[0]["url"] == "https://en.wikipedia.org/wiki/Example"

    @patch("util.search.DuckDuckGoSearchAPIWrapper")
    def test_multiple_queries(self, mock_ddg_wrapper, combined_search_api):
        combined_search_api.primary_engine = "duckduckgo"
        mock_ddg_instance = MagicMock()
        mock_ddg_instance.results.side_effect = [
            [
                {
                    "link": "https://en.wikipedia.org/wiki/Example1",
                    "snippet": "Example 1",
                    "title": "Title 1",
                }
            ],
            [
                {
                    "link": "https://en.wikipedia.org/wiki/Example2",
                    "snippet": "Example 2",
                    "title": "Title 2",
                }
            ],
        ]
        mock_ddg_wrapper.return_value = mock_ddg_instance
        combined_search_api.ddg_search = mock_ddg_instance

        results = combined_search_api.forward(["query1", "query2"], [])
        assert len(results) >= 2
        assert results[0]["url"] == "https://en.wikipedia.org/wiki/Example1"
        assert results[1]["url"] == "https://en.wikipedia.org/wiki/Example2"

    @patch("util.search.requests.get")
    def test_arxiv_search(self, mock_get, combined_search_api):
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.content = """
        <feed xmlns="http://www.w3.org/2005/Atom">
            <entry>
                <title>Example ArXiv Paper</title>
                <id>http://arxiv.org/abs/1234.5678</id>
                <summary>This is an example ArXiv paper summary.</summary>
            </entry>
        </feed>
        """
        mock_get.return_value = mock_response

        combined_search_api.primary_engine = "arxiv"
        results = combined_search_api._search_arxiv("test query")

        assert len(results) == 1
        assert results[0]["title"] == "Example ArXiv Paper"
        assert results[0]["url"] == "http://arxiv.org/abs/1234.5678"
        assert results[0]["snippets"][0] == "This is an example ArXiv paper summary."
        assert results[0]["description"] == "This is an example ArXiv paper summary."

    def test_calculate_relevance(self, combined_search_api):
        wikipedia_result = {
            "url": "https://en.wikipedia.org/wiki/Test",
            "description": "A" * 1000,
        }
        arxiv_result = {
            "url": "https://arxiv.org/abs/1234.5678",
            "description": "B" * 1000,
        }
        other_result = {
            "url": "https://example.com",
            "description": "C" * 1000,
        }

        assert combined_search_api._calculate_relevance(wikipedia_result) == 2.0
        assert combined_search_api._calculate_relevance(arxiv_result) == 1.8
        assert combined_search_api._calculate_relevance(other_result) == 1.0

    @patch("util.search.requests.get")
    @patch("util.search.DuckDuckGoSearchAPIWrapper")
    def test_arxiv_failure_searxng_fallback(
        self, mock_ddg_wrapper, mock_requests_get, combined_search_api
    ):
        combined_search_api.primary_engine = "arxiv"
        combined_search_api.fallback_engine = "searxng"

        # Mock ArXiv failure
        mock_arxiv_response = MagicMock()
        mock_arxiv_response.status_code = 500

        # Mock SearxNG success
        mock_searxng_response = MagicMock()
        mock_searxng_response.status_code = 200
        mock_searxng_response.json.return_value = {
            "results": [
                {
                    "url": "https://en.wikipedia.org/wiki/Example",
                    "content": "Example content",
                    "title": "Example Title",
                }
            ]
        }

        mock_requests_get.side_effect = [mock_arxiv_response, mock_searxng_response]

        results = combined_search_api.forward("test query", [])

        assert len(results) > 0
        assert results[0]["snippets"][0] == "Example content"
        assert results[0]["title"] == "Example Title"
        assert results[0]["url"] == "https://en.wikipedia.org/wiki/Example"

        @patch("util.search.requests.get")
        @patch("util.search.DuckDuckGoSearchAPIWrapper")
        def test_searxng_failure_duckduckgo_fallback(
            self, mock_ddg_wrapper, mock_requests_get, combined_search_api
        ):
            combined_search_api.primary_engine = "searxng"
            combined_search_api.fallback_engine = "duckduckgo"

            # Mock SearxNG failure
            mock_searxng_response = MagicMock()
            mock_searxng_response.status_code = 500
            mock_requests_get.return_value = mock_searxng_response

            # Mock DuckDuckGo success
            mock_ddg_instance = MagicMock()
            mock_ddg_instance.results.return_value = [
                {
                    "link": "https://en.wikipedia.org/wiki/Example",
                    "snippet": "Example snippet",
                    "title": "Example Title",
                }
            ]
            mock_ddg_wrapper.return_value = mock_ddg_instance
            combined_search_api.ddg_search = mock_ddg_instance

            results = combined_search_api.forward("test query", [])

            assert len(results) > 0
            assert results[0]["snippets"][0] == "Example snippet"
            assert results[0]["title"] == "Example Title"
            assert results[0]["url"] == "https://en.wikipedia.org/wiki/Example"

        @patch("util.search.requests.get")
        @patch("util.search.DuckDuckGoSearchAPIWrapper")
        def test_all_engines_failure(
            self, mock_ddg_wrapper, mock_requests_get, combined_search_api
        ):
            combined_search_api.primary_engine = "searxng"
            combined_search_api.fallback_engine = "duckduckgo"

            # Mock SearxNG failure
            mock_searxng_response = MagicMock()
            mock_searxng_response.status_code = 500
            mock_requests_get.return_value = mock_searxng_response

            # Mock DuckDuckGo failure
            mock_ddg_instance = MagicMock()
            mock_ddg_instance.results.side_effect = Exception("DuckDuckGo failed")
            mock_ddg_wrapper.return_value = mock_ddg_instance
            combined_search_api.ddg_search = mock_ddg_instance

            results = combined_search_api.forward("test query", [])

            assert len(results) == 0

        @patch("util.search.requests.get")
        def test_searxng_error_response(self, mock_requests_get, combined_search_api):
            combined_search_api.primary_engine = "searxng"
            combined_search_api.fallback_engine = None

            # Mock SearxNG error response
            mock_response = MagicMock()
            mock_response.status_code = 200
            mock_response.json.return_value = {"error": "SearxNG error message"}
            mock_requests_get.return_value = mock_response

            results = combined_search_api.forward("test query", [])

            assert len(results) == 0
