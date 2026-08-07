"""
Minimal MCP-style stdio server for PaperStorm retrieval tools.

Example:
    python examples/storm_examples/paperstorm_mcp_server.py --pdf-dir ./papers
"""

import argparse
import json
import sys
from pathlib import Path
from typing import Any, Dict


PROJECT_ROOT = Path(__file__).resolve().parents[2]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from knowledge_storm.paperstorm_tools import list_paperstorm_tools
from knowledge_storm.paperstorm_runtime import ToolRegistry


JSONRPC_VERSION = "2.0"
INVALID_REQUEST = -32600
METHOD_NOT_FOUND = -32601
INVALID_PARAMS = -32602
INTERNAL_ERROR = -32603


def build_tool_registry(pdf_dir=None):
    registry = ToolRegistry()
    for tool in list_paperstorm_tools(pdf_dir=pdf_dir):
        registry.register(tool)
    return registry


def _jsonrpc_result(request_id, result):
    return {"jsonrpc": JSONRPC_VERSION, "id": request_id, "result": result}


def _jsonrpc_error(request_id, code, message):
    return {
        "jsonrpc": JSONRPC_VERSION,
        "id": request_id,
        "error": {"code": code, "message": message},
    }


def _mcp_text_content(payload: Dict[str, Any]):
    return {
        "content": [
            {
                "type": "text",
                "text": json.dumps(payload, ensure_ascii=False, sort_keys=True),
            }
        ]
    }


def handle_jsonrpc_request(request: Dict[str, Any], registry: Dict[str, Any]):
    request_id = request.get("id")
    method = request.get("method")

    if method == "tools/list":
        tools = _list_tool_schemas(registry)
        return _jsonrpc_result(request_id, {"tools": tools})

    if method == "tools/call":
        params = request.get("params") or {}
        tool_name = params.get("name")
        arguments = params.get("arguments") or {}
        tool = _get_tool(registry, tool_name)
        if tool is None:
            return _jsonrpc_error(
                request_id,
                INVALID_PARAMS,
                "Unknown tool: {tool_name}".format(tool_name=tool_name),
            )
        try:
            if hasattr(registry, "validate_arguments"):
                registry.validate_arguments(tool_name, arguments)
            return _jsonrpc_result(request_id, _mcp_text_content(tool.run(arguments)))
        except ValueError as exc:
            return _jsonrpc_error(request_id, INVALID_PARAMS, str(exc))
        except Exception as exc:
            return _jsonrpc_error(request_id, INTERNAL_ERROR, str(exc))

    if method:
        return _jsonrpc_error(
            request_id,
            METHOD_NOT_FOUND,
            "Unsupported method: {method}".format(method=method),
        )

    return _jsonrpc_error(request_id, INVALID_REQUEST, "JSON-RPC method is required.")


def _list_tool_schemas(registry):
    if hasattr(registry, "list_schemas"):
        return registry.list_schemas()
    return [tool.to_schema() for tool in registry.values()]


def _get_tool(registry, tool_name):
    if hasattr(registry, "get"):
        try:
            return registry.get(tool_name)
        except KeyError:
            return None
    return registry.get(tool_name)


def serve_stdio(registry):
    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            request = json.loads(line)
            response = handle_jsonrpc_request(request, registry)
        except json.JSONDecodeError as exc:
            response = _jsonrpc_error(None, INVALID_REQUEST, str(exc))
        sys.stdout.write(json.dumps(response, ensure_ascii=False) + "\n")
        sys.stdout.flush()


def main():
    parser = argparse.ArgumentParser(
        description="Expose PaperStorm retrieval tools over a minimal MCP-style stdio server."
    )
    parser.add_argument(
        "--pdf-dir",
        default=None,
        help="Optional local PDF directory. Enables the local_pdf_search tool.",
    )
    args = parser.parse_args()

    serve_stdio(build_tool_registry(pdf_dir=args.pdf_dir))


if __name__ == "__main__":
    main()
