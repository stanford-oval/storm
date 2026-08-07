import io
import json
import logging
import sys
import unittest
import warnings
from types import SimpleNamespace
from tempfile import TemporaryDirectory
from unittest.mock import patch

from knowledge_storm.rm import ArxivRM
from knowledge_storm.storm_wiki.modules.storm_dataclass import StormInformationTable


class PaperStormLoggingTest(unittest.TestCase):
    def test_wikipedia_toc_request_uses_user_agent_and_reports_http_errors(self):
        from knowledge_storm.storm_wiki.modules.persona_generator import (
            get_wiki_page_title_and_toc,
        )

        response = SimpleNamespace(
            content=b"Please set a user-agent",
            status_code=403,
            url="https://en.wikipedia.org/wiki/Passive_intermodulation",
            raise_for_status=lambda: (_ for _ in ()).throw(
                RuntimeError("403 Client Error")
            ),
        )

        with patch("requests.get", return_value=response) as mock_get:
            with self.assertRaisesRegex(RuntimeError, "403 Client Error"):
                get_wiki_page_title_and_toc(response.url)

        _, kwargs = mock_get.call_args
        self.assertIn("User-Agent", kwargs["headers"])
        self.assertGreater(len(kwargs["headers"]["User-Agent"]), 10)
        self.assertEqual(kwargs["timeout"], 10)

    def test_wikipedia_toc_reports_missing_title_cleanly(self):
        from knowledge_storm.storm_wiki.modules.persona_generator import (
            get_wiki_page_title_and_toc,
        )

        response = SimpleNamespace(
            content=b"<html><body>No article title</body></html>",
            status_code=200,
            url="https://en.wikipedia.org/wiki/Missing",
            raise_for_status=lambda: None,
        )

        with patch("requests.get", return_value=response):
            with self.assertRaisesRegex(ValueError, "no h1 title"):
                get_wiki_page_title_and_toc(response.url)

    def test_paperstorm_logging_filters_noisy_provider_warnings(self):
        from examples.storm_examples.run_paper_storm_minimax import (
            configure_paperstorm_logging,
        )

        configure_paperstorm_logging(verbose=False)

        with warnings.catch_warnings(record=True) as caught:
            configure_paperstorm_logging(verbose=False)
            warnings.warn("Pydantic serializer warnings:\n noisy", UserWarning)
            warnings.warn("important warning", UserWarning)

        messages = [str(item.message) for item in caught]
        self.assertNotIn("Pydantic serializer warnings:\n noisy", messages)
        self.assertIn("important warning", messages)
        self.assertEqual(logging.getLogger("LiteLLM").level, logging.WARNING)

    def test_paperstorm_logging_filters_litellm_provider_stdout(self):
        from examples.storm_examples.run_paper_storm_minimax import (
            PaperStormStdoutFilter,
            configure_paperstorm_logging,
        )

        original_stdout = sys.stdout
        try:
            configure_paperstorm_logging(verbose=False)
            self.assertIsInstance(sys.stdout, PaperStormStdoutFilter)
            noisy_line = "Provider List: https://docs.litellm.ai/docs/providers\n"
            self.assertEqual(sys.stdout.write(noisy_line), len(noisy_line))
        finally:
            sys.stdout = original_stdout

    def test_arxiv_rm_logs_query_failures_without_error_level(self):
        rm = ArxivRM(k=1)
        rm.request = lambda query: (_ for _ in ()).throw(RuntimeError("rate limited"))

        with self.assertLogs("knowledge_storm.rm", level="INFO") as logs:
            results = rm.forward("passive intermodulation")

        self.assertEqual(results, [])
        self.assertTrue(any("Skipping failed arXiv query" in line for line in logs.output))
        self.assertFalse(any("ERROR" in line for line in logs.output))

    def test_paperstorm_logging_filters_legacy_wikipedia_errors(self):
        from examples.storm_examples.run_paper_storm_minimax import (
            configure_paperstorm_logging,
        )

        stream = io.StringIO()
        handler = logging.StreamHandler(stream)
        root_logger = logging.getLogger()
        root_logger.addHandler(handler)
        try:
            configure_paperstorm_logging(verbose=False)
            logging.error(
                "Error occurs when processing "
                "https://en.wikipedia.org/wiki/Passive_intermodulation: "
                "'NoneType' object has no attribute 'text'"
            )
        finally:
            root_logger.removeHandler(handler)

        self.assertEqual(stream.getvalue(), "")

    def test_empty_information_table_retrieval_returns_no_information(self):
        table = StormInformationTable(conversations=[])
        table.prepare_table_for_retrieval()

        self.assertEqual(
            table.retrieve_information("cnn network architecture", search_top_k=3),
            [],
        )

    def test_trace_recorder_writes_jsonl_events_and_summary(self):
        from examples.storm_examples.run_paper_storm_minimax import (
            PaperStormTraceRecorder,
        )

        with TemporaryDirectory() as tmpdir:
            trace = PaperStormTraceRecorder(tmpdir)
            trace.emit("run_start", topic="PIM")
            trace.emit("artifact_written", path="storm_gen_outline.txt")
            trace.write_summary(success=True, artifacts=["storm_gen_outline.txt"])

            with open(trace.trace_path, encoding="utf-8") as f:
                events = [json.loads(line) for line in f.read().splitlines()]
            with open(trace.summary_path, encoding="utf-8") as f:
                summary = json.load(f)

        self.assertEqual(
            [event["event"] for event in events],
            ["run_start", "artifact_written"],
        )
        self.assertEqual(events[0]["topic"], "PIM")
        self.assertTrue(summary["success"])
        self.assertEqual(summary["artifacts"], ["storm_gen_outline.txt"])

    def test_traced_retrieval_model_records_success_and_error(self):
        from examples.storm_examples.run_paper_storm_minimax import (
            PaperStormTraceRecorder,
            TracedRetrievalModel,
        )

        class DummyRM:
            def __init__(self):
                self.fail = False

            def __call__(self, query_or_queries, exclude_urls=None):
                if self.fail:
                    raise RuntimeError("boom")
                return [{"url": "u", "title": "t", "description": "d", "snippets": ["s"]}]

        with TemporaryDirectory() as tmpdir:
            recorder = PaperStormTraceRecorder(tmpdir)
            rm = DummyRM()
            traced = TracedRetrievalModel(rm, recorder, retriever_name="DummyRM")

            self.assertEqual(len(traced(query_or_queries=["pim"])), 1)
            rm.fail = True
            with self.assertRaises(RuntimeError):
                traced(query_or_queries=["bad"])

            with open(recorder.trace_path, encoding="utf-8") as f:
                events = [json.loads(line) for line in f.read().splitlines()]

        self.assertEqual(
            [event["event"] for event in events],
            [
                "tool_start",
                "retrieval_start",
                "retrieval_end",
                "tool_end",
                "tool_start",
                "retrieval_start",
                "retrieval_error",
                "tool_error",
            ],
        )
        self.assertEqual(events[0]["tool_name"], "DummyRM")
        self.assertEqual(events[1]["queries"], ["pim"])
        self.assertEqual(events[2]["result_count"], 1)
        self.assertEqual(events[7]["error_type"], "RuntimeError")


if __name__ == "__main__":
    unittest.main()
