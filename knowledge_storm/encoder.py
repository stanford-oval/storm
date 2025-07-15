import os
import numpy as np

from concurrent.futures import ThreadPoolExecutor, as_completed
from typing import List, Tuple, Union, Optional, Dict, Literal
from pathlib import Path

try:
    import warnings

    with warnings.catch_warnings():
        warnings.filterwarnings("ignore", category=UserWarning)
        if "LITELLM_LOCAL_MODEL_COST_MAP" not in os.environ:
            os.environ["LITELLM_LOCAL_MODEL_COST_MAP"] = "True"
        import litellm

        litellm.drop_params = True
        litellm.telemetry = False

    from litellm.caching.caching import Cache

    disk_cache_dir = os.path.join(Path.home(), ".storm_local_cache")
    litellm.cache = Cache(disk_cache_dir=disk_cache_dir, type="disk")

except ImportError:

    class LitellmPlaceholder:
        def __getattr__(self, _):
            raise ImportError(
                "The LiteLLM package is not installed. Run `pip install litellm`."
            )

    litellm = LitellmPlaceholder()


class Encoder:
    """
    A wrapper class for the LiteLLM embedding model, designed to handle embedding
    generation tasks efficiently. It supports parallel processing and local caching of
    embedding results for improved performance.

    The Encoder utilizes the LiteLLM library to interact with various embedding models,
    such as OpenAI and Azure embeddings. Users can specify the desired encoder type and
    provide relevant API credentials during initialization.

    Features:
        - Support for multiple embedding models (e.g., OpenAI, Azure).
        - Parallel processing for faster embedding generation.
        - Local disk caching to store and reuse embedding results.
        - Total token usage tracking for cost monitoring.

    Note:
        Refer to the LiteLLM documentation for details on supported embedding models:
        https://docs.litellm.ai/docs/embedding/supported_embedding
    """

    def __init__(
        self,
        encoder_type: Optional[str] = None,
        api_key: Optional[str] = None,
        api_base: Optional[str] = None,
        api_version: Optional[str] = None,
    ):
        """
        Initializes the Encoder with the appropriate embedding model.

        Args:
            encoder_type (Optional[str]): Type of encoder ('openai', 'azure', etc.).
            api_key (Optional[str]): API key for the encoder service.
            api_base (Optional[str]): API base URL for the encoder service.
            api_version (Optional[str]): API version for the encoder service.
        """
        self.embedding_model_name = None
        self.kargs = {}
        self.total_token_usage = 0

        # Initialize the appropriate embedding model
        encoder_type = encoder_type or os.getenv("ENCODER_API_TYPE")
        if not encoder_type:
            raise ValueError("ENCODER_API_TYPE environment variable is not set.")

        if encoder_type.lower() == "openai":
            self.embedding_model_name = "text-embedding-3-small"
            self.kargs = {"api_key": api_key or os.getenv("OPENAI_API_KEY")}
        elif encoder_type.lower() == "azure":
            self.embedding_model_name = "azure/text-embedding-3-small"
            self.kargs = {
                "api_key": api_key or os.getenv("AZURE_API_KEY"),
                "api_base": api_base or os.getenv("AZURE_API_BASE"),
                "api_version": api_version or os.getenv("AZURE_API_VERSION"),
            }
        else:
            raise ValueError(
                f"Unsupported ENCODER_API_TYPE '{encoder_type}'. Supported types are 'openai', 'azure', 'together'."
            )

    def get_total_token_usage(self, reset: bool = False) -> int:
        """
        Retrieves the total token usage.

        Args:
            reset (bool): If True, resets the total token usage counter after retrieval.

        Returns:
            int: The total number of tokens used.
        """
        token_usage = self.total_token_usage
        if reset:
            self.total_token_usage = 0
        return token_usage

    def encode(self, texts: Union[str, List[str]], max_workers: int = 5) -> np.ndarray:
        """
        Public method to get embeddings for the given texts.

        Args:
            texts (Union[str, List[str]]): A single text string or a list of text strings to embed.

        Returns:
            np.ndarray: The array of embeddings.
        """
        return self._get_text_embeddings(texts, max_workers=max_workers)

    def _get_single_text_embedding(self, text):
        response = litellm.embedding(
            model=self.embedding_model_name, input=text, caching=True, **self.kargs
        )
        embedding = response.data[0]["embedding"]
        token_usage = response.get("usage", {}).get("total_tokens", 0)
        return text, embedding, token_usage

    def _get_text_embeddings(
        self,
        texts: Union[str, List[str]],
        max_workers: int = 5,
    ) -> Tuple[np.ndarray, int]:
        """
        Get text embeddings using OpenAI's text-embedding-3-small model.

        Args:
            texts (Union[str, List[str]]): A single text string or a list of text strings to embed.
            max_workers (int): The maximum number of workers for parallel processing.
            api_key (str): The API key for accessing OpenAI's services.
            embedding_cache (Optional[Dict[str, np.ndarray]]): A cache to store previously computed embeddings.

        Returns:
            Tuple[np.ndarray, int]: The 2D array of embeddings and the total token usage.
        """

        if isinstance(texts, str):
            _, embedding, tokens = self._get_single_text_embedding(texts)
            self.total_token_usage += tokens
            return np.array(embedding)

        embeddings = []
        total_tokens = 0

        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            futures = {
                executor.submit(self._get_single_text_embedding, text): text
                for text in texts
            }

            for future in as_completed(futures):
                try:
                    text, embedding, tokens = future.result()
                    embeddings.append((text, embedding, tokens))
                    total_tokens += tokens
                except Exception as e:
                    print(f"An error occurred for text: {futures[future]}")
                    print(e)

        # Sort results to match the order of the input texts
        embeddings.sort(key=lambda x: texts.index(x[0]))
        embeddings = [result[1] for result in embeddings]
        self.total_token_usage += total_tokens

        return np.array(embeddings)
