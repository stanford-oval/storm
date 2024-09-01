import os
from argparse import ArgumentParser

from dspy import Example

from knowledge_storm import STORMWikiRunnerArguments, STORMWikiRunner, STORMWikiLMConfigs
from knowledge_storm.lm import OllamaClient
from knowledge_storm.rm import SearXNG
from knowledge_storm.utils import load_api_key


def main(args):
    load_api_key(toml_file_path='secrets.toml')
    lm_configs = STORMWikiLMConfigs()

    ollama_kwargs = {
        "model": args.model,
        "port": args.port,
        "url": args.url,
        "stop": ('\n\n---',)
    }

    conv_simulator_lm = OllamaClient(max_tokens=500, **ollama_kwargs)
    question_asker_lm = OllamaClient(max_tokens=500, **ollama_kwargs)
    outline_gen_lm = OllamaClient(max_tokens=400, **ollama_kwargs)
    article_gen_lm = OllamaClient(max_tokens=700, **ollama_kwargs)
    article_polish_lm = OllamaClient(max_tokens=4000, **ollama_kwargs)

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

    rm = SearXNG(searxng_api_url=args.searxng_api_url, searxng_api_key=os.getenv('SEARXNG_API_KEY'), k=engine_args.search_top_k)

    runner = STORMWikiRunner(engine_args, lm_configs, rm)

    find_related_topic_example = Example(
        topic="Knowledge Curation",
        related_topics="https://en.wikipedia.org/wiki/Knowledge_management\n"
                       "https://en.wikipedia.org/wiki/Information_science\n"
                       "https://en.wikipedia.org/wiki/Library_science\n"
    )
    gen_persona_example = Example(
        topic="Knowledge Curation",
        examples="Title: Knowledge management\n"
                 "Table of Contents: History\nResearch\n  Dimensions\n  Strategies\n  Motivations\nKM technologies"
                 "\nKnowledge barriers\nKnowledge retention\nKnowledge audit\nKnowledge protection\n"
                 "  Knowledge protection methods\n    Formal methods\n    Informal methods\n"
                 "  Balancing knowledge protection and knowledge sharing\n  Knowledge protection risks",
        personas=(
            "1. Historian of Knowledge Systems: This editor will focus on the history and evolution of knowledge "
            "curation. They will provide context on how knowledge curation has changed over time and its impact on "
            "modern practices.\n"
            "2. Information Science Professional: With insights from 'Information science', this editor will "
            "explore the foundational theories, definitions, and philosophy that underpin knowledge curation\n"
            "3. Digital Librarian: This editor will delve into the specifics of how digital libraries operate, "
            "including software, metadata, digital preservation.\n"
            "4. Technical expert: This editor will focus on the technical aspects of knowledge curation, "
            "such as common features of content management systems.\n"
            "5. Museum Curator: The museum curator will contribute expertise on the curation of physical items and "
            "the transition of these practices into the digital realm."
        )
    )
    runner.storm_knowledge_curation_module.persona_generator.create_writer_with_persona.find_related_topic.demos = [
        find_related_topic_example]
    runner.storm_knowledge_curation_module.persona_generator.create_writer_with_persona.gen_persona.demos = [
        gen_persona_example]

    write_page_outline_example = Example(
        topic="Example Topic",
        conv="Wikipedia Writer: ...\nExpert: ...\nWikipedia Writer: ...\nExpert: ...",
        old_outline="# Section 1\n## Subsection 1\n## Subsection 2\n"
                    "# Section 2\n## Subsection 1\n## Subsection 2\n"
                    "# Section 3",
        outline="# New Section 1\n## New Subsection 1\n## New Subsection 2\n"
                "# New Section 2\n"
                "# New Section 3\n## New Subsection 1\n## New Subsection 2\n## New Subsection 3"
    )
    runner.storm_outline_generation_module.write_outline.write_page_outline.demos = [write_page_outline_example]
    write_section_example = Example(
        info="[1]\nInformation in document 1\n[2]\nInformation in document 2\n[3]\nInformation in document 3",
        topic="Example Topic",
        section="Example Section",
        output="# Example Topic\n## Subsection 1\n"
               "This is an example sentence [1]. This is another example sentence [2][3].\n"
               "## Subsection 2\nThis is one more example sentence [1]."
    )
    runner.storm_article_generation.section_gen.write_section.demos = [write_section_example]

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


if __name__ == '__main__':
    parser = ArgumentParser()
    # global arguments
    parser.add_argument('--url', type=str, default='http://localhost',
                        help='URL of the Ollama server.')
    parser.add_argument('--port', type=int, default=11434,
                        help='Port of the Ollama server.')
    parser.add_argument('--model', type=str, default='llama3:latest',
                        help='Model of the Ollama server.')
    parser.add_argument('--output-dir', type=str, default='./results/ollama',
                        help='Directory to store the outputs.')
    parser.add_argument('--max-thread-num', type=int, default=3,
                        help='Maximum number of threads to use. The information seeking part and the article generation'
                             'part can speed up by using multiple threads. Consider reducing it if keep getting '
                             '"Exceed rate limit" error when calling LM API.')
    parser.add_argument('--retriever', type=str, choices=['searxng'],
                        help='The search engine API to use for retrieving information.')
    parser.add_argument('--searxng-api-url', type=str, required=True,
                        help='URL of the SearXNG API.')
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
