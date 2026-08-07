import json
import tempfile
import unittest
from pathlib import Path


class PaperStormReleaseDemoTest(unittest.TestCase):
    def test_release_demo_builds_service_and_dashboard_artifacts(self):
        from knowledge_storm.paperstorm_release import build_release_demo

        with tempfile.TemporaryDirectory() as temp_dir:
            root = Path(temp_dir)
            summary = build_release_demo(
                service_root=root / "service",
                dashboard_dir=root / "dashboard",
                topic="pim 神经网络抑制",
            )

            summary_path = Path(summary["summary_path"])
            dashboard_data = Path(summary["dashboard_data"])
            article_path = Path(summary["article_path"])
            trace_path = Path(summary["trace_path"])
            scorecard_path = Path(summary["scorecard_path"])

            self.assertTrue(summary_path.exists())
            self.assertTrue(dashboard_data.exists())
            self.assertTrue((dashboard_data.parent / "sample_data.js").exists())
            self.assertTrue(article_path.exists())
            self.assertTrue(trace_path.exists())
            self.assertTrue(scorecard_path.exists())
            self.assertEqual(summary["task_status"], "succeeded")
            self.assertGreater(summary["score_total"], 50)
            self.assertIn("passive intermodulation", summary["qa_answer"])

            dashboard = json.loads(dashboard_data.read_text(encoding="utf-8"))
            dashboard_serialized = json.dumps(dashboard, ensure_ascii=False)
            self.assertEqual(dashboard["project"]["version"], "v1.0")
            self.assertEqual(dashboard["tasks"][0]["task_id"], summary["task_id"])
            self.assertIn("release_demo", dashboard)
            self.assertNotIn(str(root), dashboard_serialized)
            self.assertIn("demo://paperstorm_release", dashboard_serialized)


if __name__ == "__main__":
    unittest.main()
