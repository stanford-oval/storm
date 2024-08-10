import os
import json
import openai
from datetime import datetime
import streamlit as st
from util.ui_components import UIComponents, StreamlitCallbackHandler
from util.file_io import FileIOHelper
from util.text_processing import convert_txt_to_md
from util.storm_runner import (
    set_storm_runner,
    process_search_results,
    create_lm_client,
    collect_existing_information,
    use_fallback_llm,
    write_fallback_result,
)

from util.theme_manager import (
    load_and_apply_theme,
    get_form_submit_button_css,
)
from util.consts import (
    LLM_MODELS,
)
from db.db_operations import (
    load_search_options,
    save_search_options,
    load_llm_settings,
    save_llm_settings,
)
from pages_util.Settings import (
    update_llm_setting,
    update_search_option,
    get_available_search_engines,
    list_downloaded_models,
)
import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

categories = FileIOHelper.load_categories()


def get_output_dir(category="Default"):
    return FileIOHelper.get_output_dir(category)


def sanitize_title(title):
    sanitized = title.strip().replace(" ", "_")
    return sanitized.rstrip("_")


def add_date_to_file(file_path):
    with open(file_path, "r+") as f:
        content = f.read()
        f.seek(0, 0)
        date_string = datetime.now().strftime("Last Modified: %Y-%m-%d %H:%M:%S")
        f.write(f"{date_string}\n\n{content}")


def initialize_session_state():
    if "page3_write_article_state" not in st.session_state:
        st.session_state["page3_write_article_state"] = "not started"
    if "page3_current_working_dir" not in st.session_state:
        st.session_state["page3_current_working_dir"] = get_output_dir()
    if "page3_topic_name_cleaned" not in st.session_state:
        st.session_state["page3_topic_name_cleaned"] = ""


def display_article_form():
    st.header("Create New Article")
    categories = FileIOHelper.load_categories()

    # Apply custom CSS for the form submit button
    st.markdown(
        get_form_submit_button_css(st.session_state.current_theme),
        unsafe_allow_html=True,
    )

    with st.form(key="search_form"):
        selected_category = st.selectbox("Select category", categories, index=0)
        st.text_input(
            "Enter the topic",
            key="page3_topic",
            placeholder="Enter the topic",
            help="Enter the main topic or question for your article",
        )
        st.text_area(
            "Elaborate on the purpose",
            key="page3_purpose",
            placeholder="Please type here to elaborate on the purpose of writing this article",
            help="Provide more context or specific areas you want to explore",
            height=300,
        )
        submit_button = st.form_submit_button(
            label="Research",
            help="Start researching the topic",
            use_container_width=True,
        )
    return submit_button, selected_category


def handle_form_submission(submit_button, selected_category):
    if submit_button:
        if not st.session_state["page3_topic"].strip():
            st.warning("Topic could not be empty", icon="⚠️")
        else:
            st.session_state["page3_topic_name_cleaned"] = sanitize_title(
                st.session_state["page3_topic"]
            )
            st.session_state["page3_write_article_state"] = "initiated"
            st.session_state["selected_category"] = selected_category
            st.session_state["page3_current_working_dir"] = get_output_dir(
                selected_category
            )
            st.rerun()


