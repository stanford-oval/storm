"""
Co-STORM pipeline powered by GPT-4o/4o-mini and Bing search engine.
You need to set up the following environment variables to run this script:
    - OPENAI_API_KEY: OpenAI API key
    - OPENAI_API_TYPE: OpenAI API type (e.g., 'openai' or 'azure')
    - AZURE_API_BASE: Azure API base URL if using Azure API
    - AZURE_API_VERSION: Azure API version if using Azure API
    - BING_SEARCH_API_KEY: Biang search API key; BING_SEARCH_API_KEY: Bing Search API key, SERPER_API_KEY: Serper API key, BRAVE_API_KEY: Brave API key, or TAVILY_API_KEY: Tavily API key

Output will be structured as below
args.output_dir/
    log.json           # Log of information-seeking conversation
    report.txt         # Final article generated
"""

import os
import json
from argparse import ArgumentParser
from knowledge_storm.collaborative_storm.engine import (
    CollaborativeStormLMConfigs,
    RunnerArgument,
    CoStormRunner,
)
from knowledge_storm.collaborative_storm.modules.callback import (
    LocalConsolePrintCallBackHandler,
)
from knowledge_storm.lm import OpenAIModel, AzureOpenAIModel
from knowledge_storm.logging_wrapper import LoggingWrapper
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


def main(args):
    load_api_key(toml_file_path="secrets.toml")
    lm_config: CollaborativeStormLMConfigs = CollaborativeStormLMConfigs()
    openai_kwargs = (
        {
            "api_key": os.getenv("OPENAI_API_KEY"),
            "api_provider": "openai",
            "temperature": 1.0,
            "top_p": 0.9,
            "api_base": None,
        }
        if os.getenv("OPENAI_API_TYPE") == "openai"
        else {
            "api_key": os.getenv("AZURE_API_KEY"),
            "temperature": 1.0,
            "top_p": 0.9,
            "api_base": os.getenv("AZURE_API_BASE"),
            "api_version": os.getenv("AZURE_API_VERSION"),
        }
    )

    ModelClass = (
        OpenAIModel if os.getenv("OPENAI_API_TYPE") == "openai" else AzureOpenAIModel
    )
    # If you are using Azure service, make sure the model name matches your own deployed model name.
    # The default name here is only used for demonstration and may not match your case.
    gpt_4o_mini_model_name = "gpt-4o-mini"
    gpt_4o_model_name = "gpt-4o"
    if os.getenv("OPENAI_API_TYPE") == "azure":
        openai_kwargs["api_base"] = os.getenv("AZURE_API_BASE")
        openai_kwargs["api_version"] = os.getenv("AZURE_API_VERSION")

    # STORM is a LM system so different components can be powered by different models.
    # For a good balance between cost and quality, you can choose a cheaper/faster model for conv_simulator_lm
    # which is used to split queries, synthesize answers in the conversation. We recommend using stronger models
    # for outline_gen_lm which is responsible for organizing the collected information, and article_gen_lm
    # which is responsible for generating sections with citations.
    question_answering_lm = ModelClass(
        model=gpt_4o_model_name, max_tokens=1000, **openai_kwargs
    )
    discourse_manage_lm = ModelClass(
        model=gpt_4o_model_name, max_tokens=500, **openai_kwargs
    )
    utterance_polishing_lm = ModelClass(
        model=gpt_4o_model_name, max_tokens=2000, **openai_kwargs
    )
    warmstart_outline_gen_lm = ModelClass(
        model=gpt_4o_model_name, max_tokens=500, **openai_kwargs
    )
    question_asking_lm = ModelClass(
        model=gpt_4o_model_name, max_tokens=300, **openai_kwargs
    )
    knowledge_base_lm = ModelClass(
        model=gpt_4o_model_name, max_tokens=1000, **openai_kwargs
    )

    lm_config.set_question_answering_lm(question_answering_lm)
    lm_config.set_discourse_manage_lm(discourse_manage_lm)
    lm_config.set_utterance_polishing_lm(utterance_polishing_lm)
    lm_config.set_warmstart_outline_gen_lm(warmstart_outline_gen_lm)
    lm_config.set_question_asking_lm(question_asking_lm)
    lm_config.set_knowledge_base_lm(knowledge_base_lm)

    topic = input("Topic: ")
    runner_argument = RunnerArgument(
        topic=topic,
        retrieve_top_k=args.retrieve_top_k,
        max_search_queries=args.max_search_queries,
        total_conv_turn=args.total_conv_turn,
        max_search_thread=args.max_search_thread,
        max_search_queries_per_turn=args.max_search_queries_per_turn,
        warmstart_max_num_experts=args.warmstart_max_num_experts,
        warmstart_max_turn_per_experts=args.warmstart_max_turn_per_experts,
        warmstart_max_thread=args.warmstart_max_thread,
        max_thread_num=args.max_thread_num,
        max_num_round_table_experts=args.max_num_round_table_experts,
        moderator_override_N_consecutive_answering_turn=args.moderator_override_N_consecutive_answering_turn,
        node_expansion_trigger_count=args.node_expansion_trigger_count,
    )
    logging_wrapper = LoggingWrapper(lm_config)
    callback_handler = (
        LocalConsolePrintCallBackHandler() if args.enable_log_print else None
    )

    # Co-STORM is a knowledge curation system which consumes information from the retrieval module.
    # Currently, the information source is the Internet and we use search engine API as the retrieval module.
    match args.retriever:
        case "bing":
            rm = BingSearch(
                bing_search_api=os.getenv("BING_SEARCH_API_KEY"),
                k=runner_argument.retrieve_top_k,
            )
        case "you":
            rm = YouRM(
                ydc_api_key=os.getenv("YDC_API_KEY"), k=runner_argument.retrieve_top_k
            )
        case "brave":
            rm = BraveRM(
                brave_search_api_key=os.getenv("BRAVE_API_KEY"),
                k=runner_argument.retrieve_top_k,
            )
        case "duckduckgo":
            rm = DuckDuckGoSearchRM(
                k=runner_argument.retrieve_top_k, safe_search="On", region="us-en"
            )
        case "serper":
            rm = SerperRM(
                serper_search_api_key=os.getenv("SERPER_API_KEY"),
                query_params={"autocorrect": True, "num": 10, "page": 1},
            )
        case "tavily":
            rm = TavilySearchRM(
                tavily_search_api_key=os.getenv("TAVILY_API_KEY"),
                k=runner_argument.retrieve_top_k,
                include_raw_content=True,
            )
        case "searxng":
            rm = SearXNG(
                searxng_api_key=os.getenv("SEARXNG_API_KEY"),
                k=runner_argument.retrieve_top_k,
            )
        case _:
            raise ValueError(
                f'Invalid retriever: {args.retriever}. Choose either "bing", "you", "brave", "duckduckgo", "serper", "tavily", or "searxng"'
            )

    costorm_runner = CoStormRunner(
        lm_config=lm_config,
        runner_argument=runner_argument,
        logging_wrapper=logging_wrapper,
        rm=rm,
        callback_handler=callback_handler,
    )

    # warm start the system
    costorm_runner.warm_start()

    # Below is an example of how users may interact with Co-STORM to seek information together
    # In actual deployment, we suggest allowing the user to decide whether to observe the agent utterance or inject a turn

    # observing Co-STORM LLM agent utterance for 5 turns
    for _ in range(1):
        conv_turn = costorm_runner.step()
        print(f"**{conv_turn.role}**: {conv_turn.utterance}\n")

    # active engaging by injecting your utterance
    your_utterance = input("Your utterance: ")
    costorm_runner.step(user_utterance=your_utterance)

    # continue observing
    conv_turn = costorm_runner.step()
    print(f"**{conv_turn.role}**: {conv_turn.utterance}\n")

    # generate report
    costorm_runner.knowledge_base.reorganize()
    article = costorm_runner.generate_report()

    # save results
    os.makedirs(args.output_dir, exist_ok=True)

    # Save article
    with open(os.path.join(args.output_dir, "report.md"), "w") as f:
        f.write(article)

    # Save instance dump
    instance_copy = costorm_runner.to_dict()
    with open(os.path.join(args.output_dir, "instance_dump.json"), "w") as f:
        json.dump(instance_copy, f, indent=2)

    # Save logging
    log_dump = costorm_runner.dump_logging_and_reset()
    with open(os.path.join(args.output_dir, "log.json"), "w") as f:
        json.dump(log_dump, f, indent=2)


