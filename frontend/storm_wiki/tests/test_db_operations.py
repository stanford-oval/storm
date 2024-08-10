import pytest
import os
from db.db_operations import (
    DB_PATH,
    init_db,
    save_setting,
    load_setting,
    load_search_options,
    save_search_options,
    update_search_option,
    load_llm_settings,
    save_llm_settings,
    update_llm_setting,
)


@pytest.fixture(scope="function")
def test_db():
    # Use a temporary database for testing
    test_db_path = "test_settings.db"
    original_db_path = DB_PATH

    # Temporarily change the DB_PATH
    globals()["DB_PATH"] = test_db_path

    init_db()

    yield

    # Clean up: remove the test database and restore the original DB_PATH
    if os.path.exists(test_db_path):
        os.remove(test_db_path)
    globals()["DB_PATH"] = original_db_path


@pytest.fixture
def default_search_options():
    return {
        "primary_engine": "duckduckgo",
        "fallback_engine": None,
        "search_top_k": 3,
        "retrieve_top_k": 3,
        "engine_settings": {
            "searxng": {"base_url": "", "api_key": ""},
            "bing": {"api_key": ""},
            "yourdm": {"api_key": ""},
        },
    }


@pytest.fixture
def default_llm_settings():
    return {
        "primary_model": "ollama",
        "fallback_model": None,
        "model_settings": {
            "ollama": {
                "model": "jaigouk/hermes-2-theta-llama-3:latest",
                "max_tokens": 500,
            },
            "openai": {"model": "gpt-4o-mini", "max_tokens": 500},
            "anthropic": {"model": "claude-3-haiku-20240307", "max_tokens": 500},
        },
    }


def test_save_and_load_setting(test_db):
    key = "test_key"
    value = {"test": "value"}
    save_setting(key, value)
    loaded_value = load_setting(key)
    assert loaded_value == value


def test_load_setting_default(test_db):
    key = "non_existent_key"
    default_value = "default"
    loaded_value = load_setting(key, default_value)
    assert loaded_value == default_value


def test_save_and_load_search_options(default_search_options):
    save_search_options(default_search_options)
    loaded_options = load_search_options()
    assert loaded_options == default_search_options


def test_update_search_option_valid(default_search_options):
    save_search_options(default_search_options)
    update_search_option("primary_engine", "bing")
    loaded_options = load_search_options()
    assert loaded_options["primary_engine"] == "bing"


def test_update_search_option_top_level(test_db):
    initial_options = load_search_options()
    initial_primary_engine = initial_options["primary_engine"]

    # Update to a different engine
    new_engine = "bing" if initial_primary_engine != "bing" else "duckduckgo"
    update_search_option("primary_engine", new_engine)

    updated_options = load_search_options()
    assert updated_options["primary_engine"] == new_engine
    assert updated_options["primary_engine"] != initial_primary_engine


def test_update_search_option_nested(test_db):
    # Set initial search options
    initial_options = load_search_options()

    # Update a nested option
    update_search_option("engine_settings.searxng.base_url", "https://example.com")

    # Load and check the updated options
    updated_options = load_search_options()
    assert (
        updated_options["engine_settings"]["searxng"]["base_url"]
        == "https://example.com"
    )
    assert updated_options != initial_options


def test_update_search_option_new_nested(test_db):
    update_search_option("engine_settings.new_engine.api_key", "new_key")
    updated_options = load_search_options()
    assert updated_options["engine_settings"]["new_engine"]["api_key"] == "new_key"


def test_update_search_option_invalid_key(test_db):
    with pytest.raises(ValueError):
        update_search_option("invalid_key", "value")


def test_update_search_option_invalid_value(test_db):
    with pytest.raises(ValueError):
        update_search_option("search_top_k", "not_a_number")


def test_update_search_option_numeric(test_db):
    update_search_option("search_top_k", 10)
    updated_options = load_search_options()
    assert updated_options["search_top_k"] == 10


def test_load_search_options_default(test_db):
    save_setting("search_options", None)
    default_options = load_search_options()
    assert default_options["primary_engine"] == "duckduckgo"
    assert "engine_settings" in default_options


def test_save_and_load_llm_settings(default_llm_settings):
    save_llm_settings(default_llm_settings)
    loaded_settings = load_llm_settings()
    assert loaded_settings == default_llm_settings


def test_update_llm_setting_valid(default_llm_settings):
    save_llm_settings(default_llm_settings)
    update_llm_setting("primary_model", "openai")
    loaded_settings = load_llm_settings()
    assert loaded_settings["primary_model"] == "openai"


def test_update_llm_setting_invalid_key():
    with pytest.raises(ValueError):
        update_llm_setting("invalid_key", "value")


def test_load_llm_settings_default(test_db):
    save_setting("llm_settings", None)
    default_settings = load_llm_settings()
    assert default_settings["primary_model"] == "ollama"
    assert "model_settings" in default_settings


def test_update_llm_setting_invalid_value(test_db):
    with pytest.raises(ValueError):
        update_llm_setting("model_settings.ollama.max_tokens", "not_a_number")


def test_update_nested_llm_setting(default_llm_settings):
    save_llm_settings(default_llm_settings)
    update_llm_setting("model_settings.ollama.model", "llama2")
    loaded_settings = load_llm_settings()
    assert loaded_settings["model_settings"]["ollama"]["model"] == "llama2"


def test_overwrite_setting(test_db):
    key = "overwrite_test"
    value1 = {"test": "value1"}
    value2 = {"test": "value2"}

    save_setting(key, value1)
    loaded_value1 = load_setting(key)
    assert loaded_value1 == value1

    save_setting(key, value2)
    loaded_value2 = load_setting(key)
    assert loaded_value2 == value2
