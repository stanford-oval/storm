import streamlit as st
import sqlite3
import json
from .consts import (
    DB_PATH,
    THEME_CSS_TEMPLATE,
    GLOBAL_CSS_TEMPLATE,
    MY_ARTICLES_CSS_TEMPLATE,
    FORM_SUBMIT_BUTTON_CSS_TEMPLATE,
    PREVIEW_HTML_TEMPLATE,
    ALL_CUSTOM_CSS_TEMPLATE,
    TOKYO_NIGHT,
)
from db.db_operations import save_setting, load_setting


def save_theme(theme):
    save_setting("theme", theme)


def load_theme_from_db():
    return load_setting("theme", TOKYO_NIGHT.copy())


def adjust_color_brightness(hex_color, brightness_factor):
    # Convert hex to RGB
    rgb = tuple(int(hex_color.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))
    # Adjust brightness
    new_rgb = tuple(
        min(255, max(0, int(c * (1 + brightness_factor / 100)))) for c in rgb
    )
    # Convert back to hex
    return "#{:02x}{:02x}{:02x}".format(*new_rgb)


def get_contrasting_text_color(hex_color):
    # Convert hex to RGB
    rgb = tuple(int(hex_color.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))
    # Calculate luminance
    luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
    # Return black for light backgrounds, white for dark
    return "#000000" if luminance > 0.5 else "#ffffff"


def get_option_menu_style(theme):
    return {
        "container": {
            "padding": "0.5rem",
            "background-color": theme["sidebarBackgroundColor"],
            "border-radius": "0px",
        },
        "icon": {"color": theme["sidebarTextColor"], "font-size": "16px"},
        "nav-link": {
            "color": adjust_color_brightness(theme["sidebarTextColor"], 50),
            "font-size": "16px",
            "text-align": "left",
            "margin": "0px",
            "--hover-color": theme["primaryColor"],
            "background-color": "transparent",
        },
        "nav-link-selected": {
            "background-color": theme["primaryColor"],
            "color": get_contrasting_text_color(theme["primaryColor"]),
        },
    }


def get_theme_css(theme):
    return THEME_CSS_TEMPLATE.format(
        primary_color=theme["primaryColor"],
        background_color=theme["backgroundColor"],
        secondary_background_color=theme["secondaryBackgroundColor"],
        text_color=theme["textColor"],
        font=theme["font"],
        sidebar_bg_color=theme["sidebarBackgroundColor"],
    )


def get_read_more_button_css(theme):
    is_light_theme = is_light_color(theme["backgroundColor"])
    button_bg_color = (
        theme["secondaryBackgroundColor"]
        if is_light_theme
        else theme["backgroundColor"]
    )
    button_text_color = theme["textColor"]
    button_border_color = theme["primaryColor"]
    button_hover_bg_color = theme["primaryColor"]
    button_hover_text_color = get_contrasting_text_color(button_hover_bg_color)

    return f"""
    .stButton.read-more-button > button {{
        width: auto;
        height: auto;
        white-space: normal;
        word-wrap: break-word;
        background-color: {button_bg_color} !important;
        color: {button_text_color} !important;
        border: 1px solid {button_border_color} !important;
        padding: 5px 10px;
        font-size: 14px;
        border-radius: 4px;
        transition: all 0.3s ease;
        float: right;
        margin-top: 10px;
    }}
    .stButton.read-more-button > button:hover {{
        background-color: {button_hover_bg_color} !important;
        color: {button_hover_text_color} !important;
    }}
    """


def is_light_color(hex_color):
    # Convert hex to RGB
    rgb = tuple(int(hex_color.lstrip("#")[i : i + 2], 16) for i in (0, 2, 4))
    # Calculate luminance
    luminance = (0.299 * rgb[0] + 0.587 * rgb[1] + 0.114 * rgb[2]) / 255
    return luminance > 0.5


def get_my_articles_css(theme):
    hover_text_color = get_contrasting_text_color(theme["primaryColor"])
    primary_button_bg_color = theme["primaryColor"]
    primary_button_text_color = get_contrasting_text_color(primary_button_bg_color)
    is_light_theme = is_light_color(theme["backgroundColor"])
    secondary_button_bg_color = (
        theme["secondaryBackgroundColor"]
        if is_light_theme
        else theme["backgroundColor"]
    )
    secondary_button_text_color = theme["textColor"]
    secondary_button_border_color = theme["primaryColor"]

    return MY_ARTICLES_CSS_TEMPLATE.format(
        primary_color=theme["primaryColor"],
        secondary_background_color=theme["secondaryBackgroundColor"],
        text_color=theme["textColor"],
        hover_text_color=hover_text_color,
        primary_button_bg_color=primary_button_bg_color,
        primary_button_text_color=primary_button_text_color,
        secondary_button_bg_color=secondary_button_bg_color,
        secondary_button_text_color=secondary_button_text_color,
        secondary_button_border_color=secondary_button_border_color,
    )


def get_form_submit_button_css(theme):
    primary_color = theme["primaryColor"]
    bg_color = theme["backgroundColor"]
    is_light_theme = is_light_color(bg_color)

    text_color = get_contrasting_text_color(primary_color)
    hover_bg_color = adjust_color_brightness(
        primary_color, -30 if is_light_theme else 30
    )
    hover_text_color = get_contrasting_text_color(hover_bg_color)
    active_bg_color = adjust_color_brightness(hover_bg_color, -20)

    return FORM_SUBMIT_BUTTON_CSS_TEMPLATE.format(
        primary_color=primary_color,
        text_color=text_color,
        hover_bg_color=hover_bg_color,
        hover_text_color=hover_text_color,
        active_bg_color=active_bg_color,
    )


def get_global_css(theme):
    hover_color = adjust_color_brightness(theme["primaryColor"], -20)
    return GLOBAL_CSS_TEMPLATE.format(
        primary_color=theme["primaryColor"],
        background_color=theme["backgroundColor"],
        secondary_background_color=theme["secondaryBackgroundColor"],
        text_color=theme["textColor"],
        font=theme["font"],
        sidebar_bg_color=theme["sidebarBackgroundColor"],
        sidebar_text_color=theme["sidebarTextColor"],
        hover_color=hover_color,
    )


def load_and_apply_theme():
    if "current_theme" not in st.session_state:
        st.session_state.current_theme = load_theme_from_db()

    current_theme = st.session_state.current_theme

    # Apply custom CSS
    st.markdown(get_theme_css(current_theme), unsafe_allow_html=True)

    # Apply option menu styles
    option_menu_style = get_option_menu_style(current_theme)
    st.session_state.option_menu_style = option_menu_style

    return current_theme


def update_theme_and_rerun(new_theme):
    save_theme(new_theme)
    st.session_state.current_theme = new_theme
    st.rerun()


def get_preview_html(theme):
    button_text_color = get_contrasting_text_color(theme["primaryColor"])

    return PREVIEW_HTML_TEMPLATE.format(
        primary_color=theme["primaryColor"],
        background_color=theme["backgroundColor"],
        secondary_background_color=theme["secondaryBackgroundColor"],
        text_color=theme["textColor"],
        button_text_color=button_text_color,
    )


def get_all_custom_css(theme):
    return ALL_CUSTOM_CSS_TEMPLATE.format(
        primary_color=theme["primaryColor"],
        background_color=theme["backgroundColor"],
        secondary_background_color=theme["secondaryBackgroundColor"],
        text_color=theme["textColor"],
        sidebar_bg_color=theme["sidebarBackgroundColor"],
    )
