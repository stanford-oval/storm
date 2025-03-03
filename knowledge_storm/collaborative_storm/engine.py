import dspy
import os
from dataclasses import dataclass, field, asdict
from typing import List, Union, Literal, Optional, Dict

from .modules import collaborative_storm_utils as collaborative_storm_utils
from .modules.callback import BaseCallbackHandler
from .modules.co_storm_agents import (
    SimulatedUser,
    PureRAGAgent,
    Moderator,
    CoStormExpert,
)
from .modules.expert_generation import GenerateExpertModule
from .modules.warmstart_hierarchical_chat import WarmStartModule
from ..dataclass import ConversationTurn, KnowledgeBase
from ..encoder import Encoder
from ..interface import LMConfigs, Agent
from ..logging_wrapper import LoggingWrapper
from ..lm import LitellmModel
from ..rm import BingSearch


class CollaborativeStormLMConfigs(LMConfigs):
    """Configurations for LLM used in different parts of Co-STORM.

    Given that different parts in Co-STORM framework have different complexity, we use different LLM configurations
    to achieve a balance between quality and efficiency. If no specific configuration is provided, we use the default
    setup in the paper.
    """

    def __init__(self):
        self.question_answering_lm = None
        self.discourse_manage_lm = None
        self.utterance_polishing_lm = None
        self.warmstart_outline_gen_lm = None
        self.question_asking_lm = None
        self.knowledge_base_lm = None

    def init(
        self,
        lm_type: Literal["openai", "azure", "together"],
        temperature: Optional[float] = 1.0,
        top_p: Optional[float] = 0.9,
    ):
        if lm_type and lm_type == "openai":
            openai_kwargs = {
                "api_key": os.getenv("OPENAI_API_KEY"),
                "temperature": temperature,
                "top_p": top_p,
                "api_base": None,
            }
            self.question_answering_lm = LitellmModel(
                model="gpt-4o-2024-05-13", max_tokens=1000, **openai_kwargs
            )
            self.discourse_manage_lm = LitellmModel(
                model="gpt-4o-2024-05-13", max_tokens=500, **openai_kwargs
            )
            self.utterance_polishing_lm = LitellmModel(
                model="gpt-4o-2024-05-13", max_tokens=2000, **openai_kwargs
            )
            self.warmstart_outline_gen_lm = LitellmModel(
                model="gpt-4-1106-preview", max_tokens=500, **openai_kwargs
            )
            self.question_asking_lm = LitellmModel(
                model="gpt-4o-2024-05-13", max_tokens=300, **openai_kwargs
            )
            self.knowledge_base_lm = LitellmModel(
                model="gpt-4o-2024-05-13", max_tokens=1000, **openai_kwargs
            )
        elif lm_type and lm_type == "azure":
            azure_kwargs = {
                "api_key": os.getenv("AZURE_API_KEY"),
                "temperature": temperature,
                "top_p": top_p,
                "api_base": os.getenv("AZURE_API_BASE"),
                "api_version": os.getenv("AZURE_API_VERSION"),
            }
            self.question_answering_lm = LitellmModel(
                model="azure/gpt-4o", max_tokens=1000, **azure_kwargs, model_type="chat"
            )
            self.discourse_manage_lm = LitellmModel(
                model="azure/gpt-4o", max_tokens=500, **azure_kwargs, model_type="chat"
            )
            self.utterance_polishing_lm = LitellmModel(
                model="azure/gpt-4o", max_tokens=2000, **azure_kwargs, model_type="chat"
            )
            self.warmstart_outline_gen_lm = LitellmModel(
                model="azure/gpt-4o", max_tokens=300, **azure_kwargs, model_type="chat"
            )
            self.question_asking_lm = LitellmModel(
                model="azure/gpt-4o", max_tokens=300, **azure_kwargs, model_type="chat"
            )
            self.knowledge_base_lm = LitellmModel(
                model="azure/gpt-4o", max_tokens=1000, **azure_kwargs, model_type="chat"
            )
        elif lm_type and lm_type == "together":
            together_kwargs = {
                "api_key": os.getenv("TOGETHER_API_KEY"),
                "temperature": temperature,
                "top_p": top_p,
            }
            self.question_answering_lm = LitellmModel(
                model="together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
                max_tokens=1000,
                model_type="chat",
                **together_kwargs,
            )
            self.discourse_manage_lm = LitellmModel(
                model="together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
                max_tokens=500,
                model_type="chat",
                **together_kwargs,
            )
            self.utterance_polishing_lm = LitellmModel(
                model="together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
                max_tokens=2000,
                model_type="chat",
                **together_kwargs,
            )
            self.warmstart_outline_gen_lm = LitellmModel(
                model="together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
                max_tokens=500,
                model_type="chat",
                **together_kwargs,
            )
            self.question_asking_lm = LitellmModel(
                model="together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
                max_tokens=300,
                model_type="chat",
                **together_kwargs,
            )
            self.knowledge_base_lm = LitellmModel(
                model="together_ai/meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
                max_tokens=1000,
                model_type="chat",
                **together_kwargs,
            )
        else:
            raise Exception(
                "No valid OpenAI API provider is provided. Cannot use default LLM configurations."
            )

    def set_question_answering_lm(self, model: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.question_answering_lm = model

    def set_discourse_manage_lm(self, model: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.discourse_manage_lm = model

    def set_utterance_polishing_lm(self, model: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.utterance_polishing_lm = model

    def set_warmstart_outline_gen_lm(self, model: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.warmstart_outline_gen_lm = model

    def set_question_asking_lm(self, model: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.question_asking_lm = model

    def set_knowledge_base_lm(self, model: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.knowledge_base_lm = model

    def collect_and_reset_lm_usage(self):
        lm_usage = {}
        for attr_name in self.__dict__:
            if "_lm" in attr_name and hasattr(
                getattr(self, attr_name), "get_usage_and_reset"
            ):
                usage = getattr(self, attr_name).get_usage_and_reset()
                if any(
                    value["prompt_tokens"] != 0 or value["completion_tokens"] != 0
                    for value in usage.values()
                ):
                    lm_usage[attr_name] = usage
        return lm_usage

    def to_dict(self):
        """
        Converts the CollaborativeStormLMConfigs instance to a dictionary representation.
        """
        config_dict = {}

        # For each LM attribute
        for attr_name, attr_value in self.__dict__.items():
            if attr_name.endswith("_lm") and attr_value is not None:
                # Store the model information directly
                model_info = {
                    "type": attr_value.__class__.__name__,
                    "module": attr_value.__class__.__module__,
                    "model": getattr(attr_value, "model", None),
                    "max_tokens": getattr(attr_value, "max_tokens", None),
                }

                # Check for additional important attributes
                for param in ["temperature", "top_p"]:
                    if hasattr(attr_value, param):
                        model_info[param] = getattr(attr_value, param)

                # Check if the model has a kwargs dictionary
                if hasattr(attr_value, "kwargs"):
                    # Make a copy to avoid reference issues
                    model_info["kwargs"] = {**attr_value.kwargs}

                    # Don't include sensitive info or large objects in serialization
                    if "extra_headers" in model_info["kwargs"]:
                        model_info["kwargs"]["extra_headers"] = "AUTH_HEADERS_PRESENT"

                config_dict[attr_name] = model_info

        return config_dict

    @classmethod
    def from_dict(cls, data):
        """
        Constructs a CollaborativeStormLMConfigs instance from a dictionary representation.
        Fails if no data is provided.
        """
        # If there's no data, raise an exception
        if not data:
            raise ValueError(
                "No data provided to construct CollaborativeStormLMConfigs"
            )

        # Create a new instance
        config = cls()

        # Import LM class
        try:
            from knowledge_storm.lm import LM
        except ImportError:
            # Fallback if import path is different
            from ..lm import LM

        # Process each LM configuration from the data - don't use get() with lm_config again
        for attr_name, model_info in data.items():
            if attr_name.endswith("_lm") and model_info:
                # Extract model class if specified
                LMClass = LM
                if "module" in model_info and "type" in model_info:
                    try:
                        module_name = model_info["module"]
                        class_name = model_info["type"]
                        module = __import__(module_name, fromlist=[class_name])
                        LMClass = getattr(module, class_name)
                    except (ImportError, AttributeError):
                        pass

                # Extract parameters from model_info
                model = model_info.get("model")
                kwargs = model_info.get("kwargs", {}).copy()

                # Handle max_tokens
                max_tokens = kwargs.pop("max_tokens", model_info.get("max_tokens"))

                # Handle model_type
                model_type = kwargs.pop("model_type", "chat")

                # Only replace auth headers placeholder if it was explicitly present
                if kwargs.get("extra_headers") == "AUTH_HEADERS_PRESENT":
                    # The presence of this placeholder indicates auth headers were previously used
                    if model and model.startswith("azure/"):
                        auth_headers = get_auth_headers()
                        if auth_headers:
                            kwargs["extra_headers"] = auth_headers
                            kwargs["api_key"] = None
                    else:
                        # For non-Azure models, remove the placeholder
                        kwargs.pop("extra_headers", None)

                # Create the LM instance
                try:
                    lm = LMClass(
                        model=model,
                        max_tokens=max_tokens,
                        model_type=model_type,
                        **kwargs,
                    )
                    setattr(config, attr_name, lm)
                except Exception as e:
                    print(
                        f"Warning: Could not create {attr_name} with model {model}: {e}"
                    )
                    # Don't attempt to create a fallback here

        return config


@dataclass
class RunnerArgument:
    """Arguments for controlling the STORM Wiki pipeline."""

    topic: str = field(
        metadata={"help": "Topic of discourse"},
    )
    retrieve_top_k: int = field(
        default=10,
        metadata={"help": "retrieve top k results for each query in retriever"},
    )
    max_search_queries: int = field(
        default=2,
        metadata={
            "help": "Maximum number of search queries to consider for each question."
        },
    )
    total_conv_turn: int = field(
        default=20,
        metadata={"help": "Maximum number turn in conversation."},
    )
    max_search_thread: int = field(
        default=5,
        metadata={"help": "Maximum number of parallel thread for retriever"},
    )
    max_search_queries_per_turn: int = field(
        default=3,
        metadata={"help": "Maximum number of search queries to consider in each turn."},
    )
    warmstart_max_num_experts: int = field(
        default=3,
        metadata={
            "help": "Max number of experts in perspective guided QA in warm start process"
        },
    )
    warmstart_max_turn_per_experts: int = field(
        default=2,
        metadata={"help": "Max number of turns per perspective in warm start process"},
    )
    warmstart_max_thread: int = field(
        default=3,
        metadata={
            "help": "Max number thread for parallel perspective guided QA in warm start process"
        },
    )
    max_thread_num: int = field(
        default=10,
        metadata={
            "help": "Maximum number of threads to use. "
            "Consider reducing it if keep getting 'Exceed rate limit' error when calling LM API."
        },
    )
    max_num_round_table_experts: int = field(
        default=2,
        metadata={"help": "Max number of active experts in round table discussion."},
    )
    moderator_override_N_consecutive_answering_turn: int = field(
        default=3,
        metadata={
            "help": "Number of consecutive experts answering turn before moderator override the conversation"
        },
    )
    node_expansion_trigger_count: int = field(
        default=10,
        metadata={
            "help": "Trigger node expansion for node that contain more than N snippets"
        },
    )
    disable_moderator: bool = field(
        default=False,
        metadata={"help": "If True, disable moderator."},
    )
    disable_multi_experts: bool = field(
        default=False,
        metadata={"help": "If True, disable moderator."},
    )
    rag_only_baseline_mode: bool = field(
        default=False,
        metadata={"help": "If True, switch to rag online baseline mode"},
    )

    def to_dict(self):
        """
        Converts the RunnerArgument instance to a dictionary representation.

        Returns:
            dict: The dictionary representation of the RunnerArgument.
        """
        return asdict(self)

    @classmethod
    def from_dict(cls, data):
        """
        Constructs a RunnerArgument instance from a dictionary representation.

        Args:
            data (dict): The dictionary representation of the RunnerArgument.

        Returns:
            RunnerArgument: The constructed RunnerArgument instance.
        """
        return cls(**data)


@dataclass
class TurnPolicySpec:
    """
    Represents the policy specifications for determining the behavior of a conversation turn.

    Attributes:
        should_reorganize_knowledge_base (bool):
            A flag that indicates whether the knowledge base should be reorganized after the current turn.

        should_update_experts_list (bool):
            A flag that indicates whether the list of experts should be updated based on the conversation context.

        should_polish_utterance (bool):
            A flag that indicates whether the generated utterance should be polished (e.g., refined or rephrased) before it is used in the conversation.

        agent (Agent):
            The `Agent` responsible for generating utterances or responses during the conversation turn.
            This agent interacts with the knowledge base and the conversation history to produce responses.
    """

    should_reorganize_knowledge_base: bool = False
    should_update_experts_list: bool = False
    should_polish_utterance: bool = False
    agent: Agent = None


class DiscourseManager:
    def __init__(
        self,
        logging_wrapper: LoggingWrapper,
        lm_config: CollaborativeStormLMConfigs,
        runner_argument: RunnerArgument,
        rm: dspy.Retrieve,
        encoder: Encoder,
        callback_handler: BaseCallbackHandler,
    ):
        # parameter management
        self.lm_config = lm_config
        self.runner_argument = runner_argument
        self.logging_wrapper = logging_wrapper
        self.callback_handler = callback_handler
        self.rm = rm
        self.encoder = encoder
        # role management
        self.experts: List[CoStormExpert] = []
        self.simulated_user: SimulatedUser = SimulatedUser(
            topic=self.runner_argument.topic,
            role_name="Guest",
            role_description="",
            intent=None,
            lm_config=self.lm_config,
            runner_argument=self.runner_argument,
            logging_wrapper=self.logging_wrapper,
            callback_handler=self.callback_handler,
        )
        self.pure_rag_agent: PureRAGAgent = PureRAGAgent(
            topic=self.runner_argument.topic,
            role_name="PureRAG",
            role_description="",
            lm_config=self.lm_config,
            runner_argument=self.runner_argument,
            logging_wrapper=self.logging_wrapper,
            rm=self.rm,
            callback_handler=self.callback_handler,
        )
        self.moderator: Moderator = Moderator(
            topic=self.runner_argument.topic,
            role_name="Moderator",
            role_description="",
            lm_config=self.lm_config,
            runner_argument=self.runner_argument,
            logging_wrapper=self.logging_wrapper,
            encoder=self.encoder,
            callback_handler=self.callback_handler,
        )
        self.general_knowledge_provider = CoStormExpert(
            topic=self.runner_argument.topic,
            role_name="General Knowledge Provider",
            role_description="Focus on broadly covering the basic facts about the question.",
            lm_config=self.lm_config,
            runner_argument=self.runner_argument,
            logging_wrapper=self.logging_wrapper,
            rm=self.rm,
            callback_handler=self.callback_handler,
        )
        self.generate_expert_module = GenerateExpertModule(
            engine=self.lm_config.discourse_manage_lm
        )
        self.next_turn_moderator_override = False

    def serialize_experts(self) -> List[Dict]:
        return [
            {
                "topic": expert.topic,
                "role_name": expert.role_name,
                "role_description": expert.role_description,
            }
            for expert in self.experts
        ]

    def deserialize_experts(self, data: List[Dict]):
        for expert_data in data:
            self.experts.append(
                CoStormExpert(
                    topic=expert_data["topic"],
                    role_name=expert_data["role_name"],
                    role_description=expert_data["role_description"],
                    lm_config=self.lm_config,
                    runner_argument=self.runner_argument,
                    logging_wrapper=self.logging_wrapper,
                    rm=self.rm,
                    callback_handler=self.callback_handler,
                )
            )

    def _should_generate_question(
        self, conversation_history: List[ConversationTurn]
    ) -> bool:
        consecutive_non_questioning_turn = 0
        for conv_turn in reversed(conversation_history):
            if conv_turn.utterance_type not in [
                "Original Question",
                "Information Request",
            ]:
                consecutive_non_questioning_turn += 1
            else:
                break
        return (
            consecutive_non_questioning_turn
            >= self.runner_argument.moderator_override_N_consecutive_answering_turn
        )

    def _parse_expert_names_to_agent(self, expert_descriptions: Union[str, List[str]]):
        if type(expert_descriptions) == str:
            expert_descriptions = [expert_descriptions]
        agents: CoStormExpert = []
        for expert_name in expert_descriptions:
            role_name, role_description = expert_name.split(":")
            role_name = role_name.strip()
            role_description = role_description.strip()
            new_costorm_expert = CoStormExpert(
                topic=self.runner_argument.topic,
                role_name=role_name,
                role_description=role_description,
                lm_config=self.lm_config,
                runner_argument=self.runner_argument,
                logging_wrapper=self.logging_wrapper,
                rm=self.rm,
                callback_handler=self.callback_handler,
            )
            agents.append(new_costorm_expert)
        return agents

    def _update_expert_list_from_utterance(self, focus: str, background_info: str):
        expert_names = self.generate_expert_module(
            topic=self.runner_argument.topic,
            background_info=background_info,
            focus=focus,
            num_experts=self.runner_argument.max_num_round_table_experts,
        ).experts
        self.experts = self._parse_expert_names_to_agent(expert_names)

    def _is_last_turn_questioning(self, conversation_history: List[ConversationTurn]):
        return conversation_history and conversation_history[-1].utterance_type in [
            "Original Question",
            "Information Request",
        ]

    def get_next_turn_policy(
        self,
        conversation_history: List[ConversationTurn],
        dry_run=False,
        simulate_user=False,
        simulate_user_intent: str = None,
    ) -> TurnPolicySpec:
        next_turn_policy = TurnPolicySpec()
        if simulate_user:
            self.simulated_user.intent = simulate_user_intent
            next_turn_policy.agent = self.simulated_user
        elif self.runner_argument.rag_only_baseline_mode:
            assert self.conversation_history[-1].role == "Guest"
            next_turn_policy.agent = self.pure_rag_agent
        elif self.next_turn_moderator_override:
            next_turn_policy.agent = self.moderator
            if not dry_run:
                self.next_turn_moderator_override = False
        elif (
            not self.runner_argument.disable_moderator
            and self._should_generate_question(conversation_history)
        ):
            next_turn_policy.agent = self.moderator
            next_turn_policy.should_reorganize_knowledge_base = True
        # experts RAG gen
        else:
            next_turn_policy.agent = self.general_knowledge_provider
            if (
                not self._is_last_turn_questioning(conversation_history)
                and not self.runner_argument.disable_multi_experts
            ):
                if dry_run:
                    next_turn_policy.agent = self.experts[0]
                else:
                    next_turn_policy.agent = self.experts.pop(0)
                    self.experts.append(next_turn_policy.agent)
            next_turn_policy.should_update_experts_list = (
                self._is_last_turn_questioning(conversation_history)
                and not self.runner_argument.disable_multi_experts
            )
            next_turn_policy.should_polish_utterance = True
        return next_turn_policy


class CoStormRunner:
    def __init__(
        self,
        lm_config: CollaborativeStormLMConfigs,
        runner_argument: RunnerArgument,
        logging_wrapper: LoggingWrapper,
        rm: Optional[dspy.Retrieve] = None,
        encoder: Optional[Encoder] = None,
        callback_handler: BaseCallbackHandler = None,
    ):
        self.runner_argument = runner_argument
        self.lm_config = lm_config
        self.logging_wrapper = logging_wrapper
        self.callback_handler = callback_handler
        if rm is None:
            self.rm = BingSearch(k=runner_argument.retrieve_top_k)
        else:
            self.rm = rm
        if encoder is None:
            self.encoder = Encoder()
        else:
            self.encoder = encoder
        self.conversation_history = []
        self.warmstart_conv_archive = []
        self.knowledge_base = KnowledgeBase(
            topic=self.runner_argument.topic,
            knowledge_base_lm=self.lm_config.knowledge_base_lm,
            node_expansion_trigger_count=self.runner_argument.node_expansion_trigger_count,
            encoder=self.encoder,
        )
        self.discourse_manager = DiscourseManager(
            lm_config=self.lm_config,
            runner_argument=self.runner_argument,
            logging_wrapper=self.logging_wrapper,
            rm=self.rm,
            encoder=self.encoder,
            callback_handler=callback_handler,
        )
        self.report = None  # Initialize the report attribute

    def to_dict(self):
        result = {
            "runner_argument": self.runner_argument.to_dict(),
            "lm_config": self.lm_config.to_dict(),
            "conversation_history": [
                turn.to_dict() for turn in self.conversation_history
            ],
            "warmstart_conv_archive": [
                turn.to_dict() for turn in self.warmstart_conv_archive
            ],
            "experts": self.discourse_manager.serialize_experts(),
            "knowledge_base": self.knowledge_base.to_dict(),
        }

        # Include the report if it exists
        if hasattr(self, "report") and self.report is not None:
            result["report"] = self.report

        return result

    @classmethod
    def from_dict(cls, data, callback_handler: BaseCallbackHandler = None):
        # Fail if no data is provided
        if not data:
            raise ValueError("No data provided to construct CoStormRunner")

        # Create a new LM config from lm_config data - pass the actual lm_config data, not nested
        lm_config = CollaborativeStormLMConfigs.from_dict(data.get("lm_config", {}))

        # Create logging wrapper
        logging_wrapper = LoggingWrapper(lm_config)

        # Create a basic encoder - don't add auth headers by default
        encoder = Encoder()

        # Only create an encoder with auth headers if there's evidence they were used before
        uses_azure_auth = False
        for attr_name in dir(lm_config):
            if attr_name.endswith("_lm"):
                lm = getattr(lm_config, attr_name, None)
                if (
                    lm
                    and hasattr(lm, "kwargs")
                    and isinstance(getattr(lm, "kwargs", {}), dict)
                    and "extra_headers" in getattr(lm, "kwargs", {})
                ):
                    uses_azure_auth = True
                    break

        # Only use auth headers if they were previously used
        if uses_azure_auth:
            auth_headers = get_auth_headers()
            if auth_headers:
                encoder = Encoder(
                    api_key=None,
                    api_base=os.getenv("AZURE_OPENAI_ENDPOINT")
                    or os.getenv("AZURE_API_BASE"),
                    extra_headers=auth_headers,
                )

        # Create runner args from the data
        runner_args = RunnerArgument.from_dict(data["runner_argument"])

        # Create retriever
        retriever = BingSearch(
            bing_search_api_key=os.getenv("BING_SEARCH_API_KEY"),
            k=runner_args.retrieve_top_k,
        )

        # Initialize CoStormRunner
        costorm_runner = cls(
            lm_config=lm_config,
            runner_argument=runner_args,
            logging_wrapper=logging_wrapper,
            rm=retriever,
            callback_handler=callback_handler,
            encoder=encoder,
        )

        # Load data from the dictionary
        if "conversation_history" in data:
            costorm_runner.conversation_history = [
                ConversationTurn.from_dict(turn)
                for turn in data["conversation_history"]
            ]

        if "warmstart_conv_archive" in data:
            costorm_runner.warmstart_conv_archive = [
                ConversationTurn.from_dict(turn)
                for turn in data["warmstart_conv_archive"]
            ]

        if "experts" in data:
            costorm_runner.discourse_manager.deserialize_experts(data["experts"])

        if "knowledge_base" in data:
            costorm_runner.knowledge_base = KnowledgeBase.from_dict(
                data=data["knowledge_base"],
                knowledge_base_lm=costorm_runner.lm_config.knowledge_base_lm,
                node_expansion_trigger_count=costorm_runner.runner_argument.node_expansion_trigger_count,
                encoder=costorm_runner.encoder,
            )

        # Load report if it exists
        if "report" in data:
            costorm_runner.report = data["report"]

        return costorm_runner

    def warm_start(self):
        """
        Warm start co-storm system to conduct background information search in order to build shared conceptual space with user.
        This stage is a mini-STORM, spawning multiple LLM agent with different perspective and perform multi-round conversation.
        The knowledge base (i.e. mind map) will be initialize using the collected information.

        It will also generate a first draft of report and use it to produce an engaging and concise conversation presented to the
        user to catch up with system's knowledge about the topic.
        """
        with self.logging_wrapper.log_pipeline_stage(
            pipeline_stage=f"warm start stage"
        ):
            if not self.runner_argument.rag_only_baseline_mode:
                warm_start_module = WarmStartModule(
                    lm_config=self.lm_config,
                    runner_argument=self.runner_argument,
                    logging_wrapper=self.logging_wrapper,
                    rm=self.rm,
                    callback_handler=self.callback_handler,
                )

                (
                    warmstart_conv,
                    warmstart_revised_conv,
                    warmstart_experts,
                ) = warm_start_module.initiate_warm_start(
                    topic=self.runner_argument.topic,
                    knowledge_base=self.knowledge_base,
                )
                self.discourse_manager.experts = (
                    self.discourse_manager._parse_expert_names_to_agent(
                        warmstart_experts
                    )
                )
                self.discourse_manager.next_turn_moderator_override = True
                self.conversation_history = (
                    warmstart_revised_conv if warmstart_revised_conv else warmstart_conv
                )
                self.warmstart_conv_archive = warmstart_conv
                self.knowledge_base.reorganize()
            else:
                if self.knowledge_base is None:
                    self.knowledge_base = KnowledgeBase(
                        topic=self.runner_argument.topic,
                        knowledge_base_lm=self.lm_config.knowledge_base_lm,
                        node_expansion_trigger_count=self.runner_argument.node_expansion_trigger_count,
                        encoder=self.encoder,
                    )
                if self.conversation_history is None:
                    self.conversation_history = []
                conv_turn = (
                    self.discourse_manager.pure_rag_agent.generate_topic_background()
                )
                self.conversation_history.append(conv_turn)
                self.knowledge_base.update_from_conv_turn(
                    conv_turn=conv_turn,
                    allow_create_new_node=True,
                    insert_under_root=self.runner_argument.rag_only_baseline_mode,
                )

    def generate_report(self) -> str:
        """
        Generate report leveraging organized collected information in the knowledge base (i.e. mind map).
        The article generation follows the paradigm in STORM paper, where it considers mind map nodes as section names, and generate the report section by section.

        Returns:
            str: A string representing the report, with "#" "##" indicating hierarchical sections and [1][2] indicating references.
        """
        with self.logging_wrapper.log_pipeline_stage(
            f"report generation after conv turn: {len(self.conversation_history)}"
        ):
            with self.logging_wrapper.log_event(
                "report generation stage: generate report"
            ):
                self.report = self.knowledge_base.to_report()
                return self.report

    def dump_logging_and_reset(self):
        return self.logging_wrapper.dump_logging_and_reset()

    def step(
        self,
        user_utterance: str = "",
        simulate_user: bool = False,
        simulate_user_intent: str = "",
    ) -> ConversationTurn:
        """
        Yields a single turn in the conversation flow.

        This method take a user input when user choose to inject an utterance or generates the next system utterance based on the current conversation history and defined discourse policies.
        It handles updating the conversation history, managing expert lists, and interacting with the knowledge base.
        Additionally, it logs each stage of the conversation for monitoring and debugging purposes.

        Args:
            user_utterance (str, optional): The input provided by the user. If provided, this utterance is added directly to the conversation history and returns with no further action.
            simulate_user (bool, optional): This is designed for automatic experiments using a LLM agent to simulate user actions. Flag indicating whether to simulate user behavior. When set to `True`, the system will generate user intents based on predefined simulation logic. Defaults to `False`.
            simulate_user_intent (str, optional): This is designed for automatic experiments using a LLM agent to simulate user actions. Specifies the intent to simulate for the user. This is used when `simulate_user` is `True` to guide the simulated user's responses,

        Returns:
            ConversationTurn: An object representing the latest turn in the conversation.

        Workflow:
            1. User Utterance Handling
                - If `user_utterance` is provided, it is appended to the `conversation_history`

            2. System Utterance Generation
                - If no `user_utterance` is provided, the method proceeds to generate the next system utterance.
                - Determines the next turn policy by consulting the `discourse_manager` with the current conversation history.
                - Generates a new utterance using the agent defined in the turn policy, leveraging the `knowledge_base` and `conversation_history`.
                - If the turn policy indicates that the experts list should be updated, it updates the expert list based on the latest utterances.

            4. Knowledge Base Update
                - Inserts the new turn into the `knowledge_base`, optionally allowing the creation of new nodes or inserting under the root based on the `rag_only_baseline_mode` flag.
                - If the turn policy specifies, it reorganizes the `knowledge_base` to maintain optimal structure and relevance.
        """
        last_conv_turn = self.conversation_history[-1]
        cur_turn_name = f"conv turn: {len(self.conversation_history) + 1}"
        with self.logging_wrapper.log_pipeline_stage(
            pipeline_stage=f"{cur_turn_name} stage"
        ):
            conv_turn = None
            if user_utterance:
                self.discourse_manager.next_turn_moderator_override = False
                conv_turn = ConversationTurn(
                    role="Guest",
                    raw_utterance=user_utterance,
                    utterance_type="Original Question",
                )
                self.conversation_history.append(conv_turn)
            else:
                with self.logging_wrapper.log_event(
                    f"{cur_turn_name}: get turn policy"
                ):
                    if self.callback_handler is not None:
                        self.callback_handler.on_turn_policy_planning_start()
                    turn_policy = self.discourse_manager.get_next_turn_policy(
                        conversation_history=self.conversation_history,
                        simulate_user=simulate_user,
                        simulate_user_intent=simulate_user_intent,
                        dry_run=False,
                    )

                with self.logging_wrapper.log_event(
                    f"{cur_turn_name}: generate utterance"
                ):
                    conv_turn = turn_policy.agent.generate_utterance(
                        knowledge_base=self.knowledge_base,
                        conversation_history=self.conversation_history,
                    )

                if turn_policy.should_update_experts_list:
                    with self.logging_wrapper.log_event(
                        f"{cur_turn_name}: update experts list"
                    ):
                        self.discourse_manager._update_expert_list_from_utterance(
                            focus=last_conv_turn.raw_utterance,
                            background_info=conv_turn.raw_utterance,
                        )

                if conv_turn is not None:
                    self.conversation_history.append(conv_turn)
                    with self.logging_wrapper.log_event(
                        f"{cur_turn_name}: insert into knowledge base"
                    ):
                        if self.callback_handler is not None:
                            self.callback_handler.on_mindmap_insert_start()
                        self.knowledge_base.update_from_conv_turn(
                            conv_turn=conv_turn,
                            allow_create_new_node=True,
                            insert_under_root=self.runner_argument.rag_only_baseline_mode,
                        )
                        if self.callback_handler is not None:
                            self.callback_handler.on_mindmap_insert_end()
                if turn_policy.should_reorganize_knowledge_base:
                    with self.logging_wrapper.log_event(
                        f"{cur_turn_name}: reorganize knowledge base"
                    ):
                        if self.callback_handler is not None:
                            self.callback_handler.on_mindmap_reorg_start()
                        self.knowledge_base.reorganize()
        return conv_turn


def get_auth_headers():
    """
    Helper function to get authentication headers based on available credentials.
    Avoids direct dependency on Azure libraries unless necessary.

    Returns:
        dict: A dictionary containing authentication headers if available
    """
    auth_headers = {}

    # Try to get Azure API key if available
    api_key = os.getenv("AZURE_OPENAI_API_KEY") or os.getenv("AZURE_API_KEY")
    if api_key:
        auth_headers["api-key"] = api_key

    # Try to get Azure Bearer token only if needed
    client_id = os.getenv("AZURE_OPENAI_CLIENT_ID") or os.getenv("AZURE_CLIENT_ID")
    client_secret = os.getenv("AZURE_OPENAI_CLIENT_SECRET") or os.getenv(
        "AZURE_CLIENT_SECRET"
    )
    tenant_id = os.getenv("AZURE_OPENAI_TENANT_ID") or os.getenv("AZURE_TENANT_ID")

    if all([client_id, client_secret, tenant_id]):
        try:
            # Only import azure.identity if we need to get a token
            import importlib.util

            if importlib.util.find_spec("azure.identity"):
                from azure.identity import ClientSecretCredential

                token = (
                    ClientSecretCredential(
                        client_id=client_id,
                        client_secret=client_secret,
                        tenant_id=tenant_id,
                    )
                    .get_token("https://cognitiveservices.azure.com/.default")
                    .token
                )
                auth_headers["Authorization"] = f"Bearer {token}"
        except ImportError:
            # If azure.identity isn't available, continue without token
            pass
        except Exception as e:
            # Handle other exceptions
            print(f"Warning: Could not get Azure authentication token: {e}")

    return auth_headers
