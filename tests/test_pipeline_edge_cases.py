import pathlib
import re
import unittest

REPO_ROOT = pathlib.Path(__file__).resolve().parents[1]


def read_source(relative_path):
    return (REPO_ROOT / relative_path).read_text(encoding="utf-8")


class PipelineEdgeCaseTests(unittest.TestCase):
    def test_storm_runner_honors_disable_perspective_argument(self):
        source = read_source("knowledge_storm/storm_wiki/engine.py")

        self.assertIn("disable_perspective=self.args.disable_perspective", source)
        self.assertNotIn("disable_perspective=False,", source)

    def test_article_generation_allows_missing_information_table(self):
        runner_source = read_source("knowledge_storm/storm_wiki/engine.py")
        generation_source = read_source(
            "knowledge_storm/storm_wiki/modules/article_generation.py"
        )

        self.assertIn("information_table: StormInformationTable = None", runner_source)
        self.assertIn("if information_table is not None:", generation_source)
        self.assertIn(
            "information_table.prepare_table_for_retrieval()", generation_source
        )

    def test_information_table_handles_empty_retrieval_corpus(self):
        source = read_source("knowledge_storm/storm_wiki/modules/storm_dataclass.py")

        self.assertIn("if not self.collected_snippets:", source)
        self.assertIn("self.encoder = None", source)
        self.assertIn("self.encoded_snippets = np.array([])", source)
        self.assertRegex(
            source,
            re.compile(
                r"def retrieve_information\(.*?return \[\]",
                flags=re.DOTALL,
            ),
        )

    def test_dialogue_turn_log_tolerates_missing_search_results(self):
        source = read_source("knowledge_storm/storm_wiki/modules/storm_dataclass.py")

        self.assertIn("for data in (self.search_results or [])", source)

    def test_costorm_turn_policy_and_step_have_clear_empty_state_guards(self):
        source = read_source("knowledge_storm/collaborative_storm/engine.py")

        self.assertIn(
            'assert conversation_history and conversation_history[-1].role == "Guest"',
            source,
        )
        self.assertIn("and self.experts", source)
        self.assertIn("if not self.conversation_history:", source)
        self.assertIn("Call warm_start() first or pass user_utterance", source)

    def test_costorm_expert_parsing_tolerates_missing_colon(self):
        source = read_source("knowledge_storm/collaborative_storm/engine.py")

        self.assertIn('expert_name.split(":", 1)', source)
        self.assertIn('role_name, role_description = expert_name, ""', source)
        self.assertIn("if not role_name:", source)


if __name__ == "__main__":
    unittest.main()
