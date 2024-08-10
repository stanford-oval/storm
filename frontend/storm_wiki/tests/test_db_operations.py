import pytest
import os
import json
from db.db_operations import (
    DB_PATH,
    init_db,
    save_setting,
    load_setting,
    load_search_options,
    save_search_options,
    load_llm_settings,
    save_llm_settings,
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


def test_save_and_load_search_options(test_db):
    options = {
        "primary_engine": "test_engine",
        "fallback_engine": "fallback_engine",
        "search_top_k": 5,
        "retrieve_top_k": 3,
        "engine_settings": {"test_engine": {"api_key": "test_key"}},
    }
    save_search_options(options)
    loaded_options = load_search_options()
    assert loaded_options == options


def test_load_search_options_default(test_db):
    # First, ensure no search options are saved
    save_setting("search_options", None)

    default_options = load_search_options()
    assert default_options["primary_engine"] == "duckduckgo"
    assert default_options["fallback_engine"] is None
    assert default_options["search_top_k"] == 3
    assert default_options["retrieve_top_k"] == 3
    assert "searxng" in default_options["engine_settings"]
    assert "bing" in default_options["engine_settings"]
    assert "yourdm" in default_options["engine_settings"]


def test_save_and_load_llm_settings(test_db):
    settings = {
        "primary_model": "test_model",
        "fallback_model": "fallback_model",
        "model_settings": {
            "test_model": {"model": "test_model_name", "max_tokens": 1000}
        },
    }
    save_llm_settings(settings)
    loaded_settings = load_llm_settings()
    assert loaded_settings == settings


def test_load_llm_settings_default(test_db):
    # First, ensure no LLM settings are saved
    save_setting("llm_settings", None)

    default_settings = load_llm_settings()
    assert default_settings["primary_model"] == "ollama"
    assert default_settings["fallback_model"] is None
    assert "ollama" in default_settings["model_settings"]
    assert "openai" in default_settings["model_settings"]
    assert "anthropic" in default_settings["model_settings"]


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
