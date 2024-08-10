import streamlit as st
import os
from dotenv import load_dotenv
from db.db_operations import init_db
from util.phoenix_setup import setup_phoenix
from streamlit_option_menu import option_menu
from util.theme_manager import load_and_apply_theme, get_option_menu_style
from pages_util.MyArticles import my_articles_page
from pages_util.CreateNewArticle import create_new_article_page
from pages_util.Settings import settings_page

load_dotenv()

# Set STREAMLIT_OUTPUT_DIR if not already set
if "STREAMLIT_OUTPUT_DIR" not in os.environ:
    os.environ["STREAMLIT_OUTPUT_DIR"] = os.path.join(
        os.path.dirname(__file__), "output"
    )

# Set page config first
st.set_page_config(layout="wide")

# Custom CSS to hide the progress bar and other loading indicators
hide_streamlit_style = """
<style>
    header {visibility: hidden;}
    .stProgress, .stSpinner, .st-emotion-cache-1dp5vir {
        display: none !important;
    }
    div.block-container{padding-top:1rem;}
</style>
"""
st.markdown(hide_streamlit_style, unsafe_allow_html=True)

script_dir = os.path.dirname(os.path.abspath(__file__))
wiki_root_dir = os.path.dirname(os.path.dirname(script_dir))


def clear_other_page_session_state(page_index: int):
    if page_index is None:
        keys_to_delete = [key for key in st.session_state if key.startswith("page")]
    else:
        keys_to_delete = [
            key
            for key in st.session_state
            if key.startswith("page") and f"page{page_index}" not in key
        ]
    for key in set(keys_to_delete):
        del st.session_state[key]


def main():
    init_db()
    setup_phoenix()

    if "first_run" not in st.session_state:
        st.session_state["first_run"] = True

    # Initialize theme_updated state
    if "theme_updated" not in st.session_state:
        st.session_state.theme_updated = False

    # set api keys from secrets
    if st.session_state["first_run"]:
        for key, value in st.secrets.items():
            if isinstance(value, str):
                os.environ[key] = value

    # initialize session_state
    if "selected_article_index" not in st.session_state:
        st.session_state["selected_article_index"] = 0
    if "selected_page" not in st.session_state:
        st.session_state["selected_page"] = 0
    if st.session_state.get("rerun_requested", False):
        st.session_state["rerun_requested"] = False
        st.rerun()

    # Load theme from database
    current_theme = load_and_apply_theme()
    st.session_state.current_theme = current_theme
    st.session_state.option_menu_style = get_option_menu_style(current_theme)

    # Check if Phoenix settings have been updated
    if st.session_state.get("phoenix_settings_updated", False):
        setup_phoenix()
        st.session_state.phoenix_settings_updated = False

    # Check if a force rerun is requested
    if st.session_state.get("force_rerun", False):
        st.session_state.force_rerun = False
        st.rerun()

    # Create the sidebar menu
    with st.sidebar:
        st.title("Storm wiki")
        pages = ["My Articles", "Create New Article", "Settings"]

        # Use a unique key for the menu when the theme is updated
        menu_key = f"menu_selection_{st.session_state.get('theme_updated', False)}"

        menu_selection = option_menu(
            menu_title=None,
            options=pages,
            icons=["house", "pencil-square", "gear"],
            menu_icon="cast",
            default_index=0,
            styles=st.session_state.option_menu_style,
            key=menu_key,
        )

        # Add submenu for Settings
        if menu_selection == "Settings":
            st.markdown("<hr>", unsafe_allow_html=True)
            st.markdown("### Settings Section")
            settings_options = ["General", "Search", "Theme", "LLM", "Categories"]
            icons = ["gear", "search", "brush", "robot", "tags"]

            # Use a unique key for the submenu when the theme is updated
            submenu_key = (
                f"settings_submenu_{st.session_state.get('theme_updated', False)}"
            )

            selected_setting = option_menu(
                menu_title=None,
                options=settings_options,
                icons=icons,
                menu_icon=None,
                default_index=0,
                styles=st.session_state.option_menu_style,
                key=submenu_key,
            )
            # Store the selected setting in session state
            st.session_state.selected_setting = selected_setting

    # Reset the theme_updated flag
    if st.session_state.get("theme_updated", False):
        st.session_state.theme_updated = False

    # Display the selected page
    if menu_selection == "My Articles":
        clear_other_page_session_state(page_index=2)
        my_articles_page()
    elif menu_selection == "Create New Article":
        clear_other_page_session_state(page_index=3)
        create_new_article_page()
    elif menu_selection == "Settings":
        settings_page(st.session_state.selected_setting)

    # Update selected_page in session state
    st.session_state["selected_page"] = pages.index(menu_selection)


if __name__ == "__main__":
    main()
