"""
STORM Wiki News pipeline powered by GPT-3.5/4 and You.com search engine.
Generate opinionated news articles instead of purely informational wiki articles.

You need to set up the following environment variables to run this script:
    - OPENAI_API_KEY: OpenAI API key
    - OPENAI_API_TYPE: OpenAI API type (e.g., 'openai' or 'azure')
    - AZURE_API_BASE: Azure API base URL if using Azure API
    - AZURE_API_VERSION: Azure API version if using Azure API
    - YDC_API_KEY: You.com API key; BING_SEARCH_API_KEY: Bing Search API key, SERPER_API_KEY: Serper API key, BRAVE_API_KEY: Brave API key, or TAVILY_API_KEY: Tavily API key

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
import json
from argparse import ArgumentParser
from typing import List

from knowledge_storm import (
    STORMWikiRunnerArguments,
    STORMWikiRunner,
    STORMWikiLMConfigs,
)
from knowledge_storm.lm import OpenAIModel, AzureOpenAIModel
from knowledge_storm.rm import (
    YouRM,
    BingSearch,
    BraveRM,
    SerperRM,
    DuckDuckGoSearchRM,
    TavilySearchRM,
    SearXNG,
    AzureAISearch,
)
from knowledge_storm.utils import load_api_key
from knowledge_storm.interface import Information
from knowledge_storm.storm_wiki.modules.article_generation import StormArticleGenerationModule
from knowledge_storm.storm_wiki.modules.article_polish import StormArticlePolishingModule


def load_custom_news_sources(file_path):
    """
    Load custom news sources from a JSON file.
    
    The file should be a list of objects with the following structure:
    [
        {
            "title": "Article title",
            "url": "https://example.com/news/article",
            "snippets": ["Text content from the article", "More content..."],
            "metadata": {"source": "News Source Name", "date": "2023-06-01"}
        },
        ...
    ]
    
    Returns:
        List[Information]: A list of Information objects
    """
    with open(file_path, 'r') as f:
        custom_sources_data = json.load(f)
    
    # Safety check - limit to max 10 sources to prevent memory issues
    if len(custom_sources_data) > 10:
        print(f"⚠️ Warning: Limiting custom sources to 10 (out of {len(custom_sources_data)}) to prevent memory issues")
        custom_sources_data = custom_sources_data[:10]
    
    custom_sources = []
    for idx, source in enumerate(custom_sources_data):
        # Create Information object with the correct parameters
        info = Information(
            url=source.get("url", f"custom-source-{idx}"),
            description=source.get("description", f"Custom news source {idx+1}"),  # Description is required
            snippets=source.get("snippets", []),
            title=source.get("title", "Custom Article"),
            meta=source.get("metadata", {})  # 'meta' not 'metadata'
        )
        
        # Optionally add query information to meta
        info.meta["query"] = source.get("query", "")
        
        custom_sources.append(info)
    
    return custom_sources


def main(args):
    load_api_key(toml_file_path="secrets.toml")
    lm_configs = STORMWikiLMConfigs()
    openai_kwargs = {
        "api_key": os.getenv("OPENAI_API_KEY"),
        "temperature": 1.0,
        "top_p": 0.9,
    }

    ModelClass = (
        OpenAIModel if os.getenv("OPENAI_API_TYPE") == "openai" else AzureOpenAIModel
    )
    # If you are using Azure service, make sure the model name matches your own deployed model name.
    # The default name here is only used for demonstration and may not match your case.
    gpt_35_model_name = (
        "gpt-3.5-turbo" if os.getenv("OPENAI_API_TYPE") == "openai" else "gpt-35-turbo"
    )
    gpt_4_model_name = "gpt-4o"
    if os.getenv("OPENAI_API_TYPE") == "azure":
        openai_kwargs["api_base"] = os.getenv("AZURE_API_BASE")
        openai_kwargs["api_version"] = os.getenv("AZURE_API_VERSION")

    # STORM is a LM system so different components can be powered by different models.
    # For a good balance between cost and quality, you can choose a cheaper/faster model for conv_simulator_lm
    # which is used to split queries, synthesize answers in the conversation. We recommend using stronger models
    # for outline_gen_lm which is responsible for organizing the collected information, and article_gen_lm
    # which is responsible for generating sections with citations.
    conv_simulator_lm = ModelClass(
        model=gpt_35_model_name, max_tokens=500, **openai_kwargs
    )
    question_asker_lm = ModelClass(
        model=gpt_35_model_name, max_tokens=500, **openai_kwargs
    )
    outline_gen_lm = ModelClass(model=gpt_4_model_name, max_tokens=400, **openai_kwargs)
    article_gen_lm = ModelClass(model=gpt_4_model_name, max_tokens=700, **openai_kwargs)
    article_polish_lm = ModelClass(
        model=gpt_4_model_name, max_tokens=4000, **openai_kwargs
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
        case "azure_ai_search":
            rm = AzureAISearch(
                azure_ai_search_api_key=os.getenv("AZURE_AI_SEARCH_API_KEY"),
                k=engine_args.search_top_k,
            )
        case _:
            raise ValueError(
                f'Invalid retriever: {args.retriever}. Choose either "bing", "you", "brave", "duckduckgo", "serper", "tavily", "searxng", or "azure_ai_search"'
            )

    # Load custom sources if provided
    custom_sources = None
    if args.custom_sources_file:
        custom_sources = load_custom_news_sources(args.custom_sources_file)
        print(f"Loaded {len(custom_sources)} custom news sources")

    # Create STORM runner
    runner = STORMWikiRunner(engine_args, lm_configs, rm)
    
    # Override the article generation and polishing modules to use news mode
    runner.storm_article_generation = StormArticleGenerationModule(
        article_gen_lm=article_gen_lm,
        retrieve_top_k=args.retrieve_top_k,
        max_thread_num=args.max_thread_num,
        custom_sources=custom_sources,
        news_mode=True
    )
    
    runner.storm_article_polishing_module = StormArticlePolishingModule(
        article_gen_lm=article_gen_lm,
        article_polish_lm=article_polish_lm,
        news_mode=True
    )

    topic = input("Topic: ")
    
    # Run the pipeline
    runner.run(
        topic=topic,
        do_research=args.do_research,
        do_generate_outline=args.do_generate_outline,
        do_generate_article=args.do_generate_article,
        do_polish_article=args.do_polish_article,
        remove_duplicate=args.remove_duplicate
    )
    
    runner.post_run()
    runner.summary()


if __name__ == "__main__":
    parser = ArgumentParser()
    # global arguments
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./results/news",
        help="Directory to store the outputs.",
    )
    parser.add_argument(
        "--max-thread-num",
        type=int,
        default=2,
        help="Maximum number of threads to use. The information seeking part and the article generation"
        "part can speed up by using multiple threads. Consider reducing it if keep getting "
        '"Exceed rate limit" error when calling LM API or memory issues.',
    )
    parser.add_argument(
        "--retriever",
        type=str,
        choices=[
            "bing",
            "you",
            "brave",
            "serper",
            "duckduckgo",
            "tavily",
            "searxng",
            "azure_ai_search",
        ],
        help="The search engine API to use for retrieving information.",
    )
    # Custom sources
    parser.add_argument(
        "--custom-sources-file",
        type=str,
        help="Path to a JSON file containing custom news sources",
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