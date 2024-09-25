"""
Warm starts the Co-STORM system by conducting a background information search to establish a shared conceptual space with the user.
 
This stage functions as a mini-STORM, where multiple LLM agents are spawned with different perspectives to engage in multi-round conversations. 
The knowledge base (represented as a mind map) is initialized using the information gathered during these exchanges.

Additionally, the system generates a first draft of the report, which is then used to create a concise and engaging conversation. 
The synthesized conversation is presented to the user to help them quickly catch up on the system's current knowledge about the topic.
"""

import dspy
import concurrent.futures
from threading import Lock
from typing import List, Optional, Union, TYPE_CHECKING

from .callback import BaseCallbackHandler
from .collaborative_storm_utils import _get_answer_question_module_instance
from .expert_generation import GenerateExpertModule
from .grounded_question_answering import AnswerQuestionModule
from ...dataclass import ConversationTurn, KnowledgeBase
from ...interface import LMConfigs
from ...logging_wrapper import LoggingWrapper
from ...storm_wiki.modules.outline_generation import WritePageOutline
from ...utils import ArticleTextProcessing as AP


if TYPE_CHECKING:
    from ..engine import RunnerArgument


class WarmStartModerator(dspy.Signature):
    """
    You are a moderator in a roundtable discussion. The goal is to chat with multiple experts to discuss the facts and background of the topic to familiarize the audience with the topic.
    You will be presented with the topic, the history of question you have already asked, and the current expert you are discussing with.
    Based on these information, generate the next question for the current expert to further the discussion.

    The output should only include the next question for the current expert. Do not include any other information or preamble.
    """

    topic = dspy.InputField(prefix="Topic for roundtable discussion: ", format=str)
    history = dspy.InputField(
        prefix="Experts you have already interacted with: ", format=str
    )
    current_expert = dspy.InputField(prefix="Expert you are talking with:", format=str)
    question = dspy.OutputField(
        prefix="Next question for the expert you are talking with: ", format=str
    )


class SectionToConvTranscript(dspy.Signature):
    """
    You are given a section of a brief report on a specific topic. Your task is to transform this section into an engaging opening discussion for a roundtable conversation.
    The goal is to help participants and the audience quickly understand the key information.
    Both question and answer should be in the tone of roundtable discussion talking to audiences.

    Specifically, you need to:
    1. Generate an engaging question that leverages section name and topic that opens discussion of the content.
    2. Provide a brief and engaging answer (with all inline citations from original text) derived from the section serving as pointers and avoid too much details.
    """

    topic = dspy.InputField(prefix="topic:", format=str)
    section_name = dspy.InputField(prefix="section name:", format=str)
    section_content = dspy.InputField(prefix="section content:", format=str)
    question = dspy.OutputField(prefix="Now give engaging question only.\nQuestion:")
    answer = dspy.OutputField(
        prefix="Now give engaging answer only with all inline citations from original text.\nAnswer:"
    )


class ReportToConversation(dspy.Module):
    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.engine = engine
        self.section_to_conv_transcript = dspy.Predict(SectionToConvTranscript)

    def forward(self, knowledge_base: KnowledgeBase):
        def process_node(node, topic):
            with dspy.settings.context(lm=self.engine, show_guidelines=False):
                output = self.section_to_conv_transcript(
                    topic=topic,
                    section_name=node.get_path_from_root(),
                    section_content=node.synthesize_output,
                )
                question = output.question.replace("Question:", "").strip()
                answer = output.answer.replace("Answer:", "").strip()
                return question, answer

        conversations = []
        nodes = knowledge_base.collect_all_nodes()
        nodes = [node for node in nodes if node.name != "root" and node.content]
        topic = knowledge_base.topic

        with concurrent.futures.ThreadPoolExecutor() as executor:
            future_to_node = {
                executor.submit(process_node, node, topic): node for node in nodes
            }
            for future in concurrent.futures.as_completed(future_to_node):
                node = future_to_node[future]
                question, answer = future.result()
                conversations.append(
                    ConversationTurn(
                        role="Background discussion moderator",
                        raw_utterance=question,
                        utterance_type="Original Question",
                        utterance=question,
                        cited_info=[
                            knowledge_base.info_uuid_to_info_dict[idx]
                            for idx in AP.parse_citation_indices(question)
                        ],
                    )
                )
                conversations.append(
                    ConversationTurn(
                        role="Background discussion expert",
                        raw_utterance=answer,
                        utterance_type="Potential Answer",
                        utterance=answer,
                        cited_info=[
                            knowledge_base.info_uuid_to_info_dict[idx]
                            for idx in AP.parse_citation_indices(answer)
                        ],
                    )
                )
        return conversations


