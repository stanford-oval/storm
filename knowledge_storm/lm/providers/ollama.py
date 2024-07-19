# knowledge_storm/lm/providers/ollama.py
import dspy


class OllamaClient(dspy.OllamaLocal):
    """A wrapper class for dspy.OllamaClient."""

    def __init__(self, model, port, url="http://localhost", **kwargs):
        """Copied from dspy/dsp/modules/hf_client.py with the addition of storing additional kwargs."""
        # Check if the URL has 'http://' or 'https://'
        if not url.startswith("http://") and not url.startswith("https://"):
            url = "http://" + url
        super().__init__(model=model, base_url=f"{url}:{port}", **kwargs)
        # Store additional kwargs for the generate method.
        self.kwargs = {**self.kwargs, **kwargs}