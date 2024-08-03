import pytest
import os
import json
from unittest.mock import MagicMock, patch
from util.storm_runner import process_search_results


@pytest.fixture
def mock_runner():
    return MagicMock()


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
