# knowledge_storm/lm/providers/anthropic.py
import logging
import os
from typing import Optional, Any

import backoff
import dspy
from dsp import ERRORS, backoff_hdlr, giveup_hdlr

try:
    from anthropic import RateLimitError
except ImportError:
    RateLimitError = None


class ClaudeModel(dspy.dsp.modules.lm.LM):
    """Copied from dspy/dsp/modules/anthropic.py with the addition of tracking token usage."""

    def __init__(
            self,
            model: str,
            api_key: Optional[str] = None,
            api_base: Optional[str] = None,
            **kwargs,
    ):
        super().__init__(model)
        try:
            from anthropic import Anthropic
        except ImportError as err:
            raise ImportError("Claude requires `pip install anthropic`.") from err

        self.provider = "anthropic"
        self.api_key = api_key = os.environ.get("ANTHROPIC_API_KEY") if api_key is None else api_key
        self.api_base = "https://api.anthropic.com/v1/messages" if api_base is None else api_base
        self.kwargs = {"temperature": kwargs.get("temperature", 0.0),
                       "max_tokens": min(kwargs.get("max_tokens", 4096), 4096), "top_p": kwargs.get("top_p", 1.0),
                       "top_k": kwargs.get("top_k", 1), "n": kwargs.pop("n", kwargs.pop("num_generations", 1)),
                       **kwargs, "model": model}
        self.history: list[dict[str, Any]] = []
        self.client = Anthropic(api_key=api_key)
        self.model = model

        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def log_usage(self, response):
        """Log the total tokens from the Anthropic API response."""
        usage_data = response.usage
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.input_tokens
                self.completion_tokens += usage_data.output_tokens

    def get_usage_and_reset(self):
        """Get the total tokens used and reset the token usage."""
        usage = {
            self.model:
                {'prompt_tokens': self.prompt_tokens, 'completion_tokens': self.completion_tokens}
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0

        return usage

    def basic_request(self, prompt: str, **kwargs):
        raw_kwargs = kwargs
        kwargs = {**self.kwargs, **kwargs}
        # caching mechanism requires hashable kwargs
        kwargs["messages"] = [{"role": "user", "content": prompt}]
        kwargs.pop("n")
        response = self.client.messages.create(**kwargs)
        # history = {
        #     "prompt": prompt,
        #     "response": response,
        #     "kwargs": kwargs,
        #     "raw_kwargs": raw_kwargs,
        # }
        json_serializable_history = {
            "prompt": prompt,
            "response": {
                "content": response.content[0].text,
                "model": response.model,
                "role": response.role,
                "stop_reason": response.stop_reason,
                "stop_sequence": response.stop_sequence,
                "type": response.type,
                "usage": {
                    "input_tokens": response.usage.input_tokens,
                    "output_tokens": response.usage.output_tokens,
                }
            },
            "kwargs": kwargs,
            "raw_kwargs": raw_kwargs,
        }
        self.history.append(json_serializable_history)
        return response

    @backoff.on_exception(
        backoff.expo,
        (RateLimitError,),
        max_time=1000,
        max_tries=8,
        on_backoff=backoff_hdlr,
        giveup=giveup_hdlr,
    )
    def request(self, prompt: str, **kwargs):
        """Handles retrieval of completions from Anthropic whilst handling API errors."""
        return self.basic_request(prompt, **kwargs)

    def __call__(self, prompt, only_completed=True, return_sorted=False, **kwargs):
        """Retrieves completions from Anthropic.

        Args:
            prompt (str): prompt to send to Anthropic
            only_completed (bool, optional): return only completed responses and ignores completion due to length. Defaults to True.
            return_sorted (bool, optional): sort the completion choices using the returned probabilities. Defaults to False.

        Returns:
            list[str]: list of completion choices
        """
        assert only_completed, "for now"
        assert return_sorted is False, "for now"
        # per eg here: https://docs.anthropic.com/claude/reference/messages-examples
        # max tokens can be used as a proxy to return smaller responses
        # so this cannot be a proper indicator for incomplete response unless it isnt the user-intent.
        n = kwargs.pop("n", 1)
        completions = []
        for _ in range(n):
            response = self.request(prompt, **kwargs)
            self.log_usage(response)
            # This is the original behavior in dspy/dsp/modules/anthropic.py.
            # Comment it out because it can cause "IndexError: list index out of range" silently
            # which is not transparent to developers.
            # if only_completed and response.stop_reason == "max_tokens":
            #     continue
            completions = [c.text for c in response.content]
        return completions