def display_sidebar_options():
    st.sidebar.header("Search Options")
    search_options = load_search_options()

    available_engines = list(get_available_search_engines().keys())

    primary_engine = st.sidebar.selectbox(
        "Primary Search Engine",
        options=available_engines,
        index=available_engines.index(search_options["primary_engine"])
        if search_options["primary_engine"] in available_engines
        else 0,
        key="primary_engine_input",
    )
    if primary_engine != search_options["primary_engine"]:
        update_search_option("primary_engine", primary_engine)

    fallback_options = [None] + [
        engine for engine in available_engines if engine != primary_engine
    ]
    fallback_engine = st.sidebar.selectbox(
        "Fallback Search Engine",
        options=fallback_options,
        index=fallback_options.index(search_options["fallback_engine"])
        if search_options["fallback_engine"] in fallback_options
        else 0,
        key="fallback_engine_input",
    )
    if fallback_engine != search_options["fallback_engine"]:
        update_search_option("fallback_engine", fallback_engine)

    search_top_k = st.sidebar.number_input(
        "Search Top K",
        min_value=1,
        max_value=100,
        value=int(search_options.get("search_top_k", 3)),
        key="search_top_k_input",
    )
    if search_top_k != search_options["search_top_k"]:
        update_search_option("search_top_k", search_top_k)

    retrieve_top_k = st.sidebar.number_input(
        "Retrieve Top K",
        min_value=1,
        max_value=100,
        value=int(search_options.get("retrieve_top_k", 3)),
        key="retrieve_top_k_input",
    )
    if retrieve_top_k != search_options["retrieve_top_k"]:
        update_search_option("retrieve_top_k", retrieve_top_k)

    st.sidebar.header("LLM Options")
    llm_settings = load_llm_settings()
    logger.info(f"Loaded LLM settings: {json.dumps(llm_settings, indent=2)}")

    def update_llm_setting(key):
        keys = key.split(".")
        if len(keys) == 1:
            llm_settings[key] = st.session_state[f"{key}_input"]
        elif len(keys) == 3:
            if keys[0] not in llm_settings:
                llm_settings[keys[0]] = {}
            if keys[1] not in llm_settings[keys[0]]:
                llm_settings[keys[0]][keys[1]] = {}
            llm_settings[keys[0]][keys[1]][keys[2]] = st.session_state[f"{key}_input"]
        else:
            st.error(f"Unexpected key format: {key}")
        save_llm_settings(llm_settings)
        logger.info(f"Updated LLM settings: {json.dumps(llm_settings, indent=2)}")

    primary_model = st.sidebar.selectbox(
        "Primary LLM Model",
        options=list(LLM_MODELS.keys()),
        index=list(LLM_MODELS.keys()).index(llm_settings["primary_model"]),
        key="primary_model_input",
        on_change=update_llm_setting,
        args=("primary_model",),
    )

    fallback_model_options = [None] + [
        model for model in LLM_MODELS.keys() if model != primary_model
    ]
    fallback_model = st.sidebar.selectbox(
        "Fallback LLM Model",
        options=fallback_model_options,
        index=fallback_model_options.index(llm_settings["fallback_model"])
        if llm_settings["fallback_model"] in fallback_model_options
        else 0,
        key="fallback_model_input",
        on_change=update_llm_setting,
        args=("fallback_model",),
    )

    model_settings = llm_settings.get("model_settings", {})

    for model in LLM_MODELS.keys():
        if model == primary_model or model == fallback_model:
            st.sidebar.write(f"{model.capitalize()} Settings")
            if model not in model_settings:
                model_settings[model] = {}

            if model == "ollama":
                downloaded_models = list_downloaded_models()
                model_settings[model]["model"] = st.sidebar.selectbox(
                    "Ollama Model",
                    options=downloaded_models,
                    index=downloaded_models.index(
                        model_settings[model].get(
                            "model", "jaigouk/hermes-2-theta-llama-3:latest"
                        )
                    )
                    if model_settings[model].get("model") in downloaded_models
                    else 0,
                    key=f"model_settings.{model}.model_input",
                    on_change=update_llm_setting,
                    args=(f"model_settings.{model}.model",),
                )
            elif model == "openai":
                model_settings[model]["model"] = st.sidebar.selectbox(
                    "OpenAI Model",
                    options=["gpt-4o-mini", "gpt-4o"],
                    index=0
                    if model_settings[model].get("model") == "gpt-4o-mini"
                    else 1,
                    key=f"model_settings.{model}.model_input",
                    on_change=update_llm_setting,
                    args=(f"model_settings.{model}.model",),
                )
            elif model == "anthropic":
                model_settings[model]["model"] = st.sidebar.selectbox(
                    "Anthropic Model",
                    options=["claude-3-haiku-20240307", "claude-3-5-sonnet-20240620"],
                    index=0
                    if model_settings[model].get("model") == "claude-3-haiku-20240307"
                    else 1,
                    key=f"model_settings.{model}.model_input",
                    on_change=update_llm_setting,
                    args=(f"model_settings.{model}.model",),
                )

            model_settings[model]["max_tokens"] = st.sidebar.number_input(
                f"{model.capitalize()} Max Tokens",
                min_value=1,
                max_value=10000,
                value=int(model_settings[model].get("max_tokens", 500)),
                key=f"model_settings.{model}.max_tokens_input",
                on_change=update_llm_setting,
                args=(f"model_settings.{model}.max_tokens",),
            )

    llm_settings["model_settings"] = model_settings
    save_llm_settings(llm_settings)

    return {
        "search_options": search_options,
        "llm_options": llm_settings,
    }


