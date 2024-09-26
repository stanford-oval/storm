import logging
import os
import random
import threading
from typing import Optional, Literal, Any

import backoff
import dspy
import requests
from dsp import ERRORS, backoff_hdlr, giveup_hdlr
from dsp.modules.hf import openai_to_hf
from dsp.modules.hf_client import send_hftgi_request_v01_wrapped
from openai import OpenAI
from transformers import AutoTokenizer

try:
    from anthropic import RateLimitError
except ImportError:
    RateLimitError = None


class OpenAIModel(dspy.OpenAI):
    """A wrapper class for dspy.OpenAI."""

    def __init__(
        self,
        model: str = "gpt-4o-mini",
        api_key: Optional[str] = None,
        model_type: Literal["chat", "text"] = None,
        **kwargs,
    ):
        super().__init__(model=model, api_key=api_key, model_type=model_type, **kwargs)
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def log_usage(self, response):
        """Log the total tokens from the OpenAI API response."""
        usage_data = response.get("usage")
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.get("prompt_tokens", 0)
                self.completion_tokens += usage_data.get("completion_tokens", 0)

    def get_usage_and_reset(self):
        """Get the total tokens used and reset the token usage."""
        usage = {
            self.kwargs.get("model")
            or self.kwargs.get("engine"): {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0

        return usage

    def __call__(
        self,
        prompt: str,
        only_completed: bool = True,
        return_sorted: bool = False,
        **kwargs,
    ) -> list[dict[str, Any]]:
        """Copied from dspy/dsp/modules/gpt3.py with the addition of tracking token usage."""

        assert only_completed, "for now"
        assert return_sorted is False, "for now"

        # if kwargs.get("n", 1) > 1:
        #     if self.model_type == "chat":
        #         kwargs = {**kwargs}
        #     else:
        #         kwargs = {**kwargs, "logprobs": 5}

        response = self.request(prompt, **kwargs)

        # Log the token usage from the OpenAI API response.
        self.log_usage(response)

        choices = response["choices"]

        completed_choices = [c for c in choices if c["finish_reason"] != "length"]

        if only_completed and len(completed_choices):
            choices = completed_choices

        completions = [self._get_choice_text(c) for c in choices]
        if return_sorted and kwargs.get("n", 1) > 1:
            scored_completions = []

            for c in choices:
                tokens, logprobs = (
                    c["logprobs"]["tokens"],
                    c["logprobs"]["token_logprobs"],
                )

                if "<|endoftext|>" in tokens:
                    index = tokens.index("<|endoftext|>") + 1
                    tokens, logprobs = tokens[:index], logprobs[:index]

                avglog = sum(logprobs) / len(logprobs)
                scored_completions.append((avglog, self._get_choice_text(c)))

            scored_completions = sorted(scored_completions, reverse=True)
            completions = [c for _, c in scored_completions]

        return completions


class DeepSeekModel(dspy.OpenAI):
    """A wrapper class for DeepSeek API, compatible with dspy.OpenAI."""

    def __init__(
        self,
        model: str = "deepseek-chat",
        api_key: Optional[str] = None,
        api_base: str = "https://api.deepseek.com",
        **kwargs,
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
                "DeepSeek API key must be provided either as an argument or as an environment variable DEEPSEEK_API_KEY"
            )

    def log_usage(self, response):
        """Log the total tokens from the DeepSeek API response."""
        usage_data = response.get("usage")
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.get("prompt_tokens", 0)
                self.completion_tokens += usage_data.get("completion_tokens", 0)

    def get_usage_and_reset(self):
        """Get the total tokens used and reset the token usage."""
        usage = {
            self.model: {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
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
            "Authorization": f"Bearer {self.api_key}",
        }
        data = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            **kwargs,
        }
        response = requests.post(
            f"{self.api_base}/v1/chat/completions", headers=headers, json=data
        )
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


class AzureOpenAIModel(dspy.AzureOpenAI):
    """A wrapper class for dspy.AzureOpenAI."""

    def __init__(
        self,
        api_base: Optional[str] = None,
        api_version: Optional[str] = None,
        model: str = "gpt-4o-mini",
        api_key: Optional[str] = None,
        model_type: Literal["chat", "text"] = "chat",
        **kwargs,
    ):
        super().__init__(
            api_base=api_base,
            api_version=api_version,
            model=model,
            api_key=api_key,
            model_type=model_type,
            **kwargs,
        )
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def log_usage(self, response):
        """Log the total tokens from the OpenAI API response.
        Override log_usage() in dspy.AzureOpenAI for tracking accumulated token usage.
        """
        usage_data = response.get("usage")
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.get("prompt_tokens", 0)
                self.completion_tokens += usage_data.get("completion_tokens", 0)

    def get_usage_and_reset(self):
        """Get the total tokens used and reset the token usage."""
        usage = {
            self.kwargs.get("model")
            or self.kwargs.get("engine"): {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0

        return usage


class GroqModel(dspy.OpenAI):
    """A wrapper class for Groq API (https://console.groq.com/), compatible with dspy.OpenAI."""

    def __init__(
        self,
        model: str = "llama3-70b-8192",
        api_key: Optional[str] = None,
        api_base: str = "https://api.groq.com/openai/v1",
        **kwargs,
    ):
        super().__init__(model=model, api_key=api_key, api_base=api_base, **kwargs)
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self.model = model
        self.api_key = api_key or os.getenv("GROQ_API_KEY")
        self.api_base = api_base
        if not self.api_key:
            raise ValueError(
                "Groq API key must be provided either as an argument or as an environment variable GROQ_API_KEY"
            )

    def log_usage(self, response):
        """Log the total tokens from the Groq API response."""
        usage_data = response.get("usage")
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.get("prompt_tokens", 0)
                self.completion_tokens += usage_data.get("completion_tokens", 0)

    def get_usage_and_reset(self):
        """Get the total tokens used and reset the token usage."""
        usage = {
            self.model: {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
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
        """Create a completion using the Groq API."""
        headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {self.api_key}",
        }

        # Remove unsupported fields
        kwargs.pop("logprobs", None)
        kwargs.pop("logit_bias", None)
        kwargs.pop("top_logprobs", None)

        # Ensure N is 1 if supplied
        if "n" in kwargs and kwargs["n"] != 1:
            raise ValueError("Groq API only supports N=1")

        # Adjust temperature if it's 0
        if kwargs.get("temperature", 1) == 0:
            kwargs["temperature"] = 1e-8

        data = {
            "model": self.model,
            "messages": [{"role": "user", "content": prompt}],
            **kwargs,
        }

        # Remove 'name' field from messages if present
        for message in data["messages"]:
            message.pop("name", None)

        response = requests.post(
            f"{self.api_base}/chat/completions", headers=headers, json=data
        )
        response.raise_for_status()
        return response.json()

    def __call__(
        self,
        prompt: str,
        only_completed: bool = True,
        return_sorted: bool = False,
        **kwargs,
    ) -> list[dict[str, Any]]:
        """Call the Groq API to generate completions."""
        assert only_completed, "for now"
        assert return_sorted is False, "for now"

        response = self._create_completion(prompt, **kwargs)

        # Log the token usage from the Groq API response.
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
        self.api_key = api_key = (
            os.environ.get("ANTHROPIC_API_KEY") if api_key is None else api_key
        )
        self.api_base = (
            "https://api.anthropic.com/v1/messages" if api_base is None else api_base
        )
        self.kwargs = {
            "temperature": kwargs.get("temperature", 0.0),
            "max_tokens": min(kwargs.get("max_tokens", 4096), 4096),
            "top_p": kwargs.get("top_p", 1.0),
            "top_k": kwargs.get("top_k", 1),
            "n": kwargs.pop("n", kwargs.pop("num_generations", 1)),
            **kwargs,
            "model": model,
        }
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
            self.model: {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
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
                },
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


class VLLMClient(dspy.dsp.LM):
    """A client compatible with vLLM HTTP server.

    vLLM HTTP server is designed to be compatible with the OpenAI API. Use OpenAI client to interact with the server.
    """

    def __init__(
        self,
        model,
        port,
        model_type: Literal["chat", "text"] = "text",
        url="http://localhost",
        api_key="null",
        **kwargs,
    ):
        """Check out https://docs.vllm.ai/en/latest/serving/openai_compatible_server.html for more information."""
        super().__init__(model=model)
        # Store additional kwargs for the generate method.
        self.kwargs = {**self.kwargs, **kwargs}
        self.model = model
        self.base_url = f"{url}:{port}/v1/"
        if model_type == "chat":
            self.base_url += "chat/"
        self.client = OpenAI(base_url=self.base_url, api_key=api_key)
        self.prompt_tokens = 0
        self.completion_tokens = 0
        self._token_usage_lock = threading.Lock()

    def basic_request(self, prompt, **kwargs):
        completion = self.client.chat.completions.create(
            **kwargs,
            messages=[{"role": "user", "content": prompt}],
        )
        return completion

    @backoff.on_exception(
        backoff.expo,
        ERRORS,
        max_time=1000,
        on_backoff=backoff_hdlr,
    )
    def request(self, prompt: str, **kwargs):
        return self.basic_request(prompt, **kwargs)

    def log_usage(self, response):
        """Log the total tokens from the response."""
        usage_data = response.usage
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.prompt_tokens
                self.completion_tokens += usage_data.completion_tokens

    def get_usage_and_reset(self):
        """Get the total tokens used and reset the token usage."""
        usage = {
            self.kwargs.get("model")
            or self.kwargs.get("engine"): {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0

        return usage

    def __call__(self, prompt: str, **kwargs):
        kwargs = {**self.kwargs, **kwargs}

        try:
            response = self.request(prompt, **kwargs)
        except Exception as e:
            print(f"Failed to generate completion: {e}")
            raise Exception(e)

        self.log_usage(response)

        choices = response.choices
        completions = [choice.message.content for choice in choices]

        history = {
            "prompt": prompt,
            "response": response,
            "kwargs": kwargs,
        }
        self.history.append(history)

        return completions


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


class TGIClient(dspy.HFClientTGI):
    def __init__(self, model, port, url, http_request_kwargs=None, **kwargs):
        super().__init__(
            model=model,
            port=port,
            url=url,
            http_request_kwargs=http_request_kwargs,
            **kwargs,
        )

    def _generate(self, prompt, **kwargs):
        """Copied from dspy/dsp/modules/hf_client.py with the addition of removing hard-coded parameters."""
        kwargs = {**self.kwargs, **kwargs}

        payload = {
            "inputs": prompt,
            "parameters": {
                "do_sample": kwargs["n"] > 1,
                "best_of": kwargs["n"],
                "details": kwargs["n"] > 1,
                **kwargs,
            },
        }

        payload["parameters"] = openai_to_hf(**payload["parameters"])

        # Comment out the following lines to remove the hard-coded parameters.
        # payload["parameters"]["temperature"] = max(
        #     0.1, payload["parameters"]["temperature"],
        # )

        response = send_hftgi_request_v01_wrapped(
            f"{self.url}:{random.Random().choice(self.ports)}" + "/generate",
            url=self.url,
            ports=tuple(self.ports),
            json=payload,
            headers=self.headers,
            **self.http_request_kwargs,
        )

        try:
            json_response = response.json()
            # completions = json_response["generated_text"]

            completions = [json_response["generated_text"]]

            if (
                "details" in json_response
                and "best_of_sequences" in json_response["details"]
            ):
                completions += [
                    x["generated_text"]
                    for x in json_response["details"]["best_of_sequences"]
                ]

            response = {"prompt": prompt, "choices": [{"text": c} for c in completions]}
            return response
        except Exception:
            print("Failed to parse JSON response:", response.text)
            raise Exception("Received invalid JSON response from server")


class TogetherClient(dspy.HFModel):
    """A wrapper class for dspy.Together."""

    def __init__(
        self,
        model,
        api_key: Optional[str] = None,
        apply_tokenizer_chat_template=False,
        hf_tokenizer_name=None,
        model_type: Literal["chat", "text"] = "chat",
        **kwargs,
    ):
        """Copied from dspy/dsp/modules/hf_client.py with the support of applying tokenizer chat template."""

        super().__init__(model=model, is_client=True)
        self.session = requests.Session()
        self.api_key = api_key = (
            os.environ.get("TOGETHER_API_KEY") if api_key is None else api_key
        )
        self.model = model
        self.model_type = model_type
        if os.getenv("TOGETHER_API_BASE") is None:
            if self.model_type == "chat":
                self.api_base = "https://api.together.xyz/v1/chat/completions"
            else:
                self.api_base = "https://api.together.xyz/v1/completions"
        else:
            self.api_base = os.getenv("TOGETHER_API_BASE")

        # self.use_inst_template = False
        # if any(keyword in self.model.lower() for keyword in ["inst", "instruct"]):
        #     self.use_inst_template = True
        self.apply_tokenizer_chat_template = apply_tokenizer_chat_template
        if self.apply_tokenizer_chat_template:
            logging.info("Loading huggingface tokenizer.")
            if hf_tokenizer_name is None:
                hf_tokenizer_name = self.model
            self.tokenizer = AutoTokenizer.from_pretrained(
                hf_tokenizer_name, cache_dir=kwargs.get("cache_dir", None)
            )

        stop_default = "\n\n---"

        self.kwargs = {
            "temperature": kwargs.get("temperature", 0.0),
            "max_tokens": min(kwargs.get("max_tokens", 4096), 4096),
            "top_p": kwargs.get("top_p", 1.0),
            "top_k": kwargs.get("top_k", 1),
            "repetition_penalty": 1,
            "n": kwargs.pop("n", kwargs.pop("num_generations", 1)),
            "stop": stop_default if "stop" not in kwargs else kwargs["stop"],
            **kwargs,
        }
        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def log_usage(self, response):
        """Log the total tokens from the OpenAI API response."""
        usage_data = response.get("usage")
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.get("prompt_tokens", 0)
                self.completion_tokens += usage_data.get("completion_tokens", 0)

    def get_usage_and_reset(self):
        """Get the total tokens used and reset the token usage."""
        usage = {
            self.model: {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
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
    def _generate(self, prompt, **kwargs):
        kwargs = {**self.kwargs, **kwargs}

        stop = kwargs.get("stop")
        temperature = kwargs.get("temperature")
        max_tokens = kwargs.get("max_tokens", 150)
        top_p = kwargs.get("top_p", 0.7)
        top_k = kwargs.get("top_k", 50)
        repetition_penalty = kwargs.get("repetition_penalty", 1)
        if self.apply_tokenizer_chat_template:
            prompt = self.tokenizer.apply_chat_template(
                [{"role": "user", "content": prompt}], tokenize=False
            )
        # prompt = f"[INST]{prompt}[/INST]" if self.use_inst_template else prompt

        if self.model_type == "chat":
            messages = [
                {
                    "role": "system",
                    "content": "You are a helpful assistant. You must continue the user text directly without *any* additional interjections.",
                },
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

        headers = {"Authorization": f"Bearer {self.api_key}"}

        with self.session.post(self.api_base, headers=headers, json=body) as resp:
            resp_json = resp.json()
            # Log the token usage from the Together API response.
            self.log_usage(resp_json)
            if self.model_type == "chat":
                # completions = [resp_json['output'].get('choices', [])[0].get('message', {}).get('content', "")]
                completions = [
                    resp_json.get("choices", [])[0]
                    .get("message", {})
                    .get("content", "")
                ]
            else:
                # completions = [resp_json['output'].get('choices', [])[0].get('text', "")]
                completions = [resp_json.get("choices", [])[0].get("text", "")]
            response = {"prompt": prompt, "choices": [{"text": c} for c in completions]}
            return response


class GoogleModel(dspy.dsp.modules.lm.LM):
    """A wrapper class for Google Gemini API."""

    def __init__(
        self,
        model: str,
        api_key: Optional[str] = None,
        **kwargs,
    ):
        """You can use `genai.list_models()` to get a list of available models."""
        super().__init__(model)
        try:
            import google.generativeai as genai
        except ImportError as err:
            raise ImportError(
                "GoogleModel requires `pip install google-generativeai`."
            ) from err

        api_key = os.environ.get("GOOGLE_API_KEY") if api_key is None else api_key
        genai.configure(api_key=api_key)

        kwargs = {
            "candidate_count": 1,  # Caveat: Gemini API supports only one candidate for now.
            "temperature": (
                0.0 if "temperature" not in kwargs else kwargs["temperature"]
            ),
            "max_output_tokens": kwargs["max_tokens"],
            "top_p": 1,
            "top_k": 1,
            **kwargs,
        }

        kwargs.pop("max_tokens", None)  # GenerationConfig cannot accept max_tokens

        self.model = model
        self.config = genai.GenerationConfig(**kwargs)
        self.llm = genai.GenerativeModel(
            model_name=model, generation_config=self.config
        )

        self.kwargs = {
            "n": 1,
            **kwargs,
        }

        self.history: list[dict[str, Any]] = []

        self._token_usage_lock = threading.Lock()
        self.prompt_tokens = 0
        self.completion_tokens = 0

    def log_usage(self, response):
        """Log the total tokens from the Google API response."""
        usage_data = response.usage_metadata
        if usage_data:
            with self._token_usage_lock:
                self.prompt_tokens += usage_data.prompt_token_count
                self.completion_tokens += usage_data.candidates_token_count

    def get_usage_and_reset(self):
        """Get the total tokens used and reset the token usage."""
        usage = {
            self.model: {
                "prompt_tokens": self.prompt_tokens,
                "completion_tokens": self.completion_tokens,
            }
        }
        self.prompt_tokens = 0
        self.completion_tokens = 0

        return usage

    def basic_request(self, prompt: str, **kwargs):
        raw_kwargs = kwargs
        kwargs = {
            **self.kwargs,
            **kwargs,
        }

        # Google disallows "n" arguments.
        n = kwargs.pop("n", None)

        response = self.llm.generate_content(prompt, generation_config=kwargs)

        history = {
            "prompt": prompt,
            "response": [response.to_dict()],
            "kwargs": kwargs,
            "raw_kwargs": raw_kwargs,
        }
        self.history.append(history)

        return response

    @backoff.on_exception(
        backoff.expo,
        (Exception,),
        max_time=1000,
        max_tries=8,
        on_backoff=backoff_hdlr,
        giveup=giveup_hdlr,
    )
    def request(self, prompt: str, **kwargs):
        """Handles retrieval of completions from Google whilst handling API errors"""
        return self.basic_request(prompt, **kwargs)

    def __call__(
        self,
        prompt: str,
        only_completed: bool = True,
        return_sorted: bool = False,
        **kwargs,
    ):
        assert only_completed, "for now"
        assert return_sorted is False, "for now"

        n = kwargs.pop("n", 1)

        completions = []
        for _ in range(n):
            response = self.request(prompt, **kwargs)
            self.log_usage(response)
            completions.append(response.parts[0].text)

        return completions
