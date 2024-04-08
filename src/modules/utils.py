import functools
import json
import logging
import operator
import os
import pickle
import re
import sys
import threading
from collections import OrderedDict, Counter
from typing import Optional, Union, Literal, Any, List

import toml

import dspy


class MyOpenAIModel(dspy.OpenAI):
    """A wrapper class for dspy.OpenAI to track token usage."""

    def __init__(
            self,
            model: str = "gpt-3.5-turbo-instruct",
            api_key: Optional[str] = None,
            api_provider: Literal["openai", "azure"] = "openai",
            api_base: Optional[str] = None,
            model_type: Literal["chat", "text"] = None,
            **kwargs
    ):
        super().__init__(model=model, api_key=api_key, api_provider=api_provider, api_base=api_base,
                         model_type=model_type, **kwargs)
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def log_usage(self, response):
        """Log the total tokens from the OpenAI API response."""
        usage_data = response.get('usage')
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.get('prompt_tokens', 0)
                self.completion_tokens += usage_data.get('completion_tokens', 0)

    def get_usage_and_reset(self):
        """Get the total tokens used and reset the token usage."""
        usage = {
            self.kwargs.get('model') or self.kwargs.get('engine'):
                {'prompt_tokens': self.prompt_tokens, 'completion_tokens': self.completion_tokens}
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0

        return usage

    def __call__(
            self,
            prompt: str,
            only_completed: bool = True,
            return_sorted: bool = False,
            **kwargs,
    ) -> list[dict[str, Any]]:
        """Copied from dspy/dsp/modules/gpt3.py with the addition of tracking token usage."""

        assert only_completed, "for now"
        assert return_sorted is False, "for now"

        # if kwargs.get("n", 1) > 1:
        #     if self.model_type == "chat":
        #         kwargs = {**kwargs}
        #     else:
        #         kwargs = {**kwargs, "logprobs": 5}

        response = self.request(prompt, **kwargs)

        # Log the token usage from the OpenAI API response.
        self.log_usage(response)

        choices = response["choices"]

        completed_choices = [c for c in choices if c["finish_reason"] != "length"]

        if only_completed and len(completed_choices):
            choices = completed_choices

        completions = [self._get_choice_text(c) for c in choices]
        if return_sorted and kwargs.get("n", 1) > 1:
            scored_completions = []

            for c in choices:
                tokens, logprobs = (
                    c["logprobs"]["tokens"],
                    c["logprobs"]["token_logprobs"],
                )

                if "<|endoftext|>" in tokens:
                    index = tokens.index("<|endoftext|>") + 1
                    tokens, logprobs = tokens[:index], logprobs[:index]

                avglog = sum(logprobs) / len(logprobs)
                scored_completions.append((avglog, self._get_choice_text(c)))

            scored_completions = sorted(scored_completions, reverse=True)
            completions = [c for _, c in scored_completions]

        return completions


class LLMConfigs:
    """Configurations for LLM used in different parts of STORM.

    Given that different parts in STORM framework have different complexity, we use different LLM configurations
    to achieve a balance between quality and efficiency. If no specific configuration is provided, we use the default
    setup in the paper.
    """

    def __init__(self):
        self.conv_simulator_lm = None  # LLM used in conversation simulator except for question asking.
        self.question_asker_lm = None  # LLM used in question asking.
        self.outline_gen_lm = None  # LLM used in outline generation.
        self.article_gen_lm = None  # LLM used in article generation.
        self.article_polish_lm = None  # LLM used in article polishing.

    def init_openai_model(
            self,
            openai_api_key: str,
            openai_type: Literal["openai", "azure"],
            api_base: Optional[str] = None,
            api_version: Optional[str] = None,
            temperature: Optional[float] = 1.0,
            top_p: Optional[float] = 0.9
    ):
        openai_kwargs = {
            'api_key': openai_api_key,
            'api_provider': openai_type,
            'temperature': temperature,
            'top_p': top_p,
            'api_base': None,
            'api_version': None,
        }
        if openai_type and openai_type == 'azure':
            openai_kwargs['api_base'] = api_base
            openai_kwargs['api_version'] = api_version

            self.conv_simulator_lm = MyOpenAIModel(model='gpt-35-turbo-instruct', engine='gpt-35-turbo-instruct',
                                                   max_tokens=500, **openai_kwargs)
            self.question_asker_lm = MyOpenAIModel(model='gpt-35-turbo', engine='gpt-35-turbo',
                                                   max_tokens=500, **openai_kwargs)
            self.outline_gen_lm = MyOpenAIModel(model='gpt-4', engine='gpt-4',
                                                max_tokens=400, **openai_kwargs)
            self.article_gen_lm = MyOpenAIModel(model='gpt-4', engine='gpt-4',
                                                max_tokens=700, **openai_kwargs)
            self.article_polish_lm = MyOpenAIModel(model='gpt-4-32k', engine='gpt-4-32k',
                                                   max_tokens=4000, **openai_kwargs)
        elif openai_type and openai_type == 'openai':
            self.conv_simulator_lm = MyOpenAIModel(model='gpt-3.5-turbo-instruct',
                                                   max_tokens=500, **openai_kwargs)
            self.question_asker_lm = MyOpenAIModel(model='gpt-3.5-turbo',
                                                   max_tokens=500, **openai_kwargs)
            # 1/12/2024: Update gpt-4 to gpt-4-1106-preview. (Currently keep the original setup when using azure.)
            self.outline_gen_lm = MyOpenAIModel(model='gpt-4-0125-preview',
                                                max_tokens=400, **openai_kwargs)
            self.article_gen_lm = MyOpenAIModel(model='gpt-4-0125-preview',
                                                max_tokens=700, **openai_kwargs)
            self.article_polish_lm = MyOpenAIModel(model='gpt-4-0125-preview',
                                                   max_tokens=4000, **openai_kwargs)
        else:
            logging.warning('No valid OpenAI API provider is provided. Cannot use default LLM configurations.')

    def set_conv_simulator_lm(self, model: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.conv_simulator_lm = model

    def set_question_asker_lm(self, model: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.question_asker_lm = model

    def set_outline_gen_lm(self, model: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.outline_gen_lm = model

    def set_article_gen_lm(self, model: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.article_gen_lm = model

    def set_article_polish_lm(self, model: Union[dspy.dsp.LM, dspy.dsp.HFModel]):
        self.article_polish_lm = model

    def collect_and_reset_lm_history(self):
        history = []
        if self.conv_simulator_lm:
            history.extend(self.conv_simulator_lm.history)
            self.conv_simulator_lm.history = []
        if self.question_asker_lm:
            history.extend(self.question_asker_lm.history)
            self.question_asker_lm.history = []
        if self.outline_gen_lm:
            history.extend(self.outline_gen_lm.history)
            self.outline_gen_lm.history = []
        if self.article_gen_lm:
            history.extend(self.article_gen_lm.history)
            self.article_gen_lm.history = []
        if self.article_polish_lm:
            history.extend(self.article_polish_lm.history)
            self.article_polish_lm.history = []

        return history

    def collect_and_reset_lm_usage(self):
        combined_usage = []
        if self.conv_simulator_lm:
            combined_usage.append(self.conv_simulator_lm.get_usage_and_reset())
        if self.question_asker_lm:
            combined_usage.append(self.question_asker_lm.get_usage_and_reset())
        if self.outline_gen_lm:
            combined_usage.append(self.outline_gen_lm.get_usage_and_reset())
        if self.article_gen_lm:
            combined_usage.append(self.article_gen_lm.get_usage_and_reset())
        if self.article_polish_lm:
            combined_usage.append(self.article_polish_lm.get_usage_and_reset())
        combined_usage = dict(functools.reduce(operator.add, map(Counter, combined_usage)))

        return combined_usage

    def log(self):
        return OrderedDict(
            {
                'conv_simulator_lm': self.conv_simulator_lm.kwargs if self.conv_simulator_lm else None,
                'question_asker_lm': self.question_asker_lm.kwargs if self.question_asker_lm else None,
                'outline_gen_lm': self.outline_gen_lm.kwargs if self.outline_gen_lm else None,
                'article_gen_lm': self.article_gen_lm.kwargs if self.article_gen_lm else None,
                'article_polish_lm': self.article_polish_lm.kwargs if self.article_polish_lm else None,
            }
        )


class DialogueTurn:
    def __init__(
            self,
            agent_utterance: str = None,
            user_utterance: str = None,
            search_queries: Optional[List[str]] = None,
            search_results: Optional[List[dict[str, Any]]] = None
    ):
        self.agent_utterance = agent_utterance
        self.user_utterance = user_utterance
        self.search_queries = search_queries
        self.search_results = search_results

    def log(self):
        """
        Returns a json object that contains all information inside `self`
        """

        return OrderedDict(
            {
                'agent_utterance': self.agent_utterance,
                'user_utterance': self.user_utterance,
                'search_queries': self.search_queries,
                'search_results': self.search_results,
            }
        )


class BaseCallbackHandler:
    """Base callback handler that can be used to handle callbacks from the STORM pipeline."""

    def on_identify_perspective_start(self, **kwargs):
        """Run when the perspective identification starts."""
        pass

    def on_identify_perspective_end(self, perspectives: list[str], **kwargs):
        """Run when the perspective identification finishes."""
        pass

    def on_information_gathering_start(self, **kwargs):
        """Run when the information gathering starts."""
        pass

    def on_dialogue_turn_end(self, dlg_turn: DialogueTurn, **kwargs):
        """Run when a question asking and answering turn finishes."""
        pass

    def on_information_gathering_end(self, **kwargs):
        """Run when the information gathering finishes."""
        pass

    def on_information_organization_start(self, **kwargs):
        """Run when the information organization starts."""
        pass

    def on_direct_outline_generation_end(self, outline: str, **kwargs):
        """Run when the direct outline generation finishes."""
        pass

    def on_outline_refinement_end(self, outline: str, **kwargs):
        """Run when the outline refinement finishes."""
        pass


###############################################
# Helper functions for reading and writing files
###############################################


def dump_pickle(obj, path):
    with open(path, 'wb') as f:
        pickle.dump(obj, f)


def load_pickle(path):
    with open(path, 'rb') as f:
        return pickle.load(f)


def write_str(s, path):
    with open(path, 'w') as f:
        f.write(s)


def load_str(path):
    with open(path, 'r') as f:
        return '\n'.join(f.readlines())


def handle_non_serializable(obj):
    return "non-serializable contents"  # mark the non-serializable part


def load_json(file_name, encoding="utf-8"):
    with open(file_name, 'r', encoding=encoding) as fr:
        return json.load(fr)


def dump_json(obj, file_name, encoding="utf-8"):
    with open(file_name, 'w', encoding=encoding) as fw:
        json.dump(obj, fw, default=handle_non_serializable)


###############################################
# Helper functions for post-processing generated text
###############################################


def remove_citations(s):
    """Remove citations from a string."""

    return re.sub(r'\[\d+\]', '', s)


def limit_word_count_preserve_newline(input_string, max_word_count):
    """Limit the word count of a string while preserving complete lines."""

    word_count = 0
    limited_string = ''

    for word in input_string.split('\n'):
        line_words = word.split()
        for lw in line_words:
            if word_count < max_word_count:
                limited_string += lw + ' '
                word_count += 1
            else:
                break
        if word_count >= max_word_count:
            break
        limited_string = limited_string.strip() + '\n'

    return limited_string.strip()


def remove_uncompleted_sentences_with_citations(text):
    """Remove uncompleted sentences with citations from a string.

    The expected format of citation is '[1]', '[2]', etc.
    """

    # Convert citations like [1, 2, 3] to [1][2][3].
    def replace_with_individual_brackets(match):
        numbers = match.group(1).split(', ')
        return ' '.join(f'[{n}]' for n in numbers)

    # Deduplicate and sort individual groups of citations.
    def deduplicate_group(match):
        citations = match.group(0)
        unique_citations = list(set(re.findall(r'\[\d+\]', citations)))
        sorted_citations = sorted(unique_citations, key=lambda x: int(x.strip('[]')))
        # Return the sorted unique citations as a string
        return ''.join(sorted_citations)

    text = re.sub(r'\[([0-9, ]+)\]', replace_with_individual_brackets, text)
    text = re.sub(r'(\[\d+\])+', deduplicate_group, text)

    # Deprecated: Remove sentence without proper ending punctuation and citations.
    # Split the text into sentences (including citations).
    # sentences_with_trailing = re.findall(r'([^.!?]*[.!?].*?)(?=[^.!?]*[.!?]|$)', text)

    # Filter sentences to ensure they end with a punctuation mark and properly formatted citations
    # complete_sentences = []
    # for sentence in sentences_with_trailing:
    #     # Check if the sentence ends with properly formatted citations
    #     if re.search(r'[.!?]( \[\d+\])*$|^[^.!?]*[.!?]$', sentence.strip()):
    #         complete_sentences.append(sentence.strip())

    # combined_sentences = ' '.join(complete_sentences)

    # Check for and append any complete citations that follow the last sentence
    # trailing_citations = re.findall(r'(\[\d+\]) ', text[text.rfind(combined_sentences) + len(combined_sentences):])
    # if trailing_citations:
    #     combined_sentences += ' '.join(trailing_citations)

    # Regex pattern to match sentence endings, including optional citation markers.
    eos_pattern = r'([.!?])\s*(\[\d+\])?\s*'
    matches = list(re.finditer(eos_pattern, text))
    if matches:
        last_match = matches[-1]
        text = text[:last_match.end()].strip()

    return text


def clean_up_section(text):
    """Clean up a section:
     1. Remove uncompleted sentences (usually due to output token limitation).
     2. Deduplicate individual groups of citations.
     3. Remove unnecessary summary."""

    paragraphs = text.split('\n')
    output_paragraphs = []
    summary_sec_flag = False
    for p in paragraphs:
        p = p.strip()
        if len(p) == 0:
            continue
        if not p.startswith('#'):
            p = remove_uncompleted_sentences_with_citations(p)
        if summary_sec_flag:
            if p.startswith('#'):
                summary_sec_flag = False
            else:
                continue
        if p.startswith('Overall') or p.startswith('In summary') or p.startswith('In conclusion'):
            continue
        if "# Summary" in p or '# Conclusion' in p:
            summary_sec_flag = True
            continue
        output_paragraphs.append(p)

    return '\n\n'.join(output_paragraphs)  # Join with '\n\n' for markdown format.


def process_table_of_contents(toc):
    """Convert a table of contents into a tree structure.

    The table of contents is a string with each line representing a heading.
    "#" Title"  indicates section title, "##" Title" to indication subsection title, "###" Title" to indicate subsubsection title, and so on.
    """
    lines = toc.split('\n')

    root = {}
    path = [(root, -1)]

    for line in lines:
        line = line.strip()
        if not line.startswith('#'):
            continue

        # Count only the leading '#' symbols
        level = 0
        for char in line:
            if char == '#':
                level += 1
            else:
                break

        heading = line[level:].strip()
        if len(heading) == 0:
            continue
        while path and path[-1][1] >= level:
            path.pop()

        # Add the new heading
        if path:
            current_dict = path[-1][0]
            current_dict[heading] = {}
            path.append((current_dict[heading], level))

    return root


def convert_outline_into_queries(root):
    queries = []
    for k in root:
        queries.extend(convert_outline_into_queries(root[k]))
        queries.append(k)

    return queries


def convert_outline_into_str(root, level):
    s = ''
    for k in root:
        s += '#' * level + ' ' + k + '\n'
        s += convert_outline_into_str(root[k], level + 1)

    return s


def update_citation_index(s, citation_map):
    """Update citation index in the string based on the citation map."""
    for original_citation in citation_map:
        s = s.replace(f"[{original_citation}]", f"__PLACEHOLDER_{original_citation}__")
    for original_citation, unify_citation in citation_map.items():
        s = s.replace(f"__PLACEHOLDER_{original_citation}__", f"[{unify_citation}]")

    return s


def clean_up_outline(outline, topic=""):
    output_lines = []
    current_level = 0  # To track the current section level

    for line in outline.split('\n'):
        stripped_line = line.strip()

        if topic != "" and f"# {topic.lower()}" in stripped_line.lower():
            output_lines = []

        # Check if the line is a section header
        if stripped_line.startswith('#'):
            current_level = stripped_line.count('#')
            output_lines.append(stripped_line)
        # Check if the line is a bullet point
        elif stripped_line.startswith('-'):
            subsection_header = '#' * (current_level + 1) + ' ' + stripped_line[1:].strip()
            output_lines.append(subsection_header)

    outline = '\n'.join(output_lines)

    # Remove references.
    outline = re.sub(r"#[#]? See also.*?(?=##|$)", '', outline, flags=re.DOTALL)
    outline = re.sub(r"#[#]? See Also.*?(?=##|$)", '', outline, flags=re.DOTALL)
    outline = re.sub(r"#[#]? Notes.*?(?=##|$)", '', outline, flags=re.DOTALL)
    outline = re.sub(r"#[#]? References.*?(?=##|$)", '', outline, flags=re.DOTALL)
    outline = re.sub(r"#[#]? External links.*?(?=##|$)", '', outline, flags=re.DOTALL)
    outline = re.sub(r"#[#]? External Links.*?(?=##|$)", '', outline, flags=re.DOTALL)
    outline = re.sub(r"#[#]? Bibliography.*?(?=##|$)", '', outline, flags=re.DOTALL)
    outline = re.sub(r"#[#]? Further reading*?(?=##|$)", '', outline, flags=re.DOTALL)
    outline = re.sub(r"#[#]? Further Reading*?(?=##|$)", '', outline, flags=re.DOTALL)
    outline = re.sub(r"#[#]? Summary.*?(?=##|$)", '', outline, flags=re.DOTALL)
    outline = re.sub(r"#[#]? Appendices.*?(?=##|$)", '', outline, flags=re.DOTALL)
    outline = re.sub(r"#[#]? Appendix.*?(?=##|$)", '', outline, flags=re.DOTALL)

    return outline


def clean_up_citation(conv):
    for turn in conv.dlg_history:
        turn.agent_utterance = turn.agent_utterance[:turn.agent_utterance.find('References:')]
        turn.agent_utterance = turn.agent_utterance[:turn.agent_utterance.find('Sources:')]
        turn.agent_utterance = turn.agent_utterance.replace('Answer:', '').strip()
        try:
            max_ref_num = max([int(x) for x in re.findall(r'\[(\d+)\]', turn.agent_utterance)])
        except Exception as e:
            max_ref_num = 0
        if max_ref_num > len(turn.search_results):
            for i in range(len(turn.search_results), max_ref_num + 1):
                turn.agent_utterance = turn.agent_utterance.replace(f'[{i}]', '')
        turn.agent_utterance = remove_uncompleted_sentences_with_citations(turn.agent_utterance)

    return conv


def unify_citations_across_sections(sections, search_results):
    url_to_unified_index = {}
    url_to_info = {}
    current_index = 1
    updated_sections = []

    for section, search_result in zip(sections, search_results):
        citation_map = {}
        references = set([int(x) for x in re.findall(r'\[(\d+)\]', section)])
        if len(references) > 0:
            max_ref_num = max(references)
            if max_ref_num > len(search_result):
                print(f'Max ref num: {max_ref_num}, #Searched articles: {len(search_result)}')
                for i in range(len(search_result), max_ref_num + 1):
                    section = section.replace(f'[{i}]', '')
                    if i in references:
                        references.remove(i)

        for original_citation in references:
            url = search_result[original_citation - 1]['url']
            if url not in url_to_unified_index:
                url_to_unified_index[url] = current_index
                current_index += 1
                url_to_info[url] = search_result[original_citation - 1]
                citation_map[original_citation] = url_to_unified_index[url]
            else:
                citation_map[original_citation] = url_to_unified_index[url]
                url_to_info[url]['snippets'].extend(search_result[original_citation - 1]['snippets'])
        updated_section = update_citation_index(section, citation_map)
        updated_sections.append(updated_section)

    for url in url_to_info:
        url_to_info[url]['snippets'] = list(set(url_to_info[url]['snippets']))

    return updated_sections, url_to_unified_index, url_to_info


###############################################
# Helper functions for running STORM
###############################################

def load_api_key(toml_file_path='../secrets.toml'):
    try:
        with open(toml_file_path, 'r') as file:
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
