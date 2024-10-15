import streamlit as st
import subprocess
import shutil
import os
import re
from util.file_io import FileIOHelper
from util.ui_components import UIComponents
from util.consts import (
    SEARCH_ENGINES,
    DARK_THEMES,
    LIGHT_THEMES,
    LLM_MODELS
)
from util.theme_manager import (
    save_theme,
    load_theme_from_db,
    get_preview_html,
    get_all_custom_css,
    load_and_apply_theme,
    get_theme_css,
    get_global_css,
    get_option_menu_style,
)
from db.db_operations import (
    load_setting,
    save_setting,
    load_search_options,
    update_search_option,
    load_llm_settings,
    save_llm_settings,
)

import logging
logger = logging.getLogger(__name__)

def load_output_dir():
    return FileIOHelper.load_output_base_dir()

def save_output_dir(output_dir):
    FileIOHelper.save_output_base_dir(output_dir)

def load_categories():
    return FileIOHelper.load_categories()

def save_categories(categories):
    FileIOHelper.save_categories(categories)

def get_available_search_engines():
    available_engines = {}
    search_options = load_search_options()
    engine_settings = search_options.get("engine_settings", {})

    for engine, config in SEARCH_ENGINES.items():
        if config["env_var"] is None or engine == "SearXNG":
            available_engines[engine] = None
        elif engine in config.get("settings", {}):
            required_settings = [
                key
                for key, setting in config["settings"].items()
                if setting.get("required", False)
            ]
            if all(
                engine_settings.get(engine, {}).get(key) for key in required_settings
            ):
                available_engines[engine] = config["env_var"]
        elif config["env_var"] in st.secrets:
            available_engines[engine] = config["env_var"]

    return available_engines

def llm_settings():
    st.subheader("LLM Settings")
    llm_settings = load_llm_settings()

    primary_model = st.selectbox(
        "Primary LLM Model",
        options=list(LLM_MODELS.keys()),
        index=list(LLM_MODELS.keys()).index(llm_settings["primary_model"]),
        key="primary_model_input",
        on_change=update_llm_setting,
        args=("primary_model", llm_settings),
    )

    fallback_model_options = [None] + [
        model for model in LLM_MODELS.keys() if model != primary_model
    ]
    st.selectbox(
        "Fallback LLM Model",
        options=fallback_model_options,
        index=fallback_model_options.index(llm_settings["fallback_model"])
        if llm_settings["fallback_model"] in fallback_model_options
        else 0,
        key="fallback_model_input",
        on_change=update_llm_setting,
        args=("fallback_model", llm_settings),
    )

    st.subheader("Model-specific Settings")
    for model, env_var in LLM_MODELS.items():
        st.write(f"{model.capitalize()} Settings")
        model_settings = llm_settings.get("model_settings", {}).setdefault(model, {})

        if model == "ollama":
            downloaded_models = list_downloaded_models()
            st.selectbox(
                "Ollama Model",
                options=downloaded_models,
                index=downloaded_models.index(
                    model_settings.get("model", "mistral-nemo:12b-instruct-2407-q6_K")
                ) if model_settings.get("model") in downloaded_models else 0,
                key=f"model_settings.{model}.model_input",
                on_change=update_llm_setting,
                args=(f"model_settings.{model}.model", llm_settings),
            )
        elif model in ["openai", "anthropic"]:
            model_options = {
                "openai": ["gpt-4o-mini", "gpt-4o"],
                "anthropic": ["claude-3-haiku-20240307", "claude-3-5-sonnet-20240620"]
            }
            st.selectbox(
                f"{model.capitalize()} Model",
                options=model_options[model],
                index=model_options[model].index(model_settings.get("model", model_options[model][0])),
                key=f"model_settings.{model}.model_input",
                on_change=update_llm_setting,
                args=(f"model_settings.{model}.model", llm_settings),
            )

        st.number_input(
            f"{model.capitalize()} Max Tokens",
            min_value=1,
            max_value=10000,
            value=int(model_settings.get("max_tokens", 4000)),
            key=f"model_settings.{model}.max_tokens_input",
            on_change=update_llm_setting,
            args=(f"model_settings.{model}.max_tokens", llm_settings),
        )

        api_key = st.text_input(
            f"{model.capitalize()} API Key",
            type="password",
            value=st.secrets.get(env_var, ""),
            key=f"model_settings.{model}.api_key_input",
        )
        if api_key:
            model_settings["api_key"] = api_key
            update_llm_setting(f"model_settings.{model}.api_key", llm_settings)

