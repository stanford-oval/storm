import requests
import os
from typing import List, Tuple, Union, Optional, Dict, Literal
import numpy as np

from concurrent.futures import ThreadPoolExecutor, as_completed


class EmbeddingModel:
    def __init__(self):
        pass

    def get_embedding(self, text: str) -> Tuple[np.ndarray, int]:
        raise Exception("Not implemented")


class OpenAIEmbeddingModel(EmbeddingModel):
    def __init__(self, model: str = "text-embedding-3-small", api_key: str = None):
        if not api_key:
            api_key = os.getenv("OPENAI_API_KEY")

        self.url = "https://api.openai.com/v1/embeddings"
        self.headers = {
            "Content-Type": "application/json",
            "Authorization": f"Bearer {api_key}",
        }
        self.model = model

    def get_embedding(self, text: str) -> Tuple[np.ndarray, int]:
        data = {"input": text, "model": self.model}

        response = requests.post(self.url, headers=self.headers, json=data)
        if response.status_code == 200:
            data = response.json()
            embedding = np.array(data["data"][0]["embedding"])
            token = data["usage"]["prompt_tokens"]
            return embedding, token
        else:
            response.raise_for_status()


class TogetherEmbeddingModel:
    def __init__(self, model: str = "BAAI/bge-large-en-v1.5", api_key: str = None):
        import together

        self.model = model
        if not api_key:
            api_key = os.getenv("TOGETHER_API_KEY")
        self.together_client = together.Together(api_key=api_key)

    def get_embedding(self, text: str) -> Tuple[np.ndarray, int]:
        response = self.together_client.embeddings.create(input=text, model=self.model)
        return response.data[0].embedding, -1


class AzureOpenAIEmbeddingModel:
    def __init__(self, model: str = "text-embedding-3-small", api_key: str = None):
        from openai import AzureOpenAI

        self.model = model
        if not api_key:
            api_key = os.getenv("AZURE_API_KEY")

        self.client = AzureOpenAI(
            api_key=api_key,
            api_version=os.getenv("AZURE_API_VERSION"),
            azure_endpoint=os.getenv("AZURE_API_BASE"),
        )

    def get_embedding(self, text: str) -> Tuple[np.ndarray, int]:
        response = self.client.embeddings.create(input=text, model=self.model)

        embedding = np.array(response.data[0].embedding)
        token = response.usage.prompt_tokens
        return embedding, token


def get_text_embeddings(
    texts: Union[str, List[str]],
    max_workers: int = 5,
    embedding_cache: Optional[Dict[str, np.ndarray]] = None,
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
    embedding_model = None
    encoder_type = os.getenv("ENCODER_API_TYPE")
    if encoder_type and encoder_type == "openai":
        embedding_model = OpenAIEmbeddingModel()
    elif encoder_type and encoder_type == "azure":
        embedding_model = AzureOpenAIEmbeddingModel()
    elif encoder_type == encoder_type == "together":
        embedding_model = TogetherEmbeddingModel()
    else:
        raise Exception(
            "No valid encoder type is provided. Check <repo root>/secrets.toml for the field ENCODER_API_TYPE"
        )

    def fetch_embedding(text: str) -> Tuple[str, np.ndarray, int]:
        if embedding_cache is not None and text in embedding_cache:
            return (
                text,
                embedding_cache[text],
                0,
            )  # Returning 0 tokens since no API call is made
        embedding, token_usage = embedding_model.get_embedding(text)
        return text, embedding, token_usage

    if isinstance(texts, str):
        _, embedding, tokens = fetch_embedding(texts)
        return np.array(embedding), tokens

    embeddings = []
    total_tokens = 0

    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = {executor.submit(fetch_embedding, text): text for text in texts}

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
    if embedding_cache is not None:
        for text, embedding, _ in embeddings:
            embedding_cache[text] = embedding
    embeddings = [result[1] for result in embeddings]

    return np.array(embeddings), total_tokens
