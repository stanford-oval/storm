import dspy
import os
import re
import sys
import toml
from typing import List, Tuple, Dict, Optional, TYPE_CHECKING

if TYPE_CHECKING:
    from ..engine import RunnerArgument
from ...interface import Information, Retriever, LMConfigs
from ...logging_wrapper import LoggingWrapper
from ...rm import BingSearch


def extract_storm_info_snippet(info: Information, snippet_index: int) -> Information:
    """
    Constructs a new Information instance with only the specified snippet index.

    Args:
        storm_info (Information): The original Information instance.
        snippet_index (int): The index of the snippet to retain.

    Returns:
        Information: A new Information instance with only the specified snippet.
    """
    if snippet_index < 0 or snippet_index >= len(info.snippets):
        raise ValueError("Snippet index out of range")

    new_snippets = [info.snippets[snippet_index]]
    new_storm_info = Information(
        info.url, info.description, new_snippets, info.title, info.meta
    )
    return new_storm_info


def format_search_results(
    searched_results: List[Information],
    info_max_num_words: int = 1000,
    mode: str = "brief",
) -> Tuple[str, Dict[int, Information]]:
    """
    Constructs a string from a list of search results with a specified word limit and returns a mapping of indices to Information.

    Args:
        searched_results (List[Information]): List of Information objects to process.
        info_max_num_words (int, optional): Maximum number of words allowed in the output string. Defaults to 1000.
        mode (str, optional): Mode of summarization. 'brief' takes only the first snippet of each Information.
                                'extensive' adds snippets iteratively until the word limit is reached. Defaults to 'brief'.

    Returns:
        Tuple[str, Dict[int, Information]]:
            - Formatted string with search results, constrained by the word limit.
            - Dictionary mapping indices to the corresponding Information objects.
    """
    total_length = 0

    extracted_snippet_queue = []
    max_snippets = (
        max(len(info.snippets) for info in searched_results) if searched_results else 0
    )
    max_snippets = 1 if mode == "brief" else max_snippets
    abort = False
    included_snippets = set()
    for i in range(max_snippets):
        for info in searched_results:
            if i < len(info.snippets) and not abort:
                cur_snippet = info.snippets[i]
                cur_snippet_len = len(info.snippets[i].split())
                if total_length + cur_snippet_len > info_max_num_words:
                    abort = True
                    break
                if cur_snippet not in included_snippets:
                    included_snippets.add(cur_snippet)
                    info = extract_storm_info_snippet(info, snippet_index=i)
                    extracted_snippet_queue.append(info)
                    total_length += cur_snippet_len
    output = []
    index_mapping = {}
    for idx, info in enumerate(extracted_snippet_queue):
        output.append(f"[{idx + 1}]: {info.snippets[0]}")
        index_mapping[idx + 1] = info
    assert -1 not in index_mapping
    return "\n".join(output), index_mapping


def extract_cited_storm_info(
    response: str, index_to_storm_info: Dict[int, Information]
) -> Dict[int, Information]:
    """
    Extracts a sub-dictionary of Information instances that are cited in the response.

    Args:
        response (str): The response string containing inline citations like [1], [2], etc.
        index_to_storm_info (Dict[int, Information]): A dictionary mapping indices to Information instances.

    Returns:
        Dict[int, Information]: A sub-dictionary with only the indices that appear in the response.
    """
    cited_indices = set(map(int, re.findall(r"\[(\d+)\]", response)))
    cited_storm_info = {
        index: info
        for index, info in index_to_storm_info.items()
        if index in cited_indices
    }
    return cited_storm_info


def trim_output_after_hint(response: str, hint: str) -> str:
    """
    Trims the output string to only keep the substring after the given hint (not including the hint).

    Args:
        response (str): The original output string.
        hint (str): The hint string after which the substring should be kept.

    Returns:
        str: The trimmed output string, or the original string if the hint is not found.
    """
    if hint in response:
        start_index = response.find(hint) + len(hint)
        return response[start_index:].strip()
    return response.strip("\n")


def separate_citations(text: str) -> str:
    """
    Separates multiple citations within square brackets into individual citations.

    Args:
        text (str): The input string containing citations.

    Returns:
        str: The string with separated citations.
    """

    # Define a function to process each match
    def replace_citations(match):
        citations = match.group(1).split(",")
        return "".join(f"[{citation.strip()}]" for citation in citations)

    # Use regular expressions to find and replace citations
    pattern = re.compile(r"\[(\d+(?:,\s*\d+)*)\]")
    return pattern.sub(replace_citations, text)


def extract_and_remove_citations(text: str) -> Tuple[str, List[int]]:
    """
    Removes single inline citations from the input string and returns the modified string and a list of citation integers.

    Args:
        text (str): The input string containing citations.

    Returns:
        Tuple[str, List[int]]: The string after removal of citations and a list of citation integers.
    """
    citations = []

    # Define a function to process each match
    def extract_citation(match):
        citation = int(match.group(1))
        citations.append(citation)
        return ""

    # Use regular expressions to find and replace citations
    pattern = re.compile(r"\[(\d+)\]")
    modified_text = pattern.sub(extract_citation, text)

    return modified_text, citations


def keep_first_and_last_paragraph(text: str) -> str:
    """
    Processes the input text to keep the first and last paragraphs and replace
    the middle paragraphs with '[content omitted due to space limit]'.

    Args:
        text (str): The input text containing paragraphs separated by '\n\n'.

    Returns:
        str: The processed text.
    """
    paragraphs = text.split("\n\n")

    if len(paragraphs) <= 3:
        return text

    first_paragraph = paragraphs[0]
    last_paragraph = "\n\n".join(paragraphs[-2:])
    return (
        f"{first_paragraph}\n\n[content omitted due to space limit]\n\n{last_paragraph}"
    )


