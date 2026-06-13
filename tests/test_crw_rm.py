"""Unit tests for the fastCRW retrieval module (``CRWSearchRM``).

These tests mock the HTTP layer with ``unittest.mock`` so no network calls are
made. They mirror the input/output contract of the other retrieval modules in
``knowledge_storm/rm.py`` (each result is a dict with the keys ``description``,
``snippets``, ``title`` and ``url``).
"""

import os
import unittest
from unittest import mock

from knowledge_storm.rm import CRWSearchRM


def _fake_response(payload):
    resp = mock.Mock()
    resp.json.return_value = payload
    return resp


class CRWSearchRMTest(unittest.TestCase):
    def _make_rm(self, **kwargs):
        # Avoid importing the (optional) WebPageHelper machinery during tests by
        # constructing the module with a key passed explicitly.
        kwargs.setdefault("crw_api_key", "test-key")
        return CRWSearchRM(**kwargs)

    def test_default_api_url_is_cloud(self):
        rm = self._make_rm()
        self.assertEqual(rm.crw_api_url, "https://fastcrw.com/api")

    def test_self_host_override_strips_trailing_slash(self):
        rm = self._make_rm(crw_api_url="http://localhost:3000/")
        self.assertEqual(rm.crw_api_url, "http://localhost:3000")

    @mock.patch.dict(os.environ, {"CRW_API_KEY": "env-key"}, clear=True)
    def test_reads_api_key_from_env(self):
        rm = CRWSearchRM()
        self.assertEqual(rm.crw_api_key, "env-key")

    @mock.patch("knowledge_storm.rm.requests.post")
    def test_forward_parses_results(self, mock_post):
        mock_post.return_value = _fake_response(
            {
                "success": True,
                "data": [
                    {
                        "url": "https://example.com/a",
                        "title": "Example A",
                        "description": "Description A",
                        "markdown": "# Example A\n\nFull markdown body.",
                    }
                ],
            }
        )
        rm = self._make_rm(k=5)
        results = rm.forward("what is fastcrw")

        self.assertEqual(len(results), 1)
        self.assertEqual(
            results[0],
            {
                "url": "https://example.com/a",
                "title": "Example A",
                "description": "Description A",
                "snippets": ["Description A"],
            },
        )

        # Verify the request shape: Bearer auth + /v1/search + query/limit body.
        _, kwargs = mock_post.call_args
        self.assertEqual(mock_post.call_args[0][0], "https://fastcrw.com/api/v1/search")
        self.assertEqual(kwargs["headers"]["Authorization"], "Bearer test-key")
        self.assertEqual(kwargs["json"], {"query": "what is fastcrw", "limit": 5})

    @mock.patch("knowledge_storm.rm.requests.post")
    def test_forward_uses_markdown_when_include_raw_content(self, mock_post):
        mock_post.return_value = _fake_response(
            {
                "success": True,
                "data": [
                    {
                        "url": "https://example.com/a",
                        "title": "Example A",
                        "description": "Description A",
                        "markdown": "Full markdown body.",
                    }
                ],
            }
        )
        rm = self._make_rm(include_raw_content=True)
        results = rm.forward("query")
        self.assertEqual(results[0]["snippets"], ["Full markdown body."])

    @mock.patch("knowledge_storm.rm.requests.post")
    def test_forward_respects_exclude_urls(self, mock_post):
        mock_post.return_value = _fake_response(
            {
                "success": True,
                "data": [
                    {
                        "url": "https://example.com/skip",
                        "title": "Skip",
                        "description": "Skip me",
                    }
                ],
            }
        )
        rm = self._make_rm()
        results = rm.forward("query", exclude_urls=["https://example.com/skip"])
        self.assertEqual(results, [])

    @mock.patch("knowledge_storm.rm.requests.post")
    def test_forward_handles_unsuccessful_envelope(self, mock_post):
        mock_post.return_value = _fake_response(
            {"success": False, "error": "rate limited"}
        )
        rm = self._make_rm()
        # Errors are swallowed and logged, mirroring the other RMs.
        self.assertEqual(rm.forward("query"), [])

    def test_get_usage_and_reset(self):
        rm = self._make_rm()
        rm.usage = 3
        self.assertEqual(rm.get_usage_and_reset(), {"CRWSearchRM": 3})
        self.assertEqual(rm.usage, 0)


if __name__ == "__main__":
    unittest.main()
