"""
STORM Wiki pipeline powered by llama3-70b-8192 hosted by Groq server and You.com search engine.
You need to set up the following environment variables to run this script:
    - GROQ_API_KEY: You can get your Groq API Key at https://console.groq.com/keys
    - YDC_API_KEY: You.com API key; BING_SEARCH_API_KEY: Bing Search API key, SERPER_API_KEY: Serper API key, BRAVE_API_KEY: Brave API key, or TAVILY_API_KEY: Tavily API key
You also need to have a VLLM server running with the Mistral-7B-Instruct-v0.2 model. Specify `--url` and `--port` accordingly.

Output will be structured as below
args.output_dir/
    topic_name/  # topic_name will follow convention of underscore-connected topic name w/o space and slash
        conversation_log.json           # Log of information-seeking conversation
        raw_search_results.json         # Raw search results from search engine
        direct_gen_outline.txt          # Outline directly generated with LLM's parametric knowledge
        storm_gen_outline.txt           # Outline refined with collected information
        url_to_info.json                # Sources that are used in the final article
        storm_gen_article.txt           # Final article generated
        storm_gen_article_polished.txt  # Polished final article (if args.do_polish_article is True)
"""

import os
import re
from argparse import ArgumentParser

from knowledge_storm import (
    STORMWikiRunnerArguments,
    STORMWikiRunner,
    STORMWikiLMConfigs,
)

# Now import lm directly
import lm
from lm import GroqModel
from knowledge_storm.rm import (
    YouRM,
    BingSearch,
    BraveRM,
    SerperRM,
    DuckDuckGoSearchRM,
    TavilySearchRM,
    SearXNG,
)
from knowledge_storm.utils import load_api_key


def sanitize_topic(topic):
    """
    Sanitize the topic name for use in file names.
    Remove or replace characters that are not allowed in file names.
    """
    # Replace spaces with underscores
    topic = topic.replace(" ", "_")

    # Remove any character that isn't alphanumeric, underscore, or hyphen
    topic = re.sub(r"[^a-zA-Z0-9_-]", "", topic)

    # Ensure the topic isn't empty after sanitization
    if not topic:
        topic = "unnamed_topic"

    return topic


def main(args):
    load_api_key(toml_file_path="secrets.toml")
    lm_configs = STORMWikiLMConfigs()

    # Ensure GROQ_API_KEY is set
    if not os.getenv("GROQ_API_KEY"):
        raise ValueError(
            "GROQ_API_KEY environment variable is not set. Please set it in your secrets.toml file."
        )

    groq_kwargs = {
        "api_key": os.getenv("GROQ_API_KEY"),
        "api_base": "https://api.groq.com/openai/v1",
        "temperature": args.temperature,
        "top_p": args.top_p,
    }

    # Groq currently offers the "llama3-70b-8192" model with generous free API credits and the llama3.1 family of models as a preview for paying customers
    conv_simulator_lm = GroqModel(
        model="llama3-70b-8192", max_tokens=500, **groq_kwargs
    )
    question_asker_lm = GroqModel(
        model="llama3-70b-8192", max_tokens=500, **groq_kwargs
    )
    outline_gen_lm = GroqModel(model="llama3-70b-8192", max_tokens=400, **groq_kwargs)
    article_gen_lm = GroqModel(model="llama3-70b-8192", max_tokens=700, **groq_kwargs)
    article_polish_lm = GroqModel(
        model="llama3-70b-8192", max_tokens=4000, **groq_kwargs
    )

    lm_configs.set_conv_simulator_lm(conv_simulator_lm)
    lm_configs.set_question_asker_lm(question_asker_lm)
    lm_configs.set_outline_gen_lm(outline_gen_lm)
    lm_configs.set_article_gen_lm(article_gen_lm)
    lm_configs.set_article_polish_lm(article_polish_lm)

    engine_args = STORMWikiRunnerArguments(
        output_dir=args.output_dir,
        max_conv_turn=args.max_conv_turn,
        max_perspective=args.max_perspective,
        search_top_k=args.search_top_k,
        max_thread_num=args.max_thread_num,
    )

    # STORM is a knowledge curation system which consumes information from the retrieval module.
    # Currently, the information source is the Internet and we use search engine API as the retrieval module.
    match args.retriever:
        case "bing":
            rm = BingSearch(
                bing_search_api=os.getenv("BING_SEARCH_API_KEY"),
                k=engine_args.search_top_k,
            )
        case "you":
            rm = YouRM(ydc_api_key=os.getenv("YDC_API_KEY"), k=engine_args.search_top_k)
        case "brave":
            rm = BraveRM(
                brave_search_api_key=os.getenv("BRAVE_API_KEY"),
                k=engine_args.search_top_k,
            )
        case "duckduckgo":
            rm = DuckDuckGoSearchRM(
                k=engine_args.search_top_k, safe_search="On", region="us-en"
            )
        case "serper":
            rm = SerperRM(
                serper_search_api_key=os.getenv("SERPER_API_KEY"),
                query_params={"autocorrect": True, "num": 10, "page": 1},
            )
        case "tavily":
            rm = TavilySearchRM(
                tavily_search_api_key=os.getenv("TAVILY_API_KEY"),
                k=engine_args.search_top_k,
                include_raw_content=True,
            )
        case "searxng":
            rm = SearXNG(
                searxng_api_key=os.getenv("SEARXNG_API_KEY"), k=engine_args.search_top_k
            )
        case _:
            raise ValueError(
                f'Invalid retriever: {args.retriever}. Choose either "bing", "you", "brave", "duckduckgo", "serper", "tavily", or "searxng"'
            )

    runner = STORMWikiRunner(engine_args, lm_configs, rm)

    topic = input("Topic: ")
    sanitized_topic = sanitize_topic(topic)

    try:
        runner.run(
            topic=sanitized_topic,
            do_research=args.do_research,
            do_generate_outline=args.do_generate_outline,
            do_generate_article=args.do_generate_article,
            do_polish_article=args.do_polish_article,
            remove_duplicate=args.remove_duplicate,
        )
        runner.post_run()
        runner.summary()
    except Exception as e:
        logger.exception(f"An error occurred: {str(e)}")
        raise


