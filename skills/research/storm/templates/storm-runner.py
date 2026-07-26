#!/usr/bin/env python3
"""
Minimal STORM Wiki Runner Template

Usage:
    python storm-runner.py --topic "Your topic" --retriever you

Required: secrets.toml with API keys (see templates/secrets.toml.example)
"""

import os
import sys
from argparse import ArgumentParser

from knowledge_storm import (
    STORMWikiRunnerArguments,
    STORMWikiRunner,
    STORMWikiLMConfigs,
)
from knowledge_storm.lm import OpenAIModel, OllamaModel
from knowledge_storm.rm import YouRM, BingSearch, DuckDuckGoSearchRM
from knowledge_storm.utils import load_api_key


def build_lm_configs(provider: str = "openai"):
    """Build LM configs for different providers."""
    lm_configs = STORMWikiLMConfigs()

    if provider == "openai":
        api_key = os.getenv("OPENAI_API_KEY")
        if not api_key:
            raise ValueError("OPENAI_API_KEY not set")

        # Cost-effective tiered approach
        fast_lm = OpenAIModel(model="gpt-3.5-turbo", max_tokens=500, api_key=api_key)
        smart_lm = OpenAIModel(model="gpt-4o", max_tokens=400, api_key=api_key)
        long_lm = OpenAIModel(model="gpt-4o", max_tokens=4000, api_key=api_key)

        lm_configs.set_conv_simulator_lm(fast_lm)
        lm_configs.set_question_asker_lm(fast_lm)
        lm_configs.set_outline_gen_lm(smart_lm)
        lm_configs.set_article_gen_lm(smart_lm)
        lm_configs.set_article_polish_lm(long_lm)

    elif provider == "ollama":
        base_url = os.getenv("OLLAMA_BASE_URL", "http://localhost:11434")
        fast_model = os.getenv("OLLAMA_FAST_MODEL", "llama3.1:8b")
        smart_model = os.getenv("OLLAMA_SMART_MODEL", "llama3.1:70b")

        fast_lm = OllamaModel(model=fast_model, base_url=base_url)
        smart_lm = OllamaModel(model=smart_model, base_url=base_url)

        lm_configs.set_conv_simulator_lm(fast_lm)
        lm_configs.set_question_asker_lm(fast_lm)
        lm_configs.set_outline_gen_lm(smart_lm)
        lm_configs.set_article_gen_lm(smart_lm)
        lm_configs.set_article_polish_lm(smart_lm)

    else:
        raise ValueError(f"Unknown provider: {provider}")

    return lm_configs


def build_retriever(retriever: str):
    """Build retriever instance."""
    if retriever == "you":
        return YouRM(ydc_api_key=os.getenv("YDC_API_KEY"), k=10)
    elif retriever == "bing":
        return BingSearch(bing_search_api_key=os.getenv("BING_SEARCH_API_KEY"), k=10)
    elif retriever == "duckduckgo":
        return DuckDuckGoSearchRM(k=10, safe_search="On", region="us-en")
    else:
        raise ValueError(f"Unknown retriever: {retriever}")


def main():
    parser = ArgumentParser(description="Run STORM Wiki pipeline")
    parser.add_argument("--topic", type=str, required=True, help="Topic to research")
    parser.add_argument(
        "--output-dir", type=str, default="./results/storm", help="Output directory"
    )
    parser.add_argument(
        "--retriever",
        type=str,
        choices=["you", "bing", "duckduckgo"],
        default="you",
        help="Search engine to use",
    )
    parser.add_argument(
        "--provider",
        type=str,
        choices=["openai", "ollama"],
        default="openai",
        help="LLM provider",
    )
    parser.add_argument(
        "--max-thread-num", type=int, default=3, help="Max concurrent threads"
    )
    parser.add_argument(
        "--max-conv-turn", type=int, default=3, help="Max conversation turns"
    )
    parser.add_argument(
        "--max-perspective", type=int, default=3, help="Max perspectives"
    )
    parser.add_argument(
        "--search-top-k", type=int, default=10, help="Top-k search results"
    )
    parser.add_argument(
        "--do-research", action="store_true", help="Run research phase"
    )
    parser.add_argument(
        "--do-generate-outline", action="store_true", help="Generate outline"
    )
    parser.add_argument(
        "--do-generate-article", action="store_true", help="Generate article"
    )
    parser.add_argument(
        "--do-polish-article", action="store_true", help="Polish article"
    )
    parser.add_argument(
        "--retrieve-top-k", type=int, default=3, help="Top-k refs per section"
    )
    parser.add_argument(
        "--remove-duplicate", action="store_true", help="Remove duplicate content"
    )

    args = parser.parse_args()

    # Load API keys
    load_api_key(toml_file_path="secrets.toml")

    # Validate at least one stage is enabled
    if not any(
        [
            args.do_research,
            args.do_generate_outline,
            args.do_generate_article,
            args.do_polish_article,
        ]
    ):
        parser.error("At least one --do-* flag must be set")

    # Build components
    lm_configs = build_lm_configs(args.provider)
    rm = build_retriever(args.retriever)

    engine_args = STORMWikiRunnerArguments(
        output_dir=args.output_dir,
        max_conv_turn=args.max_conv_turn,
        max_perspective=args.max_perspective,
        search_top_k=args.search_top_k,
        max_thread_num=args.max_thread_num,
    )

    runner = STORMWikiRunner(engine_args, lm_configs, rm)

    # Run pipeline
    runner.run(
        topic=args.topic,
        do_research=args.do_research,
        do_generate_outline=args.do_generate_outline,
        do_generate_article=args.do_generate_article,
        do_polish_article=args.do_polish_article,
    )

    runner.post_run()
    runner.summary()

    print(f"\nResults in: {args.output_dir}/{args.topic.replace(' ', '_')}/")


if __name__ == "__main__":
    main()