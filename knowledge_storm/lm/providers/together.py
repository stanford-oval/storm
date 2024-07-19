# knowledge_storm/lm/providers/together.py
import logging
import os
import random
import threading
from typing import Optional, Literal, Any

import backoff
import dspy
import requests
from dsp import ERRORS, backoff_hdlr
from transformers import AutoTokenizer


class TogetherClient(dspy.HFModel):
    """A wrapper class for dspy.Together."""

    def __init__(self, model, apply_tokenizer_chat_template=False, hf_tokenizer_name=None, **kwargs):
        """Copied from dspy/dsp/modules/hf_client.py with the support of applying tokenizer chat template."""

        super().__init__(model=model, is_client=True)
        self.session = requests.Session()
        self.api_base = "https://api.together.xyz/v1/completions" if os.getenv(
            "TOGETHER_API_BASE") is None else os.getenv("TOGETHER_API_BASE")
        self.token = os.getenv("TOGETHER_API_KEY")
        self.model = model

        # self.use_inst_template = False
        # if any(keyword in self.model.lower() for keyword in ["inst", "instruct"]):
        #     self.use_inst_template = True
        self.apply_tokenizer_chat_template = apply_tokenizer_chat_template
        if self.apply_tokenizer_chat_template:
            logging.info("Loading huggingface tokenizer.")
            if hf_tokenizer_name is None:
                hf_tokenizer_name = self.model
            self.tokenizer = AutoTokenizer.from_pretrained(hf_tokenizer_name, cache_dir=kwargs.get("cache_dir", None))

        stop_default = "\n\n---"

        self.kwargs = {
            "temperature": 0.0,
            "max_tokens": 512,
            "top_p": 1,
            "top_k": 20,
            "repetition_penalty": 1,
            "n": 1,
            "stop": stop_default if "stop" not in kwargs else kwargs["stop"],
            **kwargs,
        }
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def log_usage(self, response):
        """Log the total tokens from the OpenAI API response."""
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
    )
    def _generate(self, prompt, use_chat_api=False, **kwargs):
        url = f"{self.api_base}"

        kwargs = {**self.kwargs, **kwargs}

        stop = kwargs.get("stop")
        temperature = kwargs.get("temperature")
        max_tokens = kwargs.get("max_tokens", 150)
        top_p = kwargs.get("top_p", 0.7)
        top_k = kwargs.get("top_k", 50)
        repetition_penalty = kwargs.get("repetition_penalty", 1)
        if self.apply_tokenizer_chat_template:
            prompt = self.tokenizer.apply_chat_template([{"role": "user", "content": prompt}], tokenize=False)
        # prompt = f"[INST]{prompt}[/INST]" if self.use_inst_template else prompt

        if use_chat_api:
            url = f"{self.api_base}/chat/completions"
            messages = [
                {"role": "system",
                 "content": "You are a helpful assistant. You must continue the user text directly without *any* additional interjections."},
                {"role": "user", "content": prompt},
            ]
            body = {
                "model": self.model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "top_p": top_p,
                "top_k": top_k,
                "repetition_penalty": repetition_penalty,
                "stop": stop,
            }
        else:
            body = {
                "model": self.model,
                "prompt": prompt,
                "temperature": temperature,
                "max_tokens": max_tokens,
                "top_p": top_p,
                "top_k": top_k,
                "repetition_penalty": repetition_penalty,
                "stop": stop,
            }

        headers = {"Authorization": f"Bearer {self.token}"}

        with self.session.post(url, headers=headers, json=body) as resp:
            resp_json = resp.json()
            # Log the token usage from the Together API response.
            self.log_usage(resp_json)
            if use_chat_api:
                # completions = [resp_json['output'].get('choices', [])[0].get('message', {}).get('content', "")]
                completions = [resp_json.get('choices', [])[0].get('message', {}).get('content', "")]
            else:
                # completions = [resp_json['output'].get('choices', [])[0].get('text', "")]
                completions = [resp_json.get('choices', [])[0].get('text', "")]
            response = {"prompt": prompt, "choices": [{"text": c} for c in completions]}
            return response
