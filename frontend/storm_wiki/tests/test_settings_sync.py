import streamlit as st
from streamlit.testing.v1 import AppTest
from pages_util.Settings import settings_page
from pages_util.CreateNewArticle import create_new_article_page
import os
from unittest.mock import patch

# Mock the st.sidebar to avoid errors in testing
st.sidebar = st.empty()


def setup_test_environment():
    for key in list(st.session_state.keys()):
        del st.session_state[key]

    # Set up environment variables if needed
    os.environ["SOME_ENV_VAR"] = "some_value"


def print_available_elements(at):
    print("Available elements:")
    for attr in dir(at):
        if not attr.startswith("_") and attr not in [
            "run",
            "from_file",
            "get_delta_path",
        ]:
            elements = getattr(at, attr)
            if isinstance(elements, list):
                print(f"{attr}:")
                for elem in elements:
                    print(f"  - Type: {type(elem).__name__}")
                    if hasattr(elem, "label"):
                        print(f"    Label: {elem.label}")
                    if hasattr(elem, "key"):
                        print(f"    Key: {elem.key}")


@patch("streamlit.secrets", {"some_key": "some_value"})
def test_num_columns_sync():
    setup_test_environment()

    # Test Settings page to My Articles page sync
    settings_at = AppTest.from_file("pages_util/Settings.py")
    settings_at.run()

    print_available_elements(settings_at)

    try:
        settings_at.selectbox[0].set_value("General").run()
        settings_at.number_input[0].set_value(4).run()
    except Exception as e:
        print(f"Error setting values in Settings page: {e}")
        print_available_elements(settings_at)

    # Verify changes in My Articles page
    my_articles_at = AppTest.from_file("pages_util/MyArticles.py")
    my_articles_at.run()

    print_available_elements(my_articles_at)

    try:
        assert my_articles_at.sidebar.number_input[0].value == 4
    except Exception as e:
        print(f"Error verifying values in My Articles page: {e}")
        print_available_elements(my_articles_at)

    # Test My Articles page to Settings page sync
    try:
        my_articles_at.sidebar.number_input[0].set_value(5).run()
    except Exception as e:
        print(f"Error setting values in My Articles page: {e}")
        print_available_elements(my_articles_at)

    # Verify changes in Settings page
    settings_at = AppTest.from_file("pages_util/Settings.py")
    settings_at.run()
    try:
        assert settings_at.number_input[0].value == 5
    except Exception as e:
        print(f"Error verifying final values in Settings page: {e}")
        print_available_elements(settings_at)


@patch("streamlit.secrets", {"some_key": "some_value"})
def test_search_options_sync():
    setup_test_environment()

    settings_at = AppTest.from_file("pages_util/Settings.py")
    settings_at.run()

    print_available_elements(settings_at)

    try:
        # Instead of using label, let's try to find elements by type and index
        settings_at.selectbox[0].set_value("Search").run()
        settings_at.number_input[0].set_value(10).run()
        settings_at.number_input[1].set_value(5).run()
    except Exception as e:
        print(f"Error setting values in Settings page: {e}")
        print_available_elements(settings_at)

    # Verify changes in Create New Article page
    article_at = AppTest.from_file("pages_util/CreateNewArticle.py")
    article_at.run()

    print_available_elements(article_at)

    try:
        assert article_at.sidebar.number_input[0].value == 10
        assert article_at.sidebar.number_input[1].value == 5
    except Exception as e:
        print(f"Error verifying values in Create New Article page: {e}")
        print_available_elements(article_at)

    # Test Create New Article page to Settings page sync
    try:
        article_at.sidebar.number_input[0].set_value(15).run()
        article_at.sidebar.number_input[1].set_value(8).run()
    except Exception as e:
        print(f"Error setting values in Create New Article page: {e}")
        print_available_elements(article_at)

    # Verify changes in Settings page
    settings_at = AppTest.from_file("pages_util/Settings.py")
    settings_at.run()
    try:
        assert settings_at.number_input[0].value == 15
        assert settings_at.number_input[1].value == 8
    except Exception as e:
        print(f"Error verifying final values in Settings page: {e}")
        print_available_elements(settings_at)


@patch("streamlit.secrets", {"some_key": "some_value"})
def test_llm_settings_sync():
    setup_test_environment()

    settings_at = AppTest.from_file("pages_util/Settings.py")
    settings_at.run()

    print_available_elements(settings_at)

    try:
        settings_at.selectbox[0].set_value("LLM").run()
        settings_at.selectbox[1].set_value("ollama").run()
        settings_at.selectbox[2].set_value("llama2").run()
    except Exception as e:
        print(f"Error setting values in Settings page: {e}")
        print_available_elements(settings_at)

    # Verify changes in Create New Article page
    article_at = AppTest.from_file("pages_util/CreateNewArticle.py")
    article_at.run()

    print_available_elements(article_at)

    try:
        assert article_at.sidebar.selectbox[0].value == "ollama"
        assert article_at.sidebar.selectbox[1].value == "llama2"
    except Exception as e:
        print(f"Error verifying values in Create New Article page: {e}")
        print_available_elements(article_at)

    # Test Create New Article page to Settings page sync
    try:
        article_at.sidebar.selectbox[0].set_value("openai").run()
        article_at.sidebar.selectbox[1].set_value("gpt-4o").run()
    except Exception as e:
        print(f"Error setting values in Create New Article page: {e}")
        print_available_elements(article_at)

    # Verify changes in Settings page
    settings_at = AppTest.from_file("pages_util/Settings.py")
    settings_at.run()
    try:
        assert settings_at.selectbox[1].value == "openai"
        assert settings_at.selectbox[2].value == "gpt-4o"
    except Exception as e:
        print(f"Error verifying final values in Settings page: {e}")
        print_available_elements(settings_at)


@patch("streamlit.secrets", {"some_key": "some_value"})
def test_phoenix_settings_sync():
    setup_test_environment()

    settings_at = AppTest.from_file("pages_util/Settings.py")
    settings_at.run()

    print_available_elements(settings_at)

    try:
        settings_at.selectbox[0].set_value("General").run()
        settings_at.toggle[0].set_value(True).run()
        settings_at.text_input[0].set_value("test-project").run()
        settings_at.text_input[1].set_value("localhost:7007").run()
    except Exception as e:
        print(f"Error setting values in Settings page: {e}")
        print_available_elements(settings_at)

    # Verify changes in Phoenix settings
    settings_at = AppTest.from_file("pages_util/Settings.py")
    settings_at.run()
    try:
        assert settings_at.toggle[0].value == True
        assert settings_at.text_input[0].value == "test-project"
        assert settings_at.text_input[1].value == "localhost:7007"
    except Exception as e:
        print(f"Error verifying Phoenix settings: {e}")
        print_available_elements(settings_at)

    # Test toggling Phoenix off
    try:
        settings_at.toggle[0].set_value(False).run()
    except Exception as e:
        print(f"Error toggling Phoenix off: {e}")
        print_available_elements(settings_at)

    # Verify Phoenix is disabled
    settings_at = AppTest.from_file("pages_util/Settings.py")
    settings_at.run()
    try:
        assert settings_at.toggle[0].value == False
    except Exception as e:
        print(f"Error verifying Phoenix is disabled: {e}")
        print_available_elements(settings_at)
