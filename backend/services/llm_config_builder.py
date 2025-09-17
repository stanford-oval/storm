"""
LLM configuration builder for STORM pipeline.

Builds LitellmModel configurations based on provider and settings.
"""

import os
import logging
from typing import Dict, Any, Optional
from knowledge_storm.lm import LitellmModel
from knowledge_storm import STORMWikiLMConfigs
from .config_service import ProjectConfig, LLMProviderConfig

logger = logging.getLogger(__name__)


class LLMConfigBuilder:
    """Builder for LLM configurations."""

    # Provider-specific settings
    PROVIDER_DEFAULTS = {
        "ollama": {
            "api_base": "http://localhost:11434",
            "request_timeout": 600,
            "requires_api_key": False,
            "stop": ["\n\n---"],  # Default stop sequence for dspy
        },
        "lmstudio": {
            "api_base": "http://localhost:1234/v1",
            "api_key": "lmstudio",
            "request_timeout": 600,
            "requires_api_key": False,
            "model_prefix": "openai/",  # LMStudio uses OpenAI format
        },
        "anthropic": {
            "request_timeout": 300,
            "requires_api_key": True,
            "env_key": "ANTHROPIC_API_KEY",
        },
        "openai": {
            "request_timeout": 300,
            "requires_api_key": True,
            "env_key": "OPENAI_API_KEY",
        },
        "gemini": {
            "request_timeout": 300,
            "requires_api_key": True,
            "env_key": "GEMINI_API_KEY",
        },
        "azure": {
            "request_timeout": 300,
            "requires_api_key": True,
            "env_key": "AZURE_API_KEY",
            "additional_env": {
                "api_base": "AZURE_API_BASE",
                "api_version": "AZURE_API_VERSION",
            },
        },
        "cohere": {
            "request_timeout": 300,
            "requires_api_key": True,
            "env_key": "COHERE_API_KEY",
        },
        "replicate": {
            "request_timeout": 600,
            "requires_api_key": True,
            "env_key": "REPLICATE_API_KEY",
        },
        "huggingface": {
            "api_base": "https://api-inference.huggingface.co/models",
            "request_timeout": 600,
            "requires_api_key": True,
            "env_key": "HUGGINGFACE_API_KEY",
        },
        "together": {
            "request_timeout": 600,
            "requires_api_key": True,
            "env_key": "TOGETHERAI_API_KEY",
            "model_prefix": "together_ai/",
        },
        "groq": {
            "request_timeout": 300,
            "requires_api_key": True,
            "env_key": "GROQ_API_KEY",
        },
    }

    @classmethod
    def build_llm_kwargs(cls, llm_config: LLMProviderConfig) -> Dict[str, Any]:
        """Build LiteLLM kwargs from LLM configuration."""

        provider = llm_config.provider
        provider_defaults = cls.PROVIDER_DEFAULTS.get(provider, {})

        # Get model prefix for provider
        model_prefix = provider_defaults.get("model_prefix", f"{provider}/")

        # Format model name
        if llm_config.model.startswith(provider + "/") or llm_config.model.startswith(
            model_prefix
        ):
            model_name = llm_config.model
        else:
            model_name = f"{model_prefix}{llm_config.model}"

        # Base kwargs
        kwargs = {
            "model": model_name,
            "temperature": llm_config.temperature,
            "top_p": llm_config.top_p,
            "frequency_penalty": llm_config.frequency_penalty,
            "presence_penalty": llm_config.presence_penalty,
            "request_timeout": llm_config.request_timeout
            or provider_defaults.get("request_timeout", 300),
        }

        # Add API key if required
        if provider_defaults.get("requires_api_key", False):
            env_key = provider_defaults.get("env_key")
            if env_key:
                api_key = os.getenv(env_key)
                if api_key:
                    kwargs["api_key"] = api_key
                else:
                    raise ValueError(
                        f"{provider} API key not found. Please set {env_key} environment variable."
                    )
            elif provider_defaults.get("api_key"):
                # Use default API key (e.g., for LMStudio)
                kwargs["api_key"] = provider_defaults["api_key"]

        # Add API base if configured
        api_base = llm_config.api_base or provider_defaults.get("api_base")

        # Handle Ollama-specific settings
        if provider == "ollama":
            # Build API base from host and port if configured
            if hasattr(llm_config, "ollama_host") and hasattr(
                llm_config, "ollama_port"
            ):
                ollama_host = llm_config.ollama_host or "localhost"
                ollama_port = llm_config.ollama_port or 11434
                api_base = f"http://{ollama_host}:{ollama_port}"

            # Add stop sequences if configured
            if hasattr(llm_config, "stop_sequences") and llm_config.stop_sequences:
                kwargs["stop"] = llm_config.stop_sequences
            elif "stop" in provider_defaults:
                kwargs["stop"] = provider_defaults["stop"]

        if api_base:
            kwargs["api_base"] = api_base

        # Handle Azure-specific settings
        if provider == "azure":
            if llm_config.api_version:
                kwargs["api_version"] = llm_config.api_version
            elif "AZURE_API_VERSION" in os.environ:
                kwargs["api_version"] = os.getenv("AZURE_API_VERSION")
            else:
                kwargs["api_version"] = "2024-02-01"  # Default

            if llm_config.deployment_name:
                kwargs["deployment_name"] = llm_config.deployment_name

        # Add retry configuration
        kwargs["num_retries"] = llm_config.retry_count
        kwargs["retry_delay"] = llm_config.retry_delay

        logger.info(f"Built LLM kwargs for {provider}/{llm_config.model}")
        logger.debug(f"LLM kwargs: {cls._sanitize_kwargs_for_logging(kwargs)}")

        return kwargs

    @classmethod
    def build_storm_configs(cls, config: ProjectConfig) -> STORMWikiLMConfigs:
        """Build STORM LLM configurations from project config."""

        lm_configs = STORMWikiLMConfigs()

        # Get base LLM configuration
        base_llm_kwargs = cls.build_llm_kwargs(config.llm)

        # Configure each stage
        # 1. Conversation Simulator
        stage_config = config.llm_stages.conv_simulator if config.llm_stages else None
        if stage_config:
            stage_kwargs = cls.build_llm_kwargs(stage_config)
        else:
            stage_kwargs = base_llm_kwargs.copy()

        lm_configs.set_conv_simulator_lm(
            LitellmModel(
                max_tokens=(
                    config.llm_stages.conv_simulator_max_tokens
                    if config.llm_stages
                    else 500
                ),
                **stage_kwargs,
            )
        )

        # 2. Question Asker
        stage_config = config.llm_stages.question_asker if config.llm_stages else None
        if stage_config:
            stage_kwargs = cls.build_llm_kwargs(stage_config)
        else:
            stage_kwargs = base_llm_kwargs.copy()

        lm_configs.set_question_asker_lm(
            LitellmModel(
                max_tokens=(
                    config.llm_stages.question_asker_max_tokens
                    if config.llm_stages
                    else 500
                ),
                **stage_kwargs,
            )
        )

        # 3. Outline Generator
        stage_config = config.llm_stages.outline_gen if config.llm_stages else None
        if stage_config:
            stage_kwargs = cls.build_llm_kwargs(stage_config)
        else:
            stage_kwargs = base_llm_kwargs.copy()

        lm_configs.set_outline_gen_lm(
            LitellmModel(
                max_tokens=(
                    config.llm_stages.outline_gen_max_tokens
                    if config.llm_stages
                    else 1000
                ),
                **stage_kwargs,
            )
        )

        # 4. Article Generator
        stage_config = config.llm_stages.article_gen if config.llm_stages else None
        if stage_config:
            stage_kwargs = cls.build_llm_kwargs(stage_config)
        else:
            stage_kwargs = base_llm_kwargs.copy()

        lm_configs.set_article_gen_lm(
            LitellmModel(
                max_tokens=(
                    config.llm_stages.article_gen_max_tokens
                    if config.llm_stages
                    else config.llm.max_tokens
                ),
                **stage_kwargs,
            )
        )

        # 5. Article Polish
        stage_config = config.llm_stages.article_polish if config.llm_stages else None
        if stage_config:
            stage_kwargs = cls.build_llm_kwargs(stage_config)
        else:
            stage_kwargs = base_llm_kwargs.copy()

        lm_configs.set_article_polish_lm(
            LitellmModel(
                max_tokens=(
                    config.llm_stages.article_polish_max_tokens
                    if config.llm_stages
                    else config.llm.max_tokens
                ),
                **stage_kwargs,
            )
        )

        logger.info(f"Built STORM LLM configs for provider: {config.llm.provider}")
        return lm_configs

    @classmethod
    def _sanitize_kwargs_for_logging(cls, kwargs: Dict[str, Any]) -> Dict[str, Any]:
        """Sanitize kwargs for logging (remove sensitive data)."""
        sanitized = kwargs.copy()
        sensitive_keys = ["api_key", "api_base", "deployment_name"]
        for key in sensitive_keys:
            if key in sanitized:
                sanitized[key] = "***REDACTED***"
        return sanitized

    @classmethod
    def validate_provider_setup(cls, provider: str) -> tuple[bool, Optional[str]]:
        """Validate that a provider is properly configured."""

        if provider not in cls.PROVIDER_DEFAULTS:
            return False, f"Unknown provider: {provider}"

        provider_config = cls.PROVIDER_DEFAULTS[provider]

        # Check API key if required
        if provider_config.get("requires_api_key", False):
            env_key = provider_config.get("env_key")
            if env_key and not os.getenv(env_key):
                return (
                    False,
                    f"Missing API key. Please set {env_key} environment variable.",
                )

            # Check additional required environment variables (e.g., Azure)
            additional_env = provider_config.get("additional_env", {})
            for key, env_var in additional_env.items():
                if not os.getenv(env_var):
                    return (
                        False,
                        f"Missing configuration. Please set {env_var} environment variable.",
                    )

        # Check if local services are running (for Ollama, LMStudio)
        if provider in ["ollama", "lmstudio"]:
            import requests

            api_base = provider_config.get("api_base")
            try:
                response = requests.get(
                    (
                        f"{api_base}/api/tags"
                        if provider == "ollama"
                        else f"{api_base}/models"
                    ),
                    timeout=2,
                )
                if response.status_code != 200:
                    return False, f"{provider} service is not responding at {api_base}"
            except Exception as e:
                return False, f"Cannot connect to {provider} at {api_base}: {str(e)}"

        return True, None
