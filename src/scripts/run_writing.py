"""
STORM pipeline final-writing stage:
Generate use the outline and collected information to generate a full article.

Expect the following files to exist:
args.output_dir/
    topic_name/ # topic_name will follow convention of underscore-connected topic name w/o space and slash
        raw_search_results.json  # Raw search results from search engine
        storm_gen_outline.txt    # Outline refined with collected information

Output will be structured as below
args.output_dir/
    topic_name/
        url_to_info.json                # Sources that are used in the final article
        storm_gen_article.txt           # Final article generated
        storm_gen_article_polished.txt  # Polished final article (if args.do_polish_article is True)
"""

import os
from argparse import ArgumentParser

import pandas as pd
from tqdm import tqdm

from engine import DeepSearchRunnerArguments, DeepSearchRunner
from modules.utils import MyOpenAIModel, load_api_key, LLMConfigs


def main(args):
    load_api_key()
    llm_configs = LLMConfigs()
    llm_configs.init_openai_model(openai_api_key=os.getenv("OPENAI_API_KEY"), openai_type=os.getenv('OPENAI_API_TYPE'),
                                  api_base=os.getenv('AZURE_API_BASE'), api_version=os.getenv('AZURE_API_VERSION'))

    if args.engine == 'gpt-35-turbo':  # if args.engine == 'gpt-4', use the default.
        if os.getenv("OPENAI_API_TYPE") and os.getenv("OPENAI_API_TYPE") == 'azure':
            model_name = 'gpt-35-turbo'
        else:
            model_name = 'gpt-3.5-turbo'
        llm_configs.set_article_gen_lm(MyOpenAIModel(model=model_name, api_key=os.getenv("OPENAI_API_KEY"),
                                                     api_provider=os.getenv("OPENAI_API_TYPE"),
                                                     api_base=os.getenv("AZURE_API_BASE"),
                                                     api_version=os.getenv("AZURE_API_VERSION"),
                                                     max_tokens=700, temperature=1.0, top_p=0.9))

    engine_args = DeepSearchRunnerArguments(
        output_dir=args.output_dir,
        retrieve_top_k=args.retrieve_top_k
    )
    runner = DeepSearchRunner(engine_args, llm_configs)

    if args.input_source == 'console':
        topic = input('Topic: ')
        runner.run(topic=topic,
                   ground_truth_url=None,
                   do_research=False,
                   do_generate_outline=False,
                   do_generate_article=True,
                   do_polish_article=args.do_polish_article,
                   remove_duplicate=args.remove_duplicate)
        runner.post_run()
    else:
        data = pd.read_csv(args.input_path)

        for _, row in tqdm(data.iterrows(), total=len(data)):
            topic = row['topic']
            runner.run(topic=topic,
                       ground_truth_url=None,
                       do_research=False,
                       do_generate_outline=False,
                       do_generate_article=True,
                       do_polish_article=args.do_polish_article,
                       remove_duplicate=args.remove_duplicate)
            runner.post_run()


if __name__ == '__main__':
    parser = ArgumentParser()
    parser.add_argument('--retrieve-top-k', type=int, default=5,
                        help='Top k collected references for each section title.')
    parser.add_argument('--do-polish-article', action='store_true',
                        help='If True, polish the article by adding a summarization section and (optionally) removing '
                             'duplicate content.')
    parser.add_argument('--remove-duplicate', action='store_true',
                        help='If True, remove duplicate content from the article.')
    parser.add_argument('--input-source', type=str, choices=['console', 'file'],
                        help='Where does the input come from.')
    parser.add_argument('--input-path', type=str,
                        help='Using csv file to store topic and ground truth url at present.')
    parser.add_argument('--output-dir', type=str, default='../results',
                        help='Directory to store the outputs.')
    parser.add_argument('--engine', type=str, required=True, choices=['gpt-4', 'gpt-35-turbo'])

    main(parser.parse_args())
