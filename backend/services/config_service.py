"""
Configuration management service for STORM backend.

Implements a hierarchical configuration system with:
- Global defaults
- Environment-specific overrides
- Project-specific overrides
- Normal vs Advanced settings separation
"""

import os
import json
from pathlib import Path
from typing import Dict, Any, Optional, List
from pydantic import BaseModel, Field, validator
from enum import Enum
import logging

logger = logging.getLogger(__name__)


class ConfigLevel(Enum):
    """Configuration complexity levels."""

    NORMAL = "normal"
    ADVANCED = "advanced"


class LLMProviderConfig(BaseModel):
    """LLM Provider specific configuration."""

    # Normal settings
    provider: str = Field(
        "openai", description="LLM provider (openai, anthropic, ollama, etc.)"
    )
    model: str = Field("gpt-4o", description="Model identifier")
    temperature: float = Field(0.7, ge=0.0, le=2.0, description="Sampling temperature")

    # Advanced settings
    max_tokens: int = Field(
        4000, ge=100, le=32000, description="Maximum tokens per response"
    )
    top_p: float = Field(1.0, ge=0.0, le=1.0, description="Top-p sampling parameter")
    frequency_penalty: float = Field(
        0.0, ge=-2.0, le=2.0, description="Frequency penalty"
    )
    presence_penalty: float = Field(
        0.0, ge=-2.0, le=2.0, description="Presence penalty"
    )
    request_timeout: int = Field(
        300, ge=30, le=3600, description="Request timeout in seconds"
    )
    retry_count: int = Field(3, ge=0, le=10, description="Number of retries on failure")
    retry_delay: float = Field(
        1.0, ge=0.1, le=60.0, description="Delay between retries in seconds"
    )

    # Provider-specific settings
    api_base: Optional[str] = Field(None, description="Custom API base URL")
    api_version: Optional[str] = Field(None, description="API version (for Azure)")
    deployment_name: Optional[str] = Field(
        None, description="Deployment name (for Azure)"
    )

    @validator("model")
    def validate_model(cls, v, values):
        """Validate model based on provider."""
        provider = values.get("provider", "openai")
        # Add model validation logic here if needed
        return v


class StageSpecificLLMConfig(BaseModel):
    """Stage-specific LLM configuration."""

    # Allow different models/settings for different pipeline stages
    conv_simulator: Optional[LLMProviderConfig] = None
    question_asker: Optional[LLMProviderConfig] = None
    outline_gen: Optional[LLMProviderConfig] = None
    article_gen: Optional[LLMProviderConfig] = None
    article_polish: Optional[LLMProviderConfig] = None

    # Stage-specific token limits (Advanced)
    conv_simulator_max_tokens: int = Field(
        500, description="Max tokens for conversation simulation"
    )
    question_asker_max_tokens: int = Field(
        500, description="Max tokens for question generation"
    )
    outline_gen_max_tokens: int = Field(
        1000, description="Max tokens for outline generation"
    )
    article_gen_max_tokens: int = Field(
        4000, description="Max tokens for article generation"
    )
    article_polish_max_tokens: int = Field(
        4000, description="Max tokens for article polishing"
    )


class RetrieverConfig(BaseModel):
    """Retriever configuration."""

    # Normal settings
    retriever_type: str = Field("duckduckgo", description="Retriever type")
    max_search_results: int = Field(
        10, ge=1, le=100, description="Maximum search results per query"
    )

    # Advanced settings
    search_top_k: int = Field(3, ge=1, le=20, description="Top K results to use")
    min_relevance_score: float = Field(
        0.0, ge=0.0, le=1.0, description="Minimum relevance score"
    )
    enable_reranking: bool = Field(False, description="Enable result reranking")
    reranking_model: Optional[str] = Field(None, description="Model for reranking")

    # Search behavior (Advanced)
    safe_search: str = Field(
        "moderate", description="Safe search level (off, moderate, strict)"
    )
    search_region: str = Field("us-en", description="Search region/language")
    exclude_domains: List[str] = Field(
        default_factory=list, description="Domains to exclude"
    )
    prefer_domains: List[str] = Field(
        default_factory=list, description="Preferred domains"
    )

    # Caching (Advanced)
    enable_cache: bool = Field(True, description="Enable search result caching")
    cache_ttl: int = Field(3600, ge=0, description="Cache TTL in seconds")


