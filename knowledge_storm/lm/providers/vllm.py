# knowledge_storm/lm/providers/vllm.py
import random

import dspy
from dsp.modules.hf import openai_to_hf
from dsp.modules.hf_client import send_hfvllm_request_v00, send_hftgi_request_v01_wrapped


class VLLMClient(dspy.HFClientVLLM):
    """A wrapper class for dspy.HFClientVLLM."""

    def __init__(self, model, port, url="http://localhost", **kwargs):
        """Copied from dspy/dsp/modules/hf_client.py with the addition of storing additional kwargs."""

        super().__init__(model=model, port=port, url=url, **kwargs)
        # Store additional kwargs for the generate method.
        self.kwargs = {**self.kwargs, **kwargs}

    def _generate(self, prompt, **kwargs):
        """Copied from dspy/dsp/modules/hf_client.py with the addition of passing kwargs to VLLM server."""
        kwargs = {**self.kwargs, **kwargs}

        # payload = {
        #     "model": kwargs["model"],
        #     "prompt": prompt,
        #     "max_tokens": kwargs["max_tokens"],
        #     "temperature": kwargs["temperature"],
        # }
        payload = {
            "prompt": prompt,
            **kwargs
        }

        response = send_hfvllm_request_v00(
            f"{self.url}/v1/completions",
            json=payload,
            headers=self.headers,
        )

        try:
            json_response = response.json()
            completions = json_response["choices"]
            response = {
                "prompt": prompt,
                "choices": [{"text": c["text"]} for c in completions],
            }
            return response

        except Exception as e:
            print("Failed to parse JSON response:", response.text)
            raise Exception("Received invalid JSON response from server")


class TGIClient(dspy.HFClientTGI):
    def __init__(self, model, port, url, http_request_kwargs=None, **kwargs):
        super().__init__(model=model, port=port, url=url, http_request_kwargs=http_request_kwargs, **kwargs)

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