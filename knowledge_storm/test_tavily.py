import os
import unittest
from unittest.mock import MagicMock, patch
from knowledge_storm.rm import TavilySearchRM

class TestTavilySearchRM(unittest.TestCase):
    def setUp(self):
        self.api_key = "test_api_key"
        os.environ["TAVILY_API_KEY"] = self.api_key

    def test_init(self):
        rm = TavilySearchRM(tavily_search_api_key=self.api_key, k=5)
        self.assertEqual(rm.tavily_search_api_key, self.api_key)
        self.assertEqual(rm.k, 5)

    @patch("requests.post")
    def test_forward(self, mock_post):
        # Mock response
        mock_response = MagicMock()
        mock_response.json.return_value = {
            "results": [
                {
                    "url": "http://example.com/1",
                    "title": "Example Title 1",
                    "content": "Example Content 1",
                    "raw_content": "Raw Content 1"
                },
                {
                    "url": "http://example.com/2",
                    "title": "Example Title 2",
                    "content": "Example Content 2",
                    "raw_content": "Raw Content 2"
                }
            ]
        }
        mock_post.return_value = mock_response

        rm = TavilySearchRM(tavily_search_api_key=self.api_key, k=2)
        results = rm.forward(query_or_queries="test query")

        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]["url"], "http://example.com/1")
        self.assertEqual(results[0]["snippets"], ["Example Content 1"])
        self.assertEqual(results[0]["description"], "Example Content 1")

        # Verify usage update
        usage = rm.get_usage_and_reset()
        self.assertEqual(usage["TavilySearchRM"], 1)

if __name__ == "__main__":
    unittest.main()
