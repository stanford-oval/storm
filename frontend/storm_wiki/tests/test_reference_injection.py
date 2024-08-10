import pytest
import os
import json
from unittest.mock import MagicMock, patch
from util.storm_runner import process_search_results, run_storm_with_fallback


@pytest.fixture
def mock_runner():
    runner = MagicMock()
    runner.run.side_effect = Exception(
        "HTTPConnectionPool(host='localhost', port=11434): Read timed out. (read timeout=120)"
    )
    return runner


@pytest.fixture
def mock_fallback_lm():
    return MagicMock(return_value=["Fallback article content"])


@pytest.fixture
def mock_working_dir(tmp_path):
    return tmp_path


@pytest.fixture
def mock_topic():
    return "Test_Topic"


@pytest.fixture
def mock_raw_search_results():
    return {
        "results": [
            {
                "title": "Test Title 1",
                "url": "https://example.com/1",
                "content": "Test content 1",
            },
            {
                "title": "Test Title 2",
                "url": "https://example.com/2",
                "content": "Test content 2",
            },
        ]
    }


def test_run_storm_with_fallback_timeout(mock_runner, mock_fallback_lm):
    with patch(
        "util.storm_runner.collect_existing_information",
        return_value={"research": "Mock research", "outline": "Mock outline"},
    ):
        with patch("util.storm_runner.write_fallback_result") as mock_write_fallback:
            result = run_storm_with_fallback(
                "Test topic",
                "/mock/dir",
                runner=mock_runner,
                fallback_lm=mock_fallback_lm,
            )

            mock_runner.run.assert_called_once()
            mock_fallback_lm.assert_called_once()
            mock_write_fallback.assert_called_once_with(
                "Fallback article content", "/mock/dir", "Test topic"
            )
            assert result == mock_runner


def test_process_search_results(
    mock_runner, mock_working_dir, mock_topic, mock_raw_search_results
):
    # Setup
    topic_dir = os.path.join(mock_working_dir, mock_topic)
    os.makedirs(topic_dir)

    raw_search_results_path = os.path.join(topic_dir, "raw_search_results.json")
    with open(raw_search_results_path, "w") as f:
        json.dump(mock_raw_search_results, f)

    markdown_path = os.path.join(topic_dir, f"{mock_topic}.md")
    with open(markdown_path, "w") as f:
        f.write("# Test Article\n\nSome content here.\n")

    # Run the function
    process_search_results(mock_runner, mock_working_dir, mock_topic)

    # Assert
    with open(markdown_path, "r") as f:
        content = f.read()

    assert "## References" in content
    assert "1. [Test Title 1](https://example.com/1)" in content
    assert "2. [Test Title 2](https://example.com/2)" in content


def test_process_search_results_no_raw_results(
    mock_runner, mock_working_dir, mock_topic
):
    # Setup
    topic_dir = os.path.join(mock_working_dir, mock_topic)
    os.makedirs(topic_dir)

    markdown_path = os.path.join(topic_dir, f"{mock_topic}.md")
    with open(markdown_path, "w") as f:
        f.write("# Test Article\n\nSome content here.\n")

    # Run the function
    process_search_results(mock_runner, mock_working_dir, mock_topic)

    # Assert
    with open(markdown_path, "r") as f:
        content = f.read()

    assert "## References" not in content


@patch("util.storm_runner.logger")
def test_process_search_results_json_decode_error(
    mock_logger, mock_runner, mock_working_dir, mock_topic
):
    # Setup
    topic_dir = os.path.join(mock_working_dir, mock_topic)
    os.makedirs(topic_dir)

    raw_search_results_path = os.path.join(topic_dir, "raw_search_results.json")
    with open(raw_search_results_path, "w") as f:
        f.write("Invalid JSON")

    # Run the function
    process_search_results(mock_runner, mock_working_dir, mock_topic)

    # Assert
    mock_logger.error.assert_called_once_with(
        f"Error decoding JSON from {raw_search_results_path}"
    )
