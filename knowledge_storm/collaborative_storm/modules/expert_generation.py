import dspy
import re
from typing import Union


class GenerateExpertGeneral(dspy.Signature):
    """You need to select a group of diverse experts who will be suitable to be invited to a roundtable discussion on the given topic.
    Each expert should represent a different perspective, role, or affiliation related to this topic.
    You can use the background information provided about the topic for inspiration. For each expert, add a description of their expertise and what they will focus on during the discussion.
    No need to include speakers name in the output.
    Strictly follow format below:
    1. [speaker 1 role]: [speaker 1 short description]
    2. [speaker 2 role]: [speaker 2 short description]
    """

    topic = dspy.InputField(prefix="Topic of interest:", format=str)
    background_info = dspy.InputField(
        prefix="Background information about the topic:\n", format=str
    )
    topN = dspy.InputField(prefix="Number of speakers needed: ", format=str)
    experts = dspy.OutputField(format=str)


class GenerateExpertWithFocus(dspy.Signature):
    """
    You need to select a group of speakers who will be suitable to have roundtable discussion on the [topic] of specific [focus].
    You may consider inviting speakers having opposite stands on the topic; speakers representing different interest parties; Ensure that the selected speakers are directly connected to the specific context and scenario provided.
    For example, if the discussion focus is about a recent event at a specific university, consider inviting students, faculty members, journalists covering the event, university officials, and local community members.
    Use the background information provided about the topic for inspiration. For each speaker, add a description of their interests and what they will focus on during the discussion.
    No need to include speakers name in the output.
    Strictly follow format below:
    1. [speaker 1 role]: [speaker 1 short description]
    2. [speaker 2 role]: [speaker 2 short description]
    """

    topic = dspy.InputField(prefix="Topic of interest:", format=str)
    background_info = dspy.InputField(prefix="Background information:\n", format=str)
    focus = dspy.InputField(prefix="Discussion focus: ", format=str)
    topN = dspy.InputField(prefix="Number of speakers needed: ", format=str)
    experts = dspy.OutputField(format=str)


class GenerateExpertModule(dspy.Module):
    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.engine = engine
        self.generate_expert_general = dspy.Predict(GenerateExpertGeneral)
        self.generate_expert_w_focus = dspy.ChainOfThought(GenerateExpertWithFocus)

    def trim_background(self, background: str, max_words: int = 100):
        words = background.split()
        cur_len = len(words)
        if cur_len <= max_words:
            return background
        trimmed_words = words[: min(cur_len, max_words)]
        trimmed_background = " ".join(trimmed_words)
        return f"{trimmed_background} [rest content omitted]."

    def forward(
        self, topic: str, num_experts: int, background_info: str = "", focus: str = ""
    ):
        with dspy.settings.context(lm=self.engine, show_guidelines=False):
            if not focus:
                output = self.generate_expert_general(
                    topic=topic, background_info=background_info, topN=num_experts
                ).experts
            else:
                background_info = self.trim_background(
                    background=background_info, max_words=100
                )
                output = self.generate_expert_w_focus(
                    topic=topic,
                    background_info=background_info,
                    focus=focus,
                    topN=num_experts,
                ).experts
        output = output.replace("*", "").replace("[", "").replace("]", "")
        expert_list = []
        for s in output.split("\n"):
            match = re.search(r"\d+\.\s*(.*)", s)
            if match:
                expert_list.append(match.group(1))
        expert_list = [expert.strip() for expert in expert_list if expert.strip()]
        return dspy.Prediction(experts=expert_list, raw_output=output)
