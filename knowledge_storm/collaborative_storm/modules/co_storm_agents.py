import dspy
from itertools import zip_longest
import numpy as np
from sklearn.metrics.pairwise import cosine_similarity
from typing import List, Optional, TYPE_CHECKING

from .callback import BaseCallbackHandler
from .collaborative_storm_utils import (
    extract_storm_info_snippet,
    _get_answer_question_module_instance,
)
from .costorm_expert_utterance_generator import CoStormExpertUtteranceGenerationModule
from .grounded_question_generation import GroundedQuestionGenerationModule
from .simulate_user import GenSimulatedUserUtterance
from ...dataclass import ConversationTurn, KnowledgeBase
from ...encoder import Encoder
from ...interface import Agent, Information, LMConfigs
from ...logging_wrapper import LoggingWrapper

if TYPE_CHECKING:
    from ..engine import RunnerArgument


class CoStormExpert(Agent):
    """
    Represents an expert agent in the Co-STORM framework.
    The `CoStormExpert` is a specialized type of `Agent` that is tasked with participating in roundtable discussions within the Co-STORM system.
    The expert uses language models to generate action plans, answer questions, and polish its utterances based on the current conversation history and knowledge base.
      It interacts with modules for action planning and question answering grounding on provided retrieval models.

    Args:
        topic (str): The conversation topic that the expert specializes in.
        role_name (str): The perspective of the expert's role (e.g. AI enthusiast, drug discovery expert, etc.)
        role_description (str): A description of the perspective of the experts
        lm_config (LMConfigs): Configuration for the language models
        runner_argument (RunnerArgument): Co-STORM runner argument
        logging_wrapper (LoggingWrapper): An instance of `LoggingWrapper` to log events.
        rm (Optional[dspy.Retrieve], optional): A retrieval module used for fetching external knowledge or context.
        callback_handler (BaseCallbackHandler, optional): Handles log message printing
    """

    def __init__(
        self,
        topic: str,
        role_name: str,
        role_description: str,
        lm_config: LMConfigs,
        runner_argument: "RunnerArgument",
        logging_wrapper: LoggingWrapper,
        rm: Optional[dspy.Retrieve] = None,
        callback_handler: BaseCallbackHandler = None,
    ):
        super().__init__(topic, role_name, role_description)
        self.lm_config = lm_config
        self.runner_argument = runner_argument
        self.logging_wrapper = logging_wrapper
        self.callback_handler = callback_handler
        self.costorm_agent_utterance_generator = (
            self._get_costorm_expert_utterance_generator(rm=rm)
        )

    def _get_costorm_expert_utterance_generator(
        self, rm: Optional[dspy.Retrieve] = None
    ):
        return CoStormExpertUtteranceGenerationModule(
            action_planning_lm=self.lm_config.discourse_manage_lm,
            utterance_polishing_lm=self.lm_config.utterance_polishing_lm,
            answer_question_module=_get_answer_question_module_instance(
                lm_config=self.lm_config,
                runner_argument=self.runner_argument,
                logging_wrapper=self.logging_wrapper,
                rm=rm,
            ),
            logging_wrapper=self.logging_wrapper,
            callback_handler=self.callback_handler,
        )

    def generate_utterance(
        self,
        knowledge_base: KnowledgeBase,
        conversation_history: List[ConversationTurn],
    ):
        with self.logging_wrapper.log_event(
            "CoStormExpert generate utternace: get knowledge base summary"
        ):
            if self.callback_handler is not None:
                self.callback_handler.on_expert_action_planning_start()
            conversation_summary = knowledge_base.get_knowledge_base_summary()
        with self.logging_wrapper.log_event(
            "CoStormExpert.generate_utterance generate utterance"
        ):
            last_conv_turn = conversation_history[-1]
            conv_turn = self.costorm_agent_utterance_generator(
                topic=self.topic,
                current_expert=self.get_role_description(),
                conversation_summary=conversation_summary,
                last_conv_turn=last_conv_turn,
            ).conversation_turn
        with self.logging_wrapper.log_event(
            "CoStormExpert generate utterance: polish utterance"
        ):
            if self.callback_handler is not None:
                self.callback_handler.on_expert_utterance_polishing_start()
            self.costorm_agent_utterance_generator.polish_utterance(
                conversation_turn=conv_turn, last_conv_turn=last_conv_turn
            )
        return conv_turn


