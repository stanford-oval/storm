"""
Service for interacting with various LLM providers to query available models
"""

import os
import logging
import httpx
from typing import List, Dict, Optional, Any
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)


class LLMModel(BaseModel):
    """Represents an available LLM model"""

    id: str
    name: str
    provider: str
    description: Optional[str] = None
    context_length: Optional[int] = None


class LLMProvider(BaseModel):
    """LLM Provider configuration"""

    name: str
    endpoint: Optional[str] = None
    api_key: Optional[str] = None
    available: bool = False
    models: List[LLMModel] = []
    error: Optional[str] = None


class LLMService:
    """Service for managing LLM providers and querying available models"""

    def __init__(self):
        self.providers = {
            "openai": self._get_openai_models,
            "anthropic": self._get_anthropic_models,
            "ollama": self._get_ollama_models,
            "lmstudio": self._get_lmstudio_models,
            "gemini": self._get_gemini_models,
            "cohere": self._get_cohere_models,
        }

    async def get_available_models(self, provider: str, **kwargs) -> LLMProvider:
        """Get available models for a specific provider"""
        if provider not in self.providers:
            return LLMProvider(
                name=provider, available=False, error=f"Unknown provider: {provider}"
            )

        try:
            handler = self.providers[provider]
            return await handler(**kwargs)
        except Exception as e:
            logger.error(f"Error getting models for {provider}: {e}")
            return LLMProvider(name=provider, available=False, error=str(e))

    async def _get_openai_models(
        self, api_key: Optional[str] = None, **kwargs
    ) -> LLMProvider:
        """Get available OpenAI models from the API"""
        api_key = api_key or os.getenv("OPENAI_API_KEY")

        if not api_key:
            return LLMProvider(
                name="openai", available=False, error="OpenAI API key not configured"
            )

        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    "https://api.openai.com/v1/models",
                    headers={"Authorization": f"Bearer {api_key}"},
                    timeout=10.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    models = []
                    seen_models = set()

                    # Get all models from API
                    for model_data in data.get("data", []):
                        model_id = model_data.get("id", "")

                        # Filter for chat/completion models only (exclude embeddings, whisper, dall-e, etc.)
                        if any(
                            prefix in model_id
                            for prefix in ["gpt-", "o1-", "o3-", "chatgpt"]
                        ):
                            # Skip duplicates and deprecated models
                            if (
                                model_id in seen_models
                                or "instruct" in model_id
                                or "0301" in model_id
                                or "0314" in model_id
                                or "0613" in model_id
                            ):
                                continue

                            seen_models.add(model_id)

                            # Format the name nicely
                            name = model_id.upper().replace("-", " ")
                            if "gpt-4o" in model_id:
                                name = name.replace("GPT 4O", "GPT-4o")
                            elif "o1" in model_id:
                                name = name.replace("O1", "o1")
                            elif "o3" in model_id:
                                name = name.replace("O3", "o3")

                            models.append(
                                LLMModel(
                                    id=model_id,
                                    name=name,
                                    provider="openai",
                                    context_length=self._get_openai_context_length(
                                        model_id
                                    ),
                                )
                            )

                    # Sort models by importance/recency
                    priority_order = [
                        "o3",
                        "o1",
                        "gpt-4o",
                        "gpt-4-turbo",
                        "gpt-4",
                        "gpt-3.5-turbo",
                        "chatgpt",
                    ]

                    def model_priority(model):
                        for i, prefix in enumerate(priority_order):
                            if prefix in model.id:
                                return i
                        return len(priority_order)

                    models.sort(key=model_priority)

                    return LLMProvider(name="openai", available=True, models=models)
                else:
                    return LLMProvider(
                        name="openai",
                        available=False,
                        error=f"API request failed: {response.status_code}",
                    )

        except Exception as e:
            return LLMProvider(name="openai", available=False, error=str(e))

    def _get_openai_context_length(self, model: str) -> int:
        """Get context length for OpenAI models"""
        context_lengths = {
            "gpt-4o": 128000,
            "gpt-4o-mini": 128000,
            "gpt-4-turbo": 128000,
            "gpt-4": 8192,
            "gpt-3.5-turbo": 16385,
            "gpt-3.5-turbo-16k": 16385,
        }
        return context_lengths.get(model, 4096)

    async def _get_anthropic_models(
        self, api_key: Optional[str] = None, **kwargs
    ) -> LLMProvider:
        """Get available Anthropic models from the API"""
        api_key = api_key or os.getenv("ANTHROPIC_API_KEY")

        if not api_key:
            return LLMProvider(
                name="anthropic",
                available=False,
                error="Anthropic API key not configured",
            )

        try:
            async with httpx.AsyncClient() as client:
                # Query the Claude models endpoint
                response = await client.get(
                    "https://api.anthropic.com/v1/models",
                    headers={"x-api-key": api_key, "anthropic-version": "2023-06-01"},
                    timeout=10.0,
                )

                if response.status_code == 200:
                    data = response.json()
                    models = []

                    for model_data in data.get("data", []):
                        model_id = model_data.get("id", "")
                        # Only include chat models, not completion models
                        if "claude" in model_id.lower():
                            models.append(
                                LLMModel(
                                    id=model_id,
                                    name=model_data.get("display_name", model_id),
                                    provider="anthropic",
                                    description=model_data.get("description", ""),
                                    context_length=model_data.get(
                                        "context_length", 200000
                                    ),
                                )
                            )

                    return LLMProvider(name="anthropic", available=True, models=models)
                else:
                    # No fallback models - return empty list if API fails
                    logger.warning(f"Claude models API returned {response.status_code}")
                    return LLMProvider(
                        name="anthropic",
                        available=False,
                        models=[],
                        error=f"API request failed: {response.status_code}",
                    )

        except Exception as e:
            logger.warning(f"Failed to fetch Claude models: {e}")
            return LLMProvider(
                name="anthropic", available=False, models=[], error=str(e)
            )

    async def _get_ollama_models(
        self, host: str = "localhost", port: int = 11434, **kwargs
    ) -> LLMProvider:
        """Get available Ollama models"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://{host}:{port}/api/tags", timeout=5.0
                )

                if response.status_code == 200:
                    data = response.json()
                    models = []

                    for model in data.get("models", []):
                        models.append(
                            LLMModel(
                                id=model["name"],
                                name=model["name"],
                                provider="ollama",
                                description=f"Size: {model.get('size', 'Unknown')}",
                                context_length=model.get("context_length", 2048),
                            )
                        )

                    return LLMProvider(
                        name="ollama",
                        endpoint=f"http://{host}:{port}",
                        available=True,
                        models=models,
                    )
                else:
                    return LLMProvider(
                        name="ollama",
                        endpoint=f"http://{host}:{port}",
                        available=False,
                        error=f"Failed to connect to Ollama: {response.status_code}",
                    )

        except httpx.ConnectError:
            return LLMProvider(
                name="ollama",
                endpoint=f"http://{host}:{port}",
                available=False,
                error="Ollama server not running or unreachable",
            )
        except Exception as e:
            return LLMProvider(
                name="ollama",
                endpoint=f"http://{host}:{port}",
                available=False,
                error=str(e),
            )

    async def _get_lmstudio_models(
        self, host: str = "localhost", port: int = 1234, **kwargs
    ) -> LLMProvider:
        """Get available LM Studio models"""
        try:
            async with httpx.AsyncClient() as client:
                response = await client.get(
                    f"http://{host}:{port}/v1/models", timeout=5.0
                )

                if response.status_code == 200:
                    data = response.json()
                    models = []

                    for model in data.get("data", []):
                        models.append(
                            LLMModel(
                                id=model["id"],
                                name=model.get("id", "").split("/")[
                                    -1
                                ],  # Extract model name from path
                                provider="lmstudio",
                                description=f"LM Studio local model",
                                context_length=model.get("context_length", 4096),
                            )
                        )

                    return LLMProvider(
                        name="lmstudio",
                        endpoint=f"http://{host}:{port}",
                        available=True,
                        models=models,
                    )
                else:
                    return LLMProvider(
                        name="lmstudio",
                        endpoint=f"http://{host}:{port}",
                        available=False,
                        error=f"Failed to connect to LM Studio: {response.status_code}",
                    )

        except httpx.ConnectError:
            return LLMProvider(
                name="lmstudio",
                endpoint=f"http://{host}:{port}",
                available=False,
                error="LM Studio server not running or unreachable",
            )
        except Exception as e:
            return LLMProvider(
                name="lmstudio",
                endpoint=f"http://{host}:{port}",
                available=False,
                error=str(e),
            )

    async def _get_gemini_models(
        self, api_key: Optional[str] = None, **kwargs
    ) -> LLMProvider:
        """Get available Google Gemini models"""
        api_key = api_key or os.getenv("GEMINI_API_KEY")

        # No hardcoded models - return empty list
        return LLMProvider(
            name="gemini",
            available=bool(api_key),
            models=[],
            error=None if api_key else "Gemini API key not configured",
        )

    async def _get_cohere_models(
        self, api_key: Optional[str] = None, **kwargs
    ) -> LLMProvider:
        """Get available Cohere models"""
        api_key = api_key or os.getenv("COHERE_API_KEY")

        # No hardcoded models - return empty list
        return LLMProvider(
            name="cohere",
            available=bool(api_key),
            models=[],
            error=None if api_key else "Cohere API key not configured",
        )

    async def get_all_providers(self) -> Dict[str, LLMProvider]:
        """Get status and models for all supported providers"""
        results = {}

        for provider in self.providers.keys():
            results[provider] = await self.get_available_models(provider)

        return results


# Singleton instance
llm_service = LLMService()
