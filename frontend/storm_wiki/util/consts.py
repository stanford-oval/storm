import os

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), "db", "settings.db")

SEARCH_ENGINES = {
    "searxng": {
        "env_var": "SEARXNG_BASE_URL",
        "settings": {
            "base_url": {"type": "text", "required": True, "label": "SearXNG Base URL"},
            "api_key": {
                "type": "password",
                "required": False,
                "label": "SearXNG API Key (optional)",
            },
        },
    },
    "bing": {
        "env_var": "BING_SEARCH_API_KEY",
        "settings": {
            "api_key": {"type": "password", "required": True, "label": "Bing API Key"},
        },
    },
    "yourdm": {
        "env_var": "YDC_API_KEY",
        "settings": {
            "api_key": {
                "type": "password",
                "required": True,
                "label": "YourDM API Key",
            },
        },
    },
    "duckduckgo": {"env_var": None, "settings": {}},
    "arxiv": {"env_var": None, "settings": {}},
}

LLM_MODELS = {
    "ollama": "OLLAMA_PORT",
    "openai": "OPENAI_API_KEY",
    "anthropic": "ANTHROPIC_API_KEY",
}


DRACULA_SOFT_DARK = {
    "primaryColor": "#bf96f9",
    "backgroundColor": "#282a36",
    "secondaryBackgroundColor": "#44475a",
    "textColor": "#C0C0D0",
    "sidebarBackgroundColor": "#44475a",
    "sidebarTextColor": "#C0C0D0",
    "font": "sans serif",
}

TOKYO_NIGHT = {
    "primaryColor": "#7aa2f7",
    "backgroundColor": "#1a1b26",
    "secondaryBackgroundColor": "#24283b",
    "textColor": "#a9b1d6",
    "sidebarBackgroundColor": "#24283b",
    "sidebarTextColor": "#565f89",
    "font": "sans serif",
}

GITHUB_DARK = {
    "primaryColor": "#58a6ff",
    "backgroundColor": "#0d1117",
    "secondaryBackgroundColor": "#161b22",
    "textColor": "#c9d1d9",
    "sidebarBackgroundColor": "#161b22",
    "sidebarTextColor": "#8b949e",
    "font": "sans serif",
}

GITHUB_LIGHT = {
    "primaryColor": "#0969da",
    "backgroundColor": "#ffffff",
    "secondaryBackgroundColor": "#f6f8fa",
    "textColor": "#24292f",
    "sidebarBackgroundColor": "#f6f8fa",
    "sidebarTextColor": "#57606a",
    "font": "sans serif",
}

SOLARIZED_LIGHT = {
    "primaryColor": "#268bd2",
    "backgroundColor": "#fdf6e3",
    "secondaryBackgroundColor": "#eee8d5",
    "textColor": "#657b83",
    "sidebarBackgroundColor": "#eee8d5",
    "sidebarTextColor": "#657b83",
    "font": "sans serif",
}

NORD_LIGHT = {
    "primaryColor": "#5e81ac",
    "backgroundColor": "#eceff4",
    "secondaryBackgroundColor": "#e5e9f0",
    "textColor": "#2e3440",
    "sidebarBackgroundColor": "#e5e9f0",
    "sidebarTextColor": "#4c566a",
    "font": "sans serif",
}


LIGHT_THEMES = {
    "Solarized Light": SOLARIZED_LIGHT,
    "Nord Light": NORD_LIGHT,
    "GitHub Light": GITHUB_LIGHT,
}

DARK_THEMES = {
    "Dracula Soft Dark": DRACULA_SOFT_DARK,
    "Tokyo Night": TOKYO_NIGHT,
    "GitHub Dark": GITHUB_DARK,
}

