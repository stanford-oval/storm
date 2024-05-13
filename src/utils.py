import concurrent.futures
import json
import os
import pickle
import re
import sys
from typing import List, Dict

import httpx
import toml
from langchain_text_splitters import RecursiveCharacterTextSplitter
from trafilatura import extract


def load_api_key(toml_file_path):
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


def makeStringRed(message):
    return f"\033[91m {message}\033[00m"


class ArticleTextProcessing:
    @staticmethod
    def limit_word_count_preserve_newline(input_string, max_word_count):
        """
        Limit the word count of an input string to a specified maximum, while preserving the integrity of complete lines.

        The function truncates the input string at the nearest word that does not exceed the maximum word count,
        ensuring that no partial lines are included in the output. Words are defined as text separated by spaces,
        and lines are defined as text separated by newline characters.

        Args:
            input_string (str): The string to be truncated. This string may contain multiple lines.
            max_word_count (int): The maximum number of words allowed in the truncated string.

        Returns:
            str: The truncated string with word count limited to `max_word_count`, preserving complete lines.
        """

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

    @staticmethod
    def remove_citations(s):
        """
        Removes all citations from a given string. Citations are assumed to be in the format
        of numbers enclosed in square brackets, such as [1], [2], or [1, 2], etc. This function searches
        for all occurrences of such patterns and removes them, returning the cleaned string.

        Args:
            s (str): The string from which citations are to be removed.

        Returns:
            str: The string with all citation patterns removed.
        """

        return re.sub(r'\[\d+(?:,\s*\d+)*\]', '', s)

    @staticmethod
    def parse_citation_indices(s):
        """
        Extracts citation indexes from the provided content string and returns them as a list of integers.

        Args:
            content (str): The content string containing citations in the format [number].

        Returns:
            List[int]: A list of unique citation indexes extracted from the content, in the order they appear.
        """
        matches = re.findall(r'\[\d+\]', s)
        return [int(index[1:-1]) for index in matches]

    @staticmethod
    def remove_uncompleted_sentences_with_citations(text):
        """
        Removes uncompleted sentences and standalone citations from the input text. Sentences are identified
        by their ending punctuation (.!?), optionally followed by a citation in square brackets (e.g., "[1]").
        Grouped citations (e.g., "[1, 2]") are split into individual ones (e.g., "[1] [2]"). Only text up to
        and including the last complete sentence and its citation is retained.

        Args:
            text (str): The input text from which uncompleted sentences and their citations are to be removed.

        Returns:
            str: The processed string with uncompleted sentences and standalone citations removed, leaving only
            complete sentences and their associated citations if present.
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

    @staticmethod
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
            turn.agent_utterance = ArticleTextProcessing.remove_uncompleted_sentences_with_citations(
                turn.agent_utterance)

        return conv

    @staticmethod
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

    @staticmethod
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
                p = ArticleTextProcessing.remove_uncompleted_sentences_with_citations(p)
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

    @staticmethod
    def update_citation_index(s, citation_map):
        """Update citation index in the string based on the citation map."""
        for original_citation in citation_map:
            s = s.replace(f"[{original_citation}]", f"__PLACEHOLDER_{original_citation}__")
        for original_citation, unify_citation in citation_map.items():
            s = s.replace(f"__PLACEHOLDER_{original_citation}__", f"[{unify_citation}]")

        return s

    @staticmethod
    def parse_article_into_dict(input_string):
        """
        Parses a structured text into a nested dictionary. The structure of the text
        is defined by markdown-like headers (using '#' symbols) to denote sections
        and subsections. Each section can contain content and further nested subsections.

        The resulting dictionary captures the hierarchical structure of sections, where
        each section is represented as a key (the section's title) mapping to a value
        that is another dictionary. This dictionary contains two keys:
        - 'content': content of the section
        - 'subsections': a list of dictionaries, each representing a nested subsection
        following the same structure.

        Args:
            input_string (str): A string containing the structured text to parse.

        Returns:
            A dictionary representing contains the section title as the key, and another dictionary
        as the value, which includes the 'content' and 'subsections' keys as described above.
        """
        lines = input_string.split('\n')
        lines = [line for line in lines if line.strip()]
        root = {'content': '', 'subsections': {}}
        current_path = [(root, -1)]  # (current_dict, level)

        for line in lines:
            if line.startswith('#'):
                level = line.count('#')
                title = line.strip('# ').strip()
                new_section = {'content': '', 'subsections': {}}

                # Pop from stack until find the parent level
                while current_path and current_path[-1][1] >= level:
                    current_path.pop()

                # Append new section to the nearest upper level's subsections
                current_path[-1][0]['subsections'][title] = new_section
                current_path.append((new_section, level))
            else:
                current_path[-1][0]['content'] += line + '\n'

        return root['subsections']


class FileIOHelper:
    @staticmethod
    def dump_json(obj, file_name, encoding="utf-8"):
        with open(file_name, 'w', encoding=encoding) as fw:
            json.dump(obj, fw, default=FileIOHelper.handle_non_serializable)

    @staticmethod
    def handle_non_serializable(obj):
        return "non-serializable contents"  # mark the non-serializable part

    @staticmethod
    def load_json(file_name, encoding="utf-8"):
        with open(file_name, 'r', encoding=encoding) as fr:
            return json.load(fr)

    @staticmethod
    def write_str(s, path):
        with open(path, 'w') as f:
            f.write(s)

    @staticmethod
    def load_str(path):
        with open(path, 'r') as f:
            return '\n'.join(f.readlines())

    @staticmethod
    def dump_pickle(obj, path):
        with open(path, 'wb') as f:
            pickle.dump(obj, f)

    @staticmethod
    def load_pickle(path):
        with open(path, 'rb') as f:
            return pickle.load(f)


class WebPageHelper:
    """Helper class to process web pages.

    Acknowledgement: Part of the code is adapted from https://github.com/stanford-oval/WikiChat project.
    """

    def __init__(self, min_char_count: int = 150, snippet_chunk_size: int = 1000, max_thread_num: int = 10):
        """
        Args:
            min_char_count: Minimum character count for the article to be considered valid.
            snippet_chunk_size: Maximum character count for each snippet.
            max_thread_num: Maximum number of threads to use for concurrent requests (e.g., downloading webpages).
        """
        self.httpx_client = httpx.Client(verify=False)
        self.min_char_count = min_char_count
        self.max_thread_num = max_thread_num
        self.text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=snippet_chunk_size,
            chunk_overlap=0,
            length_function=len,
            is_separator_regex=False,
            separators=[
                "\n\n",
                "\n",
                ".",
                "\uff0e",  # Fullwidth full stop
                "\u3002",  # Ideographic full stop
                ",",
                "\uff0c",  # Fullwidth comma
                "\u3001",  # Ideographic comma
                " ",
                "\u200B",  # Zero-width space
                "",
            ],
        )

    def download_webpage(self, url: str):
        try:
            res = self.httpx_client.get(url, timeout=4)
            if res.status_code >= 400:
                res.raise_for_status()
            return res.content
        except httpx.HTTPError as exc:
            print(f"Error while requesting {exc.request.url!r} - {exc!r}")
            return None

    def urls_to_articles(self, urls: List[str]) -> Dict:
        with concurrent.futures.ThreadPoolExecutor(max_workers=self.max_thread_num) as executor:
            htmls = list(executor.map(self.download_webpage, urls))

        articles = {}

        for h, u in zip(htmls, urls):
            if h is None:
                continue
            article_text = extract(
                h,
                include_tables=False,
                include_comments=False,
                output_format="text",
            )
            if article_text is not None and len(article_text) > self.min_char_count:
                articles[u] = {"text": article_text}

        return articles

    def urls_to_snippets(self, urls: List[str]) -> Dict:
        articles = self.urls_to_articles(urls)
        for u in articles:
            articles[u]["snippets"] = self.text_splitter.split_text(articles[u]["text"])

        return articles
