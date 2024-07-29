import pytest
from unittest.mock import Mock, patch, MagicMock
import streamlit as st
from util.storm_runner import run_storm_with_fallback


@pytest.fixture(autouse=True)
def mock_gpu_dependencies():
    with patch("knowledge_storm.STORMWikiRunner"), patch(
        "knowledge_storm.STORMWikiRunnerArguments"
    ), patch("knowledge_storm.STORMWikiLMConfigs"), patch(
        "knowledge_storm.lm.OpenAIModel"
    ), patch("knowledge_storm.lm.OllamaClient"), patch("util.search.CombinedSearchAPI"):
        yield


@pytest.fixture
def mock_streamlit():
    with patch.object(st, "secrets", {"OPENAI_API_KEY": "test_key"}), patch.object(
        st, "info", MagicMock()
    ), patch.object(st, "error", MagicMock()), patch.object(st, "warning", MagicMock()):
        yield


class MockSecrets(dict):
    def __getattr__(self, key):
        return self[key]


@pytest.fixture
def mock_secrets():
    return MockSecrets({"OPENAI_API_KEY": "test_key"})


@pytest.fixture
def mock_storm_runner():
    mock = MagicMock()
    mock.storm_knowledge_curation_module.persona_generator.create_writer_with_persona.find_related_topic = MagicMock()
    mock.storm_knowledge_curation_module.persona_generator.create_writer_with_persona.gen_persona = MagicMock()
    mock.storm_outline_generation_module.write_outline.write_page_outline = MagicMock()
    mock.storm_article_generation.section_gen.write_section = MagicMock()
    return mock


@pytest.fixture(autouse=True)
def mock_streamlit(monkeypatch, mock_secrets):
    monkeypatch.setattr(st, "secrets", mock_secrets)
    monkeypatch.setattr(st, "info", MagicMock())
    monkeypatch.setattr(st, "error", MagicMock())
    monkeypatch.setattr(st, "warning", MagicMock())


@patch("util.storm_runner.STORMWikiRunnerArguments")
@patch("util.storm_runner.STORMWikiLMConfigs")
def test_run_storm_with_fallback(
    mock_storm_runner_args, mock_storm_runner_configs, mock_storm_runner
):
    from util.storm_runner import (
        run_storm_with_fallback,
    )  # Move import here to avoid circular import
    # Your test code here


def test_successful_run_with_ollama(mock_streamlit):
    with patch("util.storm_runner.STORMWikiRunner") as mock_runner:
        mock_runner_instance = Mock()
        mock_runner.return_value = mock_runner_instance

        result = run_storm_with_fallback("test topic", "/tmp/test_dir")

        assert result == mock_runner_instance
        mock_runner_instance.run.assert_called_once()
        mock_runner_instance.post_run.assert_called_once()


@patch("util.storm_runner.CombinedSearchAPI")
@patch("util.storm_runner.STORMWikiRunner")
@patch("util.storm_runner.OllamaClient")
def test_ollama_failure(mock_ollama, mock_runner, mock_combined_search, mock_streamlit):
    mock_ollama.side_effect = Exception("Ollama failed")
    mock_runner_instance = Mock()
    mock_runner.return_value = mock_runner_instance

    with pytest.raises(Exception, match="Ollama failed"):
        run_storm_with_fallback("test topic", "/tmp/test_dir")

    mock_ollama.assert_called_once()
    mock_runner.assert_not_called()
    mock_runner_instance.run.assert_not_called()
    mock_runner_instance.post_run.assert_not_called()


@patch("util.storm_runner.CombinedSearchAPI")
@patch("util.storm_runner.STORMWikiRunner")
@patch("util.storm_runner.OllamaClient")
def test_search_failure_scenario(mock_ollama, mock_runner, mock_combined_search):
    mock_combined_search.return_value.forward.side_effect = Exception("Search failed")
    mock_runner_instance = Mock()
    mock_runner.return_value = mock_runner_instance
    mock_runner_instance.run.side_effect = Exception("Search failed")

    with pytest.raises(Exception, match="Search failed"):
        run_storm_with_fallback("test topic", "/tmp/test_dir")

    mock_runner.assert_called_once()
    mock_runner_instance.run.assert_called_once()
    mock_runner_instance.post_run.assert_not_called()
