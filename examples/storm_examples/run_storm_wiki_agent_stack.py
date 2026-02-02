"""
Needs to install:
- agentstack-sdk

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
from typing import Annotated
import uuid

from dspy import Example

from knowledge_storm import (
    STORMWikiRunnerArguments,
    STORMWikiRunner,
    STORMWikiLMConfigs,
)
from knowledge_storm.lm import OpenAIModel
from knowledge_storm.rm import DuckDuckGoSearchRM, TavilySearchRM
from knowledge_storm.utils import load_api_key
from a2a.types import Message
from a2a.utils.message import get_message_text
from agentstack_sdk.server import Server
from agentstack_sdk.server.context import RunContext
from agentstack_sdk.a2a.types import AgentMessage
from agentstack_sdk.a2a.extensions import (
    LLMServiceExtensionServer,
    LLMServiceExtensionSpec,
    SettingsExtensionServer,
    SettingsExtensionSpec,
    SettingsRender,
    CheckboxGroupField,
    CheckboxField,
    TrajectoryExtensionServer,
    TrajectoryExtensionSpec,
    PlatformApiExtensionServer,
    PlatformApiExtensionSpec,
)
from a2a.types import Artifact, TextPart, Part
from agentstack_sdk.platform import File

from knowledge_storm.storm_wiki.modules.callback import BaseCallbackHandler


server = Server()

folder_path = "./results/ollama"


def read_file(file_path, context):
    try:
        with open(file_path, "r", encoding="utf-8") as f:
            content = f.read()
            context.yield_sync(
                Artifact(
                    name=os.path.basename(file_path),
                    artifact_id=str(uuid.uuid4()),
                    parts=[Part(root=TextPart(text=content))],
                )
            )
    except Exception as e:
        print(f"Error {file_path}: {e}")


def return_files(folder_path, context):
    files = [
        os.path.join(folder_path, f)
        for f in os.listdir(folder_path)
        if os.path.isfile(os.path.join(folder_path, f)) and f.split("/")[-1].startswith("storm_")
    ]
    return [read_file(f, context) for f in files]


@server.agent(name="storm agent", default_output_modes=["text/plain", "text/markdown"])
def main(
    input: Message,
    context: RunContext,
    llm: Annotated[
        LLMServiceExtensionServer,
        LLMServiceExtensionSpec.single_demand(
            suggested=(
                "watsonx:meta-llama/llama-3-3-70b-instruct",
                "watsonx:openai/gpt-oss-120b",
            )
        ),
    ],
    trajectory: Annotated[TrajectoryExtensionServer, TrajectoryExtensionSpec()],
    settings: Annotated[
        SettingsExtensionServer,
        SettingsExtensionSpec(
            params=SettingsRender(
                fields=[
                    CheckboxGroupField(
                        id="output_options",
                        fields=[
                            CheckboxField(
                                id="do_research",
                                label="Do research. If True, simulate conversation to research the topic; otherwise, load the results.",
                                default_value=True,
                            ),
                            CheckboxField(
                                id="do_generate_outline",
                                label="Generate Outline. If True, generate an outline for the topic; otherwise, load the results.",
                                default_value=True,
                            ),
                            CheckboxField(
                                id="do_generate_article",
                                label="Generate article. If True, generate an article for the topic; otherwise, load the results.",
                                default_value=True,
                            ),
                            CheckboxField(
                                id="do_polish_article",
                                label="Polish article. If True, polish the article by adding a summarization section and (optionally) removing duplicate content.",
                                default_value=True,
                            ),
                        ],
                    )
                ],
            )
        ),
    ],
    _: Annotated[PlatformApiExtensionServer, PlatformApiExtensionSpec()],
):
    load_api_key(toml_file_path="secrets.toml")
    lm_configs = STORMWikiLMConfigs()

    # return_files("./results/ollama/current_state_of_the_LLMs.", context)

    if llm and llm.data and llm.data.llm_fulfillments:

        # Get LLM configuration
        # Single demand is resolved to default (unless specified otherwise)
        llm_config = llm.data.llm_fulfillments.get("default")

        if llm_config:
            openai_kwargs = {
                "model": llm_config.api_model,
                "api_key": llm_config.api_key,
                "api_base": llm_config.api_base,
                "model_type": "chat",
            }

        else:
            yield AgentMessage(text="LLM configuration not found.")
    else:
        yield AgentMessage(text="LLM service not available.")

    do_research = True
    do_generate_outline = True
    do_generate_article = True
    do_polish_article = True

    if settings:
        parsed_settings = settings.parse_settings_response()
        output_options = parsed_settings.values["output_options"]

        if output_options.type == "checkbox_group":
            if output_options.values["do_research"].value:
                do_research = output_options.values["do_research"].value
            if output_options.values["do_generate_outline"].value:
                do_generate_outline = output_options.values["do_generate_outline"].value
            if output_options.values["do_generate_article"].value:
                do_generate_article = output_options.values["do_generate_article"].value
            if output_options.values["do_polish_article"].value:
                do_polish_article = output_options.values["do_polish_article"].value

    conv_simulator_lm = OpenAIModel(max_tokens=500, **openai_kwargs)
    question_asker_lm = OpenAIModel(max_tokens=500, **openai_kwargs)
    outline_gen_lm = OpenAIModel(max_tokens=400, **openai_kwargs)
    article_gen_lm = OpenAIModel(max_tokens=700, **openai_kwargs)
    article_polish_lm = OpenAIModel(max_tokens=4000, **openai_kwargs)

    lm_configs.set_conv_simulator_lm(conv_simulator_lm)
    lm_configs.set_question_asker_lm(question_asker_lm)
    lm_configs.set_outline_gen_lm(outline_gen_lm)
    lm_configs.set_article_gen_lm(article_gen_lm)
    lm_configs.set_article_polish_lm(article_polish_lm)

    engine_args = STORMWikiRunnerArguments(
        output_dir=folder_path,
        max_conv_turn=3,
        max_perspective=3,
        search_top_k=3,
        max_thread_num=3,
    )

    rm = TavilySearchRM()

    runner = STORMWikiRunner(engine_args, lm_configs, rm)

    find_related_topic_example = Example(
        topic="Knowledge Curation",
        related_topics="https://en.wikipedia.org/wiki/Knowledge_management\n"
        "https://en.wikipedia.org/wiki/Information_science\n"
        "https://en.wikipedia.org/wiki/Library_science\n",
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
        ),
    )
    runner.storm_knowledge_curation_module.persona_generator.create_writer_with_persona.find_related_topic.demos = [
        find_related_topic_example
    ]
    runner.storm_knowledge_curation_module.persona_generator.create_writer_with_persona.gen_persona.demos = [
        gen_persona_example
    ]

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
    runner.storm_outline_generation_module.write_outline.write_page_outline.demos = [
        write_page_outline_example
    ]
    write_section_example = Example(
        info="[1]\nInformation in document 1\n[2]\nInformation in document 2\n[3]\nInformation in document 3",
        topic="Example Topic",
        section="Example Section",
        output="# Example Topic\n## Subsection 1\n"
        "This is an example sentence [1]. This is another example sentence [2][3].\n"
        "## Subsection 2\nThis is one more example sentence [1].",
    )
    runner.storm_article_generation.section_gen.write_section.demos = [
        write_section_example
    ]

    class CallbacHandler(BaseCallbackHandler):
        def on_identify_perspective_start(self, **kwargs):
            context.yield_sync(
                trajectory.trajectory_metadata(title="Identify perspective start")
            )

        def on_identify_perspective_end(self, perspectives: list[str], **kwargs):
            context.yield_sync(
                trajectory.trajectory_metadata(
                    title="Identify perspective end", content=str(perspectives)
                )
            )

        def on_information_gathering_start(self, **kwargs):
            context.yield_sync(
                trajectory.trajectory_metadata(title="Information gathering start")
            )

        def on_dialogue_turn_end(self, dlg_turn, **kwargs):
            pass

        def on_information_gathering_end(self, **kwargs):
            context.yield_sync(
                trajectory.trajectory_metadata(title="Information gathering end")
            )

        def on_information_organization_start(self, **kwargs):
            context.yield_sync(
                trajectory.trajectory_metadata(title="Information organization start")
            )

        def on_direct_outline_generation_end(self, outline: str, **kwargs):
            context.yield_sync(
                trajectory.trajectory_metadata(
                    title="Direct outline generation end", content=str(outline)
                )
            )

        def on_outline_refinement_end(self, outline: str, **kwargs):
            context.yield_sync(
                trajectory.trajectory_metadata(
                    title="Outline refinement end", content=str(outline)
                )
            )

    runner.run(
        topic=get_message_text(input),
        do_research=do_research,
        do_generate_outline=do_generate_outline,
        do_generate_article=do_generate_article,
        do_polish_article=do_polish_article,
        callback_handler=CallbacHandler(),
    )
    runner.post_run()
    runner.summary()

    return_files(runner.article_output_dir, context)


def run():
    server.run(host=os.getenv("HOST", "127.0.0.1"), port=int(os.getenv("PORT", 8000)))


if __name__ == "__main__":
    run()
