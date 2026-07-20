import unittest
from types import SimpleNamespace

from knowledge_storm.rm import ArxivRM, LocalPDFRM


ARXIV_SAMPLE = """<?xml version="1.0" encoding="UTF-8"?>
<feed xmlns="http://www.w3.org/2005/Atom"
      xmlns:arxiv="http://arxiv.org/schemas/atom">
  <entry>
    <id>http://arxiv.org/abs/2401.12345v1</id>
    <updated>2024-01-02T00:00:00Z</updated>
    <published>2024-01-01T00:00:00Z</published>
    <title>Retrieval Augmented Generation Evaluation</title>
    <summary>
      This paper studies evaluation methods for retrieval augmented generation.
    </summary>
    <author><name>Alice Smith</name></author>
    <author><name>Bob Lee</name></author>
    <arxiv:primary_category term="cs.CL" />
    <category term="cs.CL" />
    <link href="http://arxiv.org/abs/2401.12345v1" rel="alternate" type="text/html" />
    <link title="pdf" href="http://arxiv.org/pdf/2401.12345v1" rel="related" type="application/pdf" />
  </entry>
</feed>
"""


class PaperStormRetrieversTest(unittest.TestCase):
    def test_arxiv_rm_maps_atom_entries_to_storm_results(self):
        rm = ArxivRM(k=1)
        rm.request = lambda query: ARXIV_SAMPLE

        results = rm.forward("retrieval augmented generation evaluation")

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["url"], "http://arxiv.org/abs/2401.12345v1")
        self.assertEqual(
            results[0]["title"], "Retrieval Augmented Generation Evaluation"
        )
        self.assertIn(
            "evaluation methods", results[0]["snippets"][0]
        )
        self.assertEqual(results[0]["meta"]["source_type"], "arxiv")
        self.assertEqual(results[0]["meta"]["authors"], ["Alice Smith", "Bob Lee"])
        self.assertEqual(
            results[0]["meta"]["pdf_url"], "http://arxiv.org/pdf/2401.12345v1"
        )

    def test_arxiv_rm_skips_empty_queries(self):
        rm = ArxivRM(k=1)
        calls = []
        rm.request = lambda query: calls.append(query) or ARXIV_SAMPLE

        results = rm.forward(["", "   "])

        self.assertEqual(results, [])
        self.assertEqual(calls, [])

    def test_local_pdf_rm_retrieves_relevant_chunks_from_loaded_documents(self):
        rm = LocalPDFRM(
            documents=[
                {
                    "title": "RAG Evaluation Survey",
                    "path": "papers/rag-eval.pdf",
                    "text": (
                        "Retrieval augmented generation evaluation uses faithfulness "
                        "and answer relevance metrics. Wireless channel estimation is "
                        "a different topic."
                    ),
                }
            ],
            k=1,
            chunk_size=80,
            chunk_overlap=0,
        )

        results = rm.forward("faithfulness metrics")

        self.assertEqual(len(results), 1)
        self.assertEqual(results[0]["title"], "RAG Evaluation Survey")
        self.assertIn("faithfulness", results[0]["snippets"][0])
        self.assertEqual(results[0]["meta"]["source_type"], "local_pdf")
        self.assertEqual(results[0]["meta"]["pdf_path"], "papers/rag-eval.pdf")

    def test_local_pdf_rm_skips_empty_queries(self):
        rm = LocalPDFRM(
            documents=[
                {
                    "title": "RAG Evaluation Survey",
                    "path": "papers/rag-eval.pdf",
                    "text": "Retrieval augmented generation evaluation.",
                }
            ]
        )

        self.assertEqual(rm.forward(["", "   "]), [])

    def test_paper_storm_runner_builds_arxiv_retriever(self):
        from examples.storm_examples.run_paper_storm_minimax import (
            build_paper_retriever,
        )

        rm = build_paper_retriever(
            SimpleNamespace(retriever="arxiv", search_top_k=2, pdf_dir=None)
        )

        self.assertIsInstance(rm, ArxivRM)
        self.assertEqual(rm.k, 2)

    def test_paper_storm_runner_requires_pdf_dir_for_local_pdf(self):
        from examples.storm_examples.run_paper_storm_minimax import (
            build_paper_retriever,
        )

        with self.assertRaises(ValueError):
            build_paper_retriever(
                SimpleNamespace(retriever="local-pdf", search_top_k=2, pdf_dir=None)
            )

    def test_paper_storm_runner_builds_deepseek_flash_settings(self):
        from examples.storm_examples.run_paper_storm_minimax import (
            build_lm_settings,
        )

        settings = build_lm_settings(
            SimpleNamespace(llm_provider="deepseek", llm_model="flash")
        )

        self.assertEqual(settings["model"], "deepseek/deepseek-chat")
        self.assertEqual(settings["api_env"], "DEEPSEEK_API_KEY")
        self.assertEqual(settings["api_base"], "https://api.deepseek.com")

    def test_paper_storm_runner_builds_minimax_settings(self):
        from examples.storm_examples.run_paper_storm_minimax import (
            build_lm_settings,
        )

        settings = build_lm_settings(
            SimpleNamespace(llm_provider="minimax", llm_model=None)
        )

        self.assertEqual(settings["model"], "openai/MiniMax-M3")
        self.assertEqual(settings["api_env"], "MINIMAX_API_KEY")

    def test_paper_storm_runner_uses_larger_outline_token_budget(self):
        from examples.storm_examples.run_paper_storm_minimax import (
            build_lm_token_limits,
        )

        limits = build_lm_token_limits()

        self.assertGreaterEqual(limits["outline_gen"], 1800)
        self.assertGreaterEqual(limits["article_gen"], 1800)


if __name__ == "__main__":
    unittest.main()
