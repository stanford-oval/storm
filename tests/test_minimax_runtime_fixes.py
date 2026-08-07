import unittest
from pathlib import Path
from tempfile import TemporaryDirectory

from knowledge_storm.interface import LMConfigs
from knowledge_storm.rm import DuckDuckGoSearchRM
from knowledge_storm.storm_wiki.modules.knowledge_curation import clean_search_queries
from knowledge_storm.utils import FileIOHelper
from examples.storm_examples.run_storm_wiki_minimax import (
    get_output_dir_name,
    get_topic_for_storm,
    strip_invalid_unicode,
)


class DummyLM:
    kwargs = {
        "api_key": "secret-key",
        "api_base": "https://example.test/v1",
        "max_tokens": 500,
        "temperature": 0.3,
    }


class DummyLMConfigs(LMConfigs):
    def __init__(self):
        self.test_lm = DummyLM()


class MinimaxRuntimeFixesTest(unittest.TestCase):
    def test_lm_config_log_redacts_api_credentials(self):
        log = DummyLMConfigs().log()

        self.assertEqual(log["test_lm"]["api_key"], "<redacted>")
        self.assertEqual(log["test_lm"]["api_base"], "https://example.test/v1")
        self.assertEqual(log["test_lm"]["max_tokens"], 500)
        self.assertNotIn("secret-key", str(log))
        self.assertEqual(log["test_lm"]["temperature"], 0.3)

    def test_duckduckgo_forward_accepts_modern_text_results(self):
        rm = DuckDuckGoSearchRM(k=2)
        rm.request = lambda query: [
            {
                "title": "Retrieval-augmented generation",
                "href": "https://example.test/rag",
                "body": "Retrieval-augmented generation combines retrieval and text generation.",
            }
        ]

        results = rm.forward("what is RAG")

        self.assertEqual(
            results,
            [
                {
                    "url": "https://example.test/rag",
                    "title": "Retrieval-augmented generation",
                    "description": "Retrieval-augmented generation",
                    "snippets": [
                        "Retrieval-augmented generation combines retrieval and text generation."
                    ],
                }
            ],
        )

    def test_minimax_example_keeps_original_topic_for_storm_by_default(self):
        topic = "RAG，请用中文撰写调研报告"

        self.assertEqual(get_topic_for_storm(topic), topic)

    def test_minimax_example_can_request_simplified_chinese_output(self):
        topic = get_topic_for_storm("RAG", output_language="zh")

        self.assertIn("RAG", topic)
        self.assertIn("Simplified Chinese", topic)
        self.assertIn("final article", topic)

    def test_strip_invalid_unicode_removes_surrogates(self):
        text = "RAG\udcff report"

        self.assertEqual(strip_invalid_unicode(text), "RAG report")

    def test_minimax_example_uses_safe_output_dir_name(self):
        topic_for_storm = get_topic_for_storm("RAG", output_language="zh")

        self.assertIn("\n", topic_for_storm)
        self.assertEqual(get_output_dir_name("RAG"), "RAG")

    def test_clean_search_queries_removes_empty_queries(self):
        raw_queries = "- RAG 原理\n-\n  \n- vector database"

        self.assertEqual(
            clean_search_queries(raw_queries, max_search_queries=3),
            ["RAG 原理", "vector database"],
        )

    def test_clean_search_queries_removes_structured_output_noise(self):
        raw_queries = """```json
queries": [
CNN 卷积神经网络 原理 结构
CNN network architecture explanation
以下是根据您的需求，从行动规划角度转化的搜索查询：
**Queries:**
```markdown
好的，作为理论基础专家，我将生成用于搜索引擎的高效查询语句。
GoogLeNet Inception module 2014
]
```"""

        self.assertEqual(
            clean_search_queries(raw_queries, max_search_queries=4),
            [
                "CNN 卷积神经网络 原理 结构",
                "CNN network architecture explanation",
                "GoogLeNet Inception module 2014",
            ],
        )

    def test_write_str_uses_utf8(self):
        with TemporaryDirectory() as tmpdir:
            path = Path(tmpdir) / "article.txt"

            FileIOHelper.write_str("检索增强生成", path)

            self.assertEqual(path.read_bytes().decode("utf-8"), "检索增强生成")


if __name__ == "__main__":
    unittest.main()
