"""
Configuration management API endpoints.

Provides endpoints for managing global and project-specific configurations.
"""

from fastapi import APIRouter, HTTPException, Query
from typing import Dict, Any, Optional
from pydantic import BaseModel

from services.config_service import (
    ConfigurationService,
    ProjectConfig,
    ConfigLevel,
    get_config_service,
)
from services.llm_config_builder import LLMConfigBuilder

router = APIRouter(prefix="/api/config", tags=["configuration"])


class ConfigUpdateRequest(BaseModel):
    """Request model for configuration updates."""

    config: Dict[str, Any]
    scope: str = "global"  # global, environment, or project


class ConfigValidationResponse(BaseModel):
    """Response model for configuration validation."""

    valid: bool
    errors: Optional[list] = None


@router.get("/default")
async def get_default_config():
    """Get default configuration with all settings."""
    config_service = get_config_service()
    default_config = config_service.get_default_config()
    return default_config.dict()


@router.get("/global")
async def get_global_config():
    """Get global configuration."""
    config_service = get_config_service()
    global_config = config_service.load_global_config()
    return global_config.dict()


@router.post("/global")
async def update_global_config(request: ConfigUpdateRequest):
    """Update global configuration."""
    config_service = get_config_service()

    # Validate configuration
    is_valid, errors = config_service.validate_config(request.config)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail={"message": "Invalid configuration", "errors": errors},
        )

    # Create config object and save
    config = ProjectConfig(**request.config)
    config_service.save_global_config(config)

    return {"status": "success", "message": "Global configuration updated"}


@router.get("/project/{project_id}")
async def get_project_config(project_id: str):
    """Get configuration for a specific project (with inheritance applied)."""
    config_service = get_config_service()

    # Load project overrides from file if exists
    from pathlib import Path
    import json

    base_dir = Path("./storm-projects/projects").resolve()
    project_config_file = (base_dir / project_id / "config.json").resolve()
    # Check containment to prevent directory traversal attacks
    try:
        # Ensures project_config_file is contained within base_dir
        project_config_file.relative_to(base_dir)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied.")
    project_overrides = {}
    if project_config_file.exists():
        with open(project_config_file, "r") as f:
            project_overrides = json.load(f)

    # Get merged configuration
    config = config_service.get_project_config(project_overrides)
    return config.dict()


@router.post("/project/{project_id}")
async def update_project_config(project_id: str, request: ConfigUpdateRequest):
    """Update project-specific configuration overrides."""
    from pathlib import Path
    import json

    # Validate configuration
    config_service = get_config_service()
    is_valid, errors = config_service.validate_config(request.config)
    if not is_valid:
        raise HTTPException(
            status_code=400,
            detail={"message": "Invalid configuration", "errors": errors},
        )

    # Save project overrides
    base_dir = Path("./storm-projects/projects").resolve()
    project_config_file = (base_dir / project_id / "config.json").resolve()
    # Check containment to prevent directory traversal attacks
    try:
        project_config_file.relative_to(base_dir)
    except ValueError:
        raise HTTPException(status_code=403, detail="Access denied.")
    project_config_file.parent.mkdir(parents=True, exist_ok=True)

    with open(project_config_file, "w") as f:
        json.dump(request.config, f, indent=2)

    return {"status": "success", "message": "Project configuration updated"}


@router.get("/settings/{level}")
async def get_config_by_level(level: str):
    """Get configuration filtered by complexity level (normal or advanced)."""
    config_service = get_config_service()

    try:
        config_level = ConfigLevel(level)
    except ValueError:
        raise HTTPException(
            status_code=400, detail=f"Invalid level. Must be 'normal' or 'advanced'"
        )

    config = config_service.load_global_config()
    filtered_config = config_service.get_config_by_level(config, config_level)

    return filtered_config


@router.post("/validate")
async def validate_configuration(config: Dict[str, Any]):
    """Validate a configuration without saving it."""
    config_service = get_config_service()
    is_valid, errors = config_service.validate_config(config)

    return ConfigValidationResponse(valid=is_valid, errors=errors)


@router.get("/providers")
async def get_available_providers():
    """Get list of available LLM providers and their configuration status."""
    providers = {}

    for provider in LLMConfigBuilder.PROVIDER_DEFAULTS.keys():
        is_configured, message = LLMConfigBuilder.validate_provider_setup(provider)
        providers[provider] = {
            "available": is_configured,
            "message": message,
            "requires_api_key": LLMConfigBuilder.PROVIDER_DEFAULTS[provider].get(
                "requires_api_key", False
            ),
        }

    return providers


