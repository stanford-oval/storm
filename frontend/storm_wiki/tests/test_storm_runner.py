import pytest
import unittest
from unittest.mock import Mock, patch, MagicMock, call, ANY
import streamlit as st
from util.storm_runner import (
    run_storm_with_fallback,
    set_storm_runner,
    run_storm_with_config,
    collect_existing_information,
    use_fallback_llm,
    write_fallback_result,
)
from openai import NotFoundError


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


class TestStormRunner(unittest.TestCase):
    @patch("util.storm_runner.STORMWikiRunner")
    @patch("util.storm_runner.STORMWikiLMConfigs")
    @patch("util.storm_runner.CombinedSearchAPI")
    @patch("util.storm_runner.create_lm_client")
    @patch("util.storm_runner.load_llm_settings")
    @patch("util.storm_runner.load_search_options")
    @patch("util.storm_runner.run_storm_with_fallback")
    def test_run_storm_with_config_engine_args(
        self,
        mock_run_storm_with_fallback,
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

        mock_load_llm_settings.return_value = {
            "primary_model": "test_model",
            "fallback_model": "fallback_model",
            "model_settings": {
                "test_model": {"max_tokens": 100},
                "fallback_model": {"max_tokens": 50},
            },
        }

        mock_load_search_options.return_value = {
            "search_top_k": 10,
            "retrieve_top_k": 5,
        }

        # Act
        result = run_storm_with_config("Test Topic", "/tmp/test_dir")

        # Assert
        mock_storm_wiki_runner.assert_called_once()
        mock_run_storm_with_fallback.assert_called_once_with(
            topic="Test Topic",
            current_working_dir="/tmp/test_dir",
            callback_handler=None,
            runner=mock_runner,
            fallback_lm=ANY,
        )
        mock_load_llm_settings.assert_called_once()
        mock_load_search_options.assert_called_once()
        self.assertEqual(
            mock_create_lm_client.call_count, 2
        )  # Once for primary, once for fallback
        mock_combined_search_api.assert_called_once()


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
    @patch("util.storm_runner.collect_existing_information")
    @patch("util.storm_runner.use_fallback_llm")
    @patch("util.storm_runner.write_fallback_result")
    def test_run_storm_with_fallback_success(
        self,
        mock_write_fallback_result,
        mock_use_fallback_llm,
        mock_collect_existing_information,
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
        mock_collect_existing_information.assert_not_called()
        mock_use_fallback_llm.assert_not_called()
        mock_write_fallback_result.assert_not_called()

    @pytest.mark.parametrize(
        "error_stage", ["research", "outline", "article", "polish"]
    )
    @patch("util.storm_runner.STORMWikiRunner")
    @patch("util.storm_runner.collect_existing_information")
    @patch("util.storm_runner.use_fallback_llm")
    @patch("util.storm_runner.write_fallback_result")
    def test_run_storm_with_fallback_stage_failure(
        self,
        mock_write_fallback_result,
        mock_use_fallback_llm,
        mock_collect_existing_information,
        mock_runner,
        error_stage,
        mock_streamlit,
    ):
        mock_runner_instance = Mock()
        mock_runner.return_value = mock_runner_instance
        mock_runner_instance.run.side_effect = Exception(
            f"{error_stage.capitalize()} failed"
        )
        mock_collect_existing_information.return_value = {"research": "mock research"}
        mock_use_fallback_llm.return_value = "Fallback content"

        mock_fallback_lm = None  # Set fallback_lm to None to trigger the ValueError

        with pytest.raises(ValueError, match="Fallback LLM is not configured"):
            run_storm_with_fallback(
                "test topic",
                "/tmp/test_dir",
                runner=mock_runner_instance,
                fallback_lm=mock_fallback_lm,
            )

        mock_runner_instance.run.assert_called_once()
        mock_collect_existing_information.assert_called_once_with(mock_runner_instance)
        mock_use_fallback_llm.assert_not_called()
        mock_write_fallback_result.assert_not_called()
        mock_runner_instance.post_run.assert_called_once()

    @patch("util.storm_runner.STORMWikiRunner")
    @patch("util.storm_runner.collect_existing_information")
    @patch("util.storm_runner.use_fallback_llm")
    @patch("util.storm_runner.write_fallback_result")
    def test_run_storm_with_fallback_llm_failure(
        self,
        mock_write_fallback_result,
        mock_use_fallback_llm,
        mock_collect_existing_information,
        mock_runner,
        mock_streamlit,
    ):
        mock_runner_instance = Mock()
        mock_runner.return_value = mock_runner_instance
        mock_runner_instance.run.side_effect = Exception("Primary LLM failed")
        mock_collect_existing_information.return_value = {"research": "mock research"}
        mock_use_fallback_llm.side_effect = Exception("Fallback LLM failed")

        mock_fallback_lm = Mock()

        with pytest.raises(Exception, match="Fallback LLM failed"):
            run_storm_with_fallback(
                "test topic",
                "/tmp/test_dir",
                runner=mock_runner_instance,
                fallback_lm=mock_fallback_lm,
            )

        mock_runner_instance.run.assert_called_once()
        mock_collect_existing_information.assert_called_once_with(mock_runner_instance)
        mock_use_fallback_llm.assert_called_once()
        mock_write_fallback_result.assert_not_called()
        mock_runner_instance.post_run.assert_called_once()

    @patch("util.storm_runner.STORMWikiRunner")
    @patch("util.storm_runner.collect_existing_information")
    @patch("util.storm_runner.use_fallback_llm")
    @patch("util.storm_runner.write_fallback_result")
    def test_run_storm_with_fallback_no_fallback_lm(
        self,
        mock_write_fallback_result,
        mock_use_fallback_llm,
        mock_collect_existing_information,
        mock_runner,
        mock_streamlit,
    ):
        mock_runner_instance = Mock()
        mock_runner.return_value = mock_runner_instance
        mock_runner_instance.run.side_effect = Exception("Primary LLM failed")
        mock_collect_existing_information.return_value = {"research": "mock research"}

        # Mock the fallback LLM configuration with None
        mock_runner_instance.llm_configs = Mock()
        mock_runner_instance.llm_configs.fallback_lm = None

        with pytest.raises(ValueError, match="Fallback LLM is not configured"):
            run_storm_with_fallback(
                "test topic", "/tmp/test_dir", runner=mock_runner_instance
            )

        mock_runner_instance.run.assert_called_once()
        mock_collect_existing_information.assert_called_once_with(mock_runner_instance)
        mock_use_fallback_llm.assert_not_called()
        mock_write_fallback_result.assert_not_called()
        mock_runner_instance.post_run.assert_called_once()


def test_collect_existing_information():
    mock_runner = Mock()
    mock_runner.research_results = "Mock research"
    mock_runner.outline = "Mock outline"
    mock_runner.partial_article = "Mock partial article"

    result = collect_existing_information(mock_runner)

    assert result == {
        "research": "Mock research",
        "outline": "Mock outline",
        "partial_article": "Mock partial article",
    }


def test_collect_existing_information_missing_attributes():
    mock_runner = Mock()
    mock_runner.research_results = "Mock research"
    # Explicitly delete outline and partial_article attributes
    delattr(mock_runner, "outline")
    delattr(mock_runner, "partial_article")

    result = collect_existing_information(mock_runner)

    assert result == {
        "research": "Mock research",
        "outline": None,
        "partial_article": None,
    }
    assert not hasattr(mock_runner, "outline")
    assert not hasattr(mock_runner, "partial_article")


@patch("util.storm_runner.open", new_callable=unittest.mock.mock_open)
def test_write_fallback_result(mock_open):
    write_fallback_result("Fallback content", "/tmp/test_dir", "Test Topic")
    mock_open.assert_called_once_with("/tmp/test_dir/Test_Topic.md", "w")
    mock_open().write.assert_called_once_with("Fallback content")


@patch("util.storm_runner.open", new_callable=unittest.mock.mock_open)
def test_write_fallback_result_with_special_characters(mock_open):
    write_fallback_result(
        "Fallback content", "/tmp/test_dir", "Test Topic with spaces and $pecial chars!"
    )
    mock_open.assert_called_once_with(
        "/tmp/test_dir/Test_Topic_with_spaces_and_$pecial_chars!.md", "w"
    )
    mock_open().write.assert_called_once_with("Fallback content")


@patch("util.storm_runner.logger")
def test_use_fallback_llm(mock_logger):
    mock_fallback_lm = Mock()
    mock_fallback_lm.return_value = ["Fallback content"]

    existing_info = {
        "research": "Mock research",
        "outline": "Mock outline",
        "partial_article": "Mock partial article",
    }

    result = use_fallback_llm("Test Topic", existing_info, mock_fallback_lm)

    assert result == "Fallback content"
    mock_fallback_lm.assert_called_once()
    assert "Test Topic" in mock_fallback_lm.call_args[0][0]
    assert "Mock research" in mock_fallback_lm.call_args[0][0]
    assert "Mock outline" in mock_fallback_lm.call_args[0][0]
    assert "Mock partial article" in mock_fallback_lm.call_args[0][0]


@patch("util.storm_runner.logger")
def test_use_fallback_llm_with_missing_info(mock_logger):
    mock_fallback_lm = Mock()
    mock_fallback_lm.return_value = ["Fallback content"]

    existing_info = {
        "research": "Mock research",
        "outline": None,
        "partial_article": None,
    }

    result = use_fallback_llm("Test Topic", existing_info, mock_fallback_lm)

    assert result == "Fallback content"
    mock_fallback_lm.assert_called_once()

    # Get the prompt that was passed to the fallback_lm
    call_args = mock_fallback_lm.call_args
    if call_args is not None:
        prompt = call_args[0][0]
        assert "Test Topic" in prompt
        assert "Mock research" in prompt
        assert "No outline available" in prompt
        assert "No partial article available" in prompt
        assert "None" not in prompt
    else:
        pytest.fail("mock_fallback_lm was not called with any arguments")


@patch("util.storm_runner.logger")
def test_use_fallback_llm_exception(mock_logger):
    mock_fallback_lm = Mock()
    mock_fallback_lm.side_effect = Exception("Fallback LLM failed")

    existing_info = {
        "research": "Mock research",
        "outline": "Mock outline",
        "partial_article": "Mock partial article",
    }

    with pytest.raises(Exception, match="Fallback LLM failed"):
        use_fallback_llm("Test Topic", existing_info, mock_fallback_lm)

    mock_logger.error.assert_called_once_with(
        "Error in fallback LLM: Fallback LLM failed"
    )


from openai import NotFoundError, APIError


@patch("util.storm_runner.create_lm_client")
@patch("util.storm_runner.collect_existing_information")
def test_run_storm_with_fallback_model_not_found(
    mock_collect_existing_information, mock_create_lm_client, mock_streamlit
):
    mock_runner = Mock()
    mock_runner.run.side_effect = Exception("Primary LLM failed")

    mock_collect_existing_information.return_value = {"research": "mock research"}

    mock_fallback_lm = Mock()
    error_message = "Error code: 404 - {'error': {'message': 'model \"gpt-4o-mini\" not found, try pulling it first', 'type': 'api_error', 'param': None, 'code': None}}"
    mock_fallback_lm.side_effect = NotFoundError(
        message=error_message,
        response=Mock(status_code=404),
        body={
            "error": {"message": 'model "gpt-4o-mini" not found, try pulling it first'}
        },
    )
    mock_create_lm_client.return_value = mock_fallback_lm

    with pytest.raises(NotFoundError, match='model "gpt-4o-mini" not found'):
        run_storm_with_fallback(
            "test topic",
            "/tmp/test_dir",
            runner=mock_runner,
            fallback_lm=mock_fallback_lm,
        )

    mock_runner.run.assert_called_once()
    mock_collect_existing_information.assert_called_once_with(mock_runner)
    mock_fallback_lm.assert_called_once()
    mock_runner.post_run.assert_called_once()