class WarmStartConversation(dspy.Module):
    def __init__(
        self,
        question_asking_lm: Union[dspy.dsp.LM, dspy.dsp.HFModel],
        generate_expert_module: GenerateExpertModule,
        answer_question_module: AnswerQuestionModule,
        logging_wrapper: LoggingWrapper,
        max_num_experts: int = 3,
        max_turn_per_experts: int = 2,
        max_thread: int = 3,
        callback_handler: BaseCallbackHandler = None,
    ):
        self.ask_question = dspy.Predict(WarmStartModerator)
        self.max_num_experts = max_num_experts
        self.max_turn_per_experts = max_turn_per_experts
        self.question_asking_lm = question_asking_lm
        self.answer_question_module = answer_question_module
        self.max_thread = max_thread
        self.generate_experts_module = generate_expert_module
        self.logging_wrapper = logging_wrapper
        self.callback_handler = callback_handler

    def format_dialogue_question_history_string(
        self, conversation_history: List[ConversationTurn]
    ):
        output = []
        for idx, turn in enumerate(conversation_history):
            info = turn.claim_to_make if turn.claim_to_make else turn.utterance
            output.append(f"{idx + 1}: {info}")
        return "\n".join(output)

    def generate_warmstart_experts(self, topic: str):
        background_seeking_dialogue = self.get_background_info(topic=topic)
        background_info = background_seeking_dialogue.utterance
        gen_expert_output = self.generate_experts_module(
            topic=topic,
            background_info=background_info,
            num_experts=self.max_num_experts,
        )
        return gen_expert_output.experts, background_seeking_dialogue

    def get_background_info(self, topic: str):
        question = f"Background information about {topic}"
        answer = self.answer_question_module(
            topic=topic, question=question, mode="extensive", style="conversational"
        )

        return ConversationTurn(
            role="Default Background Researcher",
            raw_utterance=answer.response,
            utterance_type="Questioning",
            claim_to_make=question,
            queries=answer.queries,
            raw_retrieved_info=answer.raw_retrieved_info,
            cited_info=answer.cited_info,
        )

    def forward(self, topic: str):
        with self.logging_wrapper.log_event(
            "warm start, perspective guided QA: identify experts"
        ):
            # do background research, generate some experts
            experts, background_seeking_dialogue = self.generate_warmstart_experts(
                topic=topic
            )
        # init list to store the dialogue history
        conversation_history: List[ConversationTurn] = []
        lock = Lock()

        # hierarchical chat: chat with one expert. Generate question, get answer
        def process_expert(expert):
            expert_name, expert_descriptoin = expert.split(":")
            for idx in range(self.max_turn_per_experts):
                with self.logging_wrapper.log_event(
                    f"warm start, perspective guided QA: expert {expert_name}; turn {idx + 1}"
                ):
                    try:
                        with lock:
                            history = self.format_dialogue_question_history_string(
                                conversation_history
                            )
                        with dspy.settings.context(lm=self.question_asking_lm):
                            question = self.ask_question(
                                topic=topic, history=history, current_expert=expert
                            ).question
                        answer = self.answer_question_module(
                            topic=topic,
                            question=question,
                            mode="brief",
                            style="conversational",
                        )
                        conversation_turn = ConversationTurn(
                            role=expert,
                            claim_to_make=question,
                            raw_utterance=answer.response,
                            utterance_type="Support",
                            queries=answer.queries,
                            raw_retrieved_info=answer.raw_retrieved_info,
                            cited_info=answer.cited_info,
                        )
                        if self.callback_handler is not None:
                            self.callback_handler.on_warmstart_update(
                                message="\n".join(
                                    [
                                        f"Finish browsing {url}"
                                        for url in [
                                            i.url for i in answer.raw_retrieved_info
                                        ]
                                    ]
                                )
                            )
                        with lock:
                            conversation_history.append(conversation_turn)
                    except Exception as e:
                        print(f"Error processing expert {expert}: {e}")

        # multi-thread conversation
        with concurrent.futures.ThreadPoolExecutor(
            max_workers=self.max_thread
        ) as executor:
            futures = [
                executor.submit(process_expert, expert)
                for expert in experts[: min(len(experts), self.max_num_experts)]
            ]
            concurrent.futures.wait(futures)

        conversation_history = [background_seeking_dialogue] + conversation_history

        return dspy.Prediction(
            conversation_history=conversation_history, experts=experts
        )


class GenerateWarmStartOutline(dspy.Signature):
    """Generate a outline of the wikipedia-like report from a roundtable discussion. You will be presented discussion points in the conversation and corresponding queries.
    You will be given a draft outline which you can borrow some inspiration. Do not include sections that are not mentioned in the given discussion history.
    Use "#" to denote section headings, "##" to denote subsection headings, and so on.
     Follow these guidelines:
     1. Use "#" for section titles, "##" for subsection titles, "###" for subsubsection titles, and so on.
     2. Do not include any additional information.
     3. Exclude the topic name from the outline.
     The organization of outline should adopt wikiepdia style.
    """

    topic = dspy.InputField(prefix="The topic discussed: ", format=str)
    draft = dspy.InputField(prefix="Draft outline you can reference to: ", format=str)
    conv = dspy.InputField(prefix="Discussion history:\n", format=str)
    outline = dspy.OutputField(
        prefix='Write the conversation outline (Use "#" Title" to indicate section title, "##" Title" to indicate subsection title, ...):\n',
        format=str,
    )


