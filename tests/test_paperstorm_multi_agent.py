import json
import tempfile
import unittest
from pathlib import Path


class FakeSearchTool:
    name = "fake_search"
    description = "Fake search tool for multi-agent tests."
    input_schema = {
        "type": "object",
        "properties": {"query": {"type": "string"}, "top_k": {"type": "integer"}},
        "required": ["query"],
    }
    output_schema = {"type": "object"}

    def to_schema(self):
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": self.input_schema,
            "output_schema": self.output_schema,
        }

    def run(self, arguments):
        return {
            "results": [
                {
                    "title": "Neural passive intermodulation cancellation",
                    "description": "RF passive intermodulation suppression with neural networks.",
                    "url": "https://example.com/pim",
                },
                {
                    "title": "Processing-in-memory accelerator",
                    "description": "DRAM and RAM system for processing-in-memory.",
                    "url": "https://example.com/ram",
                },
            ]
        }


class PaperStormMultiAgentTest(unittest.TestCase):
    def make_output_dir(self):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        return Path(temp_dir.name)

    def test_planner_generates_query_plan_with_intents(self):
        from knowledge_storm.paperstorm_agents import PlannerAgent

        planner = PlannerAgent()
        plan = planner.run(
            {
                "topic": "pim 神经网络抑制",
                "expected_keywords": ["passive intermodulation", "RF"],
            }
        )

        self.assertEqual(plan["agent"], "PlannerAgent")
        self.assertGreaterEqual(len(plan["queries"]), 2)
        self.assertIn("intent", plan["queries"][0])
        self.assertTrue(
            any("passive intermodulation" in item["query"] for item in plan["queries"])
        )

    def test_critic_filters_offtopic_pim_results_with_reasons(self):
        from knowledge_storm.paperstorm_agents import CriticAgent

        critic = CriticAgent()
        reviewed = critic.run(
            {
                "results": [
                    {
                        "title": "Passive intermodulation suppression",
                        "description": "RF nonlinear cancellation.",
                    },
                    {
                        "title": "Processing-in-memory accelerator",
                        "description": "DRAM RAM architecture.",
                    },
                ],
                "expected_keywords": ["passive intermodulation", "RF"],
                "forbidden_keywords": ["processing-in-memory", "DRAM", "RAM"],
            }
        )

        self.assertEqual(len(reviewed["kept"]), 1)
        self.assertEqual(len(reviewed["rejected"]), 1)
        self.assertIn("forbidden", reviewed["rejected"][0]["reason"])

    def test_orchestrator_runs_multi_agent_research_and_writes_agent_trace(self):
        from knowledge_storm.paperstorm_agents import PaperStormResearchOrchestrator
        from knowledge_storm.paperstorm_runtime import PaperStormRuntimeSession

        output_dir = self.make_output_dir()
        trace_path = output_dir / "paperstorm_trace.jsonl"
        session = PaperStormRuntimeSession(
            run_id="run-agents",
            task_id="task-agents",
            trace_path=trace_path,
        )
        session.register_tool(FakeSearchTool())
        orchestrator = PaperStormResearchOrchestrator(session=session, output_dir=output_dir)

        report = orchestrator.run(
            topic="pim 神经网络抑制",
            search_tool="fake_search",
            expected_keywords=["passive intermodulation", "RF"],
            forbidden_keywords=["processing-in-memory", "DRAM", "RAM"],
        )
        agent_events = [
            json.loads(line)
            for line in (output_dir / "agent_trace.jsonl").read_text(encoding="utf-8").splitlines()
        ]

        self.assertEqual(report["topic"], "pim 神经网络抑制")
        self.assertEqual(report["metrics"]["kept_count"], 1)
        self.assertEqual(report["metrics"]["rejected_count"], 1)
        self.assertTrue((output_dir / "multi_agent_report.json").exists())
        self.assertIn("PlannerAgent", {event["agent"] for event in agent_events})
        self.assertIn("CriticAgent", {event["agent"] for event in agent_events})
        self.assertIn("EvaluatorAgent", {event["agent"] for event in agent_events})
        self.assertTrue(session.memory.get_context_bundle(query="processing-in-memory")["episodic"])

    def test_multi_agent_eval_scores_agent_trace_and_critic_rejections(self):
        from knowledge_storm.paperstorm_agents import evaluate_multi_agent_report

        output_dir = self.make_output_dir()
        (output_dir / "multi_agent_report.json").write_text(
            json.dumps(
                {
                    "topic": "pim 神经网络抑制",
                    "query_plan": [{"query": "passive intermodulation RF", "intent": "definition"}],
                    "kept_results": [{"title": "Passive intermodulation"}],
                    "rejected_results": [
                        {
                            "title": "Processing-in-memory",
                            "reason": "contains forbidden keyword: DRAM",
                        }
                    ],
                    "metrics": {"kept_count": 1, "rejected_count": 1},
                },
                ensure_ascii=False,
            ),
            encoding="utf-8",
        )
        (output_dir / "agent_trace.jsonl").write_text(
            "\n".join(
                [
                    json.dumps({"agent": "PlannerAgent", "event": "agent_end"}),
                    json.dumps({"agent": "RetrieverAgent", "event": "agent_end"}),
                    json.dumps({"agent": "CriticAgent", "event": "agent_end"}),
                    json.dumps({"agent": "EvaluatorAgent", "event": "agent_end"}),
                ]
            ),
            encoding="utf-8",
        )

        scorecard = evaluate_multi_agent_report(output_dir)

        self.assertGreater(scorecard["scores"]["multi_agent_trace"], 20)
        self.assertTrue(scorecard["checks"]["critic_rejected_offtopic"])


if __name__ == "__main__":
    unittest.main()