THEME_CSS_TEMPLATE = """
<style>
:root {{
    --primary-color: var(--primary-color);
    --background-color: var(--background-color);
    --secondary-background-color: var(--secondary-background-color);
    --text-color: var(--text-color);
    --font: var(--font);
    --sidebar-bg-color: var(--sidebar-bg-color);
}}

/* Base styles */
.stApp {{
    background-color: var(--background-color);
    color: var(--text-color);
    font-family: var(--font);
}}

[data-testid="stSidebar"] {{
    background-color: var(--secondary-background-color);
    color: var(--text-color);
}}

/* Custom styles for the select box container */
div[data-baseweb="select"] > div {{
    background-color: var(--sidebar-bg-color) !important;
    border: 1px solid var(--text-color) !important;
    border-radius: 4px !important;
}}

div[data-baseweb="select"] > div:focus-within {{
    border-color: var(--primary-color) !important;
    box-shadow: none !important;
}}

/* Remove text background color */
div[data-baseweb="select"] input {{
    background-color: transparent !important;
}}

/* Styles for the select box options */
div[data-baseweb="select"] ul {{
    background-color: var(--sidebar-bg-color) !important;
    border: 1px solid var(--primary-color) !important;
}}

div[data-baseweb="select"] ul li {{
    background-color: var(--sidebar-bg-color) !important;
    color: var(--text-color) !important;
}}

div[data-baseweb="select"] ul li:hover {{
    background-color: var(--secondary-background-color) !important;
}}

/* Custom styles for select box items */
.st-bb {{
    background-color: var(--sidebar-bg-color) !important;
    color: var(--text-color) !important;
}}

.st-ba {{
    border-bottom-color: var(--sidebar-bg-color) !important;
}}

/* Attempt to style dropdown items */
.stSelectbox [data-baseweb="select"] [role="option"] {{
    background-color: var(--sidebar-bg-color) !important;
    color: var(--text-color) !important;
}}

.stSelectbox [data-baseweb="select"] [role="option"]:hover {{
    background-color: var(--secondary-background-color) !important;
}}

/* Additional custom styles for dropdown items based on observed classes */
.st-bm, .st-bn, .st-bo, .st-bp, .st-bq, .st-br, .st-bs, .st-bt, .st-bu, .st-bv, .st-bw, .st-bx, .st-by, .st-bz, .st-bt, .st-c0, .st-c1, .st-c2, .st-cd, .st-c3, .st-c4, .st-c5, .st-c6, .st-c7, .st-c8, .st-c9 {{
    background-color: var(--sidebar-bg-color) !important;
    color: var(--text-color) !important;
}}

.st-bm:hover, .st-bn:hover, .st-bo:hover, .st-bp:hover, .st-bq:hover, .st-br:hover, .st-bs:hover, .st-bt:hover, .st-bu:hover, .st-bv:hover, .st-bw:hover, .st-bx:hover, .st-by:hover, .st-bz:hover, .st-bt:hover, .st-c0:hover, .st-c1:hover, .st-c2:hover, .st-cd:hover, .st-c3:hover, .st-c4:hover, .st-c5:hover, .st-c6:hover, .st-c7:hover, .st-c8:hover, .st-c9:hover {{
    background-color: var(--secondary-background-color) !important;
}}

/* Style for number input to match select box */
input[type="number"] {{
    background-color: var(--sidebar-bg-color) !important;
    color: var(--text-color) !important;
    border: 1px solid var(--text-color) !important;
    border-radius: 4px !important;
}}

input[type="number"]:focus {{
    border-color: var(--primary-color) !important;
    box-shadow: none !important;
}}

/* Style for number input container */
.st-emotion-cache-cpi0vb {{
    border: 1px solid var(--text-color);
    border-radius: 4px;
    overflow: hidden;
    display: flex;
    align-items: stretch;
}}

.st-emotion-cache-cpi0vb:focus-within {{
    border-color: var(--primary-color) !important;
}}

/* Style for the input field inside the number input */
.st-emotion-cache-cpi0vb input[type="number"] {{
    border: none !important;
    border-radius: 0 !important;
    flex-grow: 1;
    padding: 0.5rem;
}}

/* Style for number input increment and decrement buttons */
.st-emotion-cache-76z9jo {{
    display: flex;
}}

.st-emotion-cache-1xvsebw {{
    background-color: var(--primary-color) !important;
    color: var(--background-color) !important;
    border: none !important;
    transition: opacity 0.3s ease;
    padding: 0 0.5rem;
    display: flex;
    align-items: center;
    justify-content: center;
}}

.st-emotion-cache-1xvsebw:hover {{
    opacity: 0.8;
}}

.st-emotion-cache-1xvsebw svg {{
    fill: var(--background-color) !important;
}}

/* Remove right border radius from decrement button */
.st-emotion-cache-1xvsebw.step-down {{
    border-radius: 0;
}}

/* Remove left border radius from increment button */
.st-emotion-cache-1xvsebw.step-up {{
    border-radius: 0;
}}

</style>
"""

