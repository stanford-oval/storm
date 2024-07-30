import os
from datetime import datetime
import streamlit as st
from util.ui_components import UIComponents, StreamlitCallbackHandler
from util.file_io import DemoFileIOHelper
from util.text_processing import convert_txt_to_md
from util.path_utils import get_output_dir
from util.storm_runner import set_storm_runner, process_search_results
from util.theme_manager import load_and_apply_theme


import logging

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def sanitize_title(title):
    # Remove leading/trailing spaces and replace internal spaces with underscores
    return title.strip().replace(" ", "_")


def add_date_to_file(file_path):
    with open(file_path, "r+") as f:
        content = f.read()
        f.seek(0, 0)
        date_string = datetime.now().strftime("Last Modified: %Y-%m-%d %H:%M:%S")
        f.write(f"{date_string}\n\n{content}")


def create_new_article_page():
    current_theme = load_and_apply_theme()

    if "page3_write_article_state" not in st.session_state:
        st.session_state["page3_write_article_state"] = "not started"

    if st.session_state["page3_write_article_state"] == "not started":
        _, search_form_column, _ = st.columns([1, 3, 1])
        with search_form_column:
            with st.form(key="search_form"):
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
                    height=100,
                )

                submit_button = st.form_submit_button(
                    label="Research",
                    help="Start researching the topic",
                    use_container_width=True,
                )

                if submit_button:
                    if not st.session_state["page3_topic"].strip():
                        st.warning("Topic could not be empty", icon="⚠️")
                    else:
                        st.session_state["page3_topic_name_cleaned"] = sanitize_title(
                            st.session_state["page3_topic"]
                        )
                        st.session_state["page3_write_article_state"] = "initiated"
                        st.rerun()

    if st.session_state["page3_write_article_state"] == "initiated":
        current_working_dir = get_output_dir()
        if not os.path.exists(current_working_dir):
            os.makedirs(current_working_dir)

        if "run_storm" not in st.session_state:
            set_storm_runner()
        st.session_state["page3_current_working_dir"] = current_working_dir
        st.session_state["page3_write_article_state"] = "pre_writing"

    if st.session_state["page3_write_article_state"] == "pre_writing":
        status = st.status(
            "I am brain**STORM**ing now to research the topic. (This may take several minutes.)"
        )
        progress_bar = st.progress(0)
        progress_text = st.empty()

        class ProgressCallback(StreamlitCallbackHandler):
            def __init__(self, progress_bar, progress_text):
                self.progress_bar = progress_bar
                self.progress_text = progress_text
                self.steps = ["research", "outline", "article", "polish"]
                self.current_step = 0

            def on_information_gathering_start(self, **kwargs):
                self.progress_text.text(
                    kwargs.get(
                        "message",
                        f"Step {self.current_step + 1}/{len(self.steps)}: {self.steps[self.current_step]}",
                    )
                )
                self.progress_bar.progress((self.current_step + 1) / len(self.steps))
                self.current_step = min(self.current_step + 1, len(self.steps) - 1)

        callback = ProgressCallback(progress_bar, progress_text)

        with status:
            try:
                # Run STORM with fallback
                runner = st.session_state["run_storm"](
                    st.session_state["page3_topic"],
                    st.session_state["page3_current_working_dir"],
                    callback_handler=callback,
                )
                if runner:
                    conversation_log_path = os.path.join(
                        st.session_state["page3_current_working_dir"],
                        st.session_state["page3_topic_name_cleaned"],
                        "conversation_log.json",
                    )
                    if os.path.exists(conversation_log_path):
                        UIComponents.display_persona_conversations(
                            DemoFileIOHelper.read_json_file(conversation_log_path)
                        )
                    st.session_state["page3_write_article_state"] = "final_writing"
                    status.update(label="brain**STORM**ing complete!", state="complete")
                    progress_bar.progress(100)

                    # Store the runner in the session state
                    st.session_state["runner"] = runner
                else:
                    raise Exception("STORM runner returned None")
            except Exception as e:
                st.error(f"Failed to generate the article: {str(e)}")
                logger.error(f"Error in article generation: {str(e)}", exc_info=True)
                st.session_state["page3_write_article_state"] = "not started"
                return  # Exit the function early if there's an error

    if st.session_state["page3_write_article_state"] == "final_writing":
        # Check if runner exists in the session state
        if "runner" not in st.session_state or st.session_state["runner"] is None:
            st.error("Article generation failed. Please try again.")
            st.session_state["page3_write_article_state"] = "not started"
            return

        with st.status(
            "Now I will connect the information I found for your reference. (This may take 4-5 minutes.)"
        ) as status:
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
                # finish the session
                st.session_state["runner"].post_run()

                process_search_results(
                    st.session_state["runner"],
                    st.session_state["page3_current_working_dir"],
                    st.session_state["page3_topic"],
                )

                # Convert txt files to md after article generation
                convert_txt_to_md(st.session_state["page3_current_working_dir"])

                # Rename the polished article file and add date
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

                # Remove the unpolished article file
                unpolished_file_path = os.path.join(
                    st.session_state["page3_current_working_dir"],
                    st.session_state["page3_topic_name_cleaned"],
                    "storm_gen_article.md",
                )
                if os.path.exists(unpolished_file_path):
                    os.remove(unpolished_file_path)

                # update status bar
                st.session_state["page3_write_article_state"] = "prepare_to_show_result"
                status.update(label="information synthesis complete!", state="complete")
            except Exception as e:
                st.error(f"Error during final article generation: {str(e)}")
                st.session_state["page3_write_article_state"] = "not started"

    if st.session_state["page3_write_article_state"] == "prepare_to_show_result":
        _, show_result_col, _ = st.columns([4, 3, 4])
        with show_result_col:
            if st.button("Show final article"):
                st.session_state["page3_write_article_state"] = "completed"
                st.rerun()

    if st.session_state["page3_write_article_state"] == "completed":
        # display polished article
        current_working_dir_paths = DemoFileIOHelper.read_structure_to_dict(
            st.session_state["page3_current_working_dir"]
        )
        current_article_file_path_dict = current_working_dir_paths.get(
            st.session_state["page3_topic_name_cleaned"], {}
        )

        if not current_article_file_path_dict:
            st.error(
                f"No article data found for topic: {st.session_state['page3_topic_name_cleaned']}"
            )
            st.error(
                f"Current working directory: {st.session_state['page3_current_working_dir']}"
            )
            st.error(f"Directory structure: {current_working_dir_paths}")
        else:
            UIComponents.display_article_page(
                selected_article_name=st.session_state["page3_topic_name_cleaned"],
                selected_article_file_path_dict=current_article_file_path_dict,
                show_title=True,
                show_main_article=True,
            )
