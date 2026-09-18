"""Portable Parallel retriever tests using the real MCP SDK and an HTTP fixture.

Run from the repository root: python -m unittest discover -s tests -v
"""

import argparse
import ast
import asyncio
from contextlib import contextmanager, nullcontext
import json
from pathlib import Path
from types import SimpleNamespace
import unittest
from unittest.mock import patch

import httpx
from knowledge_storm import __version__
from knowledge_storm.interface import Retriever
from knowledge_storm.rm import ParallelSearch
from knowledge_storm.storm_wiki.modules.knowledge_curation import TopicExpert
from knowledge_storm.collaborative_storm.modules.grounded_question_answering import (
    AnswerQuestionModule,
)


def source(url="https://example.org/source", excerpts=None, title="Source"):
    return {
        "url": url,
        "title": title,
        "excerpts": excerpts or ["Useful evidence [1]."],
    }


class MCPFixture:
    """Respond to actual SDK JSON-RPC requests at the HTTP transport boundary."""

    def __init__(self, result=None, rpc_error=None, redirect=False, paginated=False):
        self.result = (
            result
            if result is not None
            else {
                "content": [],
                "structuredContent": {"results": [source()]},
            }
        )
        self.rpc_error = rpc_error
        self.redirect = redirect
        self.paginated = paginated
        self.requests = []
        self.clients = []

    def respond(self, request):
        self.requests.append(request)
        if self.redirect:
            return httpx.Response(
                307, headers={"Location": "https://other.example/mcp"}
            )
        message = json.loads(request.content)
        method = message["method"]
        if "id" not in message:
            return httpx.Response(202)
        if method == "initialize":
            result = {
                "protocolVersion": message["params"]["protocolVersion"],
                "capabilities": {"tools": {}},
                "serverInfo": {"name": "fixture", "version": "1"},
            }
        elif method == "tools/list":
            if self.paginated and not message.get("params", {}).get("cursor"):
                result = {"tools": [], "nextCursor": "next"}
            else:
                result = {
                    "tools": [
                        {
                            "name": "web_search",
                            "inputSchema": {
                                "type": "object",
                                "properties": {
                                    "objective": {"type": "string"},
                                    "search_queries": {
                                        "type": "array",
                                        "items": {"type": "string"},
                                    },
                                    "session_id": {"type": "string"},
                                },
                                "required": ["objective", "search_queries"],
                            },
                        }
                    ]
                }
        elif method == "tools/call":
            if self.rpc_error:
                return httpx.Response(
                    200,
                    json={
                        "jsonrpc": "2.0",
                        "id": message["id"],
                        "error": self.rpc_error,
                    },
                )
            result = self.result
        else:
            raise AssertionError(f"Unexpected MCP method: {method}")
        return httpx.Response(
            200, json={"jsonrpc": "2.0", "id": message["id"], "result": result}
        )

    @contextmanager
    def install(self):
        client_class = httpx.AsyncClient

        def client(**kwargs):
            actual = client_class(transport=httpx.MockTransport(self.respond), **kwargs)
            self.clients.append(actual)
            return actual

        with patch("knowledge_storm.rm.httpx.AsyncClient", side_effect=client):
            yield self

    def messages(self, method):
        return [
            json.loads(request.content)
            for request in self.requests
            if json.loads(request.content)["method"] == method
        ]


