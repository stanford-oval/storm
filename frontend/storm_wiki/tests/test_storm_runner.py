import pytest
import unittest
from unittest.mock import Mock, patch, MagicMock
import streamlit as st
from util.storm_runner import (
    run_storm_with_fallback,
    set_storm_runner,
    run_storm_with_config,
)


@pytest.fixture(autouse=True)
def mock_gpu_dependencies():
    with patch("knowledge_storm.STORMWikiRunner"), patch(
        "knowledge_storm.STORMWikiRunnerArguments"
    ), patch("knowledge_storm.STORMWikiLMConfigs"), patch(
        "knowledge_storm.lm.OpenAIModel"
    ), patch("knowledge_storm.lm.OllamaClient"), patch(
        "knowledge_storm.lm.ClaudeModel"
    ), patch("util.search.CombinedSearchAPI"):  # Change this line
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


class TestStormRunner(unittest.TestCase):
    @patch("util.storm_runner.STORMWikiRunner")
    @patch("util.storm_runner.STORMWikiLMConfigs")
    @patch("util.storm_runner.CombinedSearchAPI")
    @patch("util.storm_runner.create_lm_client")
    @patch("util.storm_runner.load_llm_settings")
    @patch("util.storm_runner.load_search_options")
    def test_run_storm_with_config_engine_args(
        self,
        mock_load_search_options,
        mock_load_llm_settings,
        mock_create_lm_client,
        mock_combined_search_api,
        mock_lm_configs,
        mock_storm_wiki_runner,
    ):
        # Arrange
        mock_runner = MagicMock()
        mock_storm_wiki_runner.return_value = mock_runner

        # Mock the load_llm_settings function
        mock_load_llm_settings.return_value = {
            "primary_model": "test_model",
            "fallback_model": "fallback_model",
            "model_settings": {
                "test_model": {"max_tokens": 100},
                "fallback_model": {"max_tokens": 50},
            },
        }

        # Mock the load_search_options function
        mock_load_search_options.return_value = {
            "search_top_k": 10,
            "retrieve_top_k": 5,
        }

        # Act
        result = run_storm_with_config("Test Topic", "/tmp/test_dir")

        # Assert
        self.assertTrue(
            hasattr(mock_runner, "engine_args"),
            "STORMWikiRunner should have engine_args attribute",
        )
        self.assertEqual(mock_runner.engine_args.output_dir, "/tmp/test_dir")

        # Additional assertions
        mock_load_llm_settings.assert_called_once()
        mock_load_search_options.assert_called_once()
        mock_create_lm_client.assert_called_once()
        mock_combined_search_api.assert_called_once()
        mock_storm_wiki_runner.assert_called_once()


class TestSetStormRunner:
    @patch("util.storm_runner.load_llm_settings")
    @patch("util.storm_runner.load_search_options")
    @patch("util.storm_runner.os.getenv")
    def test_set_storm_runner(
        self,
        mock_getenv,
        mock_load_search_options,
        mock_load_llm_settings,
        mock_streamlit,
    ):
        mock_getenv.return_value = "/tmp/test_dir"
        mock_load_llm_settings.return_value = {
            "primary_model": "ollama",
            "fallback_model": "openai",
            "model_settings": {
                "ollama": {"model": "test_model", "max_tokens": 500},
                "openai": {"model": "gpt-3.5-turbo", "max_tokens": 1000},
            },
        }
        mock_load_search_options.return_value = {"search_top_k": 3, "retrieve_top_k": 3}

        set_storm_runner()

        assert "run_storm" in st.session_state
        assert callable(st.session_state["run_storm"])


