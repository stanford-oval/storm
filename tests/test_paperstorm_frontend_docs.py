import json
import tempfile
import unittest
from pathlib import Path


class PaperStormFrontendDocsTest(unittest.TestCase):
    def test_demo_bundle_contains_dashboard_data(self):
        from knowledge_storm.paperstorm_demo import build_demo_bundle

        with tempfile.TemporaryDirectory() as temp_dir:
            output_dir = Path(temp_dir)
            bundle = build_demo_bundle(output_dir=output_dir)
            data_path = output_dir / "sample_data.json"
            js_path = output_dir / "sample_data.js"

            self.assertTrue(data_path.exists())
            self.assertTrue(js_path.exists())
            data = json.loads(data_path.read_text(encoding="utf-8"))
            self.assertIn("tasks", data)
            self.assertIn("article", data)
            self.assertIn("scorecard", data)
            self.assertIn("trace", data)
            self.assertIn("multi_agent", data)
            self.assertIn("pipeline_worker", data)
            self.assertIn("service_snapshot", data)
            self.assertIn("stress_report", data)
            self.assertEqual(data["project"]["version"], "v0.9")
            self.assertEqual(bundle["data_path"], str(data_path))
            self.assertEqual(bundle["js_path"], str(js_path))

    def test_static_frontend_exposes_agent_dashboard_panels(self):
        root = Path(__file__).resolve().parents[1]
        index = (root / "frontend" / "paperstorm_dashboard" / "index.html").read_text(
            encoding="utf-8"
        )
        script = (root / "frontend" / "paperstorm_dashboard" / "app.js").read_text(
            encoding="utf-8"
        )

        self.assertIn("PaperStorm Agent Dashboard", index)
        self.assertIn("task-panel", index)
        self.assertIn("trace-panel", index)
        self.assertIn("scorecard-panel", index)
        self.assertIn("multi-agent-panel", index)
        self.assertIn("stress-panel", index)
        self.assertIn("sample_data.js", index)
        self.assertIn("sample_data.json", script)
        self.assertIn("PAPERSTORM_SAMPLE_DATA", script)

    def test_static_frontend_can_load_service_dashboard_bundle(self):
        root = Path(__file__).resolve().parents[1]
        index = (root / "frontend" / "paperstorm_dashboard" / "index.html").read_text(
            encoding="utf-8"
        )
        script = (root / "frontend" / "paperstorm_dashboard" / "app.js").read_text(
            encoding="utf-8"
        )

        self.assertIn("service-url", index)
        self.assertIn("service-task-id", index)
        self.assertIn("load-service-task", index)
        self.assertIn("/dashboard", script)
        self.assertIn("loadServiceTask", script)
        self.assertIn("pipeline-worker", index)
        self.assertIn("renderPipelineWorker", script)

    def test_static_frontend_exposes_task_control_console(self):
        root = Path(__file__).resolve().parents[1]
        index = (root / "frontend" / "paperstorm_dashboard" / "index.html").read_text(
            encoding="utf-8"
        )
        script = (root / "frontend" / "paperstorm_dashboard" / "app.js").read_text(
            encoding="utf-8"
        )

        self.assertIn("create-task-panel", index)
        self.assertIn("task-topic", index)
        self.assertIn("task-run-mode", index)
        self.assertIn("submit-task", index)
        self.assertIn("run-selected-task", index)
        self.assertIn("poll-selected-task", index)
        self.assertIn("task-error-panel", index)
        self.assertIn("submitTask", script)
        self.assertIn("runSelectedTask", script)
        self.assertIn("pollSelectedTask", script)
        self.assertIn("fetchTaskList", script)
        self.assertIn("/research-tasks", script)

    def test_official_chinese_doc_and_readme_include_storm_architecture(self):
        root = Path(__file__).resolve().parents[1]
        official_cn = (root / "docs" / "STORM_OFFICIAL_CN.md").read_text(
            encoding="utf-8"
        )
        readme = (root / "README.md").read_text(encoding="utf-8")

        self.assertIn("官方 STORM 架构", official_cn)
        self.assertIn("Perspective-Guided Question Asking", official_cn)
        self.assertIn("Simulated Conversation", official_cn)
        self.assertIn("assets/overview.svg", readme)
        self.assertIn("assets/two_stages.jpg", readme)
        self.assertIn("官方 STORM 基础架构", readme)


if __name__ == "__main__":
    unittest.main()
