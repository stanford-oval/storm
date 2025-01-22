import os

script_dir = os.path.dirname(os.path.abspath(__file__))
wiki_root_dir = os.path.dirname(os.path.dirname(script_dir))

import demo_util
from pages_util import MyArticles, CreateNewArticle
from streamlit_float import *
from streamlit_option_menu import option_menu


def main():
    global database
    st.set_page_config(layout="wide")

    if "first_run" not in st.session_state:
        st.session_state["first_run"] = True

    # set api keys from secrets
    if st.session_state["first_run"]:
        for key, value in st.secrets.items():
            if type(value) == str:
                os.environ[key] = value

    # initialize session_state
    if "selected_article_index" not in st.session_state:
        st.session_state["selected_article_index"] = 0
    if "selected_page" not in st.session_state:
        st.session_state["selected_page"] = 0
    if st.session_state.get("rerun_requested", False):
        st.session_state["rerun_requested"] = False
        st.rerun()

    st.write(
        "<style>div.block-container{padding-top:2rem;}</style>", unsafe_allow_html=True
    )
    menu_container = st.container()
    with menu_container:
        pages = ["My Articles", "Create New Article"]
        styles = {
            "container": {"padding": "0.2rem 0", "background-color": "#22222200"},
        }
        menu_selection = option_menu(
            None,
            pages,
            icons=["house", "search"],
            menu_icon="cast",
            default_index=0,
            orientation="horizontal",
            manual_select=st.session_state.selected_page,
            styles=styles,
            key="menu_selection",
        )
        if st.session_state.get("manual_selection_override", False):
            menu_selection = pages[st.session_state["selected_page"]]
            st.session_state["manual_selection_override"] = False
            st.session_state["selected_page"] = None

        if menu_selection == "My Articles":
            demo_util.clear_other_page_session_state(page_index=2)
            MyArticles.my_articles_page()
        elif menu_selection == "Create New Article":
            demo_util.clear_other_page_session_state(page_index=3)
            CreateNewArticle.create_new_article_page()


if __name__ == "__main__":
    main()
