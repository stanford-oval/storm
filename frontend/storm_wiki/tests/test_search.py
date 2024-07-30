import pytest
from unittest.mock import patch, MagicMock
import streamlit as st
from util.search import WebSearchAPIWrapper, CombinedSearchAPI


def parse_secrets_file(file_path):
    secrets = {}
    with open(file_path, "r") as f:
        for line in f:
            line = line.strip()
            if line and not line.startswith("#"):
                key, value = line.split("=", 1)
                secrets[key.strip()] = value.strip().strip('"')
    return secrets


@pytest.fixture(scope="session")
def mock_secrets():
    return parse_secrets_file("secrets.toml.example")


@pytest.fixture(autouse=True)
def mock_streamlit_secrets(mock_secrets):
    with patch.object(st, "secrets", mock_secrets):
        yield


@pytest.fixture
def mock_file_content():
    return """
    <tr class="s-gu" id="unreliable_source">
    <tr class="s-d" id="deprecated_source">
    <tr class="s-b" id="blacklisted_source">
    """


@pytest.fixture
def web_search_wrapper(tmp_path, mock_file_content):
    html_file = (
        tmp_path / "Wikipedia_Reliable sources_Perennial sources - Wikipedia.html"
    )
    html_file.write_text(mock_file_content)
    with patch("os.path.dirname", return_value=str(tmp_path)):
        return WebSearchAPIWrapper(max_results=3)


def test_web_search_wrapper_initialization(web_search_wrapper):
    assert web_search_wrapper.max_results == 3
    assert "unreliable_source" in web_search_wrapper.generally_unreliable
    assert "deprecated_source" in web_search_wrapper.deprecated
    assert "blacklisted_source" in web_search_wrapper.blacklisted


def test_is_valid_wikipedia_source(web_search_wrapper):
    assert web_search_wrapper._is_valid_wikipedia_source(
        "https://en.wikipedia.org/wiki/Test"
    )
    assert not web_search_wrapper._is_valid_wikipedia_source(
        "https://unreliable_source.com"
    )
    assert not web_search_wrapper._is_valid_wikipedia_source(
        "https://deprecated_source.org"
    )
    assert not web_search_wrapper._is_valid_wikipedia_source(
        "https://blacklisted_source.net"
    )


@patch("dspy.settings.rm", MagicMock())
@patch("dspy.Retrieve.forward")
def test_web_search_wrapper_forward(mock_forward):
    wrapper = WebSearchAPIWrapper(max_results=3)
    wrapper.forward("test query", [])
    mock_forward.assert_called_once_with("test query", exclude_urls=[])


@patch("util.search.load_search_options")
@patch("util.search.DuckDuckGoSearchAPIWrapper")
def test_combined_search_api_duckduckgo_success(
    mock_ddg_wrapper, mock_load_search_options, mock_streamlit_secrets
):
    mock_load_search_options.return_value = {
        "primary_engine": "duckduckgo",
        "fallback_engine": None,
    }
    mock_ddg_wrapper.return_value.results.return_value = [
        {
            "link": "https://example.com",
            "snippet": "Example snippet",
            "title": "Example Title",
        },
    ]
    combined_api = CombinedSearchAPI(max_results=1)
    results = combined_api.forward("test query", [])
    assert len(results) == 1
    assert results[0]["url"] == "https://example.com"
    assert results[0]["snippets"][0] == "Example snippet"
    assert results[0]["title"] == "Example Title"


@patch("util.search.load_search_options")
@patch("util.search.DuckDuckGoSearchAPIWrapper")
@patch("requests.get")
def test_combined_search_api_duckduckgo_failure_searxng_success(
    mock_requests_get,
    mock_ddg_wrapper,
    mock_load_search_options,
    mock_streamlit_secrets,
):
    mock_load_search_options.return_value = {
        "primary_engine": "duckduckgo",
        "fallback_engine": "searxng",
    }
    mock_ddg_wrapper.return_value.results.side_effect = Exception("DuckDuckGo failed")
    mock_response = MagicMock()
    mock_response.status_code = 200
    mock_response.json.return_value = {
        "results": [
            {
                "url": "https://example.com",
                "content": "Example content",
                "title": "Example Title",
            },
        ]
    }
    mock_requests_get.return_value = mock_response
    combined_api = CombinedSearchAPI(max_results=1)
    results = combined_api.forward("test query", [])
    assert len(results) == 1
    assert results[0]["url"] == "https://example.com"
    assert results[0]["snippets"][0] == "Example content"
    assert results[0]["title"] == "Example Title"


@patch("util.search.load_search_options")
@patch("util.search.DuckDuckGoSearchAPIWrapper")
def test_combined_search_api_multiple_queries(
    mock_ddg_wrapper, mock_load_search_options, mock_streamlit_secrets
):
    mock_load_search_options.return_value = {
        "primary_engine": "duckduckgo",
        "fallback_engine": None,
    }
    mock_ddg_wrapper.return_value.results.side_effect = [
        [{"link": "https://example1.com", "snippet": "Example 1", "title": "Title 1"}],
        [{"link": "https://example2.com", "snippet": "Example 2", "title": "Title 2"}],
    ]
    combined_api = CombinedSearchAPI(max_results=2)
    results = combined_api.forward(["query1", "query2"], [])
    assert len(results) == 2
    assert results[0]["url"] == "https://example1.com"
    assert results[1]["url"] == "https://example2.com"
