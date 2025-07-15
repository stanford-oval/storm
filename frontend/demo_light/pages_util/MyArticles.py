import os

import demo_util
import streamlit as st
from demo_util import DemoFileIOHelper, DemoUIHelper
from streamlit_card import card


# set page config and display title
def my_articles_page():
    with st.sidebar:
        _, return_button_col = st.columns([2, 5])
        with return_button_col:
            if st.button(
                "Select another article",
                disabled="page2_selected_my_article" not in st.session_state,
            ):
                if "page2_selected_my_article" in st.session_state:
                    del st.session_state["page2_selected_my_article"]
                st.rerun()

    # sync my articles
    if "page2_user_articles_file_path_dict" not in st.session_state:
        local_dir = os.path.join(demo_util.get_demo_dir(), "DEMO_WORKING_DIR")
        os.makedirs(local_dir, exist_ok=True)
        st.session_state["page2_user_articles_file_path_dict"] = (
            DemoFileIOHelper.read_structure_to_dict(local_dir)
        )

    # if no feature demo selected, display all featured articles as info cards
    def article_card_setup(column_to_add, card_title, article_name):
        with column_to_add:
            cleaned_article_title = article_name.replace("_", " ")
            hasClicked = card(
                title=" / ".join(card_title),
                text=article_name.replace("_", " "),
                image=DemoFileIOHelper.read_image_as_base64(
                    os.path.join(demo_util.get_demo_dir(), "assets", "void.jpg")
                ),
                styles=DemoUIHelper.get_article_card_UI_style(boarder_color="#9AD8E1"),
            )
            if hasClicked:
                st.session_state["page2_selected_my_article"] = article_name
                st.rerun()

    if "page2_selected_my_article" not in st.session_state:
        # display article cards
        my_article_columns = st.columns(3)
        if len(st.session_state["page2_user_articles_file_path_dict"]) > 0:
            # get article names
            article_names = sorted(
                list(st.session_state["page2_user_articles_file_path_dict"].keys())
            )
            # configure pagination
            pagination = st.container()
            bottom_menu = st.columns((1, 4, 1, 1, 1))[1:-1]
            with bottom_menu[2]:
                batch_size = st.selectbox("Page Size", options=[24, 48, 72])
            with bottom_menu[1]:
                total_pages = (
                    int(len(article_names) / batch_size)
                    if int(len(article_names) / batch_size) > 0
                    else 1
                )
                current_page = st.number_input(
                    "Page", min_value=1, max_value=total_pages, step=1
                )
            with bottom_menu[0]:
                st.markdown(f"Page **{current_page}** of **{total_pages}** ")
            # show article cards
            with pagination:
                my_article_count = 0
                start_index = (current_page - 1) * batch_size
                end_index = min(current_page * batch_size, len(article_names))
                for article_name in article_names[start_index:end_index]:
                    column_to_add = my_article_columns[my_article_count % 3]
                    my_article_count += 1
                    article_card_setup(
                        column_to_add=column_to_add,
                        card_title=["My Article"],
                        article_name=article_name,
                    )
        else:
            with my_article_columns[0]:
                hasClicked = card(
                    title="Get started",
                    text="Start your first research!",
                    image=DemoFileIOHelper.read_image_as_base64(
                        os.path.join(demo_util.get_demo_dir(), "assets", "void.jpg")
                    ),
                    styles=DemoUIHelper.get_article_card_UI_style(),
                )
                if hasClicked:
                    st.session_state.selected_page = 1
                    st.session_state["manual_selection_override"] = True
                    st.session_state["rerun_requested"] = True
                    st.rerun()
    else:
        selected_article_name = st.session_state["page2_selected_my_article"]
        selected_article_file_path_dict = st.session_state[
            "page2_user_articles_file_path_dict"
        ][selected_article_name]

        demo_util.display_article_page(
            selected_article_name=selected_article_name,
            selected_article_file_path_dict=selected_article_file_path_dict,
            show_title=True,
            show_main_article=True,
        )
