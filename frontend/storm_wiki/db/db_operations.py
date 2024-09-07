import logging
import streamlit as st
from typing import Any, Dict
from db.db_core import save_setting, load_setting

logging.basicConfig(
    level=logging.INFO, format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)

def get_consts():
    from util.consts import DEFAULT_SEARCH_OPTIONS, DEFAULT_LLM_SETTINGS, LLM_MODELS
    return DEFAULT_SEARCH_OPTIONS, DEFAULT_LLM_SETTINGS, LLM_MODELS

def get_db_core():
    from db.db_core import save_setting, load_setting
    return save_setting, load_setting

def load_search_options() -> Dict[str, Any]:
    save_setting, load_setting = get_db_core()
    DEFAULT_SEARCH_OPTIONS, _, _ = get_consts()
    options = load_setting("search_options")
    if options is None:
        options = DEFAULT_SEARCH_OPTIONS.copy()
        save_search_options(options)
    return options

def save_search_options(options: Dict[str, Any]):
    save_setting, _ = get_db_core()
    save_setting("search_options", options)

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

def load_llm_settings() -> Dict[str, Any]:
    save_setting, load_setting = get_db_core()
    _, DEFAULT_LLM_SETTINGS, _ = get_consts()
    settings = load_setting("llm_settings")
    if settings is None:
        settings = DEFAULT_LLM_SETTINGS.copy()
        save_llm_settings(settings)
    return settings

def save_llm_settings(settings: Dict[str, Any]):
    validate_llm_settings(settings)
    save_setting("llm_settings", settings)

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


def update_settings_with_secrets(options, settings):
    for engine, config in options["engine_settings"].items():
        for key, value in config.items():
            env_var = f"{engine.upper()}_{key.upper()}"
            config[key] = st.secrets.get(env_var, value)

    for model, config in settings["model_settings"].items():
        env_var = LLM_MODELS.get(model)
        if env_var:
            config["api_key"] = st.secrets.get(env_var)

    return options, settings


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
