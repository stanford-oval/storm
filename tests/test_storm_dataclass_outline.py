import unittest

from knowledge_storm.storm_wiki.modules.storm_dataclass import StormArticle


class StormArticleFromOutlineStrTest(unittest.TestCase):
    """`StormArticle.from_outline_str` must build a section tree for any outline
    whose headings are as shallow as the echoed topic line."""

    def build_outline(self, topic, outline_str):
        article = StormArticle.from_outline_str(topic=topic, outline_str=outline_str)
        return article.get_outline_as_list(add_hashtags=True, include_root=False)

    def test_top_level_sections_after_echoed_topic_line(self):
        # The LM sometimes echoes the topic as a H1 heading and then writes the
        # sections as H1 headings too. Both must land under the article root.
        outline = "# Quantum computing\n# History\n## Early history\n# Applications"
        self.assertEqual(
            self.build_outline("Quantum computing", outline),
            ["# History", "## Early history", "# Applications"],
        )

    def test_non_heading_line_is_ignored(self):
        # An outline file may start with a preamble line that is not a heading.
        outline = "Outline for the page\n# History\n## Early history"
        self.assertEqual(
            self.build_outline("Quantum computing", outline),
            ["# History", "## Early history"],
        )

    def test_hash_inside_section_name_does_not_deepen_section(self):
        # Only leading hashtags mark the level; "#" in a title is plain text, so
        # the subsection still belongs to the section above it.
        outline = "# C# history\n## Release timeline"
        self.assertEqual(
            self.build_outline("Programming languages", outline),
            ["# C# history", "## Release timeline"],
        )


if __name__ == "__main__":
    unittest.main()
