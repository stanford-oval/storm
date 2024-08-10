import sqlite3
import json
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "settings.db")


def init_db():
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("""CREATE TABLE IF NOT EXISTS settings
                 (key TEXT PRIMARY KEY, value TEXT)""")
    conn.commit()
    conn.close()


def save_setting(key, value):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (key, json.dumps(value)),
    )
    conn.commit()
    conn.close()


def load_setting(key, default=None):
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    c.execute("SELECT value FROM settings WHERE key=?", (key,))
    result = c.fetchone()
    conn.close()

    if result:
        return json.loads(result[0])
    return default


def load_search_options():
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
    return loaded_options if loaded_options is not None else default_options


def save_search_options(options):
    save_setting("search_options", options)


def load_llm_settings():
    default_settings = {
        "primary_model": "ollama",
        "fallback_model": None,
        "model_settings": {
            "ollama": {
                "model": "jaigouk/hermes-2-theta-llama-3:latest",
                "max_tokens": 500,
            },
            "openai": {"model": "gpt-4o-mini", "max_tokens": 500},
            "anthropic": {"model": "claude-3-haiku-202403072", "max_tokens": 500},
        },
    }
    loaded_settings = load_setting("llm_settings")
    return loaded_settings if loaded_settings is not None else default_settings


def save_llm_settings(settings):
    save_setting("llm_settings", settings)
