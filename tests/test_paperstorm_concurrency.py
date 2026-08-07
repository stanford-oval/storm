import tempfile
import unittest
from pathlib import Path


class PaperStormConcurrencyTest(unittest.TestCase):
    def make_service(self, **kwargs):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        from knowledge_storm.paperstorm_service import PaperStormTaskService

        return PaperStormTaskService(root_dir=Path(temp_dir.name), **kwargs)

    def test_worker_tick_respects_max_concurrent_tasks(self):
        service = self.make_service(max_concurrent_tasks=2)
        task_ids = [
            service.submit_research_task(topic="topic {0}".format(index), run_mode="manual")["task_id"]
            for index in range(5)
        ]

        batch = service.worker_tick()
        states = [service.get_task(task_id)["status"] for task_id in task_ids]

        self.assertEqual(batch["started_count"], 2)
        self.assertEqual(states.count("running"), 2)
        self.assertEqual(states.count("queued"), 3)

    def test_complete_running_task_releases_capacity_for_next_queued_task(self):
        service = self.make_service(max_concurrent_tasks=1)
        first = service.submit_research_task(topic="first", run_mode="manual")["task_id"]
        second = service.submit_research_task(topic="second", run_mode="manual")["task_id"]
        service.worker_tick()

        service.complete_task(first, success=True)
        batch = service.worker_tick()

        self.assertEqual(service.get_task(first)["status"], "succeeded")
        self.assertEqual(service.get_task(second)["status"], "running")
        self.assertEqual(batch["started_task_ids"], [second])

    def test_recover_stale_running_tasks_marks_them_failed(self):
        service = self.make_service(max_concurrent_tasks=1)
        task_id = service.submit_research_task(topic="stale", run_mode="manual")["task_id"]
        service.worker_tick()

        recovered = service.recover_stale_running_tasks(max_age_seconds=0)
        state = service.get_task(task_id)

        self.assertEqual(recovered["failed_count"], 1)
        self.assertEqual(state["status"], "failed")
        self.assertIn("stale", state["error"])

    def test_run_stress_benchmark_reports_latency_and_failure_metrics(self):
        service = self.make_service(max_concurrent_tasks=3)

        report = service.run_stress_benchmark(total_tasks=10, fail_every=4)

        self.assertEqual(report["total_tasks"], 10)
        self.assertEqual(report["succeeded"], 8)
        self.assertEqual(report["failed"], 2)
        self.assertIn("avg_latency_sec", report)
        self.assertIn("p95_latency_sec", report)
        self.assertLessEqual(report["max_observed_running"], 3)


if __name__ == "__main__":
    unittest.main()