class GenerateWarmStartOutlineModule(dspy.Module):
    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.engine = engine
        self.gen_outline = dspy.Predict(GenerateWarmStartOutline)
        self.draft_outline = dspy.Predict(WritePageOutline)

    def extract_questions_and_queries(self, conv: List[ConversationTurn]):
        context = []
        for turn in conv:
            focus = turn.claim_to_make
            queries = turn.queries
            queries_string = "\n\t".join(
                f"Query {idx + 1}: {query}" for idx, query in enumerate(queries)
            )
            string = f"Discussion focus {len(context) + 1}: {focus}\n\t{queries_string}"
            context.append(string)
        return "\n".join(context)

    def get_draft_outline(self, topic: str):
        with dspy.settings.context(lm=self.engine):
            return self.draft_outline(topic=topic).outline

    def forward(self, topic: str, conv: List[ConversationTurn]):
        discussion_history = self.extract_questions_and_queries(conv)
        draft_outline = self.get_draft_outline(topic=topic)
        with dspy.settings.context(lm=self.engine):
            outline = self.gen_outline(
                topic=topic, draft=draft_outline, conv=discussion_history
            ).outline
            outline = AP.clean_up_outline(outline)
        return dspy.Prediction(outline=outline, draft_outline=draft_outline)


class WarmStartModule:
    def __init__(
        self,
        lm_config: LMConfigs,
        runner_argument: "RunnerArgument",
        logging_wrapper: LoggingWrapper,
        rm: Optional[dspy.Retrieve] = None,
        callback_handler: BaseCallbackHandler = None,
    ):
        generate_expert_module = GenerateExpertModule(
            engine=lm_config.discourse_manage_lm
        )
        self.warmstart_conv = WarmStartConversation(
            question_asking_lm=lm_config.question_asking_lm,
            generate_expert_module=generate_expert_module,
            answer_question_module=_get_answer_question_module_instance(
                lm_config=lm_config,
                runner_argument=runner_argument,
                logging_wrapper=logging_wrapper,
                rm=rm,
            ),
            max_num_experts=runner_argument.warmstart_max_num_experts,
            max_turn_per_experts=runner_argument.warmstart_max_turn_per_experts,
            max_thread=runner_argument.warmstart_max_thread,
            logging_wrapper=logging_wrapper,
            callback_handler=callback_handler,
        )
        self.warmstart_outline_gen_module = GenerateWarmStartOutlineModule(
            engine=lm_config.warmstart_outline_gen_lm
        )
        self.report_to_conversation = ReportToConversation(lm_config.knowledge_base_lm)
        self.logging_wrapper = logging_wrapper
        self.callback_handler = callback_handler

    def initiate_warm_start(self, topic: str, knowledge_base: KnowledgeBase):
        """
        Initiates a warm start process for the given topic by generating a warm start conversation and inserting the
        resulting information into a knowledge base.

        Args:
            topic (str): The topic for which to initiate the warm start process.

        Returns:
            Tuple[List[ConversationTurn], List[str], KnowledgeBase]:
                - A list of ConversationTurn instances representing the conversation history.
                - A list of strings representing the experts involved in the conversation.
                - A KnowledgeBase instance containing the organized information.
        """
        warm_start_conversation_history: List[ConversationTurn] = []
        warm_start_experts = None
        # get warm start conversations
        with self.logging_wrapper.log_event("warm start: perspective guided QA"):
            if self.callback_handler is not None:
                self.callback_handler.on_warmstart_update(
                    message="Start getting familiar with the topic by chatting with multiple LLM experts (Step 1 / 4)"
                )
            warm_start_result = self.warmstart_conv(topic=topic)
            warm_start_conversation_history = warm_start_result.conversation_history
            warm_start_experts = warm_start_result.experts

        # get warm start conv outline
        with self.logging_wrapper.log_event("warm start: outline generation"):
            if self.callback_handler is not None:
                self.callback_handler.on_warmstart_update(
                    "Organizing collected information (Step 2 / 4)"
                )
            warm_start_outline_output = self.warmstart_outline_gen_module(
                topic=topic, conv=warm_start_conversation_history
            )
        # init knowledge base
        with self.logging_wrapper.log_event("warm start: insert into knowledge base"):
            if self.callback_handler is not None:
                self.callback_handler.on_warmstart_update(
                    "Inserting collected information into knowledge base (Step 3 / 4)"
                )
            knowledge_base.insert_from_outline_string(
                outline_string=warm_start_outline_output.outline
            )
            # insert information to knowledge base
            for turn in warm_start_conversation_history:
                knowledge_base.update_from_conv_turn(
                    conv_turn=turn, allow_create_new_node=False
                )
        # knowledge base to report
        if self.callback_handler is not None:
            self.callback_handler.on_warmstart_update(
                "Synthesizing background information discussion utterances (Step 4 / 4)"
            )
        knowledge_base.to_report()

        # generate engaging conversations
        engaging_conversations = self.report_to_conversation(knowledge_base)
        return (
            warm_start_conversation_history,
            engaging_conversations,
            warm_start_experts,
        )
