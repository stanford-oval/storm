import json
import tempfile
import unittest
from pathlib import Path


class PaperStormEvalTest(unittest.TestCase):
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

    def test_evaluate_run_scores_completion_retrieval_article_and_trace(self):
        from knowledge_storm.paperstorm_eval import EvalCase, evaluate_run

        run_dir = self.make_run_dir(
            {
                "raw_search_results.json": [
                    {
                        "title": "Neural suppression of passive intermodulation",
                        "description": "RF passive intermodulation cancellation.",
                        "snippets": [
                            "A neural network canceller suppresses passive intermodulation."
                        ],
                    },
                    {
                        "title": "Processing-in-memory for DRAM",
                        "description": "RAM acceleration.",
                        "snippets": ["Processing-in-memory system for DRAM."],
                    },
                ],
                "storm_gen_outline.txt": "# 无源互调抑制\n## 神经网络方法",
                "storm_gen_article_polished.txt": (
                    "无源互调是射频系统中的非线性问题。神经网络可以用于"
                    "passive intermodulation suppression 和 cancellation。[1]"
                ),
                "paperstorm_trace.jsonl": (
                    '{"event":"run_start"}\n'
                    '{"event":"retrieval_start","queries":["passive intermodulation"]}\n'
                    '{"event":"retrieval_end","result_count":2}\n'
                    '{"event":"artifact_written","path":"storm_gen_article_polished.txt"}\n'
                    '{"event":"run_end","success":true}\n'
                ),
                "run_summary.json": {
                    "success": True,
                    "retrieval_success": 1,
                    "retrieval_failed": 0,
                    "artifacts": ["storm_gen_article_polished.txt"],
                },
            }
        )
        case = EvalCase(
            topic="pim 神经网络抑制",
            expected_keywords=[
                "passive intermodulation",
                "RF",
                "neural network",
                "suppression",
                "cancellation",
            ],
            forbidden_keywords=["processing-in-memory", "DRAM", "RAM"],
            expected_language="zh",
            min_sources=2,
        )

        scorecard = evaluate_run(run_dir, case)

        self.assertEqual(scorecard["topic"], "pim 神经网络抑制")
        self.assertLess(scorecard["scores"]["offtopic_penalty"], 15)
        self.assertGreater(scorecard["scores"]["total"], 60)
        self.assertEqual(scorecard["metrics"]["source_count"], 2)
        self.assertGreater(scorecard["metrics"]["chinese_char_ratio"], 0.3)
        self.assertIn("processing-in-memory", scorecard["metrics"]["forbidden_hits"])

    def test_evaluate_run_penalizes_missing_artifacts_and_trace(self):
        from knowledge_storm.paperstorm_eval import EvalCase, evaluate_run

        run_dir = self.make_run_dir(
            {
                "raw_search_results.json": [],
                "storm_gen_article_polished.txt": "English only article without sources.",
            }
        )
        case = EvalCase(
            topic="pim 神经网络抑制",
            expected_keywords=["passive intermodulation"],
            forbidden_keywords=["processing-in-memory"],
            expected_language="zh",
            min_sources=1,
        )

        scorecard = evaluate_run(run_dir, case)

        self.assertLess(scorecard["scores"]["total"], 50)
        self.assertFalse(scorecard["checks"]["has_outline"])
        self.assertFalse(scorecard["checks"]["has_trace"])

    def test_write_scorecards_outputs_json_and_markdown(self):
        from knowledge_storm.paperstorm_eval import write_scorecards

        run_dir = self.make_run_dir({})
        scorecard = {
            "topic": "pim 神经网络抑制",
            "scores": {"total": 78.5},
            "metrics": {"source_count": 3},
            "checks": {"has_article": True},
            "notes": ["检索存在少量跑题结果。"],
        }

        json_path, md_path = write_scorecards(run_dir, scorecard)

        self.assertTrue(json_path.exists())
        self.assertTrue(md_path.exists())
        self.assertEqual(json.loads(json_path.read_text(encoding="utf-8"))["topic"], "pim 神经网络抑制")
        self.assertIn("PaperStorm Eval Scorecard", md_path.read_text(encoding="utf-8"))


if __name__ == "__main__":
    unittest.main()
