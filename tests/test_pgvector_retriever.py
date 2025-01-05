import unittest
from unittest.mock import patch, MagicMock
from knowledge_storm.rm import PGVectorRetriever

class TestPGVectorRetriever(unittest.TestCase):

    @patch('knowledge_storm.rm.create_engine')
    @patch('knowledge_storm.rm.HuggingFaceEmbeddings')
    def setUp(self, MockHuggingFaceEmbeddings, MockCreateEngine):
        self.mock_model = MockHuggingFaceEmbeddings.return_value
        self.mock_engine = MockCreateEngine.return_value
        self.retriever = PGVectorRetriever(
            db_url='postgresql://user:password@localhost/dbname',
            table_name='documents',
            embedding_model='BAAI/bge-m3',
            k=3
        )

    @patch('knowledge_storm.rm.PGVectorRetriever.Session')
    def test_forward(self, MockSession):
        mock_session = MockSession.return_value
        mock_query = MagicMock()
        mock_session.query.return_value.order_by.return_value.limit.return_value.all.return_value = [
            MagicMock(description='desc1', content='content1', title='title1', url='url1'),
            MagicMock(description='desc2', content='content2', title='title2', url='url2')
        ]
        self.retriever.model.embed_query.return_value = [0.1, 0.2, 0.3]

        results = self.retriever.forward('test query', [])

        self.assertEqual(len(results), 2)
        self.assertEqual(results[0]['description'], 'desc1')
        self.assertEqual(results[0]['snippets'], ['content1'])
        self.assertEqual(results[0]['title'], 'title1')
        self.assertEqual(results[0]['url'], 'url1')

    def test_get_usage_and_reset(self):
        self.retriever.usage = 5
        usage = self.retriever.get_usage_and_reset()
        self.assertEqual(usage, {'PGVectorRetriever': 5})
        self.assertEqual(self.retriever.usage, 0)

if __name__ == '__main__':
    unittest.main()
