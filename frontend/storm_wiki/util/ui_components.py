import streamlit as st
from .file_io import FileIOHelper
from .text_processing import DemoTextProcessingHelper
from knowledge_storm.storm_wiki.modules.callback import BaseCallbackHandler
import unidecode
import logging
import os
from util.theme_manager import (
    get_global_css,
    get_my_articles_css,
    get_form_submit_button_css,
)

logging.basicConfig(level=logging.DEBUG)


class UIComponents:
    @staticmethod
    def display_article_page(
        selected_article_name,
        selected_article_file_path_dict,
        show_title=True,
        show_main_article=True,
        show_feedback_form=False,
        show_qa_panel=False,
        show_references_in_sidebar=False,
    ):
        try:
            logging.info(f"Displaying article page for: {selected_article_name}")
            logging.info(f"Article file path dict: {selected_article_file_path_dict}")

            current_theme = st.session_state.current_theme
            if show_title:
                st.markdown(
                    f"<h2 style='text-align: center; color: {current_theme['textColor']};'>{selected_article_name.replace('_', ' ')}</h2>",
                    unsafe_allow_html=True,
                )

            if show_main_article:
                article_data = FileIOHelper.assemble_article_data(
                    selected_article_file_path_dict
                )

                if article_data is None:
                    st.warning("No article data found.")
                    st.error(
                        f"Current working directory: {os.path.dirname(next(iter(selected_article_file_path_dict.values()), ''))}"
                    )
                    st.error(
                        f"Files in directory: {os.listdir(os.path.dirname(next(iter(selected_article_file_path_dict.values()), '')))}"
                    )
                    return

                logging.info(f"Article data keys: {article_data.keys()}")
                UIComponents.display_main_article(
                    article_data,
                    show_feedback_form,
                    show_qa_panel,
                    show_references_in_sidebar,
                )
        except Exception as e:
            st.error(f"Error displaying article: {str(e)}")
            st.exception(e)
            logging.exception("Error in display_article_page")

    @staticmethod
    def display_main_article(
        article_data,
        show_feedback_form=False,
        show_qa_panel=False,
        show_references_in_sidebar=False,
    ):
        try:
            current_theme = st.session_state.current_theme
            with st.container(height=1000, border=True):
                table_content_sidebar = st.sidebar.expander(
                    "**Table of contents**", expanded=True
                )
                st.markdown(
                    f"""
                    <style>
                    [data-testid="stExpander"] {{
                        border-color: {current_theme['primaryColor']} !important;
                    }}
                    </style>
                    """,
                    unsafe_allow_html=True,
                )
                UIComponents.display_main_article_text(
                    article_text=article_data.get("article", ""),
                    citation_dict=article_data.get("citations", {}),
                    table_content_sidebar=table_content_sidebar,
                )

            # display reference panel
            if "citations" in article_data:
                with st.sidebar.expander("**References**", expanded=True):
                    with st.container(height=400, border=False):
                        UIComponents._display_references(
                            citation_dict=article_data.get("citations", {})
                        )

            # display conversation history
            if "conversation_log" in article_data:
                with st.expander(
                    "**STORM** is powered by a knowledge agent that proactively research a given topic by asking good questions coming from different perspectives.\n\n"
                    ":sunglasses: Click here to view the agent's brain**STORM**ing process!"
                ):
                    UIComponents.display_persona_conversations(
                        conversation_log=article_data.get("conversation_log", {})
                    )

            # Add placeholders for feedback form and QA panel if needed
            if show_feedback_form:
                st.write("Feedback form placeholder")

            if show_qa_panel:
                st.write("QA panel placeholder")

        except Exception as e:
            st.error(f"Error in display_main_article: {str(e)}")
            st.exception(e)

    @staticmethod
    def _display_references(citation_dict):
        if citation_dict:
            reference_list = [
                f"reference [{i}]" for i in range(1, len(citation_dict) + 1)
            ]
            selected_key = st.selectbox("Select a reference", reference_list)
            citation_val = citation_dict[reference_list.index(selected_key) + 1]

            title = citation_val.get("title", "No title available").replace("$", "\\$")
            st.markdown(f"**Title:** {title}")

            url = citation_val.get("url", "No URL available")
            st.markdown(f"**Url:** {url}")

            description = citation_val.get(
                "description", "No description available"
            ).replace("$", "\\$")
            st.markdown(f"**Description:**\n\n {description}")

            snippets = citation_val.get("snippets", ["No highlights available"])
            snippets_text = "\n\n".join(snippets).replace("$", "\\$")
            st.markdown(f"**Highlights:**\n\n {snippets_text}")
        else:
            st.markdown("**No references available**")

    @staticmethod
    def display_main_article_text(article_text, citation_dict, table_content_sidebar):
        # Post-process the generated article for better display.
        if "Write the lead section:" in article_text:
            article_text = article_text[
                article_text.find("Write the lead section:")
                + len("Write the lead section:") :
            ]
        if article_text and article_text[0] == "#":
            article_text = "\n".join(article_text.split("\n")[1:])
        if citation_dict:
            article_text = DemoTextProcessingHelper.add_inline_citation_link(
                article_text, citation_dict
            )
        # '$' needs to be changed to '\$' to avoid being interpreted as LaTeX in st.markdown()
        article_text = article_text.replace("$", "\\$")
        UIComponents.from_markdown(article_text, table_content_sidebar)

    @staticmethod
    def display_persona_conversations(conversation_log):
        """
        Display persona conversation in dialogue UI
        """
        # get personas list as (persona_name, persona_description, dialogue turns list) tuple
        parsed_conversation_history = (
            DemoTextProcessingHelper.parse_conversation_history(conversation_log)
        )

        # construct tabs for each persona conversation
        persona_tabs = st.tabs(
            [
                name if name else f"Persona {i}"
                for i, (name, _, _) in enumerate(parsed_conversation_history)
            ]
        )
        for idx, persona_tab in enumerate(persona_tabs):
            with persona_tab:
                # show persona description
                st.info(parsed_conversation_history[idx][1])
                # show user / agent utterance in dialogue UI
                for message in parsed_conversation_history[idx][2]:
                    message["content"] = message["content"].replace("$", "\\$")
                    with st.chat_message(message["role"]):
                        if message["role"] == "user":
                            st.markdown(f"**{message['content']}**")
                        else:
                            st.markdown(message["content"])

    # STOC functionality
    @staticmethod
    def from_markdown(text: str, expander=None):
        toc_items = []
        for line in text.splitlines():
            if line.startswith("###"):
                toc_items.append(("h3", line[3:]))
            elif line.startswith("##"):
                toc_items.append(("h2", line[2:]))
            elif line.startswith("#"):
                toc_items.append(("h1", line[1:]))

        # Apply custom CSS
        current_theme = st.session_state.current_theme
        custom_css = f"""
        <style>
            h1 {{ font-size: 28px; color: {current_theme['textColor']}; }}
            h2 {{ font-size: 24px; color: {current_theme['textColor']}; }}
            h3 {{ font-size: 22px; color: {current_theme['textColor']}; }}
            h4 {{ font-size: 20px; color: {current_theme['textColor']}; }}
            h5 {{ font-size: 18px; color: {current_theme['textColor']}; }}
            p {{ font-size: 18px; color: {current_theme['textColor']}; }}
            a.toc {{ color: {current_theme['textColor']}; text-decoration: none; }}
        </style>
        """
        st.markdown(custom_css, unsafe_allow_html=True)

        st.markdown(text, unsafe_allow_html=True)
        UIComponents.toc(toc_items, expander)

    @staticmethod
    def toc(toc_items, expander):
        if expander is None:
            expander = st.sidebar.expander("**Table of contents**", expanded=True)
        with expander:
            with st.container(height=600, border=False):
                markdown_toc = ""
                for title_size, title in toc_items:
                    h = int(title_size.replace("h", ""))
                    markdown_toc += (
                        " " * 2 * h
                        + "- "
                        + f'<a href="#{UIComponents.normalize(title)}" class="toc"> {title}</a> \n'
                    )
                st.markdown(markdown_toc, unsafe_allow_html=True)

    @staticmethod
    def normalize(s):
        s_wo_accents = unidecode.unidecode(s)
        accents = [s for s in s if s not in s_wo_accents]
        for accent in accents:
            s = s.replace(accent, "-")
        s = s.lower()
        normalized = (
            "".join([char if char.isalnum() else "-" for char in s]).strip("-").lower()
        )
        return normalized

    @staticmethod
    def apply_custom_css():
        current_theme = st.session_state.current_theme
        st.markdown(get_global_css(current_theme), unsafe_allow_html=True)
        st.markdown(get_my_articles_css(current_theme), unsafe_allow_html=True)
        st.markdown(get_form_submit_button_css(current_theme), unsafe_allow_html=True)


class StreamlitCallbackHandler(BaseCallbackHandler):
    def __init__(self, status_container):
        self.status_container = status_container

    def on_information_gathering_start(self, message, **kwargs):
        self.status_container.info(message)

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
