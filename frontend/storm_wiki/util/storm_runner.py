import os
import time
import json
import streamlit as st
from typing import Optional, Dict, Any
import logging
import sqlite3
import json
import subprocess
from dspy import Example

from knowledge_storm import (
    STORMWikiRunnerArguments,
    STORMWikiRunner,
    STORMWikiLMConfigs,
)
from knowledge_storm.lm import OpenAIModel, OllamaClient
from .search import CombinedSearchAPI
from .artifact_helpers import convert_txt_to_md
from pages_util.Settings import (
    load_ollama_settings,
    load_search_options,
)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


def add_examples_to_runner(runner):
    find_related_topic_example = Example(
        topic="Knowledge Curation",
        related_topics="https://en.wikipedia.org/wiki/Knowledge_management\n"
        "https://en.wikipedia.org/wiki/Information_science\n"
        "https://en.wikipedia.org/wiki/Library_science\n",
    )
    # TODO: add to consts
    gen_persona_example = Example(
        topic="Knowledge Curation",
        examples="Title: Knowledge management\n"
        "Table of Contents: History\nResearch\n  Dimensions\n  Strategies\n  Motivations\nKM technologies"
        "\nKnowledge barriers\nKnowledge retention\nKnowledge audit\nKnowledge protection\n"
        "  Knowledge protection methods\n    Formal methods\n    Informal methods\n"
        "  Balancing knowledge protection and knowledge sharing\n  Knowledge protection risks",
        personas="1. Historian of Knowledge Systems: This editor will focus on the history and evolution of knowledge curation. They will provide context on how knowledge curation has changed over time and its impact on modern practices.\n"
        "2. Information Science Professional: With insights from 'Information science', this editor will explore the foundational theories, definitions, and philosophy that underpin knowledge curation\n"
        "3. Digital Librarian: This editor will delve into the specifics of how digital libraries operate, including software, metadata, digital preservation.\n"
        "4. Technical expert: This editor will focus on the technical aspects of knowledge curation, such as common features of content management systems.\n"
        "5. Museum Curator: The museum curator will contribute expertise on the curation of physical items and the transition of these practices into the digital realm.",
    )
    write_page_outline_example = Example(
        topic="Example Topic",
        conv="Wikipedia Writer: ...\nExpert: ...\nWikipedia Writer: ...\nExpert: ...",
        old_outline="# Section 1\n## Subsection 1\n## Subsection 2\n"
        "# Section 2\n## Subsection 1\n## Subsection 2\n"
        "# Section 3",
        outline="# New Section 1\n## New Subsection 1\n## New Subsection 2\n"
        "# New Section 2\n"
        "# New Section 3\n## New Subsection 1\n## New Subsection 2\n## New Subsection 3",
    )
    write_section_example = Example(
        info="[1]\nInformation in document 1\n[2]\nInformation in document 2\n[3]\nInformation in document 3",
        topic="Example Topic",
        section="Example Section",
        output="# Example Topic\n## Subsection 1\n"
        "This is an example sentence [1]. This is another example sentence [2][3].\n"
        "## Subsection 2\nThis is one more example sentence [1].",
    )

    runner.storm_knowledge_curation_module.persona_generator.create_writer_with_persona.find_related_topic.demos = [
        find_related_topic_example
    ]
    runner.storm_knowledge_curation_module.persona_generator.create_writer_with_persona.gen_persona.demos = [
        gen_persona_example
    ]
    runner.storm_outline_generation_module.write_outline.write_page_outline.demos = [
        write_page_outline_example
    ]
    runner.storm_article_generation.section_gen.write_section.demos = [
        write_section_example
    ]


def run_storm_with_fallback(
    topic: str,
    current_working_dir: str,
    callback_handler=None,
    ollama_kwargs=None,
    engine_args=None,
):
    def log_progress(message: str):
        st.info(message)
        logger.info(message)
        if callback_handler:
            callback_handler.on_information_gathering_start(message=message)

    log_progress("Initializing language models...")
    llm_configs = STORMWikiLMConfigs()

    if engine_args is None:
        engine_args = STORMWikiRunnerArguments(
            output_dir=current_working_dir,
            max_conv_turn=3,
            max_perspective=3,
            search_top_k=3,
            retrieve_top_k=3,
        )

    log_progress("Setting up search engine...")
    rm = CombinedSearchAPI(max_results=engine_args.search_top_k)

    if ollama_kwargs is None:
        ollama_kwargs = {
            "model": "jaigouk/hermes-2-theta-llama-3:latest",
            "url": "http://localhost",
            "port": 11434,  # Add the port here
            "stop": ("\n\n---",),
        }

    log_progress("Starting STORM process with Ollama...")
    for lm_type in [
        "conv_simulator",
        "question_asker",
        "outline_gen",
        "article_gen",
        "article_polish",
    ]:
        max_tokens = (
            1000
            if lm_type == "article_polish"
            else ollama_kwargs.get("max_tokens", 500)
        )
        lm = OllamaClient(
            model=ollama_kwargs["model"],
            url=ollama_kwargs["url"],
            port=ollama_kwargs["port"],  # Pass the port here
            max_tokens=max_tokens,
            stop=ollama_kwargs["stop"],
        )
        getattr(llm_configs, f"set_{lm_type}_lm")(lm)

    runner = STORMWikiRunner(engine_args, llm_configs, rm)
    add_examples_to_runner(runner)
    runner.run(
        topic=topic,
        do_research=True,
        do_generate_outline=True,
        do_generate_article=True,
        do_polish_article=True,
    )
    runner.post_run()
    return runner


