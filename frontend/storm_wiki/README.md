
# STORM wiki

[STORM](https://github.com/stanford-oval/storm) frontend modified.

## Features & Changes


- themes: dracula soft dark color and other light and dark themes
- engines: duckduckgo, searxng and arxiv
- llm: ollama, anthropic
- users can change search engine before triggering search
- users can save primary and fallback llm in settings
- save result files as '*.md'
- add date to to top of the result file
- added arize-phoenix to trace.
- added github ci file to test fallback options for search and llm
- change number of display columns
- pagination in sidebar

## Prerequisites

- Python 3.8+
- `knowledge-storm` package or source code
- Required API keys (see main STORM repository)

## Installation

1. Clone the repository:
   ```sh
   git clone https://github.com/yourusername/storm-minimal-ui.git
   cd storm-minimal-ui
   ```

2. Install dependencies:
   ```sh
   pip install -r requirements.txt
   cp .env.example .env
   cp secrets.toml.example ./.streamlit/secrets.toml
   ```

   edit .env file
   ```
   STREAMLIT_OUTPUT_DIR=DEMO_WORKING_DIR
   OPENAI_API_KEY=YOUR_OPENAI_KEY
   STORM_TIMEZONE="America/Los_Angeles"
   ```

   also update serecets.toml

3. Set up API keys:
   - Copy `secrets.toml.example` to `.streamlit/secrets.toml`
   - Add your API keys to `.streamlit/secrets.toml`

## Usage

Run the Streamlit app:
```sh
streamlit run storm.py --server.port 8501 --server.address 0.0.0.0

```

## Customization

Modify `set_storm_runner()` in `demo_util.py` to customize STORMWikiRunner settings. Refer to the [main STORM repository](https://github.com/stanford-oval/storm) for detailed customization options.

