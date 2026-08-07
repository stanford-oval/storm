import unittest
from pathlib import Path


class PaperStormReleaseDocsTest(unittest.TestCase):
    def test_release_docs_explain_demo_plan_and_interview_pitch(self):
        root = Path(__file__).resolve().parents[1]
        readme = (root / "README.md").read_text(encoding="utf-8")
        version_plan = (root / "docs" / "VERSION_PLAN.md").read_text(encoding="utf-8")
        resume_plan = (root / "docs" / "RESUME_INTERVIEW_PLAN.md").read_text(
            encoding="utf-8"
        )

        self.assertIn("v1.0 Release Demo", readme)
        self.assertIn("5 分钟演示路线", readme)
        self.assertIn("run_paperstorm_release_demo.py", readme)
        self.assertIn("v1.0", version_plan)
        self.assertIn("状态：已完成第一阶段", version_plan)
        self.assertIn("30 秒项目介绍", resume_plan)
        self.assertIn("2 分钟技术介绍", resume_plan)
        self.assertIn("5 分钟演示路线", resume_plan)


if __name__ == "__main__":
    unittest.main()