class PipelineConfig(BaseModel):
    """Pipeline execution configuration."""

    # Normal settings - Pipeline stages
    do_research: bool = Field(True, description="Execute research phase")
    do_generate_outline: bool = Field(True, description="Generate article outline")
    do_generate_article: bool = Field(True, description="Generate article content")
    do_polish_article: bool = Field(True, description="Polish final article")

    # Normal settings - Core parameters
    max_conv_turn: int = Field(3, ge=1, le=10, description="Maximum conversation turns")
    max_perspective: int = Field(
        4, ge=1, le=10, description="Maximum perspectives to consider"
    )

    # Advanced settings - Fine-tuning
    max_search_queries_per_turn: int = Field(
        3, ge=1, le=10, description="Max search queries per turn"
    )
    min_citation_quality: float = Field(
        0.5, ge=0.0, le=1.0, description="Minimum citation quality"
    )
    enable_fact_checking: bool = Field(False, description="Enable fact checking")
    enable_source_diversity: bool = Field(True, description="Ensure source diversity")

    # Advanced settings - Performance
    parallel_research: bool = Field(True, description="Run research in parallel")
    batch_size: int = Field(5, ge=1, le=50, description="Batch size for processing")
    enable_streaming: bool = Field(False, description="Enable streaming responses")

    # Advanced settings - Quality control
    min_article_length: int = Field(
        500, ge=100, description="Minimum article length in words"
    )
    max_article_length: int = Field(
        5000, ge=500, description="Maximum article length in words"
    )
    outline_depth: int = Field(3, ge=1, le=5, description="Maximum outline depth")
    require_introduction: bool = Field(True, description="Require introduction section")
    require_conclusion: bool = Field(True, description="Require conclusion section")


class OutputConfig(BaseModel):
    """Output configuration."""

    # Normal settings
    output_format: str = Field(
        "markdown", description="Output format (markdown, html, json)"
    )
    include_citations: bool = Field(True, description="Include citations in output")

    # Advanced settings
    citation_style: str = Field(
        "numeric", description="Citation style (numeric, author-year, footnote)"
    )
    include_metadata: bool = Field(True, description="Include metadata in output")
    include_outline: bool = Field(False, description="Include outline in output")
    include_search_results: bool = Field(
        False, description="Include raw search results"
    )

    # Formatting options (Advanced)
    markdown_flavor: str = Field(
        "github", description="Markdown flavor (github, commonmark, extra)"
    )
    code_highlighting: bool = Field(True, description="Enable code syntax highlighting")
    table_of_contents: bool = Field(True, description="Generate table of contents")
    auto_link_references: bool = Field(True, description="Auto-link references")


class LoggingConfig(BaseModel):
    """Logging and monitoring configuration."""

    # Normal settings
    log_level: str = Field("INFO", description="Logging level")

    # Advanced settings
    log_to_file: bool = Field(False, description="Log to file")
    log_file_path: Optional[str] = Field(None, description="Log file path")
    log_rotation: str = Field("daily", description="Log rotation (daily, weekly, size)")
    max_log_size: int = Field(10485760, description="Max log file size in bytes")

    # Metrics and monitoring (Advanced)
    enable_metrics: bool = Field(False, description="Enable metrics collection")
    metrics_export_interval: int = Field(
        60, description="Metrics export interval in seconds"
    )
    track_token_usage: bool = Field(True, description="Track token usage")
    track_api_costs: bool = Field(True, description="Track API costs")


class ProjectConfig(BaseModel):
    """Complete project configuration."""

    # Metadata
    config_version: str = Field("1.0.0", description="Configuration schema version")

    # Core configurations
    llm: LLMProviderConfig = Field(default_factory=LLMProviderConfig)
    llm_stages: Optional[StageSpecificLLMConfig] = Field(
        default_factory=StageSpecificLLMConfig
    )
    retriever: RetrieverConfig = Field(default_factory=RetrieverConfig)
    pipeline: PipelineConfig = Field(default_factory=PipelineConfig)
    output: OutputConfig = Field(default_factory=OutputConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)

    # Project-specific overrides
    project_overrides: Dict[str, Any] = Field(default_factory=dict)

    def get_normal_settings(self) -> Dict[str, Any]:
        """Get only normal (non-advanced) settings."""
        return {
            "llm": {
                "provider": self.llm.provider,
                "model": self.llm.model,
                "temperature": self.llm.temperature,
            },
            "retriever": {
                "retriever_type": self.retriever.retriever_type,
                "max_search_results": self.retriever.max_search_results,
            },
            "pipeline": {
                "do_research": self.pipeline.do_research,
                "do_generate_outline": self.pipeline.do_generate_outline,
                "do_generate_article": self.pipeline.do_generate_article,
                "do_polish_article": self.pipeline.do_polish_article,
                "max_conv_turn": self.pipeline.max_conv_turn,
                "max_perspective": self.pipeline.max_perspective,
            },
            "output": {
                "output_format": self.output.output_format,
                "include_citations": self.output.include_citations,
            },
        }

    def get_advanced_settings(self) -> Dict[str, Any]:
        """Get all advanced settings."""
        normal = self.get_normal_settings()
        all_settings = self.dict()
        # Remove normal settings to get only advanced
        advanced = {}
        for key, value in all_settings.items():
            if key not in ["config_version", "project_overrides"]:
                if isinstance(value, dict):
                    advanced[key] = {
                        k: v
                        for k, v in value.items()
                        if key not in normal or k not in normal.get(key, {})
                    }
        return advanced