def display_llm_options(llm_settings):
    primary_model = st.sidebar.selectbox(
        "Primary LLM Model",
        options=list(LLM_MODELS.keys()),
        index=list(LLM_MODELS.keys()).index(llm_settings["primary_model"]),
        key="primary_model",
    )
    if primary_model == "ollama":
        llm_settings["model_settings"] = display_ollama_options(llm_settings)

    fallback_model_options = [None] + [
        model for model in LLM_MODELS.keys() if model != primary_model
    ]
    current_fallback_model = llm_settings["fallback_model"]
    if current_fallback_model not in fallback_model_options:
        current_fallback_model = None
    fallback_model = st.sidebar.selectbox(
        "Fallback LLM Model",
        options=fallback_model_options,
        index=fallback_model_options.index(current_fallback_model),
        key="fallback_model",
    )
    return primary_model, fallback_model, llm_settings["model_settings"]


def display_ollama_options(llm_settings):
    ollama_models = list_downloaded_models()
    selected_ollama_model = st.sidebar.selectbox(
        "Ollama Model",
        options=ollama_models,
        index=ollama_models.index(llm_settings["model_settings"]["ollama"]["model"]),
        key="ollama_model",
    )
    max_tokens = st.sidebar.number_input(
        "Max Tokens",
        min_value=1,
        max_value=10000,
        value=llm_settings["model_settings"]["ollama"]["max_tokens"],
        key="ollama_max_tokens",
    )
    llm_settings["model_settings"]["ollama"]["model"] = selected_ollama_model
    llm_settings["model_settings"]["ollama"]["max_tokens"] = max_tokens
    return llm_settings["model_settings"]


def run_storm_process(status, progress_bar, progress_text):
    callback = ProgressCallback(progress_bar, progress_text, status)
    with status:
        try:
            if "page3_topic" not in st.session_state:
                raise ValueError("Topic not found. Please enter a topic and try again.")

            current_category = st.session_state.get("selected_category", "Default")
            current_working_dir = get_output_dir(current_category)

            logger.info(
                f"Running STORM process for topic: {st.session_state['page3_topic']}"
            )
            logger.info(f"Current working directory: {current_working_dir}")

            runner = st.session_state["run_storm"](
                st.session_state["page3_topic"],
                current_working_dir,
                callback_handler=callback,
            )

            if runner:
                handle_successful_run(runner)
            else:
                raise Exception("STORM runner returned None")
        except Exception as e:
            logger.error(f"Failed to generate the article: {str(e)}", exc_info=True)
            st.error(f"Failed to generate the article: {str(e)}")
            st.session_state["page3_write_article_state"] = "not started"


def handle_successful_run(runner):
    conversation_log_path = os.path.join(
        st.session_state["page3_current_working_dir"],
        st.session_state["page3_topic_name_cleaned"],
        "conversation_log.json",
    )
    if os.path.exists(conversation_log_path):
        UIComponents.display_persona_conversations(
            FileIOHelper.read_json_file(conversation_log_path)
        )
    st.session_state["page3_write_article_state"] = "final_writing"
    st.session_state["runner"] = runner