def list_downloaded_models():
    try:
        output = subprocess.check_output(["ollama", "list"], stderr=subprocess.STDOUT)
        return [line.split()[0] for line in output.decode("utf-8").splitlines()]
    except Exception as e:
        logger.error(f"Error listing Ollama models: {e}")
        return []

def settings_page(selected_setting=None):
    current_theme = load_and_apply_theme()
    UIComponents.apply_custom_css()

    st.markdown(get_theme_css(current_theme), unsafe_allow_html=True)
    st.markdown(get_global_css(current_theme), unsafe_allow_html=True)
    st.markdown(get_all_custom_css(current_theme), unsafe_allow_html=True)

    st.title("Settings")

    settings_map = {
        "General": general_settings,
        "Theme": theme_settings,
        "Search": search_settings,
        "LLM": llm_settings,
        "Categories": category_settings
    }

    if selected_setting in settings_map:
        settings_map[selected_setting]()
    else:
        st.error(f"Unknown setting: {selected_setting}")

def update_theme(custom_theme):
    save_theme(custom_theme)
    st.session_state.current_theme = custom_theme

def update_llm_setting(key, llm_settings):
    keys = key.split(".")
    if len(keys) == 1:
        llm_settings[key] = st.session_state[f"{key}_input"]
    elif len(keys) == 3:
        llm_settings.setdefault(keys[0], {}).setdefault(keys[1], {})[keys[2]] = st.session_state[f"{key}_input"]
    else:
        logger.error(f"Unexpected key format: {key}")
    save_llm_settings(llm_settings)

def is_valid_hex_color(color):
    return bool(re.match(r"^#(?:[0-9a-fA-F]{3}){1,2}$", color))

def theme_settings():
    st.subheader("Theme Settings")
    current_theme = st.session_state.current_theme.copy()

    theme_mode = st.radio(
        "Theme Mode",
        ["Light", "Dark"],
        index=0 if current_theme in LIGHT_THEMES.values() else 1,
        key="theme_mode_radio",
    )

    theme_options = LIGHT_THEMES if theme_mode == "Light" else DARK_THEMES
    current_theme_name = next((k for k, v in theme_options.items() if v == current_theme), None)
    current_theme_name = current_theme_name or list(theme_options.keys())[0]

    selected_theme_name = st.selectbox(
        "Select a theme",
        list(theme_options.keys()),
        index=list(theme_options.keys()).index(current_theme_name),
        key="theme_select",
    )

    base_theme = theme_options[selected_theme_name]

    st.subheader("Color Customization")
    col1, col2 = st.columns(2)

    custom_theme = {}
    with col1:
        for key, value in base_theme.items():
            if key != "font":
                custom_theme[key] = st.color_picker(f"{key}", value, key=f"color_picker_{key}")
            else:
                custom_theme[key] = st.selectbox(
                    "Font",
                    ["sans serif", "serif", "monospace"],
                    index=["sans serif", "serif", "monospace"].index(value),
                    key="font_select",
                )

    with col2:
        st.markdown(get_preview_html(custom_theme), unsafe_allow_html=True)

    if st.button("Apply Theme"):
        save_theme(custom_theme)
        st.session_state.current_theme = custom_theme
        st.session_state.option_menu_style = get_option_menu_style(custom_theme)
        st.session_state.theme_updated = True
        st.success("Theme applied successfully!")
        st.rerun()

