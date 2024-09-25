import dspy
from typing import Union, List

from .callback import BaseCallbackHandler
from .collaborative_storm_utils import (
    trim_output_after_hint,
    format_search_results,
    extract_cited_storm_info,
    separate_citations,
)
from ...logging_wrapper import LoggingWrapper
from ...utils import ArticleTextProcessing
from ...interface import Information


class QuestionToQuery(dspy.Signature):
    """You want to answer the question or support a claim using Google search. What do you type in the search box?
    The question is raised in a round table discussion on a topic. The question may or may not focus on the topic itself.
    Write the queries you will use in the following format:
    - query 1
    - query 2
    ...
    - query n"""

    topic = dspy.InputField(prefix="Topic context:", format=str)
    question = dspy.InputField(
        prefix="I want to collect information about: ", format=str
    )
    queries = dspy.OutputField(prefix="Queries: \n", format=str)


class AnswerQuestion(dspy.Signature):
    """You are an expert who can use information effectively. You have gathered the related information and will now use the information to form a response.
    Make your response as informative as possible and make sure every sentence is supported by the gathered information.
    If [Gathered information] is not directly related to the [Topic] and [Question], provide the most relevant answer you can based on the available information, and explain any limitations or gaps.
    Use [1], [2], ..., [n] in line (for example, "The capital of the United States is Washington, D.C.[1][3].").
    You DO NOT need to include a References or Sources section to list the sources at the end. The style of writing should be formal.
    """

    topic = dspy.InputField(prefix="Topic you are discussing about:", format=str)
    question = dspy.InputField(prefix="You want to provide insight on: ", format=str)
    info = dspy.InputField(prefix="Gathered information:\n", format=str)
    style = dspy.InputField(prefix="Style of your response should be:", format=str)
    answer = dspy.OutputField(
        prefix="Now give your response. (Try to use as many different sources as possible and do not hallucinate.)",
        format=str,
    )


class AnswerQuestionModule(dspy.Module):
    def __init__(
        self,
        retriever: dspy.Retrieve,
        max_search_queries: int,
        question_answering_lm: Union[dspy.dsp.LM, dspy.dsp.HFModel],
        logging_wrapper: LoggingWrapper,
    ):
        super().__init__()
        self.question_answering_lm = question_answering_lm
        self.question_to_query = dspy.Predict(QuestionToQuery)
        self.answer_question = dspy.Predict(AnswerQuestion)
        self.retriever = retriever
        self.max_search_queries = max_search_queries
        self.logging_wrapper = logging_wrapper

    def retrieve_information(self, topic, question):
        # decompose question to queries
        with self.logging_wrapper.log_event(
            f"AnswerQuestionModule.question_to_query ({hash(question)})"
        ):
            with dspy.settings.context(lm=self.question_answering_lm):
                queries = self.question_to_query(topic=topic, question=question).queries
            queries = trim_output_after_hint(queries, hint="Queries:")
            queries = [
                q.replace("-", "").strip().strip('"').strip('"').strip()
                for q in queries.split("\n")
            ]
            queries = queries[: self.max_search_queries]
        self.logging_wrapper.add_query_count(count=len(queries))
        with self.logging_wrapper.log_event(
            f"AnswerQuestionModule.retriever.retrieve ({hash(question)})"
        ):
            # retrieve information using retriever
            searched_results: List[Information] = self.retriever.retrieve(
                list(set(queries)), exclude_urls=[]
            )
        # update storm information meta to include the question
        for storm_info in searched_results:
            storm_info.meta["question"] = question
        return queries, searched_results

    def forward(
        self,
        topic: str,
        question: str,
        mode: str = "brief",
        style: str = "conversational",
        callback_handler: BaseCallbackHandler = None,
    ):
        """
        Processes a topic and question to generate a response with relevant information and citations.

        Args:
            topic (str): The topic of interest.
            question (str): The specific question related to the topic.
            mode (str, optional): Mode of summarization. 'brief' takes only the first snippet of each Information.
                                'extensive' adds snippets iteratively until the word limit is reached. Defaults to 'brief'.

        Returns:
            dspy.Prediction: An object containing the following:
                - question (str): the question to answer
                - queries (List[str]): List of query strings used for information retrieval.
                - raw_retrieved_info (List[Information]): List of Information instances retrieved.
                - cited_info (Dict[int, Information]): Dictionary of cited Information instances, indexed by their citation number.
                - response (str): The generated response string with inline citations.
        """
        # retrieve information
        if callback_handler is not None:
            callback_handler.on_expert_information_collection_start()
        queries, searched_results = self.retrieve_information(
            topic=topic, question=question
        )
        if callback_handler is not None:
            callback_handler.on_expert_information_collection_end(searched_results)
        # format information string for answer generation
        info_text, index_to_information_mapping = format_search_results(
            searched_results, mode=mode
        )
        answer = "Sorry, there is insufficient information to answer the question."
        # generate answer to the question
        if info_text:
            with self.logging_wrapper.log_event(
                f"AnswerQuestionModule.answer_question ({hash(question)})"
            ):
                with dspy.settings.context(
                    lm=self.question_answering_lm, show_guidelines=False
                ):
                    answer = self.answer_question(
                        topic=topic, question=question, info=info_text, style=style
                    ).answer
                    answer = ArticleTextProcessing.remove_uncompleted_sentences_with_citations(
                        answer
                    )
                    answer = trim_output_after_hint(
                        answer,
                        hint="Now give your response. (Try to use as many different sources as possible and do not hallucinate.)",
                    )
                    # enforce single citation index bracket. [1, 2] -> [1][2]
                    answer = separate_citations(answer)
                    if callback_handler is not None:
                        callback_handler.on_expert_utterance_generation_end()
        # construct cited search result
        cited_searched_results = extract_cited_storm_info(
            response=answer, index_to_storm_info=index_to_information_mapping
        )

        return dspy.Prediction(
            question=question,
            queries=queries,
            raw_retrieved_info=searched_results,
            cited_info=cited_searched_results,
            response=answer,
        )
