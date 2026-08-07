import json
import tempfile
import unittest
from pathlib import Path


class EchoTool:
    name = "echo"
    description = "Echo a message."
    input_schema = {
        "type": "object",
        "properties": {"message": {"type": "string"}},
        "required": ["message"],
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
        return {"message": arguments["message"]}


class FailingTool(EchoTool):
    name = "fail"

    def run(self, arguments):
        raise RuntimeError("boom")


class PaperStormRuntimeTest(unittest.TestCase):
    def make_trace_path(self):
        temp_dir = tempfile.TemporaryDirectory()
        self.addCleanup(temp_dir.cleanup)
        return Path(temp_dir.name) / "trace.jsonl"

    def read_events(self, trace_path):
        return [
            json.loads(line)
            for line in trace_path.read_text(encoding="utf-8").splitlines()
            if line.strip()
        ]

    def test_tool_registry_lists_schemas_and_validates_required_arguments(self):
        from knowledge_storm.paperstorm_runtime import ToolRegistry

        registry = ToolRegistry()
        registry.register(EchoTool())

        self.assertEqual(registry.get("echo").name, "echo")
        self.assertEqual(registry.list_schemas()[0]["name"], "echo")
        with self.assertRaises(ValueError):
            registry.validate_arguments("echo", {})

    def test_runtime_session_invokes_hooks_and_writes_unified_trace(self):
        from knowledge_storm.paperstorm_runtime import HookManager, PaperStormRuntimeSession

        trace_path = self.make_trace_path()
        seen = []
        hooks = HookManager()
        hooks.register("before_tool_call", lambda event: seen.append(("before", event.tool)))
        hooks.register("after_tool_call", lambda event: seen.append(("after", event.status)))
        session = PaperStormRuntimeSession(
            run_id="run-1",
            task_id="task-1",
            trace_path=trace_path,
            hooks=hooks,
        )
        session.register_tool(EchoTool())

        result = session.call_tool("echo", {"message": "hello"}, stage="qa")
        events = self.read_events(trace_path)

        self.assertEqual(result["message"], "hello")
        self.assertEqual(seen, [("before", "echo"), ("after", "success")])
        self.assertEqual(events[0]["run_id"], "run-1")
        self.assertEqual(events[0]["task_id"], "task-1")
        self.assertEqual(events[0]["stage"], "qa")
        self.assertEqual(events[0]["tool"], "echo")
        self.assertIn("input_summary", events[0])
        self.assertIn("output_summary", events[-1])

    def test_runtime_session_invokes_error_hook_and_records_tool_error(self):
        from knowledge_storm.paperstorm_runtime import HookManager, PaperStormRuntimeSession

        trace_path = self.make_trace_path()
        seen = []
        hooks = HookManager()
        hooks.register("on_tool_error", lambda event: seen.append(event.error))
        session = PaperStormRuntimeSession(
            run_id="run-err",
            task_id="task-err",
            trace_path=trace_path,
            hooks=hooks,
        )
        session.register_tool(FailingTool())

        with self.assertRaises(RuntimeError):
            session.call_tool("fail", {"message": "hello"}, stage="qa")
        events = self.read_events(trace_path)

        self.assertTrue(seen)
        self.assertEqual(events[-1]["event"], "tool_error")
        self.assertEqual(events[-1]["status"], "error")
        self.assertIn("boom", events[-1]["error"])

    def test_runtime_session_compresses_context_with_hook_and_trace(self):
        from knowledge_storm.paperstorm_runtime import HookManager, PaperStormRuntimeSession

        trace_path = self.make_trace_path()
        seen = []
        hooks = HookManager()
        hooks.register("on_context_compress", lambda event: seen.append(event.status))
        session = PaperStormRuntimeSession(
            run_id="run-compress",
            task_id="task-compress",
            trace_path=trace_path,
            hooks=hooks,
        )

        compressed = session.compress_context(
            [{"role": "user", "content": "PIM means passive intermodulation in RF."}],
            expected_keywords=["passive intermodulation", "RF"],
            forbidden_keywords=["processing-in-memory"],
        )
        events = self.read_events(trace_path)

        self.assertTrue(compressed["validation"]["passed"])
        self.assertEqual(seen, ["success"])
        self.assertEqual(events[-1]["event"], "context_compress")
        self.assertEqual(events[-1]["stage"], "compression")


if __name__ == "__main__":
    unittest.main()
