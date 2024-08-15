"""
STORM Markdown pipeline powered by GPT-3.5/4.
You need to set up the following environment variables to run this script:
    - OPENAI_API_KEY: OpenAI API key
    - OPENAI_API_TYPE: OpenAI API type (e.g., 'openai' or 'azure')
    - AZURE_API_BASE: Azure API base URL if using Azure API
    - AZURE_API_VERSION: Azure API version if using Azure API

Output will be structured as below
args.output_dir/
    topic_name/  # topic_name will follow convention of underscore-connected topic name w/o space and slash
        processed_markdown_input.json    # Processed markdown input
        direct_gen_outline.txt           # Outline directly generated with LLM's parametric knowledge
        storm_gen_outline.txt            # Outline refined with processed markdown information
        markdown_sources.json            # Sources that are used in the final article
        storm_gen_article.txt            # Final article generated
        storm_gen_article_polished.txt   # Polished final article (if args.do_polish_article is True)
"""

import os
from argparse import ArgumentParser

from knowledge_storm import MarkdownSTORMRunnerArguments, MarkdownSTORMRunner, STORMWikiLMConfigs
from knowledge_storm.lm import OpenAIModel, AzureOpenAIModel
from knowledge_storm.utils import load_api_key


def main(args):
    load_api_key(toml_file_path="secrets.toml")
    lm_configs = STORMWikiLMConfigs()
    openai_kwargs = {
        "api_key": os.getenv("OPENAI_API_KEY"),
        "temperature": 1.0,
        "top_p": 0.9,
    }

    ModelClass = OpenAIModel if os.getenv("OPENAI_API_TYPE") == "openai" else AzureOpenAIModel
    gpt_35_model_name = "gpt-3.5-turbo" if os.getenv("OPENAI_API_TYPE") == "openai" else "gpt-35-turbo"
    gpt_4_model_name = "gpt-4o-2024-08-06"
    if os.getenv("OPENAI_API_TYPE") == "azure":
        openai_kwargs["api_base"] = os.getenv("AZURE_API_BASE")
        openai_kwargs["api_version"] = os.getenv("AZURE_API_VERSION")

    outline_gen_lm = ModelClass(model=gpt_4_model_name, max_tokens=400, **openai_kwargs)
    article_gen_lm = ModelClass(model=gpt_4_model_name, max_tokens=700, **openai_kwargs)
    article_polish_lm = ModelClass(model=gpt_4_model_name, max_tokens=4000, **openai_kwargs)

    lm_configs.set_outline_gen_lm(outline_gen_lm)
    lm_configs.set_article_gen_lm(article_gen_lm)
    lm_configs.set_article_polish_lm(article_polish_lm)

    engine_args = MarkdownSTORMRunnerArguments(
        output_dir=args.output_dir,
        max_thread_num=args.max_thread_num,
    )

    runner = MarkdownSTORMRunner(engine_args, lm_configs, args.markdown_folder)

    topic = args.topic if args.topic else input("Topic: ")
    runner.run(
        topic=topic,
        do_process_markdown=args.do_process_markdown,
        do_generate_outline=args.do_generate_outline,
        do_generate_article=args.do_generate_article,
        do_polish_article=args.do_polish_article,
        remove_duplicate=args.remove_duplicate,
    )
    runner.post_run()
    runner.summary()


if __name__ == "__main__":
    parser = ArgumentParser()
    # global arguments
    parser.add_argument(
        "--output-dir", type=str, default="./results/markdown_gpt", help="Directory to store the outputs."
    )
    parser.add_argument(
        "--max-thread-num",
        type=int,
        default=3,
        help="Maximum number of threads to use. The article generation part can speed up by using "
        'multiple threads. Consider reducing it if keep getting "Exceed rate limit" error when '
        "calling LM API.",
    )
    parser.add_argument(
        "--markdown-folder", type=str, required=True, help="Folder containing markdown files to process."
    )
    parser.add_argument(
        "--topic",
        type=str,
        default=None,
        help="Topic to generate content for. If not provided, you will be prompted.",
    )
    # stage of the pipeline
    parser.add_argument(
        "--do-process-markdown",
        action="store_true",
        help="If True, process the markdown files; otherwise, load the results.",
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
    # hyperparameters for the writing stage
    parser.add_argument(
        "--remove-duplicate", action="store_true", help="If True, remove duplicate content from the article."
    )

    main(parser.parse_args())
