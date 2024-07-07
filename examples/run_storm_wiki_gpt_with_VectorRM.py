"""
This STORM Wiki pipeline powered by GPT-3.5/4 and local retrieval model that uses Qdrant.
You need to set up the following environment variables to run this script:
    - OPENAI_API_KEY: OpenAI API key
    - OPENAI_API_TYPE: OpenAI API type (e.g., 'openai' or 'azure')
    - QDRANT_API_KEY: Qdrant API key (needed ONLY if online vector store was used)

You will also need an existing Qdrant vector store either saved in a folder locally offline or in a server online.
If not, then you would need a CSV file with documents, and the script is going to create the vector store for you.
The CSV should be in the following format:
content  | title  |  url  |  description
I am a document. | Document 1 | docu-n-112 | A self-explanatory document.
I am another document. | Document 2 | docu-l-13 | Another self-explanatory document.

Notice that the URL will be a unique identifier for the document so ensure different documents have different urls.

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
import sys
from argparse import ArgumentParser

sys.path.append('./src')
from storm_wiki.engine import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
from rm import VectorRM
from lm import OpenAIModel
from utils import load_api_key


def main(args):
    # Load API key from the specified toml file path
    load_api_key(toml_file_path='secrets.toml')

    # Initialize the language model configurations
    engine_lm_configs = STORMWikiLMConfigs()
    openai_kwargs = {
        'api_key': os.getenv("OPENAI_API_KEY"),
        'api_provider': os.getenv('OPENAI_API_TYPE'),
        'temperature': 1.0,
        'top_p': 0.9,
    }

    # STORM is a LM system so different components can be powered by different models.
    # For a good balance between cost and quality, you can choose a cheaper/faster model for conv_simulator_lm 
    # which is used to split queries, synthesize answers in the conversation. We recommend using stronger models
    # for outline_gen_lm which is responsible for organizing the collected information, and article_gen_lm
    # which is responsible for generating sections with citations.
    conv_simulator_lm = OpenAIModel(model='gpt-3.5-turbo', max_tokens=500, **openai_kwargs)
    question_asker_lm = OpenAIModel(model='gpt-3.5-turbo', max_tokens=500, **openai_kwargs)
    outline_gen_lm = OpenAIModel(model='gpt-4-0125-preview', max_tokens=400, **openai_kwargs)
    article_gen_lm = OpenAIModel(model='gpt-4-0125-preview', max_tokens=700, **openai_kwargs)
    article_polish_lm = OpenAIModel(model='gpt-4-0125-preview', max_tokens=4000, **openai_kwargs)

    engine_lm_configs.set_conv_simulator_lm(conv_simulator_lm)
    engine_lm_configs.set_question_asker_lm(question_asker_lm)
    engine_lm_configs.set_outline_gen_lm(outline_gen_lm)
    engine_lm_configs.set_article_gen_lm(article_gen_lm)
    engine_lm_configs.set_article_polish_lm(article_polish_lm)

    # Initialize the engine arguments
    engine_args = STORMWikiRunnerArguments(
        output_dir=args.output_dir,
        max_conv_turn=args.max_conv_turn,
        max_perspective=args.max_perspective,
        search_top_k=args.search_top_k,
        max_thread_num=args.max_thread_num,
    )

    # Setup VectorRM to retrieve information from your own data
    rm = VectorRM(collection_name=args.collection_name, device=args.device, k=engine_args.search_top_k)

    # initialize the vector store, either online (store the db on Qdrant server) or offline (store the db locally):
    if args.vector_db_mode == 'offline':
        rm.init_offline_vector_db(vector_store_path=args.offline_vector_db_dir)
    elif args.vector_db_mode == 'online':
        rm.init_online_vector_db(url=args.online_vector_db_url, api_key=os.getenv('QDRANT_API_KEY'))

    # Update the vector store with the documents in the csv file
    if args.update_vector_store:
        rm.update_vector_store(
            file_path=args.csv_file_path,
            content_column='content',
            title_column='title',
            url_column='url',
            desc_column='description',
            batch_size=args.embed_batch_size
        )

    # Initialize the STORM Wiki Runner
    runner = STORMWikiRunner(engine_args, engine_lm_configs, rm)

    # run the pipeline
    topic = input('Topic: ')
    runner.run(
        topic=topic,
        do_research=args.do_research,
        do_generate_outline=args.do_generate_outline,
        do_generate_article=args.do_generate_article,
        do_polish_article=args.do_polish_article,
    )
    runner.post_run()
    runner.summary()


if __name__ == "__main__":
    parser = ArgumentParser()
    # global arguments
    parser.add_argument('--output-dir', type=str, default='./results/gpt_retrieval',
                        help='Directory to store the outputs.')
    parser.add_argument('--max-thread-num', type=int, default=3,
                        help='Maximum number of threads to use. The information seeking part and the article generation'
                             'part can speed up by using multiple threads. Consider reducing it if keep getting '
                             '"Exceed rate limit" error when calling LM API.')
    # provide local corpus and set up vector db
    parser.add_argument('--collection-name', type=str, default="my_documents",
                        help='The collection name for vector store.')
    parser.add_argument('--device', type=str, default="mps",
                        help='The device used to run the retrieval model (mps, cuda, cpu, etc).')
    parser.add_argument('--vector-db-mode', type=str, choices=['offline', 'online'],
                        help='The mode of the Qdrant vector store (offline or online).')
    parser.add_argument('--offline-vector-db-dir', type=str, default='./vector_store',
                        help='If use offline mode, please provide the directory to store the vector store.')
    parser.add_argument('--online-vector-db-url', type=str,
                        help='If use online mode, please provide the url of the Qdrant server.')
    parser.add_argument('--update-vector-store', action='store_true',
                        help='If True, update the vector store with the documents in the csv file; otherwise, '
                             'use the existing vector store.')
    parser.add_argument('--csv-file-path', type=str,
                        help='The path of the custom document corpus in CSV format. The CSV file should include '
                             'content, title, url, and description columns.')
    parser.add_argument('--embed-batch-size', type=int, default=64,
                        help='Batch size for embedding the documents in the csv file.')
    # stage of the pipeline
    parser.add_argument('--do-research', action='store_true',
                        help='If True, simulate conversation to research the topic; otherwise, load the results.')
    parser.add_argument('--do-generate-outline', action='store_true',
                        help='If True, generate an outline for the topic; otherwise, load the results.')
    parser.add_argument('--do-generate-article', action='store_true',
                        help='If True, generate an article for the topic; otherwise, load the results.')
    parser.add_argument('--do-polish-article', action='store_true',
                        help='If True, polish the article by adding a summarization section and (optionally) removing '
                             'duplicate content.')
    # hyperparameters for the pre-writing stage
    parser.add_argument('--max-conv-turn', type=int, default=3,
                        help='Maximum number of questions in conversational question asking.')
    parser.add_argument('--max-perspective', type=int, default=3,
                        help='Maximum number of perspectives to consider in perspective-guided question asking.')
    parser.add_argument('--search-top-k', type=int, default=3,
                        help='Top k search results to consider for each search query.')
    # hyperparameters for the writing stage
    parser.add_argument('--retrieve-top-k', type=int, default=3,
                        help='Top k collected references for each section title.')
    parser.add_argument('--remove-duplicate', action='store_true',
                        help='If True, remove duplicate content from the article.')
    main(parser.parse_args())