def clean_up_section(text):
    """Clean up a section:
    1. Remove uncompleted sentences (usually due to output token limitation).
    2. Deduplicate individual groups of citations.
    3. Remove unnecessary summary."""

    paragraphs = text.split("\n")
    output_paragraphs = []
    summary_sec_flag = False
    for p in paragraphs:
        p = p.strip()
        if len(p) == 0:
            continue
        if not p.startswith("#"):
            p = separate_citations(p)
        if summary_sec_flag:
            if p.startswith("#"):
                summary_sec_flag = False
            else:
                continue
        if (
            p.startswith("Overall")
            or p.startswith("In summary")
            or p.startswith("In conclusion")
        ):
            continue
        if "# Summary" in p or "# Conclusion" in p:
            summary_sec_flag = True
            continue
        output_paragraphs.append(p)

    return "\n\n".join(output_paragraphs)  # Join with '\n\n' for markdown format.


def load_api_key(toml_file_path):
    try:
        with open(toml_file_path, "r") as file:
            data = toml.load(file)
    except FileNotFoundError:
        print(f"File not found: {toml_file_path}", file=sys.stderr)
        return
    except toml.TomlDecodeError:
        print(f"Error decoding TOML file: {toml_file_path}", file=sys.stderr)
        return
    # Set environment variables
    for key, value in data.items():
        os.environ[key] = str(value)


def construct_frontend_display_data(
    knowledge_base,
    conv_turn,
    is_warm_start: bool = False,
    next_turn_role: Optional[str] = None,
):
    def to_dict(node):
        if node is None:
            return None
        data = {
            "node_name": node.name,
            "node_uuid": " -> ".join(node.get_path_from_root()),
            "content": list(node.content),
            "child_node": [],
        }
        for child in node.children:
            child_data = to_dict(child)
            if child_data is not None:
                data["child_node"].append(child_data)
        return data

    def split_paragraph(paragraph):
        # Regular expression to match sentences with citations
        sentence_pattern = re.compile(r"([^.?!]*[.?!])(\s*\[\d+\])*")
        citation_pattern = re.compile(r"\[(\d+)\]")

        # Check if there are any sentence separators in the paragraph
        if not re.search(r"[.?!]", paragraph):
            # If no separators, consider the whole paragraph as a single sentence
            citations = list(map(int, citation_pattern.findall(paragraph)))
            sentence = citation_pattern.sub("", paragraph).strip()
            return [(sentence, citations)]

        sentences = []

        for match in sentence_pattern.finditer(paragraph):
            sentence_with_citations = match.group(0).strip()
            sentence = match.group(1).strip()
            citations = list(
                map(int, citation_pattern.findall(sentence_with_citations))
            )

            # Remove citations from the sentence
            sentence = citation_pattern.sub("", sentence).strip()

            sentences.append((sentence, citations))

        return sentences

    # get mind map
    mind_map = to_dict(knowledge_base.root)
    # get last turn utterance
    role = conv_turn.role
    utterance = str(conv_turn.utterance)
    sentences_w_citations = split_paragraph(utterance)

    # get cited info
    cited_info = {}
    for citation_idx, info in knowledge_base.info_uuid_to_info_dict.items():
        cited_info[citation_idx] = {
            "description": info.description,
            "snippets": info.snippets,
            "url": info.url,
            "title": info.title,
            "placement": info.meta.get("placement", ""),
        }
    evaluation_questions = None
    if conv_turn.role != "Guest":
        evaluation_questions = [
            {
                "question": "Does this new utterance help steer the discourse towards a new and interesting direction?",
                "type": "multiple_choice",
                "choices": ["Yes", "No"],
                "id": 1,
            },
            {
                "question": "Has the mind map reasonably managing the discourse so far?",
                "type": "multiple_choice",
                "choices": ["Yes", "No"],
                "id": 2,
            },
            {
                "question": "(Optional) Any comments?",
                "type": "freeform",
                "choices": [],
                "id": 3,
            },
        ]
    to_return = {
        "mind_map": mind_map,
        "conversation_turn": {
            "role": role,
            "content": sentences_w_citations,
            "is_warm_start": is_warm_start,
        },
        "cited_info": cited_info,
        "eval": evaluation_questions,
        "next_turn_role": next_turn_role,
    }
    return to_return


def construct_article_frontend_display_data(knowledge_base, article: str):
    cited_info = {
        key: value.to_dict()
        for key, value in knowledge_base.info_uuid_to_info_dict.items()
    }
    data = {"article": article, "cited_info": cited_info}
    return data


def construct_round_table_conversation_databackup(round_table_conversation):
    round_tabld_dump = round_table_conversation.to_dict()
    log_dump = round_table_conversation.logging_wrapper.dump_logging_and_reset(
        reset_logging=False
    )
    return {"round_tabld_dump": round_tabld_dump, "log_dump": log_dump}


def _get_answer_question_module_instance(
    lm_config: LMConfigs,
    runner_argument: "RunnerArgument",
    logging_wrapper: LoggingWrapper,
    rm: Optional[dspy.Retrieve] = None,
):
    from .grounded_question_answering import AnswerQuestionModule

    # configure retriever
    if rm is None:
        rm = BingSearch(k=runner_argument.retrieve_top_k)
    retriever = Retriever(rm=rm, max_thread=runner_argument.max_search_thread)
    # return AnswerQuestionModule instance
    return AnswerQuestionModule(
        retriever=retriever,
        max_search_queries=runner_argument.max_search_queries,
        question_answering_lm=lm_config.question_answering_lm,
        logging_wrapper=logging_wrapper,
    )