@router.get("/providers/{provider}/models")
async def get_provider_models(provider: str):
    """Get available models for a specific provider."""

    # Special handling for Ollama - fetch models dynamically
    if provider == "ollama":
        import requests
        from services.config_service import get_config_service

        try:
            # Get Ollama configuration
            config_service = get_config_service()
            config = config_service.load_global_config()

            # Build Ollama URL from config
            host = (
                getattr(config.llm, "ollama_host", "localhost")
                if hasattr(config, "llm")
                else "localhost"
            )
            port = (
                getattr(config.llm, "ollama_port", 11434)
                if hasattr(config, "llm")
                else 11434
            )
            ollama_url = f"http://{host}:{port}"

            # Fetch available models from Ollama
            response = requests.get(f"{ollama_url}/api/tags", timeout=2)
            if response.status_code == 200:
                data = response.json()
                models = [model["name"] for model in data.get("models", [])]

                # Check if Ollama is configured
                is_configured, message = LLMConfigBuilder.validate_provider_setup(
                    provider
                )

                return {
                    "provider": provider,
                    "configured": is_configured,
                    "message": message,
                    "models": models,
                    "dynamic": True,  # Indicate these were fetched dynamically
                }
        except Exception as e:
            # Fall back to static list if can't connect
            pass

    # Model lists for each provider
    provider_models = {
        "openai": [
            "gpt-4o",
            "gpt-4o-mini",
            "gpt-4-turbo",
            "gpt-4",
            "gpt-3.5-turbo",
            "gpt-3.5-turbo-16k",
        ],
        "anthropic": [
            "claude-3-5-sonnet-20241022",
            "claude-3-opus-20240229",
            "claude-3-sonnet-20240229",
            "claude-3-haiku-20240307",
        ],
        "gemini": [
            "gemini-1.5-pro",
            "gemini-1.5-flash",
            "gemini-pro",
        ],
        "ollama": [
            "llama3.2",
            "llama3.1",
            "llama3",
            "llama2",
            "gemma2",
            "gemma",
            "mistral",
            "mixtral",
            "qwen2.5",
            "phi3",
            "deepseek-coder-v2",
        ],
        "groq": [
            "llama-3.1-70b-versatile",
            "llama-3.1-8b-instant",
            "llama3-70b-8192",
            "llama3-8b-8192",
            "mixtral-8x7b-32768",
            "gemma-7b-it",
        ],
        "cohere": [
            "command-r-plus",
            "command-r",
            "command",
            "command-light",
            "command-nightly",
        ],
        "together": [
            "meta-llama/Meta-Llama-3.1-405B-Instruct-Turbo",
            "meta-llama/Meta-Llama-3.1-70B-Instruct-Turbo",
            "meta-llama/Meta-Llama-3.1-8B-Instruct-Turbo",
            "meta-llama/Llama-3-70b-chat-hf",
            "meta-llama/Llama-3-8b-chat-hf",
            "mistralai/Mixtral-8x7B-Instruct-v0.1",
            "mistralai/Mixtral-8x22B-Instruct-v0.1",
        ],
        "replicate": [
            "meta/llama-2-70b-chat",
            "meta/llama-2-13b-chat",
            "meta/llama-2-7b-chat",
            "mistralai/mistral-7b-instruct-v0.2",
            "mistralai/mixtral-8x7b-instruct-v0.1",
        ],
        "huggingface": [
            "meta-llama/Llama-2-7b-chat-hf",
            "mistralai/Mistral-7B-Instruct-v0.2",
            "microsoft/phi-2",
            "google/flan-t5-xxl",
            "bigscience/bloom",
        ],
    }

    if provider not in provider_models:
        raise HTTPException(status_code=404, detail=f"Unknown provider: {provider}")

    # Check if provider is configured
    is_configured, message = LLMConfigBuilder.validate_provider_setup(provider)

    return {
        "provider": provider,
        "configured": is_configured,
        "message": message,
        "models": provider_models[provider],
    }


@router.get("/retrievers")
async def get_available_retrievers():
    """Get list of available retrieval systems and their configuration status."""
    import os

    retrievers = {
        "duckduckgo": {
            "available": True,
            "description": "DuckDuckGo Search (no API key required)",
            "requires_api_key": False,
        },
        "bing": {
            "available": bool(os.getenv("BING_SEARCH_API_KEY")),
            "description": "Bing Web Search API",
            "requires_api_key": True,
            "env_key": "BING_SEARCH_API_KEY",
        },
        "google": {
            "available": bool(
                os.getenv("GOOGLE_API_KEY") and os.getenv("GOOGLE_CSE_ID")
            ),
            "description": "Google Custom Search",
            "requires_api_key": True,
            "env_keys": ["GOOGLE_API_KEY", "GOOGLE_CSE_ID"],
        },
        "tavily": {
            "available": bool(os.getenv("TAVILY_API_KEY")),
            "description": "Tavily Search API",
            "requires_api_key": True,
            "env_key": "TAVILY_API_KEY",
        },
        "serper": {
            "available": bool(os.getenv("SERPER_API_KEY")),
            "description": "Serper (Google via API)",
            "requires_api_key": True,
            "env_key": "SERPER_API_KEY",
        },
        "you": {
            "available": bool(os.getenv("YDC_API_KEY")),
            "description": "You.com Search API",
            "requires_api_key": True,
            "env_key": "YDC_API_KEY",
        },
    }

    return retrievers


@router.get("/export/{project_id}")
async def export_project_config(
    project_id: str,
    include_sensitive: bool = Query(
        False, description="Include sensitive data like API keys"
    ),
):
    """Export project configuration (optionally without sensitive data)."""
    config_service = get_config_service()

    # Get project config
    from pathlib import Path
    import json

    project_config_file = Path(f"./storm-projects/projects/{project_id}/config.json")
    project_overrides = {}
    if project_config_file.exists():
        with open(project_config_file, "r") as f:
            project_overrides = json.load(f)

    config = config_service.get_project_config(project_overrides)
    exported = config_service.export_config(config, include_sensitive)

    return exported
