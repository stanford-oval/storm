"""
Settings router for STORM UI backend.
Handles API key configuration and system settings.
"""

import os
from typing import Dict, Any, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import logging

logger = logging.getLogger(__name__)

router = APIRouter()


class APIKeysResponse(BaseModel):
    """Response model for API keys (masked)."""

    openai_configured: bool
    anthropic_configured: bool
    google_search_configured: bool
    serper_configured: bool
    tavily_configured: bool
    you_configured: bool

    # Masked keys (show first 8 chars only)
    openai_key_preview: Optional[str] = None
    anthropic_key_preview: Optional[str] = None
    google_api_key_preview: Optional[str] = None
    google_cse_id_preview: Optional[str] = None
    serper_key_preview: Optional[str] = None
    tavily_key_preview: Optional[str] = None
    you_key_preview: Optional[str] = None


def mask_api_key(key: Optional[str]) -> Optional[str]:
    """Mask API key for security, showing only first 8 characters."""
    if not key:
        return None
    if len(key) <= 12:
        return "***"
    return f"{key[:8]}...{key[-4:]}"


@router.get("/api-keys", response_model=APIKeysResponse)
async def get_api_keys():
    """Get configured API keys (masked for security)."""
    try:
        # Check environment variables
        openai_key = os.environ.get("OPENAI_API_KEY")
        anthropic_key = os.environ.get("ANTHROPIC_API_KEY")
        google_api_key = os.environ.get("GOOGLE_API_KEY")
        google_cse_id = os.environ.get("GOOGLE_CSE_ID")
        serper_key = os.environ.get("SERPER_API_KEY")
        # Check both possible env var names for Tavily
        tavily_key = os.environ.get("TAVILY_API_KEY") or os.environ.get(
            "NEXT_PUBLIC_TAVILY_API_KEY"
        )
        you_key = os.environ.get("YDC_API_KEY")

        return APIKeysResponse(
            openai_configured=bool(openai_key),
            anthropic_configured=bool(anthropic_key),
            google_search_configured=bool(google_api_key and google_cse_id),
            serper_configured=bool(serper_key),
            tavily_configured=bool(tavily_key),
            you_configured=bool(you_key),
            openai_key_preview=mask_api_key(openai_key),
            anthropic_key_preview=mask_api_key(anthropic_key),
            google_api_key_preview=mask_api_key(google_api_key),
            google_cse_id_preview=mask_api_key(google_cse_id),
            serper_key_preview=mask_api_key(serper_key),
            tavily_key_preview=mask_api_key(tavily_key),
            you_key_preview=mask_api_key(you_key),
        )

    except Exception as e:
        logger.error(f"Error getting API keys: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get API key configuration"
        )


@router.get("/default-config")
async def get_default_config():
    """Get default configuration for new projects."""
    try:
        # Determine which LLM to use based on available keys
        openai_available = bool(os.environ.get("OPENAI_API_KEY"))
        anthropic_available = bool(os.environ.get("ANTHROPIC_API_KEY"))

        default_llm = (
            "gpt-3.5-turbo"
            if openai_available
            else "claude-3-haiku-20240307" if anthropic_available else None
        )

        # Determine which retriever to use
        google_available = bool(
            os.environ.get("GOOGLE_API_KEY") and os.environ.get("GOOGLE_CSE_ID")
        )
        serper_available = bool(os.environ.get("SERPER_API_KEY"))
        # Check both possible env var names for Tavily
        tavily_available = bool(
            os.environ.get("TAVILY_API_KEY")
            or os.environ.get("NEXT_PUBLIC_TAVILY_API_KEY")
        )
        you_available = bool(os.environ.get("YDC_API_KEY"))

        # Note: Bing is not implemented in the backend, so we don't check for it
        # Default to available retrievers in preference order
        default_retriever = (
            "tavily"
            if tavily_available
            else (
                "google"
                if google_available
                else (
                    "serper"
                    if serper_available
                    else "you" if you_available else "duckduckgo"
                )
            )  # Free fallback
        )

        return {
            "llm": {
                "model": default_llm,
                "api_key": None,  # Don't send actual keys
                "max_tokens": 2000,
                "temperature": 0.7,
            },
            "retriever": {
                "type": default_retriever,
                "api_key": None,  # Don't send actual keys
                "max_results": 10,
            },
            "available_llms": {
                "openai": openai_available,
                "anthropic": anthropic_available,
            },
            "available_retrievers": {
                "google": google_available,
                "serper": serper_available,
                "tavily": tavily_available,
                "you": you_available,
                "duckduckgo": True,  # Always available (free)
            },
        }

    except Exception as e:
        logger.error(f"Error getting default config: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get default configuration"
        )