if __name__ == "__main__":
    parser = ArgumentParser()
    # global arguments
    parser.add_argument(
        "--output-dir",
        type=str,
        default="./results/co-storm",
        help="Directory to store the outputs.",
    )
    parser.add_argument(
        "--retriever",
        type=str,
        choices=["bing", "you", "brave", "serper", "duckduckgo", "tavily", "searxng"],
        help="The search engine API to use for retrieving information.",
    )
    # hyperparameters for co-storm
    parser.add_argument(
        "--retrieve_top_k",
        type=int,
        default=10,
        help="Retrieve top k results for each query in retriever.",
    )
    parser.add_argument(
        "--max_search_queries",
        type=int,
        default=2,
        help="Maximum number of search queries to consider for each question.",
    )
    parser.add_argument(
        "--total_conv_turn",
        type=int,
        default=20,
        help="Maximum number of turns in conversation.",
    )
    parser.add_argument(
        "--max_search_thread",
        type=int,
        default=5,
        help="Maximum number of parallel threads for retriever.",
    )
    parser.add_argument(
        "--max_search_queries_per_turn",
        type=int,
        default=3,
        help="Maximum number of search queries to consider in each turn.",
    )
    parser.add_argument(
        "--warmstart_max_num_experts",
        type=int,
        default=3,
        help="Max number of experts in perspective-guided QA during warm start.",
    )
    parser.add_argument(
        "--warmstart_max_turn_per_experts",
        type=int,
        default=2,
        help="Max number of turns per perspective during warm start.",
    )
    parser.add_argument(
        "--warmstart_max_thread",
        type=int,
        default=3,
        help="Max number of threads for parallel perspective-guided QA during warm start.",
    )
    parser.add_argument(
        "--max_thread_num",
        type=int,
        default=10,
        help=(
            "Maximum number of threads to use. "
            "Consider reducing it if you keep getting 'Exceed rate limit' errors when calling the LM API."
        ),
    )
    parser.add_argument(
        "--max_num_round_table_experts",
        type=int,
        default=2,
        help="Max number of active experts in round table discussion.",
    )
    parser.add_argument(
        "--moderator_override_N_consecutive_answering_turn",
        type=int,
        default=3,
        help=(
            "Number of consecutive expert answering turns before the moderator overrides the conversation."
        ),
    )
    parser.add_argument(
        "--node_expansion_trigger_count",
        type=int,
        default=10,
        help="Trigger node expansion for nodes that contain more than N snippets.",
    )

    # Boolean flags
    parser.add_argument(
        "--enable_log_print",
        action="store_true",
        help="If set, enable console log print.",
    )

    main(parser.parse_args())
