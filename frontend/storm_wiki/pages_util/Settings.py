import streamlit as st
from util.theme_manager import (
    dark_themes,
    light_themes,
    get_theme_css,
    get_preview_html,
    load_and_apply_theme,
    save_theme,
    load_theme_from_db as load_theme,
)
import sqlite3
import json
import subprocess

# Search engine options
SEARCH_ENGINES = {
    "searxng": "SEARXNG_BASE_URL",
    "bing": "BING_SEARCH_API_KEY",
    "yourdm": "YDC_API_KEY",
    "duckduckgo": None,
    "arxiv": None,
}

# LLM model options
LLM_MODELS = {
    "ollama": "OLLAMA_PORT",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}


def save_general_settings(num_columns):
    try:
        num_columns = int(num_columns)
    except ValueError:
        num_columns = 3  # Default to 3 if conversion fails

    conn = sqlite3.connect("settings.db")
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        ("general_settings", json.dumps({"num_columns": num_columns})),
    )
    conn.commit()
    conn.close()


def load_general_settings():
    conn = sqlite3.connect("settings.db")
    c = conn.cursor()
    c.execute("SELECT value FROM settings WHERE key='general_settings'")
    result = c.fetchone()
    conn.close()

    if result:
        return json.loads(result[0])
    return {"num_columns": 3}  # Default value


def get_available_search_engines():
    available_engines = {"duckduckgo": None, "arxiv": None}

    if "SEARXNG_BASE_URL" in st.secrets:
        available_engines["searxng"] = "SEARXNG_BASE_URL"
    if "BING_SEARCH_API_KEY" in st.secrets:
        available_engines["bing"] = "BING_SEARCH_API_KEY"
    if "YDC_API_KEY" in st.secrets:
        available_engines["yourdm"] = "YDC_API_KEY"

    return available_engines


def save_search_options(primary_engine, fallback_engine, search_top_k, retrieve_top_k):
    conn = sqlite3.connect("settings.db")
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (
            "search_options",
            json.dumps(
                {
                    "primary_engine": primary_engine,
                    "fallback_engine": fallback_engine,
                    "search_top_k": search_top_k,
                    "retrieve_top_k": retrieve_top_k,
                }
            ),
        ),
    )
    conn.commit()
    conn.close()


def load_search_options():
    conn = sqlite3.connect("settings.db")
    c = conn.cursor()
    c.execute("SELECT value FROM settings WHERE key='search_options'")
    result = c.fetchone()
    conn.close()

    if result:
        return json.loads(result[0])
    return {
        "primary_engine": "duckduckgo",
        "fallback_engine": None,
        "search_top_k": 3,
        "retrieve_top_k": 3,
    }


def save_llm_settings(primary_model, fallback_model, model_settings):
    conn = sqlite3.connect("settings.db")
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (
            "llm_settings",
            json.dumps(
                {
                    "primary_model": primary_model,
                    "fallback_model": fallback_model,
                    "model_settings": model_settings,
                }
            ),
        ),
    )
    conn.commit()
    conn.close()