class SimulatedUser(Agent):
    """
    Simulated Users is a special type of Agent in Co-STORM that simulates real user interaction behavior based on the given intent.

    This class can be used for automatic experiments.
    For more information, please refer to Section 3.4 of Co-STORM paper: https://www.arxiv.org/pdf/2408.15232
    """

    def __init__(
        self,
        topic: str,
        role_name: str,
        role_description: str,
        intent: str,
        lm_config: LMConfigs,
        runner_argument: "RunnerArgument",
        logging_wrapper: LoggingWrapper,
        callback_handler: BaseCallbackHandler = None,
    ):
        super().__init__(topic, role_name, role_description)
        self.intent = intent
        self.lm_config = lm_config
        self.runner_argument = runner_argument
        self.logging_wrapper = logging_wrapper
        self.gen_simulated_user_utterance = GenSimulatedUserUtterance(
            engine=self.lm_config.question_answering_lm
        )
        self.callback_handler = callback_handler

    def generate_utterance(
        self,
        knowledge_base: KnowledgeBase,
        conversation_history: List[ConversationTurn],
    ):
        assert (
            self.intent is not None and self.intent
        ), "Simulate user intent is not initialized."

        with self.logging_wrapper.log_event(
            "SimulatedUser generate utternace: generate utterance"
        ):
            utterance = self.gen_simulated_user_utterance(
                topic=self.topic, intent=self.intent, conv_history=conversation_history
            )
        return ConversationTurn(
            role="Guest", raw_utterance=utterance, utterance_type="Original Question"
        )


class Moderator(Agent):
    """
    The moderator's role in the Co-STORM framework is to inject new perspectives into the conversation to avoid stagnation, repetition, or overly niche discussions.
    This is achieved by generating questions based on unused, uncited snippets of information retrieved since the last moderator's turn.
    The selected information is reranked according to its relevance to the conversation topic and its dissimilarity to the original question.
    The resulting top-ranked snippets are used to generate an informed question to be presented to the conversation participants.

    For more information, please refer to Section 3.5 of Co-STORM paper: https://www.arxiv.org/pdf/2408.15232
    """

    def __init__(
        self,
        topic: str,
        role_name: str,
        role_description: str,
        lm_config: LMConfigs,
        runner_argument: "RunnerArgument",
        logging_wrapper: LoggingWrapper,
        encoder: Encoder,
        callback_handler: BaseCallbackHandler = None,
    ):
        super().__init__(topic, role_name, role_description)
        self.lm_config = lm_config
        self.runner_argument = runner_argument
        self.logging_wrapper = logging_wrapper
        self.grounded_question_generation_module = GroundedQuestionGenerationModule(
            engine=self.lm_config.question_asking_lm
        )
        self.callback_handler = callback_handler
        self.encoder = encoder

    def _get_conv_turn_unused_information(
        self, conv_turn: ConversationTurn, knowledge_base: KnowledgeBase
    ):
        # extract all snippets from raw retrieved information
        raw_retrieved_info: List[Information] = conv_turn.raw_retrieved_info
        raw_retrieved_single_snippet_info: List[Information] = []
        for info in raw_retrieved_info:
            for snippet_idx in range(len(info.snippets)):
                raw_retrieved_single_snippet_info.append(
                    extract_storm_info_snippet(info, snippet_index=snippet_idx)
                )
        # get all cited information
        cited_info = list(knowledge_base.info_uuid_to_info_dict.values())
        cited_info_hash_set = set([hash(info) for info in cited_info])
        cited_snippets = [info.snippets[0] for info in cited_info]
        # get list of unused information
        unused_information: List[Information] = [
            info
            for info in raw_retrieved_single_snippet_info
            if hash(info) not in cited_info_hash_set
        ]
        if not unused_information:
            return []
        # extract snippets to get embeddings
        unused_information_snippets = [info.snippets[0] for info in unused_information]
        # get embeddings
        unused_snippets_embeddings = self.encoder.encode(
            unused_information_snippets, max_workers=20
        )
        claim_embedding = self.encoder.encode(conv_turn.claim_to_make)
        query_embedding = self.encoder.encode(conv_turn.queries)
        cited_snippets_embedding = self.encoder.encode(cited_snippets)
        # calculate similarity
        query_similarities = cosine_similarity(
            unused_snippets_embeddings, query_embedding
        )
        max_query_similarity = np.max(query_similarities, axis=1)
        cited_snippets_similarity = np.max(
            cosine_similarity(unused_snippets_embeddings, cited_snippets_embedding),
            axis=1,
        )
        cited_snippets_similarity = np.clip(cited_snippets_similarity, 0, 1)
        # use claim similarity to filter out "real" not useful data
        claim_similarity = cosine_similarity(
            unused_snippets_embeddings, claim_embedding.reshape(1, -1)
        ).flatten()
        claim_similarity = np.where(claim_similarity >= 0.25, 1.0, 0.0)
        # calculate score: snippet that is close to topic but far from query
        query_sim_weight = 0.5
        cited_snippets_sim_weight = 1 - query_sim_weight
        combined_scores = (
            ((1 - max_query_similarity) ** query_sim_weight)
            * ((1 - cited_snippets_similarity) ** cited_snippets_sim_weight)
            * claim_similarity
        )
        sorted_indices = np.argsort(combined_scores)[::-1]
        return [unused_information[idx] for idx in sorted_indices]

    def _get_sorted_unused_snippets(
        self,
        knowledge_base: KnowledgeBase,
        conversation_history: List[ConversationTurn],
        last_n_conv_turn: int = 2,
    ):
        # get last N conv turn and batch encode all related strings
        considered_conv_turn = []
        batch_snippets = [self.topic]
        for conv_turn in reversed(conversation_history):
            if len(considered_conv_turn) == last_n_conv_turn:
                break
            if conv_turn.utterance_type == "Questioning":
                break
            considered_conv_turn.append(conv_turn)
            batch_snippets.extend(
                sum([info.snippets for info in conv_turn.raw_retrieved_info], [])
            )
            batch_snippets.append(conv_turn.claim_to_make)
            batch_snippets.extend(conv_turn.queries)
        self.encoder.encode(batch_snippets, max_workers=20)

        # get sorted unused snippets for each turn
        sorted_snippets = []
        for conv_turn in considered_conv_turn:
            sorted_snippets.append(
                self._get_conv_turn_unused_information(
                    conv_turn=conv_turn, knowledge_base=knowledge_base
                )
            )

        # use round robin rule to merge these snippets
        merged_snippets = []
        for elements in zip_longest(*sorted_snippets, fillvalue=None):
            merged_snippets.extend(e for e in elements if e is not None)
        return merged_snippets

    def generate_utterance(
        self,
        knowledge_base: KnowledgeBase,
        conversation_history: List[ConversationTurn],
    ):
        with self.logging_wrapper.log_event(
            "Moderator generate utternace: get unused snippets"
        ):
            unused_snippets: List[Information] = self._get_sorted_unused_snippets(
                knowledge_base=knowledge_base, conversation_history=conversation_history
            )
        with self.logging_wrapper.log_event(
            "Moderator generate utternace: QuestionGeneration module"
        ):
            generated_question = self.grounded_question_generation_module(
                topic=self.topic,
                knowledge_base=knowledge_base,
                last_conv_turn=conversation_history[-1],
                unused_snippets=unused_snippets,
            )
        return ConversationTurn(
            role=self.role_name,
            raw_utterance=generated_question.raw_utterance,
            utterance_type="Original Question",
            utterance=generated_question.utterance,
            cited_info=generated_question.cited_info,
        )


