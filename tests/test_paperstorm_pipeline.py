import unittest
from pathlib import Path


class PaperStormPipelineTest(unittest.TestCase):
    def test_build_pipeline_config_from_task_state_uses_task_output_dir(self):
        from knowledge_storm.paperstorm_pipeline import build_pipeline_config_from_task_state

        state = {
            "task_id": "task-123",
            "topic": "pim 神经网络抑制",
            "retriever": "arxiv",
            "output_language": "zh",
            "output_dir": "C:/tmp/paperstorm/tasks/task-123",
            "expected_keywords": ["passive intermodulation"],
            "forbidden_keywords": ["DRAM"],
            "options": {
                "llm_provider": "deepseek",
                "llm_model": "flash",
                "max_conv_turn": 1,
                "max_perspective": 1,
                "search_top_k": 2,
                "max_thread_num": 1,
            },
        }

        config = build_pipeline_config_from_task_state(state)

        self.assertEqual(config.topic, "pim 神经网络抑制")
        self.assertTrue(config.topic_for_storm.startswith("pim 神经网络抑制"))
        self.assertIn("Simplified Chinese", config.topic_for_storm)
        self.assertEqual(config.output_root, str(Path("C:/tmp/paperstorm/tasks")))
        self.assertEqual(config.output_dir_name, "task-123")
        self.assertEqual(config.article_dir, str(Path("C:/tmp/paperstorm/tasks/task-123")))
        self.assertEqual(config.llm_provider, "deepseek")
        self.assertEqual(config.llm_model, "flash")
        self.assertEqual(config.search_top_k, 2)
        self.assertTrue(config.do_research)
        self.assertTrue(config.do_generate_outline)
        self.assertTrue(config.do_generate_article)
        self.assertTrue(config.do_polish_article)

    def test_build_pipeline_config_supports_local_pdf_options(self):
        from knowledge_storm.paperstorm_pipeline import build_pipeline_config_from_task_state

        state = {
            "task_id": "task-local-pdf",
            "topic": "local papers",
            "retriever": "local-pdf",
            "output_language": "original",
            "output_dir": "C:/tmp/paperstorm/tasks/task-local-pdf",
            "options": {
                "pdf_dir": "D:/papers",
                "do_polish_article": False,
                "remove_duplicate": True,
            },
        }

        config = build_pipeline_config_from_task_state(state)

        self.assertEqual(config.retriever, "local-pdf")
        self.assertEqual(config.pdf_dir, "D:/papers")
        self.assertFalse(config.do_polish_article)
        self.assertTrue(config.remove_duplicate)


if __name__ == "__main__":
    unittest.main()