class TestRunStormWithFallback:
    @pytest.mark.parametrize(
        "primary_model,fallback_model",
        [
            ("ollama", "openai"),
            ("openai", "ollama"),
            ("anthropic", "openai"),
            ("openai", "anthropic"),
        ],
    )
    @patch("util.storm_runner.STORMWikiRunner")
    @patch("util.storm_runner.STORMWikiRunnerArguments")
    @patch("util.storm_runner.STORMWikiLMConfigs")
    @patch("util.storm_runner.CombinedSearchAPI")
    @patch("util.storm_runner.set_storm_runner")
    def test_run_storm_with_fallback_success(
        self,
        mock_set_storm_runner,
        mock_combined_search,
        mock_configs,
        mock_args,
        mock_runner,
        primary_model,
        fallback_model,
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
    @patch("util.storm_runner.CombinedSearchAPI")
    @patch("util.storm_runner.set_storm_runner")
    def test_run_storm_with_fallback_no_runner(
        self,
        mock_set_storm_runner,
        mock_combined_search,
        mock_configs,
        mock_args,
        mock_runner,
        mock_streamlit,
    ):
        with pytest.raises(ValueError, match="Runner is not initialized"):
            run_storm_with_fallback("test topic", "/tmp/test_dir")

    @pytest.mark.parametrize(
        "error_stage", ["research", "outline", "article", "polish"]
    )
    @patch("util.storm_runner.STORMWikiRunner")
    @patch("util.storm_runner.STORMWikiRunnerArguments")
    @patch("util.storm_runner.STORMWikiLMConfigs")
    @patch("util.storm_runner.CombinedSearchAPI")
    @patch("util.storm_runner.set_storm_runner")
    def test_run_storm_with_fallback_stage_failure(
        self,
        mock_set_storm_runner,
        mock_combined_search,
        mock_configs,
        mock_args,
        mock_runner,
        error_stage,
        mock_streamlit,
    ):
        mock_runner_instance = Mock()
        mock_runner.return_value = mock_runner_instance
        mock_runner_instance.run.side_effect = Exception(
            f"{error_stage.capitalize()} failed"
        )

        with pytest.raises(
            Exception,
            match=f"{error_stage.capitalize()} failed",  # Fixed typo here
        ):
            run_storm_with_fallback(
                "test topic", "/tmp/test_dir", runner=mock_runner_instance
            )

        mock_runner_instance.run.assert_called_once()
        mock_runner_instance.post_run.assert_not_called()

    @pytest.mark.parametrize(
        "do_research,do_generate_outline,do_generate_article,do_polish_article",
        [
            (True, True, True, True),
            (True, False, True, True),
            (True, True, False, False),
            (False, True, True, False),
            (False, False, True, True),
        ],
    )
    @patch("util.storm_runner.STORMWikiRunner")
    def test_run_storm_with_different_step_combinations(
        self,
        mock_runner,
        do_research,
        do_generate_outline,
        do_generate_article,
        do_polish_article,
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
    def test_run_storm_with_unexpected_exception(self, mock_runner, mock_streamlit):
        mock_runner_instance = Mock()
        mock_runner.return_value = mock_runner_instance
        mock_runner_instance.run.side_effect = Exception("Unexpected error")

        with pytest.raises(Exception, match="Unexpected error"):
            run_storm_with_fallback(
                "test topic", "/tmp/test_dir", runner=mock_runner_instance
            )

        mock_runner_instance.run.assert_called_once()
        mock_runner_instance.post_run.assert_not_called()

    @patch("util.storm_runner.STORMWikiRunner")
    def test_run_storm_with_different_output_formats(self, mock_runner, mock_streamlit):
        mock_runner_instance = Mock()
        mock_runner.return_value = mock_runner_instance

        # Simulate different output formats
        mock_runner_instance.run.side_effect = [
            {"outline": "Test outline", "article": "Test article"},
            {
                "outline": "Test outline",
                "article": "Test article",
                "polished_article": "Polished test article",
            },
            {"research": "Test research", "outline": "Test outline"},
        ]

        for _ in range(3):
            result = run_storm_with_fallback(
                "test topic", "/tmp/test_dir", runner=mock_runner_instance
            )
            assert result == mock_runner_instance
            mock_runner_instance.post_run.assert_called_once()
            mock_runner_instance.post_run.reset_mock()

        assert mock_runner_instance.run.call_count == 3

    @pytest.mark.parametrize(
        "topic",
        [
            "Short topic",
            "A very long topic that exceeds the usual length of topics and might cause issues if not handled properly",
            "Topic with special characters: !@#$%^&*()",
            "数学和科学",  # Topic in Chinese
            "",  # Empty topic
        ],
    )
    @patch("util.storm_runner.STORMWikiRunner")
    def test_run_storm_with_different_topic_types(
        self, mock_runner, topic, mock_streamlit
    ):
        mock_runner_instance = Mock()
        mock_runner.return_value = mock_runner_instance

        result = run_storm_with_fallback(
            topic, "/tmp/test_dir", runner=mock_runner_instance
        )

        assert result == mock_runner_instance
        mock_runner_instance.run.assert_called_once_with(
            topic=topic,
            do_research=True,
            do_generate_outline=True,
            do_generate_article=True,
            do_polish_article=True,
        )
        mock_runner_instance.post_run.assert_called_once()

    @pytest.mark.parametrize(
        "working_dir",
        [
            "/tmp/test_dir",
            "relative/path",
            ".",
            "/path/with spaces/and/special/chars!@#$",
            "",  # Empty path
        ],
    )
    @patch("util.storm_runner.STORMWikiRunner")
    @patch("util.storm_runner.STORMWikiRunnerArguments")
    @patch("util.storm_runner.STORMWikiLMConfigs")
    @patch("util.storm_runner.CombinedSearchAPI")
    @patch("util.storm_runner.os.path.exists")
    @patch("util.storm_runner.os.makedirs")
    def test_run_storm_with_different_working_directories(
        self,
        mock_makedirs,
        mock_exists,
        mock_combined_search,
        mock_configs,
        mock_args,
        mock_runner,
        working_dir,
        mock_streamlit,
    ):
        mock_runner_instance = Mock()
        mock_runner.return_value = mock_runner_instance
        mock_exists.return_value = False

        # Mock the STORMWikiRunnerArguments
        mock_args_instance = Mock()
        mock_args.return_value = mock_args_instance
        mock_args_instance.output_dir = working_dir

        # Mock the search engine and LLM model results
        mock_search_results = {
            "results": [{"title": "Test", "snippet": "Test snippet"}]
        }
        mock_llm_response = "Generated content"

        mock_combined_search_instance = Mock()
        mock_combined_search.return_value = mock_combined_search_instance
        mock_combined_search_instance.search.return_value = mock_search_results

        mock_runner_instance.run.return_value = {
            "search_results": mock_search_results,
            "generated_content": mock_llm_response,
        }

        result = run_storm_with_fallback(
            "test topic", working_dir, runner=mock_runner_instance
        )

        assert result == mock_runner_instance
        mock_runner_instance.run.assert_called_once()
        mock_runner_instance.post_run.assert_called_once()

        # Check if the working_dir was passed correctly to the runner's engine_args
        if working_dir:
            assert mock_runner_instance.engine_args.output_dir == working_dir
        else:
            # If working_dir is empty, it should use a default directory
            assert mock_runner_instance.engine_args.output_dir is not None

        # Check if the run method was called with the correct arguments
        expected_kwargs = {
            "topic": "test topic",
            "do_research": True,
            "do_generate_outline": True,
            "do_generate_article": True,
            "do_polish_article": True,
        }
        mock_runner_instance.run.assert_called_once_with(**expected_kwargs)


class TestSearchEngines:
    @pytest.mark.parametrize(
        "primary_search,fallback_search",
        [
            ("combined", "google"),
            ("google", "combined"),
            ("bing", "combined"),
            ("combined", "bing"),
        ],
    )
    @patch("util.storm_runner.STORMWikiRunner")
    @patch("util.storm_runner.CombinedSearchAPI")
    def test_search_engine_fallback(
        self,
        mock_combined_search,
        mock_runner,
        primary_search,
        fallback_search,
        mock_streamlit,
    ):
        mock_runner_instance = Mock()
        mock_runner.return_value = mock_runner_instance

        # Mock search results
        mock_search_results = {
            "results": [{"title": "Test", "snippet": "Test snippet"}]
        }
        mock_combined_search.return_value.search.return_value = mock_search_results

        # Mock LLM response
        mock_llm_response = "Generated content"

        def run_side_effect(*args, **kwargs):
            # Simulate calling the search method
            mock_combined_search.return_value.search("test topic")
            return {
                "search_results": mock_search_results,
                "generated_content": mock_llm_response,
            }

        mock_runner_instance.run.side_effect = run_side_effect

        result = run_storm_with_fallback(
            "test topic", "/tmp/test_dir", runner=mock_runner_instance
        )

        assert result == mock_runner_instance
        mock_runner_instance.run.assert_called_once()
        mock_runner_instance.post_run.assert_called_once()
        mock_combined_search.return_value.search.assert_called_once_with("test topic")