def finalize_article(status):
    with status:
        st.info(
            "Now I will connect the information I found for your reference. (This may take 4-5 minutes.)"
        )
        try:
            st.session_state["runner"].run(
                topic=st.session_state["page3_topic"],
                do_research=False,
                do_generate_outline=False,
                do_generate_article=True,
                do_polish_article=True,
                remove_duplicate=False,
            )
            st.session_state["runner"].post_run()
            process_search_results(
                st.session_state["runner"],
                st.session_state["page3_current_working_dir"],
                st.session_state["page3_topic"],
            )
            convert_txt_to_md(st.session_state["page3_current_working_dir"])
            rename_and_date_article()
            st.session_state["page3_write_article_state"] = "prepare_to_show_result"
            status.update(label="information synthesis complete!", state="complete")
        except Exception as e:
            st.error(f"Error during final article generation: {str(e)}")
            try:
                # Make sure current_llm_options is available in the session state
                if "current_llm_options" not in st.session_state:
                    st.session_state["current_llm_options"] = load_llm_settings()

                fallback_model = st.session_state["current_llm_options"].get(
                    "fallback_model"
                )
                if not fallback_model:
                    raise ValueError("No fallback model configured")

                fallback_lm = create_lm_client(
                    fallback_model,
                    fallback=False,
                    model_settings=st.session_state["current_llm_options"][
                        "model_settings"
                    ],
                )
                existing_info = collect_existing_information(st.session_state["runner"])
                fallback_result = use_fallback_llm(
                    st.session_state["page3_topic"], existing_info, fallback_lm
                )
                write_fallback_result(
                    fallback_result,
                    st.session_state["page3_current_working_dir"],
                    st.session_state["page3_topic"],
                )
                st.success("Fallback LLM successfully generated content.")
                st.session_state["page3_write_article_state"] = "prepare_to_show_result"
                status.update(
                    label="information synthesis complete (using fallback)!",
                    state="complete",
                )
            except Exception as fallback_error:
                st.error(f"Fallback LLM also failed: {str(fallback_error)}")
                st.session_state["page3_write_article_state"] = "not started"


def rename_and_date_article():
    old_file_path = os.path.join(
        st.session_state["page3_current_working_dir"],
        st.session_state["page3_topic_name_cleaned"],
        "storm_gen_article_polished.md",
    )
    new_file_path = os.path.join(
        st.session_state["page3_current_working_dir"],
        st.session_state["page3_topic_name_cleaned"],
        f"{st.session_state['page3_topic_name_cleaned']}.md",
    )
    if os.path.exists(old_file_path):
        os.rename(old_file_path, new_file_path)
        add_date_to_file(new_file_path)
    unpolished_file_path = os.path.join(
        st.session_state["page3_current_working_dir"],
        st.session_state["page3_topic_name_cleaned"],
        "storm_gen_article.md",
    )
    if os.path.exists(unpolished_file_path):
        os.remove(unpolished_file_path)


def display_final_article(current_working_dir):
    current_category = st.session_state.get("selected_category", "Default")
    current_working_dir = FileIOHelper.get_output_dir(current_category)

    st.sidebar.empty()
    current_working_dir_paths = FileIOHelper.read_structure_to_dict(current_working_dir)
    topic_name = st.session_state["page3_topic_name_cleaned"]

    # Try different variations of the topic name
    possible_names = [topic_name, topic_name.rstrip("_"), topic_name + "_"]

    current_article_file_path_dict = None
    for name in possible_names:
        if name in current_working_dir_paths:
            current_article_file_path_dict = current_working_dir_paths[name]
            break

    if not current_article_file_path_dict:
        st.error(f"No article data found for topic: {topic_name}")
        st.error(f"Current working directory: {current_working_dir}")
        st.error(f"Directory structure: {current_working_dir_paths}")
    else:
        UIComponents.display_article_page(
            selected_article_name=topic_name.rstrip("_"),
            selected_article_file_path_dict=current_article_file_path_dict,
            show_title=True,
            show_main_article=True,
            show_references_in_sidebar=True,
        )


def cleanup_folder(current_working_dir):
    if st.session_state["page3_topic_name_cleaned"]:
        old_folder_path = os.path.join(
            current_working_dir,
            st.session_state["page3_topic_name_cleaned"],
        )
        new_folder_path = os.path.join(
            current_working_dir,
            st.session_state["page3_topic_name_cleaned"].rstrip("_"),
        )
        if os.path.exists(old_folder_path) and old_folder_path != new_folder_path:
            try:
                os.rename(old_folder_path, new_folder_path)
                st.session_state["page3_topic_name_cleaned"] = st.session_state[
                    "page3_topic_name_cleaned"
                ].rstrip("_")
            except Exception as e:
                st.warning(f"Unable to rename folder: {str(e)}")