if __name__ == "__main__":
    parser = ArgumentParser()
    # global arguments
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./results/groq",
        help="Directory to store the outputs.",
    )
    parser.add_argument(
        "--max-thread-num",
        type=int,
        default=3,
        help="Maximum number of threads to use. The information seeking part and the article generation"
        "part can speed up by using multiple threads. Consider reducing it if keep getting "
        '"Exceed rate limit" error when calling LM API.',
    )
    parser.add_argument(
        "--retriever",
        type=str,
        choices=["bing", "you", "brave", "serper", "duckduckgo", "tavily", "searxng"],
        help="The search engine API to use for retrieving information.",
    )
    parser.add_argument(
        "--temperature", type=float, default=1.0, help="Sampling temperature to use."
    )
    parser.add_argument(
        "--top_p", type=float, default=0.9, help="Top-p sampling parameter."
    )
    # stage of the pipeline
    parser.add_argument(
        "--do-research",
        action="store_true",
        help="If True, simulate conversation to research the topic; otherwise, load the results.",
    )
    parser.add_argument(
        "--do-generate-outline",
        action="store_true",
        help="If True, generate an outline for the topic; otherwise, load the results.",
    )
    parser.add_argument(
        "--do-generate-article",
        action="store_true",
        help="If True, generate an article for the topic; otherwise, load the results.",
    )
    parser.add_argument(
        "--do-polish-article",
        action="store_true",
        help="If True, polish the article by adding a summarization section and (optionally) removing "
        "duplicate content.",
    )
    # hyperparameters for the pre-writing stage
    parser.add_argument(
        "--max-conv-turn",
        type=int,
        default=3,
        help="Maximum number of questions in conversational question asking.",
    )
    parser.add_argument(
        "--max-perspective",
        type=int,
        default=3,
        help="Maximum number of perspectives to consider in perspective-guided question asking.",
    )
    parser.add_argument(
        "--search-top-k",
        type=int,
        default=3,
        help="Top k search results to consider for each search query.",
    )
    # hyperparameters for the writing stage
    parser.add_argument(
        "--retrieve-top-k",
        type=int,
        default=3,
        help="Top k collected references for each section title.",
    )
    parser.add_argument(
        "--remove-duplicate",
        action="store_true",
        help="If True, remove duplicate content from the article.",
    )

    main(parser.parse_args())