class ParallelSearchTests(unittest.TestCase):
    def setUp(self):
        self.env = patch.dict("os.environ", {}, clear=True)
        self.env.start()
        self.addCleanup(self.env.stop)

    def test_sdk_discovery_call_and_identification(self):
        fixture = MCPFixture(paginated=True)
        rm = ParallelSearch()
        with fixture.install():
            results = rm("Knowledge curation")
        self.assertEqual(results[0]["snippets"], ["Useful evidence [1]."])
        messages = [
            json.loads(request.content)["method"] for request in fixture.requests
        ]
        self.assertEqual(
            messages[:4],
            ["initialize", "notifications/initialized", "tools/list", "tools/list"],
        )
        call = fixture.messages("tools/call")[0]
        self.assertEqual(
            call["params"],
            {
                "name": "web_search",
                "arguments": {
                    "objective": "Knowledge curation",
                    "search_queries": ["Knowledge curation"],
                    "session_id": rm.session_id,
                },
            },
        )
        for request in fixture.requests:
            self.assertEqual(str(request.url), "https://search.parallel.ai/mcp")
            self.assertTrue(
                request.headers["user-agent"].startswith(
                    f"knowledge-storm/{__version__} python-httpx/"
                )
            )
            self.assertNotIn("authorization", request.headers)
            self.assertIn("application/json", request.headers["accept"])
            self.assertIn("text/event-stream", request.headers["accept"])
        self.assertEqual(rm.get_usage_and_reset(), {"ParallelSearch": 1})
        self.assertEqual(rm.get_usage_and_reset(), {"ParallelSearch": 0})
        self.assertTrue(all(client.is_closed for client in fixture.clients))

    def test_filter_before_per_query_k_and_read_structured_once(self):
        payload = {
            "results": [
                source("https://example.org/excluded"),
                source("https://example.org/invalid"),
                source("https://example.org/a", title=None),
                source("https://example.org/b"),
                source("https://example.org/c"),
            ]
        }
        fixture = MCPFixture(
            result={
                "structuredContent": payload,
                "content": [{"type": "text", "text": json.dumps(payload)}],
            }
        )
        rm = ParallelSearch(
            k=2, is_valid_source=lambda url: not url.endswith("invalid")
        )
        with fixture.install():
            results = rm(
                ["first", "second"], exclude_urls=["https://example.org/excluded"]
            )
        self.assertEqual(
            [result["url"] for result in results],
            ["https://example.org/a", "https://example.org/b"] * 2,
        )
        self.assertEqual(results[0]["title"], "")
        self.assertEqual(results[0]["description"], "Useful evidence [1].")
        self.assertEqual(rm.get_usage_and_reset(), {"ParallelSearch": 2})

    def test_json_text_payload_and_valid_empty_results(self):
        for payload in [{"results": [source()]}, {"results": []}]:
            with self.subTest(payload=payload):
                fixture = MCPFixture(
                    result={"content": [{"type": "text", "text": json.dumps(payload)}]}
                )
                with fixture.install():
                    results = ParallelSearch()("query")
                self.assertEqual(len(results), len(payload["results"]))

    def test_warnings_are_preserved(self):
        fixture = MCPFixture(
            result={
                "content": [],
                "structuredContent": {
                    "results": [],
                    "warnings": ["Query was adjusted"],
                },
            }
        )
        with fixture.install(), self.assertLogs(
            "knowledge_storm.rm", level="WARNING"
        ) as logs:
            self.assertEqual(ParallelSearch()("query"), [])
        self.assertIn("Query was adjusted", logs.output[0])

    def test_tool_rpc_and_malformed_failures_are_not_empty_results(self):
        cases = [
            (
                MCPFixture(
                    result={
                        "content": [{"type": "text", "text": "rate limited"}],
                        "isError": True,
                    }
                ),
                RuntimeError,
                "tool error",
            ),
            (
                MCPFixture(rpc_error={"code": -32000, "message": "RPC failed"}),
                RuntimeError,
                "transport or RPC",
            ),
            (
                MCPFixture(result={"content": [], "structuredContent": {}}),
                ValueError,
                "results list",
            ),
            (
                MCPFixture(
                    result={
                        "content": [],
                        "structuredContent": {"results": [source(excerpts=[42])]},
                    }
                ),
                ValueError,
                "malformed search result",
            ),
            (
                MCPFixture(result={"content": [{"type": "text", "text": "not JSON"}]}),
                ValueError,
                "",
            ),
        ]
        for fixture, error, message in cases:
            with self.subTest(error=error, message=message), fixture.install():
                rm = ParallelSearch()
                with self.assertRaisesRegex(error, message):
                    rm("query")
                self.assertEqual(rm.get_usage_and_reset(), {"ParallelSearch": 1})

    def test_explicit_and_environment_authentication(self):
        for constructor_key, environment_key, expected in [
            ("explicit", "environment", "explicit"),
            (None, "environment", "environment"),
        ]:
            with self.subTest(constructor_key=constructor_key), patch.dict(
                "os.environ", {"PARALLEL_API_KEY": environment_key}
            ):
                fixture = MCPFixture()
                with fixture.install():
                    ParallelSearch(api_key=constructor_key)("query")
                self.assertTrue(
                    all(
                        request.headers["authorization"] == f"Bearer {expected}"
                        for request in fixture.requests
                    )
                )

    def test_authentication_failure_has_no_anonymous_retry(self):
        fixture = MCPFixture(result={"content": [], "isError": True})
        with fixture.install(), self.assertRaisesRegex(RuntimeError, "tool error"):
            ParallelSearch(api_key="invalid")("query")
        self.assertEqual(len(fixture.messages("tools/call")), 1)
        self.assertTrue(
            all(
                request.headers["authorization"] == "Bearer invalid"
                for request in fixture.requests
            )
        )

    def test_redirect_is_not_followed(self):
        fixture = MCPFixture(redirect=True)
        with fixture.install(), self.assertRaises(RuntimeError):
            ParallelSearch(api_key="private")("query")
        self.assertEqual(len(fixture.requests), 1)
        self.assertEqual(fixture.requests[0].url.host, "search.parallel.ai")

    def test_timeout_covers_whole_operation(self):
        async def slow_request(request):
            await asyncio.sleep(1)
            raise AssertionError("Deadline did not cancel the HTTP operation")

        client_class = httpx.AsyncClient
        with patch(
            "knowledge_storm.rm.httpx.AsyncClient",
            side_effect=lambda **kwargs: client_class(
                transport=httpx.MockTransport(slow_request), **kwargs
            ),
        ):
            with self.assertRaises(RuntimeError) as error:
                ParallelSearch(timeout=0.01)("query")
        self.assertIsInstance(error.exception.__cause__, TimeoutError)

    def test_input_validation_does_not_issue_requests(self):
        fixture = MCPFixture()
        with fixture.install():
            rm = ParallelSearch()
            for query in ["", " ", ["valid", ""], [42]]:
                with self.subTest(query=query), self.assertRaises(ValueError):
                    rm(query)
            self.assertEqual(rm.get_usage_and_reset(), {"ParallelSearch": 0})
            self.assertEqual(fixture.requests, [])
        for kwargs in [
            {"k": 0},
            {"timeout": 0},
            {"timeout": float("inf")},
            {"api_key": " "},
        ]:
            with self.subTest(kwargs=kwargs), self.assertRaises(ValueError):
                ParallelSearch(**kwargs)

    def test_canonical_retriever_concurrent_calls_share_task_identifier(self):
        fixture = MCPFixture()
        rm = ParallelSearch()
        with fixture.install():
            information = Retriever(rm, max_thread=4).retrieve(
                ["one", "two", "three", "four"]
            )
        self.assertEqual(len(information), 4)
        self.assertEqual(
            [item.meta["query"] for item in information],
            ["one", "two", "three", "four"],
        )
        self.assertEqual(information[0].snippets, ["Useful evidence ."])
        calls = fixture.messages("tools/call")
        self.assertEqual(
            {call["params"]["arguments"]["session_id"] for call in calls},
            {rm.session_id},
        )
        self.assertEqual(len(fixture.clients), 4)
        self.assertEqual(len({id(client) for client in fixture.clients}), 4)
        self.assertTrue(all(client.is_closed for client in fixture.clients))
        self.assertEqual(rm.get_usage_and_reset(), {"ParallelSearch": 4})

    def test_sync_forward_inside_running_event_loop(self):
        async def invoke():
            return ParallelSearch()("query")

        with MCPFixture().install():
            self.assertEqual(len(asyncio.run(invoke())), 1)

    def test_native_query_producers_filter_blank_lines_before_query_cap(self):
        for output, expected in [
            ("- first\n \n- second\n- third", ["first", "second"]),
            (" \n", []),
        ]:
            for producer in ["storm", "costorm"]:
                with self.subTest(producer=producer, output=output):
                    rm = ParallelSearch()
                    retriever = Retriever(rm)
                    prediction = SimpleNamespace(queries=output)
                    if producer == "storm":
                        module = TopicExpert(None, 2, 3, retriever)
                        module.generate_queries = lambda **kwargs: prediction
                        module.answer_question = lambda **kwargs: SimpleNamespace(
                            answer="Useful evidence [1]."
                        )
                        invoke = lambda: module.forward("topic", "question", "")
                    else:
                        logger = SimpleNamespace(
                            log_event=lambda name: nullcontext(),
                            add_query_count=lambda **kwargs: None,
                        )
                        module = AnswerQuestionModule(retriever, 2, None, logger)
                        module.question_to_query = lambda **kwargs: prediction
                        invoke = lambda: module.retrieve_information(
                            "topic", "question"
                        )
                    fixture = MCPFixture()
                    with fixture.install():
                        result = invoke()
                    queries, information = (
                        (result.queries, result.searched_results)
                        if producer == "storm"
                        else result
                    )
                    self.assertEqual(queries, expected)
                    self.assertEqual(len(information), len(expected))
                    self.assertEqual(
                        {
                            call["params"]["arguments"]["objective"]
                            for call in fixture.messages("tools/call")
                        },
                        set(expected),
                    )
                    self.assertEqual(
                        rm.get_usage_and_reset(), {"ParallelSearch": len(expected)}
                    )

    def test_generic_cli_parsers_and_native_provider_selection(self):
        root = Path(__file__).resolve().parents[1]
        scripts = list((root / "examples/storm_examples").glob("run_storm_wiki_*.py"))
        scripts += list((root / "examples/costorm_examples").glob("run_costorm_*.py"))
        checked = 0
        for path in scripts:
            tree = ast.parse(path.read_text())
            main = next(
                (
                    node
                    for node in tree.body
                    if isinstance(node, ast.FunctionDef) and node.name == "main"
                ),
                None,
            )
            selector = (
                next(
                    (
                        node
                        for node in main.body
                        if isinstance(node, ast.Match)
                        and ast.unparse(node.subject) == "args.retriever"
                    ),
                    None,
                )
                if main
                else None
            )
            if selector is None:
                continue
            checked += 1
            with self.subTest(script=path.name):
                # Execute the script's actual parser and provider match without
                # creating LMs, asking for a topic, or running article generation.
                entry = next(
                    node
                    for node in tree.body
                    if isinstance(node, ast.If)
                    and ast.unparse(node.test) == "__name__ == '__main__'"
                )
                namespace = {"ArgumentParser": argparse.ArgumentParser}
                exec(
                    compile(
                        ast.Module(body=entry.body[:-1], type_ignores=[]),
                        str(path),
                        "exec",
                    ),
                    namespace,
                )
                parser = namespace["parser"]
                args = parser.parse_args([])
                self.assertEqual(args.retriever, "parallel")
                self.assertEqual(
                    parser.parse_args(["--retriever", "you"]).retriever, "you"
                )
                engine_args = SimpleNamespace(search_top_k=3)
                namespace.update(
                    args=args, engine_args=engine_args, ParallelSearch=ParallelSearch
                )
                exec(
                    compile(
                        ast.Module(body=[selector], type_ignores=[]), str(path), "exec"
                    ),
                    namespace,
                )
                rm = namespace["rm"]
                self.assertIsInstance(rm, ParallelSearch)
                with MCPFixture().install():
                    information = Retriever(rm).retrieve("query")
                self.assertEqual(information[0].url, "https://example.org/source")
                self.assertTrue(information[0].snippets)
        self.assertEqual(checked, 8)


if __name__ == "__main__":
    unittest.main()