def create_new_article_page():
    load_and_apply_theme()
    initialize_session_state()
    UIComponents.apply_custom_css()

    if st.session_state["page3_write_article_state"] == "not started":
        submit_button, selected_category = display_article_form()
        handle_form_submission(submit_button, selected_category)

    current_category = st.session_state.get("selected_category", "Default")
    current_working_dir = get_output_dir(current_category)

    if st.session_state["page3_write_article_state"] != "completed":
        options = display_sidebar_options()
        st.session_state["current_search_options"] = options["search_options"]
        st.session_state["current_llm_options"] = options["llm_options"]

    if st.session_state["page3_write_article_state"] == "initiated":
        st.session_state["page3_topic"] = st.session_state["page3_topic"]
        current_working_dir = get_output_dir(st.session_state["selected_category"])
        if not os.path.exists(current_working_dir):
            os.makedirs(current_working_dir)
        if "run_storm" not in st.session_state:
            set_storm_runner()
        st.session_state["page3_write_article_state"] = "pre_writing"
        st.rerun()

    if st.session_state["page3_write_article_state"] == "pre_writing":
        status = st.status(
            "I am brain**STORM**ing now to research the topic. (This may take several minutes.)"
        )
        progress_bar = st.progress(0)
        progress_text = st.empty()
        try:
            run_storm_process(status, progress_bar, progress_text)
        except openai.NotFoundError as e:
            st.error(f"Model not found: {e}. Please check your model configuration.")
            st.session_state["page3_write_article_state"] = "not started"
        except openai.APIError as e:
            st.error(f"OpenAI API error: {e}")
            st.session_state["page3_write_article_state"] = "not started"
        except Exception as e:
            st.error(f"An unexpected error occurred: {e}")
            st.session_state["page3_write_article_state"] = "not started"

    if st.session_state["page3_write_article_state"] == "final_writing":
        if "runner" not in st.session_state or st.session_state["runner"] is None:
            st.error("Article generation failed. Please try again.")
            st.session_state["page3_write_article_state"] = "not started"
            return

        status = st.status(
            "Now I will connect the information I found for your reference. (This may take 4-5 minutes.)"
        )
        finalize_article(status)

    if st.session_state["page3_write_article_state"] == "prepare_to_show_result":
        _, show_result_col, _ = st.columns([4, 3, 4])
        with show_result_col:
            if st.button("Show final article"):
                st.session_state["page3_write_article_state"] = "completed"
                st.rerun()

    if st.session_state["page3_write_article_state"] == "completed":
        display_final_article(current_working_dir)

    cleanup_folder(current_working_dir)


class ProgressCallback(StreamlitCallbackHandler):
    def __init__(self, progress_bar, progress_text, status):
        self.progress_bar = progress_bar
        self.progress_text = progress_text
        self.status_container = status
        self.steps = ["research", "outline", "article", "polish"]
        self.current_step = 0

    def on_information_gathering_start(self, **kwargs):
        message = kwargs.get(
            "message",
            f"Step {self.current_step + 1}/{len(self.steps)}: {self.steps[self.current_step]}",
        )
        self.progress_text.text(message)
        self.status_container.info(message)
        self.progress_bar.progress((self.current_step + 1) / len(self.steps))
        self.current_step = min(self.current_step + 1, len(self.steps) - 1)

    def on_identify_perspective_start(self, **kwargs):
        self.status_container.info(
            "Start identifying different perspectives for researching the topic."
        )

    def on_identify_perspective_end(self, perspectives: list[str], **kwargs):
        perspective_list = "\n- ".join(perspectives)
        self.status_container.success(
            f"Finish identifying perspectives. Will now start gathering information"
            f" from the following perspectives:\n- {perspective_list}"
        )

    def on_dialogue_turn_end(self, dlg_turn, **kwargs):
        urls = list(set([r.url for r in dlg_turn.search_results]))
        for url in urls:
            self.status_container.markdown(
                f"""
                    <style>
                    .small-font {{
                        font-size: 14px;
                        margin: 0px;
                        padding: 0px;
                    }}
                    </style>
                    <div class="small-font">Finish browsing <a href="{url}" class="small-font" target="_blank">{url}</a>.</div>
                    """,
                unsafe_allow_html=True,
            )

    def on_information_gathering_end(self, **kwargs):
        self.status_container.success("Finish collecting information.")

    def on_information_organization_start(self, **kwargs):
        self.status_container.info(
            "Start organizing information into a hierarchical outline."
        )

    def on_direct_outline_generation_end(self, outline: str, **kwargs):
        self.status_container.success(
            "Finish leveraging the internal knowledge of the large language model."
        )

    def on_outline_refinement_end(self, outline: str, **kwargs):
        self.status_container.success("Finish leveraging the collected information.")
