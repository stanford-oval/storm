import unittest


class PaperStormServiceCliTest(unittest.TestCase):
    def test_single_task_cli_parser_supports_real_pipeline_options(self):
        from examples.storm_examples.run_paperstorm_service_task import build_parser

        args = build_parser().parse_args(
            [
                "--topic",
                "pim 神经网络抑制",
                "--run-mode",
                "paperstorm",
                "--retriever",
                "arxiv",
                "--llm-provider",
                "deepseek",
                "--llm-model",
                "flash",
                "--max-conv-turn",
                "1",
                "--max-perspective",
                "1",
                "--search-top-k",
                "2",
            ]
        )

        self.assertEqual(args.run_mode, "paperstorm")
        self.assertEqual(args.llm_provider, "deepseek")
        self.assertEqual(args.llm_model, "flash")
        self.assertEqual(args.max_conv_turn, 1)
        self.assertEqual(args.search_top_k, 2)


if __name__ == "__main__":
    unittest.main()
