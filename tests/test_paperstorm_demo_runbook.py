import unittest
from pathlib import Path


class PaperStormDemoRunbookTest(unittest.TestCase):
    def test_service_launcher_parser_documents_local_demo_defaults(self):
        from examples.storm_examples.start_paperstorm_service import build_parser

        args = build_parser().parse_args(
            [
                "--service-root",
                "./results/paperstorm_demo_service",
                "--host",
                "127.0.0.1",
                "--port",
                "8765",
                "--reload",
            ]
        )

        self.assertEqual(args.service_root, "./results/paperstorm_demo_service")
        self.assertEqual(args.host, "127.0.0.1")
        self.assertEqual(args.port, 8765)
        self.assertTrue(args.reload)

    def test_readme_and_plans_include_v11_demo_runbook(self):
        root = Path(__file__).resolve().parents[1]
        readme = (root / "README.md").read_text(encoding="utf-8")
        version_plan = (root / "docs" / "VERSION_PLAN.md").read_text(encoding="utf-8")
        resume_plan = (root / "docs" / "RESUME_INTERVIEW_PLAN.md").read_text(
            encoding="utf-8"
        )

        self.assertIn("v1.1 Demo Runbook", readme)
        self.assertIn("start_paperstorm_service.py", readme)
        self.assertIn("submit -> queued -> running -> succeeded", readme)
        self.assertIn("v1.1：本地演示链路打磨", version_plan)
        self.assertIn("状态：已完成第一阶段", version_plan)
        self.assertIn("v1.1 面试讲法", resume_plan)
        self.assertIn("演示不是只给静态截图", resume_plan)


if __name__ == "__main__":
    unittest.main()
