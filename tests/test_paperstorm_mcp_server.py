import json
import unittest


class FakeTool:
    name = "fake_search"
    description = "Fake search tool for MCP tests."

    def to_schema(self):
        return {
            "name": self.name,
            "description": self.description,
            "input_schema": {
                "type": "object",
                "properties": {"query": {"type": "string"}},
                "required": ["query"],
            },
            "output_schema": {
                "type": "object",
                "properties": {"results": {"type": "array"}},
                "required": ["results"],
            },
        }

    def run(self, arguments):
        query = arguments["query"]
        return {"results": [{"title": "Result for " + query}]}


class PaperStormMCPServerTest(unittest.TestCase):
    def test_tools_list_returns_registered_tool_schemas(self):
        from examples.storm_examples.paperstorm_mcp_server import (
            handle_jsonrpc_request,
        )

        response = handle_jsonrpc_request(
            {"jsonrpc": "2.0", "id": 1, "method": "tools/list"},
            {"fake_search": FakeTool()},
        )

        self.assertEqual(response["id"], 1)
        self.assertEqual(response["result"]["tools"][0]["name"], "fake_search")
        self.assertIn("input_schema", response["result"]["tools"][0])

    def test_tools_call_runs_registered_tool(self):
        from examples.storm_examples.paperstorm_mcp_server import (
            handle_jsonrpc_request,
        )

        response = handle_jsonrpc_request(
            {
                "jsonrpc": "2.0",
                "id": 2,
                "method": "tools/call",
                "params": {
                    "name": "fake_search",
                    "arguments": {"query": "passive intermodulation"},
                },
            },
            {"fake_search": FakeTool()},
        )

        content = response["result"]["content"]
        self.assertEqual(content[0]["type"], "text")
        payload = json.loads(content[0]["text"])
        self.assertEqual(
            payload["results"][0]["title"],
            "Result for passive intermodulation",
        )

    def test_tools_call_unknown_tool_returns_jsonrpc_error(self):
        from examples.storm_examples.paperstorm_mcp_server import (
            handle_jsonrpc_request,
        )

        response = handle_jsonrpc_request(
            {
                "jsonrpc": "2.0",
                "id": 3,
                "method": "tools/call",
                "params": {"name": "missing", "arguments": {}},
            },
            {"fake_search": FakeTool()},
        )

        self.assertEqual(response["id"], 3)
        self.assertEqual(response["error"]["code"], -32602)
        self.assertIn("Unknown tool", response["error"]["message"])

    def test_build_tool_registry_includes_arxiv_by_default(self):
        from examples.storm_examples.paperstorm_mcp_server import build_tool_registry

        registry = build_tool_registry()

        self.assertIn("arxiv_search", registry)

    def test_mcp_server_accepts_runtime_tool_registry(self):
        from examples.storm_examples.paperstorm_mcp_server import (
            handle_jsonrpc_request,
        )
        from knowledge_storm.paperstorm_runtime import ToolRegistry

        registry = ToolRegistry()
        registry.register(FakeTool())

        response = handle_jsonrpc_request(
            {"jsonrpc": "2.0", "id": 4, "method": "tools/list"},
            registry,
        )

        self.assertEqual(response["result"]["tools"][0]["name"], "fake_search")


if __name__ == "__main__":
    unittest.main()
