import sqlite3
import json
import os
import logging
from typing import Any, Dict

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

DB_PATH = os.path.join(os.path.dirname(__file__), "settings.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS settings
                 (key TEXT PRIMARY KEY, value TEXT)""")
    conn.commit()
    conn.close()


def save_setting(key: str, value: Any):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (key, json.dumps(value)),
    )
    conn.commit()
    conn.close()


def load_setting(key: str, default: Any = None) -> Any:
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT value FROM settings WHERE key=?", (key,))
    result = c.fetchone()
    conn.close()

    if result:
        return json.loads(result[0])
    return default


def save_search_options(options: Dict[str, Any]):
    validate_search_options(options)
    save_setting("search_options", options)


def save_llm_settings(settings: Dict[str, Any]):
    validate_llm_settings(settings)
    save_setting("llm_settings", settings)


def validate_llm_settings(settings: Dict[str, Any]):
    required_keys = {"primary_model", "fallback_model", "model_settings"}
    if not all(key in settings for key in required_keys):
        raise ValueError("Missing required LLM setting keys")

    if not isinstance(settings["model_settings"], dict):
        raise ValueError("model_settings must be a dictionary")

    for model, model_settings in settings["model_settings"].items():
        if "model" not in model_settings or "max_tokens" not in model_settings:
            raise ValueError(f"Missing required keys for {model} in model_settings")

        if (
            not isinstance(model_settings["max_tokens"], int)
            or model_settings["max_tokens"] <= 0
        ):
            raise ValueError(f"max_tokens for {model} must be a positive integer")


def load_search_options() -> Dict[str, Any]:
    default_options = {
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
    loaded_options = load_setting("search_options")
    if loaded_options is None:
        return default_options
    merged_options = default_options.copy()
    merged_options.update(loaded_options)
    validate_search_options(merged_options)
    return merged_options


def update_search_option(key: str, value: Any):
    options = load_search_options()
    keys = key.split(".")
    if len(keys) == 1:
        if key not in options:
            raise ValueError(f"Invalid search option key: {key}")
        options[key] = validate_search_option_value(key, value)
    elif len(keys) == 3 and keys[0] == "engine_settings":
        if keys[1] not in options["engine_settings"]:
            options["engine_settings"][keys[1]] = {}
        options["engine_settings"][keys[1]][keys[2]] = validate_search_option_value(
            key, value
        )
    else:
        raise ValueError(f"Invalid search option key format: {key}")
    save_search_options(options)


def validate_search_options(options: Dict[str, Any]):
    required_keys = {
        "primary_engine",
        "fallback_engine",
        "search_top_k",
        "retrieve_top_k",
        "engine_settings",
    }
    if not all(key in options for key in required_keys):
        raise ValueError("Missing required search option keys")

    if not isinstance(options["search_top_k"], int) or options["search_top_k"] <= 0:
        raise ValueError("search_top_k must be a positive integer")

    if not isinstance(options["retrieve_top_k"], int) or options["retrieve_top_k"] <= 0:
        raise ValueError("retrieve_top_k must be a positive integer")

    if not isinstance(options["engine_settings"], dict):
        raise ValueError("engine_settings must be a dictionary")


def validate_search_option_value(key: str, value: Any) -> Any:
    if key in {"search_top_k", "retrieve_top_k"}:
        if not isinstance(value, int) or value <= 0:
            raise ValueError(f"{key} must be a positive integer")
    elif key == "primary_engine":
        if not isinstance(value, str):
            raise ValueError("primary_engine must be a string")
    elif key == "fallback_engine":
        if value is not None and not isinstance(value, str):
            raise ValueError("fallback_engine must be None or a string")
    elif key.startswith("engine_settings."):
        # Allow any value for engine settings
        pass
    else:
        raise ValueError(f"Unknown search option key: {key}")
    return value


def load_llm_settings() -> Dict[str, Any]:
    default_settings = {
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
    loaded_settings = load_setting("llm_settings")
    if loaded_settings is None:
        return default_settings
    merged_settings = default_settings.copy()
    merged_settings.update(loaded_settings)
    validate_llm_settings(merged_settings)
    return merged_settings


def update_llm_setting(key: str, value: Any):
    settings = load_llm_settings()
    keys = key.split(".")
    if len(keys) == 1:
        if key not in settings:
            raise ValueError(f"Invalid LLM setting key: {key}")
        settings[key] = validate_llm_setting_value(key, value)
    elif len(keys) == 3 and keys[0] == "model_settings":
        if keys[1] not in settings["model_settings"]:
            settings["model_settings"][keys[1]] = {}
        settings["model_settings"][keys[1]][keys[2]] = validate_llm_setting_value(
            key, value
        )
    else:
        raise ValueError(f"Invalid LLM setting key format: {key}")
    save_llm_settings(settings)


def validate_llm_setting_value(key: str, value: Any) -> Any:
    if key in {"primary_model", "fallback_model"}:
        if value is not None and not isinstance(value, str):
            raise ValueError(f"{key} must be None or a string")
    elif key.endswith(".max_tokens"):
        if not isinstance(value, int) or value <= 0:
            raise ValueError("max_tokens must be a positive integer")
    elif key.endswith(".model"):
        if not isinstance(value, str):
            raise ValueError("model must be a string")
    else:
        raise ValueError(f"Unknown LLM setting key: {key}")
    return value
