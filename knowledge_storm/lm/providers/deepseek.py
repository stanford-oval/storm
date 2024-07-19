# knowledge_storm/lm/providers/deepseek.py
import logging
import os
import threading
from typing import Optional, Any

import backoff
import dspy
import requests
from dsp import ERRORS, backoff_hdlr, giveup_hdlr


class DeepSeekModel(dspy.OpenAI):
    """A wrapper class for DeepSeek API, compatible with dspy.OpenAI."""

    def __init__(
            self,
            model: str = "deepseek-chat",
            api_key: Optional[str] = None,
            api_base: str = "https://api.deepseek.com",
            **kwargs
    ):
        super().__init__(model=model, api_key=api_key, api_base=api_base, **kwargs)
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.model = model
        self.api_key = api_key or os.getenv("DEEPSEEK_API_KEY")
        self.api_base = api_base
        if not self.api_key:
            raise ValueError(
                "DeepSeek API key must be provided either as an argument or as an environment variable DEEPSEEK_API_KEY")

    def log_usage(self, response):
        """Log the total tokens from the DeepSeek API response."""
        usage_data = response.get('usage')
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.get('prompt_tokens', 0)
                self.completion_tokens += usage_data.get('completion_tokens', 0)

    def get_usage_and_reset(self):
        """Get the total tokens used and reset the token usage."""
        usage = {
            self.model:
                {'prompt_tokens': self.prompt_tokens, 'completion_tokens': self.completion_tokens}
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0
        return usage

    @backoff.on_exception(
        backoff.expo,
        ERRORS,
        max_time=1000,
        on_backoff=backoff_hdlr,
        giveup=giveup_hdlr,
    )
    def _create_completion(self, prompt: str, **kwargs):
        """Create a completion using the DeepSeek API."""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}"
        }
        data = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            **kwargs
        }
        response = requests.post(f"{self.api_base}/v1/chat/completions", headers=headers, json=data)
        response.raise_for_status()
        return response.json()

    def __call__(
            self,
            prompt: str,
            only_completed: bool = True,
            return_sorted: bool = False,
            **kwargs,
    ) -> list[dict[str, Any]]:
        """Call the DeepSeek API to generate completions."""
        assert only_completed, "for now"
        assert return_sorted is False, "for now"

        response = self._create_completion(prompt, **kwargs)

        # Log the token usage from the DeepSeek API response.
        self.log_usage(response)

        choices = response["choices"]
        completions = [choice["message"]["content"] for choice in choices]

        history = {
            "prompt": prompt,
            "response": response,
            "kwargs": kwargs,
        }
        self.history.append(history)

        return completions
