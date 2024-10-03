import os
import logging
import streamlit as st
from util.file_io import FileIOHelper
from util.ui_components import UIComponents
from util.theme_manager import load_and_apply_theme
from db.db_operations import load_setting, save_setting

logging.basicConfig(level=logging.DEBUG)


def update_num_columns():
    save_setting("num_columns", st.session_state.num_columns_input)


def ensure_default_categories():
    categories = load_setting("categories", ["Default", "Uncategorized"])
    for category in categories:
        local_dir = FileIOHelper.get_output_dir(category)
        os.makedirs(local_dir, exist_ok=True)
    save_setting("categories", categories)
    return categories


def initialize_session_state():
    if "page_size" not in st.session_state:
        st.session_state.page_size = 24
    if "current_page" not in st.session_state:
        st.session_state.current_page = 1
    if "selected_category" not in st.session_state:
        st.session_state.selected_category = "All Categories"
    if "num_columns" not in st.session_state:
        st.session_state.num_columns = load_setting("num_columns", 3)

    categories = ensure_default_categories()

    if "user_articles" not in st.session_state:
        st.session_state.user_articles = {}
        for category in categories:
            local_dir = FileIOHelper.get_output_dir(category)
            st.session_state.user_articles[category] = (
                FileIOHelper.read_structure_to_dict(local_dir)
            )


def get_all_articles():
    all_articles = {}
    for category, articles in st.session_state.user_articles.items():
        for article_key, article_data in articles.items():
            all_articles[f"{category}/{article_key}"] = article_data
    return all_articles


def display_article_list(page_size, num_columns):
    if st.session_state.selected_category == "All Categories":
        articles = get_all_articles()
    else:
        articles = st.session_state.user_articles[st.session_state.selected_category]

    article_keys = list(articles.keys())
    total_articles = len(article_keys)

    current_page = st.session_state.current_page - 1
    start_idx = current_page * page_size
    end_idx = min(start_idx + page_size, total_articles)

    cols = st.columns(num_columns)
    for i in range(start_idx, end_idx):
        article_key = article_keys[i]
        article_file_path_dict = articles[article_key]
        with cols[i % num_columns]:
            article_data = FileIOHelper.assemble_article_data(article_file_path_dict)
            if article_data:
                if st.session_state.selected_category == "All Categories":
                    category, article_name = article_key.split("/", 1)
                else:
                    category = st.session_state.selected_category
                    article_name = article_key

                st.markdown(
                    f"""
                    <h3 style="margin-bottom: 0;">
                        {article_name.replace("_", " ")}
                    </h3>
                    <div style="
                        font-size: 1em;
                        font-weight: normal;
                        color: var(--text-color);
                        opacity: 0.6;">
                    category: {category}
                    </div>
                    """,
                    unsafe_allow_html=True,
                )
                st.write(article_data.get("short_text", "") + "...")

                if st.button(
                    "Read More",
                    key=f"view_{article_key}",
                    use_container_width=False,
                    type="secondary",
                    help="Click to read the full article",
                ):
                    st.session_state.page2_selected_my_article = (
                        category,
                        article_name,
                    )
                    st.rerun()

    # Pagination controls
    total_pages = max(1, (total_articles + page_size - 1) // page_size)

    if total_articles > page_size:
        col1, col2 = st.columns(2)
        with col1:
            if st.button("← Previous", disabled=(st.session_state.current_page == 1)):
                st.session_state.current_page = max(
                    1, st.session_state.current_page - 1
                )
        with col2:
            if st.button(
                "Next →", disabled=(st.session_state.current_page == total_pages)
            ):
                st.session_state.current_page = min(
                    total_pages, st.session_state.current_page + 1
                )

        st.write(f"Page {st.session_state.current_page} of {total_pages}")
    else:
        st.write(f"Showing all {total_articles} articles")


def display_selected_article():
    category, article_key = st.session_state.page2_selected_my_article
    selected_article_file_path_dict = st.session_state.user_articles[category][
        article_key
    ]
    UIComponents.display_article_page(
        article_key,
        selected_article_file_path_dict,
        show_title=True,
        show_main_article=True,
        show_feedback_form=False,
        show_qa_panel=False,
    )
    if st.button("Back to Article List"):
        del st.session_state.page2_selected_my_article
        st.rerun()


def display_article_list_and_controls():
    with st.sidebar:
        st.session_state.page_size = st.selectbox(
            "Items per page", [12, 24, 48, 96], index=1
        )
        st.session_state.num_columns = st.number_input(
            "Number of columns",
            min_value=1,
            max_value=4,
            value=st.session_state.num_columns,
        )

    display_article_list(st.session_state.page_size, st.session_state.num_columns)

    save_setting("num_columns", st.session_state.num_columns)


def my_articles_page():
    initialize_session_state()
    load_and_apply_theme()
    UIComponents.apply_custom_css()

    if "page2_selected_my_article" in st.session_state:
        display_selected_article()
    else:
        with st.sidebar:
            categories = load_setting("categories", ["Default"])
            category_options = ["All Categories"] + categories
            selected_category = st.selectbox(
                "Select Category", category_options, key="category_selector"
            )

        if selected_category != st.session_state.selected_category:
            st.session_state.selected_category = selected_category
            st.session_state.current_page = 1

        display_article_list_and_controls()