class PureRAGAgent(Agent):
    """
    PureRAGAgent only handles grounded question generation by retrieving information from the retriever based on the query.
    It does not utilize any other information besides the query itself.

    It's designed for Co-STORM paper baseline comparison.
    """

    def __init__(
        self,
        topic: str,
        role_name: str,
        role_description: str,
        lm_config: LMConfigs,
        runner_argument: "RunnerArgument",
        logging_wrapper: LoggingWrapper,
        rm: Optional[dspy.Retrieve] = None,
        callback_handler: BaseCallbackHandler = None,
    ):
        super().__init__(topic, role_name, role_description)
        self.lm_config = lm_config
        self.runner_argument = runner_argument
        self.logging_wrapper = logging_wrapper
        self.grounded_question_answering_module = _get_answer_question_module_instance(
            lm_config=self.lm_config,
            runner_argument=self.runner_argument,
            logging_wrapper=self.logging_wrapper,
            rm=rm,
        )

    def _gen_utterance_from_question(self, question: str):
        grounded_answer = self.grounded_question_answering_module(
            topic=self.topic,
            question=question,
            mode="brief",
            style="conversational and concise",
        )
        conversation_turn = ConversationTurn(
            role=self.role_name, raw_utterance="", utterance_type="Potential Answer"
        )
        conversation_turn.claim_to_make = question
        conversation_turn.raw_utterance = grounded_answer.response
        conversation_turn.utterance = grounded_answer.response
        conversation_turn.queries = grounded_answer.queries
        conversation_turn.raw_retrieved_info = grounded_answer.raw_retrieved_info
        conversation_turn.cited_info = grounded_answer.cited_info
        return conversation_turn

    def generate_topic_background(self):
        return self._gen_utterance_from_question(self.topic)

    def generate_utterance(
        self,
        knowledge_base: KnowledgeBase,
        conversation_history: List[ConversationTurn],
    ):
        with self.logging_wrapper.log_event(
            "PureRAGAgent generate utternace: generate utterance"
        ):
            return self._gen_utterance_from_question(
                question=conversation_history[-1].utterance
            )
