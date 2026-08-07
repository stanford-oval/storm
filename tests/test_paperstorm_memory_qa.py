import json
import tempfile
import unittest
from pathlib import Path


class PaperStormMemoryQATest(unittest.TestCase):
    def make_run_dir(self, files):
        temp_dir = tempfile.TemporaryDirectory()
        run_dir = Path(temp_dir.name)
        for relative_path, content in files.items():
            path = run_dir / relative_path
            path.parent.mkdir(parents=True, exist_ok=True)
            if isinstance(content, (dict, list)):
                path.write_text(json.dumps(content, ensure_ascii=False), encoding="utf-8")
            else:
                path.write_text(content, encoding="utf-8")
        self.addCleanup(temp_dir.cleanup)
        return run_dir

    def test_memory_store_persists_three_memory_layers_and_preferences(self):
        from knowledge_storm.paperstorm_memory import PaperStormMemoryStore

        store = PaperStormMemoryStore()
        store.append_working("当前问题：PIM 神经网络抑制")
        store.remember_episode("arXiv 检索发现 PIM 容易被误召回为 processing-in-memory")
        store.remember_semantic(
            "PIM 在射频场景中应消歧为 passive intermodulation。",
            tags=["PIM", "RF"],
        )
        store.set_preference("output_language", "zh")

        with tempfile.TemporaryDirectory() as temp_dir:
            path = Path(temp_dir) / "memory.json"
            store.save(path)
            loaded = PaperStormMemoryStore.load(path)

        bundle = loaded.get_context_bundle(query="PIM RF")

        self.assertIn("working", bundle)
        self.assertIn("episodic", bundle)
        self.assertIn("semantic", bundle)
        self.assertEqual(bundle["preferences"]["output_language"], "zh")
        self.assertIn("passive intermodulation", bundle["semantic"][0]["content"])

    def test_context_compression_keeps_constraints_and_reports_validation(self):
        from knowledge_storm.paperstorm_memory import compress_context

        messages = [
            {"role": "user", "content": "topic 是 PIM 神经网络抑制，PIM 指无源互调。"},
            {"role": "assistant", "content": "检索时必须使用 passive intermodulation 和 RF。"},
            {"role": "tool", "content": "误召回 processing-in-memory 和 DRAM 论文，需要过滤。"},
        ]

        compressed = compress_context(
            messages,
            expected_keywords=["passive intermodulation", "RF"],
            forbidden_keywords=["processing-in-memory", "DRAM"],
        )

        self.assertIn("passive intermodulation", compressed["summary"])
        self.assertIn("RF", compressed["validation"]["expected_keyword_hits"])
        self.assertIn("processing-in-memory", compressed["validation"]["forbidden_keyword_hits"])
        self.assertFalse(compressed["validation"]["passed"])

    def test_qa_answers_from_run_artifacts_with_citations_and_memory(self):
        from knowledge_storm.paperstorm_memory import PaperStormMemoryStore
        from knowledge_storm.paperstorm_qa import PaperStormKnowledgeBase

        run_dir = self.make_run_dir(
            {
                "storm_gen_article_polished.txt": (
                    "# 无源互调抑制\n\n"
                    "无源互调 passive intermodulation 是射频无源器件非线性导致的杂散问题。[1]\n\n"
                    "神经网络方法可以学习非线性抵消器，用于 suppression 和 cancellation。[2]\n"
                ),
                "raw_search_results.json": [
                    {
                        "title": "Neural cancellation of passive intermodulation",
                        "url": "https://arxiv.org/abs/0000.00001",
                        "description": "RF passive intermodulation suppression with neural networks.",
                        "snippets": ["Neural cancellers reduce passive intermodulation products."],
                    }
                ],
            }
        )
        memory = PaperStormMemoryStore()
        memory.remember_semantic("PIM 在本任务中固定指 passive intermodulation。")

        kb = PaperStormKnowledgeBase.from_run_dir(run_dir)
        answer = kb.answer_question("PIM 神经网络抑制是什么？", memory_store=memory)

        self.assertIn("passive intermodulation", answer["answer"])
        self.assertTrue(answer["citations"])
        self.assertTrue(answer["grounded"])
        self.assertIn("semantic", answer["memory_context"])

    def test_kb_qa_tool_exposes_schema_and_runs(self):
        from knowledge_storm.paperstorm_tools import KnowledgeBaseQATool

        run_dir = self.make_run_dir(
            {
                "storm_gen_article.txt": "PIM means passive intermodulation in RF systems. [1]",
                "raw_search_results.json": [
                    {
                        "title": "Passive intermodulation survey",
                        "url": "https://example.com/pim",
                        "description": "PIM in RF systems.",
                    }
                ],
            }
        )

        tool = KnowledgeBaseQATool()
        schema = tool.to_schema()
        result = tool.run({"run_dir": str(run_dir), "question": "PIM 是什么？"})

        self.assertEqual(schema["name"], "kb_qa")
        self.assertIn("run_dir", schema["input_schema"]["required"])
        self.assertIn("passive intermodulation", result["answer"])
        self.assertTrue(result["citations"])

    def test_evaluate_qa_artifact_scores_grounded_answers(self):
        from knowledge_storm.paperstorm_eval import EvalCase, evaluate_qa_artifact

        run_dir = self.make_run_dir(
            {
                "qa_answer.json": {
                    "question": "PIM 是什么？",
                    "answer": "PIM 是 RF 系统中的 passive intermodulation 问题。[1]",
                    "citations": [{"id": 1, "url": "https://example.com/pim"}],
                    "grounded": True,
                }
            }
        )
        case = EvalCase(
            topic="pim 神经网络抑制",
            expected_keywords=["passive intermodulation", "RF"],
            forbidden_keywords=["processing-in-memory"],
            expected_language="zh",
            min_sources=1,
        )

        scorecard = evaluate_qa_artifact(run_dir, case)

        self.assertGreater(scorecard["scores"]["qa_quality"], 20)
        self.assertTrue(scorecard["checks"]["qa_has_citation"])
        self.assertTrue(scorecard["checks"]["qa_grounded"])

    def test_runtime_session_runs_tool_with_trace_and_working_memory(self):
        from knowledge_storm.paperstorm_runtime import PaperStormRuntimeSession
        from knowledge_storm.paperstorm_tools import KnowledgeBaseQATool

        run_dir = self.make_run_dir(
            {
                "storm_gen_article.txt": "PIM means passive intermodulation in RF systems. [1]",
                "raw_search_results.json": [
                    {
                        "title": "Passive intermodulation survey",
                        "url": "https://example.com/pim",
                        "description": "PIM in RF systems.",
                    }
                ],
            }
        )
        trace_path = run_dir / "paperstorm_trace.jsonl"
        session = PaperStormRuntimeSession(run_id="unit-test", trace_path=trace_path)
        session.register_tool(KnowledgeBaseQATool())

        result = session.call_tool(
            "kb_qa",
            {"run_dir": str(run_dir), "question": "PIM 是什么？"},
        )
        events = [
            json.loads(line)
            for line in trace_path.read_text(encoding="utf-8").splitlines()
        ]
        memory = session.memory.get_context_bundle(query="kb_qa")

        self.assertIn("passive intermodulation", result["answer"])
        self.assertEqual(events[0]["event"], "tool_start")
        self.assertEqual(events[-1]["event"], "tool_end")
        self.assertEqual(events[-1]["status"], "success")
        self.assertTrue(memory["working"])


if __name__ == "__main__":
    unittest.main()