def load_llm_settings():
    conn = sqlite3.connect("settings.db")
    c = conn.cursor()
    c.execute("SELECT value FROM settings WHERE key='llm_settings'")
    result = c.fetchone()
    conn.close()

    if result:
        return json.loads(result[0])
    return {
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


def list_downloaded_models():
    try:
        # Execute the 'ollama list' command
        output = subprocess.check_output(["ollama", "list"], stderr=subprocess.STDOUT)
        # Decode the output and extract the model names
        models_list = []
        for line in output.decode("utf-8").splitlines():
            model_name = line.split()[0]  # Extract the first part of the line
            models_list.append(model_name)
        return models_list
    except Exception as e:
        print(f"Error executing command: {e}")
        return []


def settings_page(selected_setting):
    current_theme = load_and_apply_theme()
    st.title("Settings")

    if selected_setting == "Search":
        st.header("Search Options Settings")
        search_options = load_search_options()

        primary_engine = st.selectbox(
            "Primary Search Engine",
            options=list(SEARCH_ENGINES.keys()),
            index=list(SEARCH_ENGINES.keys()).index(search_options["primary_engine"]),
        )

        fallback_engine = st.selectbox(
            "Fallback Search Engine",
            options=[None]
            + [engine for engine in SEARCH_ENGINES.keys() if engine != primary_engine],
            index=0
            if search_options["fallback_engine"] is None
            else (
                [None]
                + [
                    engine
                    for engine in SEARCH_ENGINES.keys()
                    if engine != primary_engine
                ]
            ).index(search_options["fallback_engine"]),
        )

        search_top_k = st.number_input(
            "Search Top K",
            min_value=1,
            max_value=100,
            value=search_options["search_top_k"],
        )
        retrieve_top_k = st.number_input(
            "Retrieve Top K",
            min_value=1,
            max_value=100,
            value=search_options["retrieve_top_k"],
        )

        if primary_engine == "arxiv" or fallback_engine == "arxiv":
            st.info(
                "ArXiv search is available without an API key. It uses the public ArXiv API."
            )

        if st.button("Save Search Options"):
            save_search_options(
                primary_engine, fallback_engine, search_top_k, retrieve_top_k
            )
            st.success("Search options saved successfully!")

    elif selected_setting == "LLM":
        st.header("LLM Settings")
        llm_settings = load_llm_settings()

        primary_model = st.selectbox(
            "Primary LLM Model",
            options=list(LLM_MODELS.keys()),
            index=list(LLM_MODELS.keys()).index(llm_settings["primary_model"]),
        )

        fallback_model = st.selectbox(
            "Fallback LLM Model",
            options=[None]
            + [model for model in LLM_MODELS.keys() if model != primary_model],
            index=0
            if llm_settings["fallback_model"] is None
            else (
                [None]
                + [model for model in LLM_MODELS.keys() if model != primary_model]
            ).index(llm_settings["fallback_model"]),
        )

        model_settings = llm_settings["model_settings"]

        st.subheader("Model-specific Settings")
        for model, env_var in LLM_MODELS.items():
            st.write(f"{model.capitalize()} Settings")
            model_settings[model] = model_settings.get(model, {})

            if model == "ollama":
                downloaded_models = list_downloaded_models()
                model_settings[model]["model"] = st.selectbox(
                    "Ollama Model",
                    options=downloaded_models,
                    index=downloaded_models.index(
                        model_settings[model].get(
                            "model", "jaigouk/hermes-2-theta-llama-3:latest"
                        )
                    ),
                )
            elif model == "openai":
                model_settings[model]["model"] = st.selectbox(
                    "OpenAI Model",
                    options=["gpt-4o-mini", "gpt-4o"],
                    index=0
                    if model_settings[model].get("model") == "gpt-4o-mini"
                    else 1,
                )
            elif model == "anthropic":
                model_settings[model]["model"] = st.selectbox(
                    "Anthropic Model",
                    options=["claude-3-haiku-20240307", "claude-3-5-sonnet-20240620"],
                    index=0
                    if model_settings[model].get("model") == "claude-3-haiku-20240307"
                    else 1,
                )

            model_settings[model]["max_tokens"] = st.number_input(
                f"{model.capitalize()} Max Tokens",
                min_value=1,
                max_value=10000,
                value=model_settings[model].get("max_tokens", 500),
            )

        if st.button("Save LLM Settings"):
            save_llm_settings(primary_model, fallback_model, model_settings)
            st.success("LLM settings saved successfully!")

    elif selected_setting == "Theme":
        st.header("Theme Settings")

        # Determine if the current theme is Light or Dark
        current_theme_mode = (
            "Light" if current_theme in light_themes.values() else "Dark"
        )
        theme_mode = st.radio(
            "Theme Mode",
            ["Light", "Dark"],
            index=["Light", "Dark"].index(current_theme_mode),
        )

        theme_options = light_themes if theme_mode == "Light" else dark_themes

        # Find the name of the current theme
        current_theme_name = next(
            (k for k, v in theme_options.items() if v == current_theme), None
        )

        if current_theme_name is None:
            # If the current theme is not in the selected mode, default to the first theme in the list
            current_theme_name = list(theme_options.keys())[0]

        selected_theme_name = st.selectbox(
            "Select a theme",
            list(theme_options.keys()),
            index=list(theme_options.keys()).index(current_theme_name),
        )

        # Update current_theme when a new theme is selected
        current_theme = theme_options[selected_theme_name]

        st.subheader("Color Customization")
        col1, col2 = st.columns(2)

        with col1:
            custom_theme = {}
            for key, value in current_theme.items():
                if key != "font":
                    custom_theme[key] = st.color_picker(f"{key}", value)
                else:
                    custom_theme[key] = st.selectbox(
                        "Font",
                        ["sans serif", "serif", "monospace"],
                        index=["sans serif", "serif", "monospace"].index(value),
                    )

        with col2:
            st.markdown(get_preview_html(custom_theme), unsafe_allow_html=True)

        if st.button("Apply Theme"):
            save_theme(custom_theme)
            st.session_state.current_theme = custom_theme
            st.success("Theme applied successfully!")
            st.session_state.force_rerun = True
            st.rerun()

    elif selected_setting == "General":
        st.header("Display Settings")

        general_settings = load_general_settings()

        # Handle the case where num_columns might be a dictionary
        current_num_columns = general_settings.get("num_columns", 3)
        if isinstance(current_num_columns, dict):
            current_num_columns = current_num_columns.get("num_columns", 3)

        try:
            current_num_columns = int(current_num_columns)
        except (ValueError, TypeError):
            current_num_columns = 3  # Default to 3 if conversion fails

        num_columns = st.number_input(
            "Number of columns in article list",
            min_value=1,
            max_value=6,
            value=current_num_columns,
            step=1,
            help="Set the number of columns for displaying articles in the My Articles page.",
        )

        if st.button("Save Display Settings"):
            general_settings["num_columns"] = num_columns
            save_general_settings(general_settings)
            st.success("Display settings saved successfully!")

    # Apply the current theme
    st.markdown(get_theme_css(current_theme), unsafe_allow_html=True)