ALL_CUSTOM_CSS_TEMPLATE = """
<style>
    /* Read More button styles */
    .stButton>button {{
        width: auto;
        height: auto;
        white-space: normal;
        word-wrap: break-word;
        background-color: var(--sidebar-bg-color);
        color: var(--primary-color);
        border: 1px solid var(--primary-color);
        padding: 5px 10px;
        font-size: 14px;
        border-radius: 4px;
        transition: all 0.3s ease;
        float: right;
        margin-top: 10px;
    }}
    .stButton>button:hover {{
        background-color: var(--primary-color);
        color: var(--background-color);
    }}

    /* Additional custom CSS */
    .st-primary-button > button {{
        width: 100%;
        font-size: 14px;
        padding: 5px 10px;
    }}
    .article-container {{
        display: flex;
        flex-direction: column;
        height: 100%;
    }}
    .article-content {{
        flex-grow: 1;
    }}
    .button-container {{
        display: flex;
        justify-content: flex-end;
    }}
    .small-font {{
        font-size: 14px;
        margin: 0px;
        padding: 0px;
    }}

    /* New style for secondary buttons */
    button[kind="secondary"],
    button[data-testid="baseButton-secondary"] {{
        background-color: var(--sidebar-bg-color) !important;
        color: var(--primary-color) !important;
        border: 0px;
    }}

    /* Ensure button text is always visible */
    .stButton > button > div > p {{
        color: inherit !important;
    }}
</style>
"""

GLOBAL_CSS_TEMPLATE = """
<style>
    :root {{
        --primary-color: {primary_color};
        --background-color: {background_color};
        --secondary-background-color: {secondary_background_color};
        --text-color: {text_color};
        --font: {font};
        --sidebar-bg-color: {sidebar_bg_color};
        --sidebar-text-color: {sidebar_text_color};
    }}
    /* Base styles */
    .stApp {{
        background-color: var(--background-color);
        color: var(--text-color);
        font-family: var(--font);
    }}

    /* Sidebar */
    [data-testid="stSidebar"] {{
        background-color: var(--secondary-background-color);
        color: var(--text-color);
    }}

    /* Buttons */
    .stButton > button {{
        background-color: var(--primary-color);
        color: var(--background-color);
        border: none;
        padding: 5px 10px;
        font-size: 14px;
        border-radius: 4px;
        transition: all 0.3s ease;
    }}
    .stButton > button:hover {{
        background-color: var(--hover-color);
    }}

    /* Sidebar button styles */
    [data-testid="stSidebar"] .stButton > button {{
        background-color: transparent;
        color: var(--text-color);
        border: 1px solid var(--text-color);
    }}
    [data-testid="stSidebar"] .stButton > button:hover {{
        background-color: var(--primary-color);
        color: var(--background-color);
        border-color: var(--primary-color);
    }}
</style>
"""

