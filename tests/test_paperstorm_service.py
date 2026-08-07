import json
import tempfile
import unittest
from pathlib import Path


class PaperStormServiceTest(unittest.TestCase):
    def make_service(self):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        from knowledge_storm.paperstorm_service import PaperStormTaskService

        return PaperStormTaskService(root_dir=Path(temp_dir.name))

    def make_service_with_pipeline_runner(self, runner):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        from knowledge_storm.paperstorm_service import PaperStormTaskService

        return PaperStormTaskService(
            root_dir=Path(temp_dir.name),
            pipeline_runner=runner,
        )

    def test_submit_research_task_creates_isolated_task_state(self):
        service = self.make_service()

        task = service.submit_research_task(
            topic="pim 神经网络抑制",
            retriever="arxiv",
            output_language="zh",
            run_mode="fake",
        )
        state = service.get_task(task["task_id"])

        self.assertEqual(state["status"], "queued")
        self.assertEqual(state["topic"], "pim 神经网络抑制")
        self.assertTrue(Path(state["output_dir"]).exists())
        self.assertIn(task["task_id"], state["output_dir"])

    def test_run_fake_task_writes_article_trace_summary_and_scorecard(self):
        service = self.make_service()
        task = service.submit_research_task(
            topic="pim 神经网络抑制",
            retriever="arxiv",
            output_language="zh",
            run_mode="fake",
            expected_keywords=["passive intermodulation", "RF"],
            forbidden_keywords=["processing-in-memory", "DRAM", "RAM"],
        )

        finished = service.run_task(task["task_id"])
        article = service.get_article(task["task_id"])
        scorecard = service.get_scorecard(task["task_id"])
        trace = service.get_trace(task["task_id"])

        self.assertEqual(finished["status"], "succeeded")
        self.assertIn("passive intermodulation", article["content"])
        self.assertGreater(scorecard["scores"]["total"], 50)
        self.assertTrue(trace["events"])

    def test_query_knowledge_base_answers_from_task_artifacts(self):
        service = self.make_service()
        task = service.submit_research_task(
            topic="pim 神经网络抑制",
            retriever="arxiv",
            output_language="zh",
            run_mode="fake",
        )
        service.run_task(task["task_id"])

        answer = service.query_knowledge_base(task["task_id"], "PIM 是什么？")

        self.assertTrue(answer["grounded"])
        self.assertTrue(answer["citations"])
        self.assertIn("passive intermodulation", answer["answer"])

    def test_dashboard_bundle_collects_task_artifacts_for_frontend(self):
        service = self.make_service()
        task = service.submit_research_task(
            topic="pim 神经网络抑制",
            retriever="arxiv",
            output_language="zh",
            run_mode="fake",
            expected_keywords=["passive intermodulation"],
            forbidden_keywords=["DRAM"],
        )
        service.run_task(task["task_id"])
        service.query_knowledge_base(task["task_id"], "PIM 是什么？")

        bundle = service.get_dashboard_bundle(task["task_id"])

        self.assertEqual(bundle["project"]["version"], "v0.8")
        self.assertEqual(bundle["tasks"][0]["task_id"], task["task_id"])
        self.assertIn("passive intermodulation", bundle["article"]["content"])
        self.assertTrue(bundle["trace"]["events"])
        self.assertGreater(bundle["scorecard"]["scores"]["total"], 50)
        self.assertTrue(bundle["qa"]["grounded"])
        self.assertIn("service_snapshot", bundle)

    def test_two_tasks_write_to_separate_output_dirs(self):
        service = self.make_service()

        first = service.submit_research_task(topic="topic one", run_mode="fake")
        second = service.submit_research_task(topic="topic two", run_mode="fake")
        service.run_task(first["task_id"])
        service.run_task(second["task_id"])
        first_state = service.get_task(first["task_id"])
        second_state = service.get_task(second["task_id"])

        self.assertNotEqual(first_state["output_dir"], second_state["output_dir"])
        self.assertTrue((Path(first_state["output_dir"]) / "run_summary.json").exists())
        self.assertTrue((Path(second_state["output_dir"]) / "run_summary.json").exists())

    def test_list_tasks_returns_recent_tasks_for_dashboard_polling(self):
        service = self.make_service()

        first = service.submit_research_task(topic="topic one", run_mode="fake")
        second = service.submit_research_task(topic="topic two", run_mode="manual")
        service.run_task(first["task_id"])
        service.worker_tick()

        tasks = service.list_tasks()
        running = service.list_tasks(status="running")
        succeeded = service.list_tasks(status="succeeded")

        self.assertEqual([task["task_id"] for task in tasks], [first["task_id"], second["task_id"]])
        self.assertEqual([task["task_id"] for task in running], [second["task_id"]])
        self.assertEqual([task["task_id"] for task in succeeded], [first["task_id"]])

    def test_task_failure_is_structured_and_secret_safe(self):
        service = self.make_service()
        task = service.submit_research_task(
            topic="broken",
            run_mode="fail",
            api_key="sk-secret-value",
        )

        failed = service.run_task(task["task_id"])
        serialized = json.dumps(failed, ensure_ascii=False)

        self.assertEqual(failed["status"], "failed")
        self.assertIn("error", failed)
        self.assertNotIn("sk-secret-value", serialized)

    def test_domain_keywords_are_preserved_in_task_state(self):
        service = self.make_service()

        task = service.submit_research_task(
            topic="pim",
            expected_keywords=["passive intermodulation"],
            forbidden_keywords=["DRAM"],
        )
        state = service.get_task(task["task_id"])

        self.assertEqual(state["expected_keywords"], ["passive intermodulation"])
        self.assertEqual(state["forbidden_keywords"], ["DRAM"])

    def test_fastapi_adapter_imports_without_required_runtime_dependency(self):
        from examples.storm_examples import paperstorm_service_api

        self.assertTrue(hasattr(paperstorm_service_api, "create_app"))
        self.assertTrue(hasattr(paperstorm_service_api, "DEFAULT_SERVICE_ROOT"))

    def test_paperstorm_run_mode_uses_injected_pipeline_runner(self):
        calls = []

        def runner(state):
            calls.append(state)
            output_dir = Path(state["output_dir"])
            (output_dir / "storm_gen_article_polished.txt").write_text(
                "# PIM\n\npassive intermodulation suppression with RF neural networks.",
                encoding="utf-8",
            )
            (output_dir / "paperstorm_trace.jsonl").write_text(
                json.dumps({"event": "run_start", "task_id": state["task_id"]})
                + "\n",
                encoding="utf-8",
            )
            (output_dir / "scorecard.json").write_text(
                json.dumps({"scores": {"total": 88}}, ensure_ascii=False),
                encoding="utf-8",
            )
            return {"artifacts": ["storm_gen_article_polished.txt"], "success": True}

        service = self.make_service_with_pipeline_runner(runner)
        task = service.submit_research_task(
            topic="pim 神经网络抑制",
            retriever="arxiv",
            output_language="zh",
            run_mode="paperstorm",
            llm_provider="deepseek",
            llm_model="flash",
        )

        finished = service.run_task(task["task_id"])

        self.assertEqual(finished["status"], "succeeded")
        self.assertEqual(len(calls), 1)
        self.assertEqual(calls[0]["run_mode"], "paperstorm")
        self.assertEqual(calls[0]["options"]["llm_provider"], "deepseek")
        self.assertIn("passive intermodulation", service.get_article(task["task_id"])["content"])
        self.assertEqual(service.get_scorecard(task["task_id"])["scores"]["total"], 88)
        self.assertTrue(service.get_trace(task["task_id"])["events"])

    def test_paperstorm_run_mode_records_structured_runner_failure(self):
        def runner(state):
            raise RuntimeError("provider failed with sk-secret-value")

        service = self.make_service_with_pipeline_runner(runner)
        task = service.submit_research_task(
            topic="broken",
            run_mode="paperstorm",
            api_key="sk-secret-value",
        )

        failed = service.run_task(task["task_id"])

        self.assertEqual(failed["status"], "failed")
        self.assertIn("provider failed", failed["error"])
        self.assertNotIn("sk-secret-value", json.dumps(failed, ensure_ascii=False))


if __name__ == "__main__":
    unittest.main()
