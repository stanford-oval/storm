"""
Router for LLM model management endpoints
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Optional, Dict, List
from services.llm_service import llm_service, LLMProvider, LLMModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


@router.get("/providers", response_model=Dict[str, LLMProvider])
async def get_all_providers():
    """
    Get all available LLM providers and their models
    """
    try:
        return await llm_service.get_all_providers()
    except Exception as e:
        logger.error(f"Error getting providers: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/providers/{provider}/models", response_model=LLMProvider)
async def get_provider_models(
    provider: str,
    host: Optional[str] = Query(
        None, description="Host for local providers (Ollama, LMStudio)"
    ),
    port: Optional[int] = Query(None, description="Port for local providers"),
    api_key: Optional[str] = Query(None, description="API key override"),
):
    """
    Get available models for a specific provider
    """
    kwargs = {}
    if host:
        kwargs["host"] = host
    if port:
        kwargs["port"] = port
    if api_key:
        kwargs["api_key"] = api_key

    try:
        result = await llm_service.get_available_models(provider, **kwargs)
        if not result.available and result.error:
            # Still return the result but with proper status
            return result
        return result
    except Exception as e:
        logger.error(f"Error getting models for {provider}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/ollama/models", response_model=List[Dict])
async def get_ollama_models(
    host: str = Query("localhost", description="Ollama host"),
    port: int = Query(11434, description="Ollama port"),
):
    """
    Get available Ollama models (specific endpoint for Ollama)
    """
    try:
        result = await llm_service.get_available_models("ollama", host=host, port=port)
        if not result.available:
            raise HTTPException(
                status_code=503, detail=result.error or "Ollama not available"
            )

        # Return simplified format for backward compatibility
        return [
            {
                "name": model.id,
                "model": model.id,
                "size": model.description,
                "digest": "",  # Ollama API compatibility
                "modified_at": "",  # Ollama API compatibility
            }
            for model in result.models
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting Ollama models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/lmstudio/models", response_model=List[Dict])
async def get_lmstudio_models(
    host: str = Query("localhost", description="LM Studio host"),
    port: int = Query(1234, description="LM Studio port"),
):
    """
    Get available LM Studio models
    """
    try:
        result = await llm_service.get_available_models(
            "lmstudio", host=host, port=port
        )
        if not result.available:
            raise HTTPException(
                status_code=503, detail=result.error or "LM Studio not available"
            )

        # Return OpenAI-compatible format
        return [
            {"id": model.id, "object": "model", "created": 0, "owned_by": "lmstudio"}
            for model in result.models
        ]
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting LM Studio models: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/test-connection")
async def test_provider_connection(
    provider: str,
    host: Optional[str] = None,
    port: Optional[int] = None,
    api_key: Optional[str] = None,
):
    """
    Test connection to a specific provider
    """
    kwargs = {}
    if host:
        kwargs["host"] = host
    if port:
        kwargs["port"] = port
    if api_key:
        kwargs["api_key"] = api_key

    try:
        result = await llm_service.get_available_models(provider, **kwargs)
        return {
            "provider": provider,
            "available": result.available,
            "error": result.error,
            "model_count": len(result.models),
        }
    except Exception as e:
        return {
            "provider": provider,
            "available": False,
            "error": str(e),
            "model_count": 0,
        }