def process_raw_search_results(
    raw_results: Dict[str, Any],
) -> Dict[int, Dict[str, str]]:
    citations = {}
    for i, result in enumerate(raw_results.get("results", []), start=1):
        citations[i] = {
            "title": result.get("title", ""),
            "url": result.get("url", ""),
            "snippets": result.get("content", ""),
        }
    return citations


def process_search_results(runner, current_working_dir: str, topic: str):
    topic_dir = os.path.join(current_working_dir, topic.replace(" ", "_"))
    raw_search_results_path = os.path.join(topic_dir, "raw_search_results.json")
    markdown_path = os.path.join(topic_dir, f"{topic.replace(' ', '_')}.md")

    if os.path.exists(raw_search_results_path):
        try:
            with open(raw_search_results_path, "r") as f:
                raw_search_results = json.load(f)

            citations = process_raw_search_results(raw_search_results)
            add_citations_to_markdown(markdown_path, citations)
            logger.info(f"Citations added to {markdown_path}")
        except json.JSONDecodeError:
            logger.error(f"Error decoding JSON from {raw_search_results_path}")
        except Exception as e:
            logger.error(f"Error processing search results: {str(e)}", exc_info=True)
    else:
        logger.warning(f"Raw search results file not found: {raw_search_results_path}")


def add_citations_to_markdown(markdown_path: str, citations: Dict[int, Dict[str, str]]):
    if os.path.exists(markdown_path):
        try:
            with open(markdown_path, "r") as f:
                content = f.read()

            if "## References" not in content:
                content += "\n\n## References\n"
                for i, citation in citations.items():
                    content += f"{i}. [{citation['title']}]({citation['url']})\n"

                with open(markdown_path, "w") as f:
                    f.write(content)
            else:
                logger.info(f"References section already exists in {markdown_path}")
        except Exception as e:
            logger.error(f"Error adding citations to markdown: {str(e)}", exc_info=True)
    else:
        logger.warning(f"Markdown file not found: {markdown_path}")


def set_storm_runner():
    current_working_dir = os.getenv("STREAMLIT_OUTPUT_DIR")
    if not current_working_dir:
        current_working_dir = os.path.join(
            os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
            "DEMO_WORKING_DIR",
        )

    os.makedirs(current_working_dir, exist_ok=True)

    # Load Ollama settings
    ollama_settings, _ = load_ollama_settings()

    # Load search options
    search_options = load_search_options()

    # Use saved settings or default values
    model = ollama_settings.get("model", "jaigouk/hermes-2-theta-llama-3:latest")
    url = ollama_settings.get("url", "http://localhost")
    port = ollama_settings.get("port", 11434)  # Ensure port is loaded
    max_tokens = ollama_settings.get("max_tokens", 500)
    search_top_k = search_options.get("search_top_k", 3)
    retrieve_top_k = search_options.get("retrieve_top_k", 3)

    # Update the run_storm_with_fallback function to use these settings
    def run_storm_with_config(*args, **kwargs):
        kwargs["ollama_kwargs"] = {
            "model": model,
            "url": url,
            "port": port,  # Include port in ollama_kwargs
            "max_tokens": max_tokens,
            "stop": ("\n\n---",),
        }
        kwargs["engine_args"] = STORMWikiRunnerArguments(
            output_dir=current_working_dir,
            max_conv_turn=3,
            max_perspective=3,
            search_top_k=search_top_k,
            retrieve_top_k=retrieve_top_k,
        )
        return run_storm_with_fallback(*args, **kwargs)

    # Set the run_storm function in the session state
    st.session_state["run_storm"] = run_storm_with_config

    convert_txt_to_md(current_working_dir)


def clear_storm_session():
    keys_to_clear = ["run_storm", "runner"]
    for key in keys_to_clear:
        st.session_state.pop(key, None)


def get_storm_runner_status() -> str:
    if "runner" not in st.session_state:
        return "Not initialized"
    return "Ready" if st.session_state["runner"] else "Failed"


def run_storm_step(step: str, topic: str) -> bool:
    if "runner" not in st.session_state or st.session_state["runner"] is None:
        st.error("STORM runner is not initialized. Please set up the runner first.")
        return False

    runner = st.session_state["runner"]
    step_config = {
        "research": {"do_research": True},
        "outline": {"do_generate_outline": True},
        "article": {"do_generate_article": True},
        "polish": {"do_polish_article": True},
    }

    if step not in step_config:
        st.error(f"Invalid step: {step}")
        return False

    try:
        runner.run(topic=topic, **step_config[step])
        return True
    except Exception as e:
        logger.error(f"Error during {step} step: {str(e)}", exc_info=True)
        st.error(f"Error during {step} step: {str(e)}")
        return False


def get_storm_output(output_type: str) -> Optional[str]:
    if "runner" not in st.session_state or st.session_state["runner"] is None:
        st.error("STORM runner is not initialized. Please set up the runner first.")
        return None

    runner = st.session_state["runner"]
    output_file_map = {
        "outline": "outline.txt",
        "article": "storm_gen_article.md",
        "polished_article": "storm_gen_article_polished.md",
    }

    if output_type not in output_file_map:
        st.error(f"Invalid output type: {output_type}")
        return None

    output_file = output_file_map[output_type]
    output_path = os.path.join(runner.engine_args.output_dir, output_file)

    if not os.path.exists(output_path):
        st.warning(
            f"{output_type.capitalize()} not found. Make sure you've run the corresponding step."
        )
        return None

    try:
        with open(output_path, "r", encoding="utf-8") as f:
            return f.read()
    except Exception as e:
        logger.error(f"Error reading {output_type} file: {str(e)}", exc_info=True)
        st.error(f"Error reading {output_type} file: {str(e)}")
        return None