def search_settings():
    st.subheader("Search Options Settings")
    search_options = load_search_options()

    update_search_option_callback = lambda key: update_search_option(key, st.session_state[f"{key}_input"])

    st.selectbox(
        "Primary Search Engine",
        options=list(SEARCH_ENGINES.keys()),
        index=list(SEARCH_ENGINES.keys()).index(search_options["primary_engine"]),
        key="primary_engine_input",
        on_change=update_search_option_callback,
        args=("primary_engine",),
    )

    fallback_options = [None] + [engine for engine in SEARCH_ENGINES.keys() if engine != search_options["primary_engine"]]
    st.selectbox(
        "Fallback Search Engine",
        options=fallback_options,
        index=fallback_options.index(search_options["fallback_engine"]) if search_options["fallback_engine"] in fallback_options else 0,
        key="fallback_engine_input",
        on_change=update_search_option_callback,
        args=("fallback_engine",),
    )

    st.number_input(
        "Search Top K",
        min_value=1,
        max_value=100,
        value=search_options["search_top_k"],
        key="search_top_k_input",
        on_change=update_search_option_callback,
        args=("search_top_k",),
    )

    st.number_input(
        "Retrieve Top K",
        min_value=1,
        max_value=100,
        value=search_options["retrieve_top_k"],
        key="retrieve_top_k_input",
        on_change=update_search_option_callback,
        args=("retrieve_top_k",),
    )

    st.subheader("Engine-specific Settings")
    engine_settings = search_options.get("engine_settings", {})

    for engine in SEARCH_ENGINES:
        with st.expander(f"{engine.capitalize()} Settings"):
            engine_settings[engine] = get_engine_specific_settings(
                engine, engine_settings.get(engine, {}), update_search_option_callback
            )

def get_engine_specific_settings(engine, current_settings, update_callback):
    settings = {}
    if engine in SEARCH_ENGINES and "settings" in SEARCH_ENGINES[engine]:
        for key, config in SEARCH_ENGINES[engine]["settings"].items():
            input_type = config.get("type", "text")
            input_key = f"engine_settings.{engine}.{key}_input"
            value = st.secrets.get(f"{engine.upper()}_{key.upper()}", current_settings.get(key, ""))

            if input_type == "text":
                settings[key] = st.text_input(config["label"], value=value, key=input_key, on_change=update_callback, args=(f"engine_settings.{engine}.{key}",))
            elif input_type == "password":
                settings[key] = st.text_input(config["label"], type="password", value=value, key=input_key, on_change=update_callback, args=(f"engine_settings.{engine}.{key}",))
    return settings

def general_settings():
    st.subheader("Display Settings")
    general_settings = load_setting("general_settings", {"num_columns": 3})

    def update_general_setting(key):
        general_settings[key] = st.session_state[f"{key}_input"]
        save_setting("general_settings", general_settings)
        if key == "num_columns":
            st.session_state.num_columns = general_settings[key]

    st.number_input(
        "Number of columns in article list",
        min_value=1,
        max_value=6,
        value=general_settings.get("num_columns", 3),
        step=1,
        help="Set the number of columns for displaying articles in the My Articles page.",
        key="num_columns_input",
        on_change=update_general_setting,
        args=("num_columns",),
    )

    st.subheader("Phoenix Settings")
    phoenix_settings = load_setting(
        "phoenix_settings",
        {
            "project_name": "storm-wiki",
            "enabled": False,
            "collector_endpoint": "localhost:6006",
        },
    )

    def update_phoenix_setting(key):
        phoenix_settings[key] = st.session_state[f"phoenix_{key}_input"]
        save_setting("phoenix_settings", phoenix_settings)
        st.session_state.phoenix_settings_updated = True

    st.toggle(
        "Enable Phoenix Tracing" if not phoenix_settings["enabled"] else "Disable Phoenix Tracing",
        value=phoenix_settings["enabled"],
        help="Toggle Phoenix tracing on/off.",
        key="phoenix_enabled_input",
        on_change=update_phoenix_setting,
        args=("enabled",),
    )

    st.text_input(
        "Phoenix Project Name",
        value=phoenix_settings["project_name"],
        help="Set the project name for Phoenix tracing.",
        key="phoenix_project_name_input",
        on_change=update_phoenix_setting,
        args=("project_name",),
    )

    st.text_input(
        "Phoenix Collector Endpoint",
        value=phoenix_settings["collector_endpoint"],
        help="Set the endpoint for the Phoenix collector.",
        key="phoenix_collector_endpoint_input",
        on_change=update_phoenix_setting,
        args=("collector_endpoint",),
    )

