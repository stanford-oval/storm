import dspy
from typing import Union
from ...dataclass import KnowledgeBase


class KnowledgeBaseSummmary(dspy.Signature):
    """Your job is to give brief summary of what's been discussed in a roundtable conversation. Contents are themantically organized into hierarchical sections.
    You will be presented with these sections where "#" denotes level of section.
    """

    topic = dspy.InputField(prefix="topic: ", format=str)
    structure = dspy.InputField(prefix="Tree structure: \n", format=str)
    output = dspy.OutputField(prefix="Now give brief summary:\n", format=str)


class KnowledgeBaseSummaryModule(dspy.Module):
    def __init__(self, engine: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.engine = engine
        self.gen_summary = dspy.Predict(KnowledgeBaseSummmary)

    def forward(self, knowledge_base: KnowledgeBase):
        structure = knowledge_base.get_node_hierarchy_string(
            include_indent=False,
            include_full_path=False,
            include_hash_tag=True,
            include_node_content_count=False,
        )
        with dspy.settings.context(lm=self.engine, show_guidelines=False):
            summary = self.gen_summary(
                topic=knowledge_base.topic, structure=structure
            ).output
        return summary
