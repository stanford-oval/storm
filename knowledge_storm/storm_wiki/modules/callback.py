from knowledge_storm.storm_wiki.modules.storm_dataclass import DialogueTurn


class BaseCallbackHandler:
    """Base callback handler that can be used to handle callbacks from the STORM pipeline."""

    def on_identify_perspective_start(self):
        """Run when the perspective identification starts."""
        pass

    def on_identify_perspective_end(self, perspectives: list[str]):
        """Run when the perspective identification finishes."""
        pass

    def on_information_gathering_start(self):
        """Run when the information gathering starts."""
        pass

    def on_dialogue_turn_end(self, dlg_turn: DialogueTurn):
        """Run when a question asking and answering turn finishes."""
        pass

    def on_information_gathering_end(self):
        """Run when the information gathering finishes."""
        pass

    def on_information_organization_start(self):
        """Run when the information organization starts."""
        pass

    def on_direct_outline_generation_end(self, outline: str):
        """Run when the direct outline generation finishes."""
        pass

    def on_outline_refinement_end(self, outline: str):
        """Run when the outline refinement finishes."""
        pass

    def on_article_generation_start(self):
        """Run when the article generation starts."""
        pass

    def on_article_generation_end(self):
        """Run when the article generation finishes."""
        pass

    def on_article_polishing_start(self):
        """Run when the article polishing starts."""
        pass

    def on_article_polishing_end(self):
        """Run when the article polishing finishes."""
        pass