def category_settings():
    st.header("Category Management")

    with st.expander("## Output Directory", expanded=False):
        output_dir = load_output_dir()
        new_output_dir = st.text_input("Set output directory", value=output_dir)
        if st.button("Update Output Directory"):
            save_output_dir(new_output_dir)
            st.success(f"Output directory updated to: {new_output_dir}")
            os.environ["STREAMLIT_OUTPUT_DIR"] = new_output_dir

    with st.expander("## Manage Existing Categories", expanded=False):
        categories = load_categories()
        if categories:
            for category in categories:
                col1, col2, col3 = st.columns([3, 1, 1])
                with col1:
                    st.write(f"- {category}")
                with col2:
                    if st.button(f"Edit", key=f"edit_{category}"):
                        st.session_state.editing_category = category
                with col3:
                    if st.button(f"Delete", key=f"delete_{category}"):
                        st.session_state.deleting_category = category

            if "editing_category" in st.session_state:
                st.markdown("---")
                st.write(f"Editing category: {st.session_state.editing_category}")
                new_name = st.text_input(
                    "New category name", value=st.session_state.editing_category
                )
                if st.button("Update Category"):
                    update_category(st.session_state.editing_category, new_name)
                    del st.session_state.editing_category
                    st.rerun()

            if "deleting_category" in st.session_state:
                st.markdown("---")
                st.write(f"Deleting category: {st.session_state.deleting_category}")
                remaining_categories = [
                    cat for cat in categories if cat != st.session_state.deleting_category
                ]
                if remaining_categories:
                    target_category = st.selectbox("Move articles to:", remaining_categories)
                    if st.button("Confirm Delete"):
                        delete_category(st.session_state.deleting_category, target_category)
                        del st.session_state.deleting_category
                        st.rerun()
                else:
                    st.warning("Cannot delete the last remaining category.")
        else:
            st.info("No existing categories.")


def update_category(old_name, new_name):
    categories = load_categories()
    if old_name in categories:
        categories[categories.index(old_name)] = new_name
        save_categories(categories)
        rename_category_folder(old_name, new_name)
        st.success(f"Category updated from {old_name} to {new_name}")
    else:
        st.error("Category not found")

def delete_category(category, target_category):
    categories = load_categories()
    if category in categories:
        categories.remove(category)
        save_categories(categories)
        move_category_contents(category, target_category)
        st.success(f"Category {category} deleted and contents moved to {target_category}")
    else:
        st.error("Category not found")

def create_category_folder(category):
    output_dir = load_output_dir()
    category_path = os.path.join(output_dir, category)
    os.makedirs(category_path, exist_ok=True)

def rename_category_folder(old_name, new_name):
    output_dir = load_output_dir()
    old_path = os.path.join(output_dir, old_name)
    new_path = os.path.join(output_dir, new_name)
    if os.path.exists(old_path):
        os.rename(old_path, new_path)

def move_category_contents(source_category, target_category):
    output_dir = load_output_dir()
    source_path = os.path.join(output_dir, source_category)
    target_path = os.path.join(output_dir, target_category)
    if os.path.exists(source_path):
        for item in os.listdir(source_path):
            s = os.path.join(source_path, item)
            d = os.path.join(target_path, item)
            if os.path.isdir(s):
                shutil.copytree(s, d, dirs_exist_ok=True)
            else:
                shutil.copy2(s, d)
        shutil.rmtree(source_path)
