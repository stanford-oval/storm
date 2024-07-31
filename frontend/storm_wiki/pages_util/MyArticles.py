import streamlit as st
from util.file_io import FileIOHelper
from util.ui_components import UIComponents
from util.theme_manager import load_and_apply_theme, get_my_articles_css
from pages_util.Settings import load_general_settings, save_general_settings

import logging

logging.basicConfig(level=logging.DEBUG)


def initialize_session_state():
    if "page_size" not in st.session_state:
        st.session_state.page_size = 24
    if "current_page" not in st.session_state:
        st.session_state.current_page = 1
    if "num_columns" not in st.session_state:
        general_settings = load_general_settings()
        try:
            if isinstance(general_settings, dict):
                num_columns = general_settings.get("num_columns", 3)
                if isinstance(num_columns, dict):
                    num_columns = num_columns.get("num_columns", 3)
            else:
                num_columns = general_settings

            st.session_state.num_columns = int(num_columns)
        except (ValueError, TypeError):
            st.session_state.num_columns = 3  # Default to 3 if conversion fails


def update_page_size():
    st.session_state.page_size = st.session_state.page_size_select
    st.session_state.current_page = 1
    st.session_state.need_rerun = True


def my_articles_page():
    initialize_session_state()
    UIComponents.apply_custom_css()

    if "user_articles" not in st.session_state:
        local_dir = FileIOHelper.get_output_dir()
        st.session_state.user_articles = FileIOHelper.read_structure_to_dict(local_dir)

    if "page2_selected_my_article" in st.session_state:
        display_selected_article()
    else:
        new_page_size, new_num_columns = display_article_list(
            page_size=st.session_state.page_size,
            num_columns=st.session_state.num_columns,
        )
        # Update session state if values have changed
        if (
            new_page_size != st.session_state.page_size
            or new_num_columns != st.session_state.num_columns
        ):
            st.session_state.page_size = new_page_size
            st.session_state.num_columns = new_num_columns
            # We don't need to rerun here, as the changes will be reflected in the next run


def display_selected_article():
    selected_article_name = st.session_state.page2_selected_my_article
    selected_article_file_path_dict = st.session_state.user_articles[
        selected_article_name
    ]

    UIComponents.display_article_page(
        selected_article_name,
        selected_article_file_path_dict,
        show_title=True,
        show_main_article=True,
        show_feedback_form=False,
        show_qa_panel=False,
    )

    if st.button("Back to Article List"):
        del st.session_state.page2_selected_my_article
        st.rerun()


def display_article_list(page_size, num_columns):
    try:
        num_columns = int(num_columns)
    except (ValueError, TypeError):
        num_columns = 3  # Default to 3 if conversion fails

    articles = st.session_state.user_articles
    article_keys = list(articles.keys())
    total_articles = len(article_keys)

    # Sidebar controls
    with st.sidebar:
        st.header("Display Settings")

        # Page size select box
        page_size_options = [12, 24, 36, 48]
        new_page_size = st.selectbox(
            "Articles per page",
            options=page_size_options,
            index=page_size_options.index(min(page_size, max(page_size_options))),
            key="page_size_select",
        )

        # Number of columns slider
        new_num_columns = st.slider(
            "Number of columns",
            min_value=1,
            max_value=4,
            value=num_columns,
            key="num_columns_slider",
        )

        # Save settings button
        if st.button("Save Display Settings"):
            save_general_settings(new_num_columns)
            st.session_state.page_size = new_page_size
            st.session_state.num_columns = new_num_columns
            st.success("Settings saved successfully!")
            st.rerun()

        # Calculate number of pages
        num_pages = max(1, (total_articles + new_page_size - 1) // new_page_size)

        # Pagination controls
        st.write("### Navigation")
        col1, col2 = st.columns(2)

        with col1:
            if st.button("← Previous", disabled=(st.session_state.current_page == 1)):
                st.session_state.current_page = max(
                    1, st.session_state.current_page - 1
                )
                st.rerun()

        with col2:
            if st.button(
                "Next →", disabled=(st.session_state.current_page == num_pages)
            ):
                st.session_state.current_page = min(
                    num_pages, st.session_state.current_page + 1
                )
                st.rerun()

        new_page = st.number_input(
            "Page",
            min_value=1,
            max_value=num_pages,
            value=st.session_state.current_page,
            key="page_number_input",
        )
        if new_page != st.session_state.current_page:
            st.session_state.current_page = new_page
            st.rerun()

        st.write(f"of {num_pages} pages")

    # Use the new values for display, but don't update session state yet
    current_page = st.session_state.current_page - 1  # Convert to 0-indexed
    start_idx = current_page * new_page_size
    end_idx = min(start_idx + new_page_size, total_articles)

    # Display articles
    cols = st.columns(new_num_columns)

    for i in range(start_idx, end_idx):
        article_key = article_keys[i]
        article_file_path_dict = articles[article_key]

        with cols[i % new_num_columns]:
            with st.container():
                st.markdown('<div class="article-container">', unsafe_allow_html=True)

                st.subheader(article_key.replace("_", " "))

                st.markdown('<div class="article-content">', unsafe_allow_html=True)
                article_data = FileIOHelper.assemble_article_data(
                    article_file_path_dict
                )
                if article_data:
                    content_preview = article_data.get("short_text", "")
                    st.write(content_preview + "...")
                st.markdown("</div>", unsafe_allow_html=True)

                st.markdown('<div class="button-container">', unsafe_allow_html=True)
                col1, col2, col3 = st.columns([1, 1, 1])
                with col3:
                    if st.button("Read More", key=f"view_{article_key}"):
                        st.session_state.page2_selected_my_article = article_key
                        st.rerun()
                st.markdown("</div>", unsafe_allow_html=True)

                st.markdown("</div>", unsafe_allow_html=True)

    return new_page_size, new_num_columns
