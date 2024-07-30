import pytest
from unittest.mock import Mock, patch, MagicMock
import streamlit as st
from util.storm_runner import run_storm_with_fallback, set_storm_runner


@pytest.fixture(autouse=True)
def mock_gpu_dependencies():
    with patch("knowledge_storm.STORMWikiRunner"), patch(
        "knowledge_storm.STORMWikiRunnerArguments"
    ), patch("knowledge_storm.STORMWikiLMConfigs"), patch(
        "knowledge_storm.lm.OpenAIModel"
    ), patch("knowledge_storm.lm.OllamaClient"), patch(
        "knowledge_storm.lm.ClaudeModel"
    ), patch("util.search.CombinedSearchAPI"):
        yield


@pytest.fixture
def mock_streamlit():
    with patch.object(st, "secrets", {"OPENAI_API_KEY": "test_key"}), patch.object(
        st, "info", MagicMock()
    ), patch.object(st, "error", MagicMock()), patch.object(
        st, "warning", MagicMock()
    ), patch.object(st.session_state, "__setitem__", MagicMock()):
        yield


@pytest.fixture
def mock_storm_runner():
    mock = MagicMock()
    mock.storm_knowledge_curation_module.persona_generator.create_writer_with_persona.find_related_topic = MagicMock()
    mock.storm_knowledge_curation_module.persona_generator.create_writer_with_persona.gen_persona = MagicMock()
    mock.storm_outline_generation_module.write_outline.write_page_outline = MagicMock()
    mock.storm_article_generation.section_gen.write_section = MagicMock()
    return mock


@patch("util.storm_runner.load_llm_settings")
@patch("util.storm_runner.load_search_options")
@patch("util.storm_runner.os.getenv")
def test_set_storm_runner(
    mock_getenv, mock_load_search_options, mock_load_llm_settings, mock_streamlit
):
    mock_getenv.return_value = "/tmp/test_dir"
    mock_load_llm_settings.return_value = {
        "primary_model": "ollama",
        "fallback_model": None,
        "model_settings": {"ollama": {"model": "test_model", "max_tokens": 500}},
    }
    mock_load_search_options.return_value = {"search_top_k": 3, "retrieve_top_k": 3}

    set_storm_runner()

    assert "run_storm" in st.session_state
    assert callable(st.session_state["run_storm"])


@patch("util.storm_runner.STORMWikiRunner")
@patch("util.storm_runner.STORMWikiRunnerArguments")
@patch("util.storm_runner.STORMWikiLMConfigs")
@patch("util.storm_runner.OllamaClient")
@patch("util.storm_runner.CombinedSearchAPI")
def test_run_storm_with_fallback(
    mock_combined_search,
    mock_ollama,
    mock_configs,
    mock_args,
    mock_runner,
    mock_streamlit,
):
    mock_runner_instance = Mock()
    mock_runner.return_value = mock_runner_instance

    result = run_storm_with_fallback(
        "test topic", "/tmp/test_dir", runner=mock_runner_instance
    )

    assert result == mock_runner_instance
    mock_runner_instance.run.assert_called_once_with(
        topic="test topic",
        do_research=True,
        do_generate_outline=True,
        do_generate_article=True,
        do_polish_article=True,
    )
    mock_runner_instance.post_run.assert_called_once()


@patch("util.storm_runner.STORMWikiRunner")
@patch("util.storm_runner.STORMWikiRunnerArguments")
@patch("util.storm_runner.STORMWikiLMConfigs")
@patch("util.storm_runner.OllamaClient")
@patch("util.storm_runner.CombinedSearchAPI")
def test_run_storm_with_fallback_no_runner(
    mock_combined_search,
    mock_ollama,
    mock_configs,
    mock_args,
    mock_runner,
    mock_streamlit,
):
    with pytest.raises(ValueError, match="Runner is not initialized"):
        run_storm_with_fallback("test topic", "/tmp/test_dir")


@patch("util.storm_runner.STORMWikiRunner")
@patch("util.storm_runner.STORMWikiRunnerArguments")
@patch("util.storm_runner.STORMWikiLMConfigs")
@patch("util.storm_runner.OllamaClient")
@patch("util.storm_runner.CombinedSearchAPI")
def test_search_failure_scenario(
    mock_combined_search,
    mock_ollama,
    mock_configs,
    mock_args,
    mock_runner,
    mock_streamlit,
):
    mock_runner_instance = Mock()
    mock_runner.return_value = mock_runner_instance
    mock_runner_instance.run.side_effect = Exception("Search failed")

    with pytest.raises(Exception, match="Search failed"):
        run_storm_with_fallback(
            "test topic", "/tmp/test_dir", runner=mock_runner_instance
        )

    mock_runner_instance.run.assert_called_once()
    mock_runner_instance.post_run.assert_not_called()
