import streamlit as st
from util.theme_manager import (
    dark_themes,
    light_themes,
    get_theme_css,
    get_preview_html,
    get_contrasting_text_color,
    load_and_apply_theme,
    update_theme_and_rerun,
    save_theme,
    load_theme_from_db as load_theme,
)
import sqlite3
import json
import subprocess


def save_search_options(search_top_k, retrieve_top_k):
    conn = sqlite3.connect("settings.db")
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (
            "search_options",
            json.dumps(
                {"search_top_k": search_top_k, "retrieve_top_k": retrieve_top_k}
            ),
        ),
    )
    conn.commit()
    conn.close()


# Function to load search options
def load_search_options():
    conn = sqlite3.connect("settings.db")
    c = conn.cursor()
    c.execute("SELECT value FROM settings WHERE key='search_options'")
    result = c.fetchone()
    conn.close()

    if result:
        return json.loads(result[0])
    return {"search_top_k": 3, "retrieve_top_k": 3}


def save_ollama_settings(model, url, port, max_tokens):
    conn = sqlite3.connect("settings.db")
    c = conn.cursor()
    c.execute(
        "INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)",
        (
            "ollama_settings",
            json.dumps(
                {"model": model, "url": url, "port": port, "max_tokens": max_tokens}
            ),
        ),
    )
    conn.commit()
    conn.close()


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


def load_ollama_settings():
    conn = sqlite3.connect("settings.db")
    c = conn.cursor()
    c.execute("SELECT value FROM settings WHERE key='ollama_settings'")
    result = c.fetchone()
    conn.close()

    if result:
        settings = json.loads(result[0])
    else:
        settings = {
            "model": "jaigouk/hermes-2-theta-llama-3:latest",
            "url": "http://localhost",
            "port": 11434,
            "max_tokens": 2000,
        }

    # Fetch the list of downloaded models
    models_list = list_downloaded_models()
    if settings["model"] not in models_list:
        models_list.insert(
            0, settings["model"]
        )  # Ensure the current model is in the list

    return settings, models_list


def settings_page(selected_setting):
    current_theme = load_and_apply_theme()
    st.title("Settings")

    if selected_setting == "Search":
        st.header("Search Options Settings")
        search_options = load_search_options()
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
        if st.button("Save Search Options"):
            save_search_options(search_top_k, retrieve_top_k)
            st.success("Search options saved successfully!")

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

    elif selected_setting == "Ollama":
        st.header("Ollama Settings")
        ollama_settings, models_list = load_ollama_settings()
        model = st.selectbox(
            "Model", models_list, index=models_list.index(ollama_settings["model"])
        )
        url = st.text_input("URL", value=ollama_settings["url"])
        port = st.number_input(
            "Port", min_value=1, max_value=65535, value=ollama_settings["port"]
        )
        max_tokens = st.number_input(
            "Max Tokens",
            min_value=1,
            max_value=10000,
            value=ollama_settings["max_tokens"],
        )

        if st.button("Save Ollama Settings"):
            save_ollama_settings(model, url, port, max_tokens)
            st.success("Ollama settings saved successfully!")

    # Apply the current theme
    st.markdown(get_theme_css(current_theme), unsafe_allow_html=True)