MY_ARTICLES_CSS_TEMPLATE = """
<style>
    .article-card {{
        background-color: var(--secondary-background-color);
        color: var(--text-color);
        border: 1px solid var(--primary-color);
        border-radius: 5px;
        padding: 10px;
        margin-bottom: 10px;
        height: auto;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
    }}
    .article-card:hover {{
        background-color: var(--primary-color);
        color: var(--hover-text-color);
    }}

    /* Primary button styles */
    .stButton > button,
    .stButton > button:hover,
    .stButton > button:focus,
    .stButton > button:active {{
        background-color: var(--primary-button-bg-color) !important;
        color: var(--primary-button-text-color) !important;
        border: none !important;
        padding: 5px 10px;
        font-size: 14px;
        border-radius: 4px;
        transition: all 0.3s ease;
    }}
    .stButton > button:hover {{
        opacity: 0.8;
    }}

    /* Secondary button styles */
    button[kind="secondary"],
    button[kind="secondaryFormSubmit"],
    button[data-testid="baseButton-secondary"],
    button[data-testid="baseButton-secondaryFormSubmit"] {{
        background-color: var(--secondary-button-bg-color) !important;
        color: var(--secondary-button-text-color) !important;
        border: 1px solid var(--secondary-button-border-color) !important;
        padding: 5px 10px;
        font-size: 14px;
        border-radius: 4px;
        transition: all 0.3s ease;
    }}
    button[kind="secondary"]:hover,
    button[kind="secondaryFormSubmit"]:hover,
    button[data-testid="baseButton-secondary"]:hover,
    button[data-testid="baseButton-secondaryFormSubmit"]:hover {{
        background-color: var(--primary-color) !important;
        color: var(--hover-text-color) !important;
    }}

    /* Form submit button styles */
    .stButton > button[kind="secondaryFormSubmit"],
    .stButton > button[data-testid="baseButton-secondaryFormSubmit"] {{
        background-color: var(--primary-button-bg-color) !important;
        color: var(--primary-button-text-color) !important;
        border: none !important;
    }}
    .stButton > button[kind="secondaryFormSubmit"]:hover,
    .stButton > button[data-testid="baseButton-secondaryFormSubmit"]:hover {{
        opacity: 0.8;
    }}

    /* Tooltip styles */
    .stTooltipIcon {{
        color: var(--text-color) !important;
    }}
    .stTooltipContent {{
        background-color: var(--secondary-background-color) !important;
        color: var(--text-color) !important;
        border: 1px solid var(--primary-color) !important;
    }}

    .pagination-container {{
        display: flex;
        justify-content: center;
        align-items: center;
        margin-top: 20px;
    }}
    .pagination-container > div {{
        margin: 0 10px;
    }}

    /* Ensure button text is always visible */
    .stButton > button > div > p {{
        color: inherit !important;
    }}
</style>
"""

FORM_SUBMIT_BUTTON_CSS_TEMPLATE = """
<style>
    div[data-testid="stForm"] .stButton > button {{
        background-color: var(--primary-color) !important;
        color: var(--text-color) !important;
        border-color: var(--primary-color) !important;
        border-style: solid !important;
        border-width: 1px !important;
        border-radius: 4px !important;
        padding: 0.25rem 0.75rem !important;
        font-size: 14px !important;
        line-height: 1.6 !important;
        transition: all 0.3s ease !important;
    }}
    div[data-testid="stForm"] .stButton > button:hover {{
        background-color: var(--hover-bg-color) !important;
        color: var(--hover-text-color) !important;
        border-color: var(--hover-bg-color) !important;
    }}
    div[data-testid="stForm"] .stButton > button:active {{
        background-color: var(--active-bg-color) !important;
        transform: translateY(2px);
    }}
</style>
"""

PREVIEW_HTML_TEMPLATE = """
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0-beta3/css/all.min.css">
<div style="display: flex; gap: 10px;">
    <div style="background-color: {secondary_background_color}; color: {text_color}; padding: 10px; border-radius: 5px; width: 150px;">
        <h4 style="margin: 0;">Sidebar</h4>
        <p><i class="fas fa-home"></i> General</p>
        <p style="color: {primary_color};"><i class="fas fa-pencil-alt"></i> Theme</p>
        <p><i class="fas fa-cog"></i> Advanced</p>
    </div>
    <div style="background-color: {background_color}; color: {text_color}; padding: 10px; border-radius: 5px; flex-grow: 1;">
        <h3>Preview</h3>
        <p>This is how your theme will look.</p>
        <button style="background-color: {primary_color}; color: {button_text_color}; border: none; padding: 5px 10px; border-radius: 3px;">Button</button>
        <input type="text" placeholder="Input field" style="background-color: {secondary_background_color}; color: {text_color}; border: 1px solid {primary_color}; padding: 5px; margin-top: 5px; width: 100%;">
    </div>
</div>
"""