class ConfigurationService:
    """Service for managing hierarchical configuration."""

    def __init__(self, config_dir: str = "./config"):
        self.config_dir = Path(config_dir)
        self.config_dir.mkdir(exist_ok=True)

        self.global_config_file = self.config_dir / "global_config.json"
        self.env_config_file = (
            self.config_dir / f"config.{os.getenv('STORM_ENV', 'development')}.json"
        )

        # Cache for loaded configurations
        self._global_config: Optional[ProjectConfig] = None
        self._env_config: Optional[Dict[str, Any]] = None

    def get_default_config(self) -> ProjectConfig:
        """Get default configuration."""
        return ProjectConfig()

    def load_global_config(self) -> ProjectConfig:
        """Load global configuration from file."""
        if self._global_config is None:
            if self.global_config_file.exists():
                with open(self.global_config_file, "r") as f:
                    data = json.load(f)
                    self._global_config = ProjectConfig(**data)
            else:
                self._global_config = self.get_default_config()
                self.save_global_config(self._global_config)
        return self._global_config

    def save_global_config(self, config: ProjectConfig):
        """Save global configuration to file."""
        with open(self.global_config_file, "w") as f:
            json.dump(config.dict(), f, indent=2, default=str)
        self._global_config = config
        logger.info(f"Global configuration saved to {self.global_config_file}")

    def load_env_config(self) -> Dict[str, Any]:
        """Load environment-specific configuration."""
        if self._env_config is None:
            if self.env_config_file.exists():
                with open(self.env_config_file, "r") as f:
                    self._env_config = json.load(f)
            else:
                self._env_config = {}
        return self._env_config

    def get_project_config(
        self, project_overrides: Optional[Dict[str, Any]] = None
    ) -> ProjectConfig:
        """
        Get configuration for a project with proper inheritance:
        1. Start with defaults
        2. Apply global config
        3. Apply environment config
        4. Apply project overrides
        """
        # Start with global config
        config = self.load_global_config()
        config_dict = config.dict()

        # Apply environment overrides
        env_config = self.load_env_config()
        config_dict = self._deep_merge(config_dict, env_config)

        # Apply project-specific overrides
        if project_overrides:
            config_dict = self._deep_merge(config_dict, project_overrides)

        return ProjectConfig(**config_dict)

    def _deep_merge(
        self, base: Dict[str, Any], override: Dict[str, Any]
    ) -> Dict[str, Any]:
        """Deep merge two dictionaries."""
        result = base.copy()

        for key, value in override.items():
            if (
                key in result
                and isinstance(result[key], dict)
                and isinstance(value, dict)
            ):
                result[key] = self._deep_merge(result[key], value)
            else:
                result[key] = value

        return result

    def validate_config(self, config: Dict[str, Any]) -> tuple[bool, List[str]]:
        """Validate configuration and return validation errors."""
        errors = []

        try:
            ProjectConfig(**config)
            return True, []
        except Exception as e:
            errors.append(str(e))
            return False, errors

    def get_stage_specific_llm_config(
        self, config: ProjectConfig, stage: str
    ) -> LLMProviderConfig:
        """
        Get LLM configuration for a specific pipeline stage.
        Falls back to default LLM config if stage-specific is not set.
        """
        stage_config = getattr(config.llm_stages, stage, None)
        return stage_config if stage_config else config.llm

    def export_config(
        self, config: ProjectConfig, include_sensitive: bool = False
    ) -> Dict[str, Any]:
        """Export configuration, optionally excluding sensitive data."""
        config_dict = config.dict()

        if not include_sensitive:
            # Remove sensitive fields like API keys
            sensitive_fields = ["api_key", "api_base", "deployment_name"]
            config_dict = self._remove_sensitive_fields(config_dict, sensitive_fields)

        return config_dict

    def _remove_sensitive_fields(
        self, data: Dict[str, Any], fields: List[str]
    ) -> Dict[str, Any]:
        """Recursively remove sensitive fields from configuration."""
        result = {}
        for key, value in data.items():
            if key in fields:
                result[key] = "***REDACTED***"
            elif isinstance(value, dict):
                result[key] = self._remove_sensitive_fields(value, fields)
            else:
                result[key] = value
        return result

    def get_config_by_level(
        self, config: ProjectConfig, level: ConfigLevel
    ) -> Dict[str, Any]:
        """Get configuration filtered by complexity level."""
        if level == ConfigLevel.NORMAL:
            return config.get_normal_settings()
        else:
            return config.dict()


# Singleton instance
_config_service = None


def get_config_service() -> ConfigurationService:
    """Get singleton configuration service instance."""
    global _config_service
    if _config_service is None:
        _config_service = ConfigurationService()
    return _config_service
