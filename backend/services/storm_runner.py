"""
STORM pipeline integration service.

Handles running STORM knowledge curation pipeline with progress tracking
and integration with the file-based storage system.
"""

import os
import asyncio
import json
import logging
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, Any, Optional, Callable, List
from concurrent.futures import ThreadPoolExecutor
import traceback

from .file_service import FileProjectService, ProgressData
from .config_service import (
    ProjectConfig,
    LLMProviderConfig,
    ConfigurationService,
    get_config_service,
)

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class StormRunnerService:
    """Service for running STORM pipeline with progress tracking."""

    def __init__(self, file_service: FileProjectService):
        self.file_service = file_service
        self.config_service = get_config_service()
        self.executor = ThreadPoolExecutor(max_workers=2)
        self.running_tasks = {}  # project_id -> asyncio.Task

    async def run_pipeline(
        self,
        project_id: str,
        config: Optional[ProjectConfig] = None,
        progress_callback: Optional[Callable[[str, ProgressData], None]] = None,
    ) -> Dict[str, Any]:
        """Run the complete STORM pipeline for a project."""

        # Check if project exists
        project = self.file_service.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        # Use provided config or load from project
        if config is None:
            config = ProjectConfig(**project["config"])

        # Check if already running
        if project_id in self.running_tasks:
            return {
                "status": "error",
                "message": "Pipeline already running for this project",
            }

        try:
            # Create and start the pipeline task
            task = asyncio.create_task(
                self._run_pipeline_internal(project_id, config, progress_callback)
            )
            self.running_tasks[project_id] = task

            # Wait for completion
            result = await task

            return result

        except Exception as e:
            logger.error(f"Pipeline error for project {project_id}: {e}")
            logger.error(traceback.format_exc())

            # Update progress with error
            error_progress = ProgressData(
                stage="error",
                status="error",
                error_message=str(e),
                overall_progress=0.0,
            )
            self.file_service.update_project_progress(project_id, error_progress)

            return {"status": "error", "message": str(e), "project_id": project_id}

        finally:
            # Clean up running task
            if project_id in self.running_tasks:
                del self.running_tasks[project_id]

    async def _run_pipeline_internal(
        self,
        project_id: str,
        config: ProjectConfig,
        progress_callback: Optional[Callable[[str, ProgressData], None]] = None,
    ) -> Dict[str, Any]:
        """Internal pipeline execution with progress tracking."""

        start_time = datetime.now()
        project = self.file_service.get_project(project_id)
        topic = project["topic"]

        # Initialize progress
        progress = ProgressData(
            stage="initializing",
            status="running",
            start_time=start_time,
            estimated_completion=start_time + timedelta(minutes=10),  # Rough estimate
            current_task="Initializing STORM pipeline...",
        )

        await self._update_progress(project_id, progress, progress_callback)

        try:
            # Check if STORM is available
            try:
                from knowledge_storm import (
                    STORMWikiRunner,
                    STORMWikiLMConfigs,
                    STORMWikiRunnerArguments,
                )
                from knowledge_storm.storm_wiki.modules.callback import (
                    BaseCallbackHandler,
                )
                from knowledge_storm.rm import (
                    TavilySearchRM,
                    YouRM,
                    DuckDuckGoSearchRM,
                    SerperRM,
                    GoogleSearch,
                )
            except ImportError as e:
                raise RuntimeError(
                    f"STORM not available: {e}. Please install knowledge-storm package."
                )

            # Setup output directory
            project_files = self.file_service.get_project_files(project_id)
            output_dir = str(Path(project_files["project"]).parent)

            # Configure language models
            lm_configs = STORMWikiLMConfigs()

            # Import LM class for all models
            from knowledge_storm.lm import LitellmModel

            # Note: Stanford's examples use OllamaClient directly:
            # from knowledge_storm.lm import OllamaClient
            # We use LitellmModel (v1.1.0+) for better caching and unified interface

            # Log the configuration for debugging
            # Handle both old flat structure and new nested structure
            if hasattr(config, "llm") and hasattr(config.llm, "provider"):
                # New nested structure
                llm_provider = config.llm.provider
                llm_model = config.llm.model
                temperature = config.llm.temperature
                max_tokens = config.llm.max_tokens
            else:
                # Old flat structure
                llm_provider = config.llm_provider
                llm_model = config.llm_model
                temperature = config.temperature
                max_tokens = config.max_tokens

            logger.info(f"LLM Provider from config: {llm_provider}")
            logger.info(f"LLM Model from config: {llm_model}")

            # Extract retriever configuration
            if hasattr(config, "retriever") and hasattr(
                config.retriever, "retriever_type"
            ):
                # New nested structure
                retriever_type = config.retriever.retriever_type
                max_search_results = config.retriever.max_search_results
                search_top_k = config.retriever.search_top_k
            else:
                # Old flat structure
                retriever_type = getattr(config, "retriever_type", "duckduckgo")
                max_search_results = getattr(config, "max_search_results", 10)
                search_top_k = getattr(config, "search_top_k", 3)

            # Extract pipeline configuration
            if hasattr(config, "pipeline") and hasattr(
                config.pipeline, "max_perspective"
            ):
                # New nested structure
                max_perspective = config.pipeline.max_perspective
                max_conv_turn = config.pipeline.max_conv_turn
                max_search_queries_per_turn = (
                    config.pipeline.max_search_queries_per_turn
                )
                do_research = config.pipeline.do_research
                do_generate_outline = config.pipeline.do_generate_outline
                do_generate_article = config.pipeline.do_generate_article
                do_polish_article = config.pipeline.do_polish_article
            else:
                # Old flat structure
                max_perspective = getattr(config, "max_perspective", 4)
                max_conv_turn = getattr(config, "max_conv_turn", 3)
                max_search_queries_per_turn = getattr(
                    config, "max_search_queries_per_turn", 3
                )
                do_research = getattr(config, "do_research", True)
                do_generate_outline = getattr(config, "do_generate_outline", True)
                do_generate_article = getattr(config, "do_generate_article", True)
                do_polish_article = getattr(config, "do_polish_article", True)

            logger.info(f"Retriever type: {retriever_type}")
            logger.info(f"Pipeline max_perspective: {max_perspective}")
            logger.info(
                f"Pipeline stages - Research: {do_research}, Outline: {do_generate_outline}, Article: {do_generate_article}, Polish: {do_polish_article}"
            )

            # Determine which LM class to use based on provider
            if llm_provider == "ollama":
                # Note: Stanford's examples use OllamaClient, but we use LitellmModel
                # which is the recommended approach for v1.1.0+

                # Check if we have new config structure with Ollama settings
                if hasattr(config, "llm") and hasattr(config.llm, "ollama_host"):
                    # Use configurable Ollama settings from new config
                    ollama_host = config.llm.ollama_host or "localhost"
                    ollama_port = config.llm.ollama_port or 11434
                    api_base = f"http://{ollama_host}:{ollama_port}"

                    # Get configurable stop sequences
                    stop_sequences = config.llm.stop_sequences or ["\n\n---"]

                    # Get stage-specific max tokens if configured
                    conv_max_tokens = (
                        getattr(config.llm_stages, "conv_simulator_max_tokens", 500)
                        if hasattr(config, "llm_stages")
                        else 500
                    )
                    qa_max_tokens = (
                        getattr(config.llm_stages, "question_asker_max_tokens", 500)
                        if hasattr(config, "llm_stages")
                        else 500
                    )
                    outline_max_tokens = (
                        getattr(config.llm_stages, "outline_gen_max_tokens", 1000)
                        if hasattr(config, "llm_stages")
                        else 400
                    )
                    article_max_tokens = (
                        getattr(config.llm_stages, "article_gen_max_tokens", 4000)
                        if hasattr(config, "llm_stages")
                        else 700
                    )
                    polish_max_tokens = (
                        getattr(config.llm_stages, "article_polish_max_tokens", 4000)
                        if hasattr(config, "llm_stages")
                        else min(max_tokens, 4000)
                    )
                else:
                    # Fallback to defaults for backward compatibility
                    api_base = "http://localhost:11434"
                    stop_sequences = ["\n\n---"]
                    conv_max_tokens = 500
                    qa_max_tokens = 500
                    outline_max_tokens = 400
                    article_max_tokens = 700
                    polish_max_tokens = min(max_tokens, 4000)

                # Format model name for litellm with ollama/ prefix
                model_name = f"ollama/{llm_model}"

                # Base configuration for Ollama via litellm
                lm_kwargs = {
                    "model": model_name,
                    "api_base": api_base,
                    "temperature": temperature,
                    "request_timeout": 600,  # 10 minute timeout for slower models
                    "stop": stop_sequences,  # Configurable stop sequences
                }

                # Configure different models for different stages with configurable max_tokens
                lm_configs.set_conv_simulator_lm(
                    LitellmModel(max_tokens=conv_max_tokens, **lm_kwargs)
                )
                lm_configs.set_question_asker_lm(
                    LitellmModel(max_tokens=qa_max_tokens, **lm_kwargs)
                )
                lm_configs.set_outline_gen_lm(
                    LitellmModel(max_tokens=outline_max_tokens, **lm_kwargs)
                )
                lm_configs.set_article_gen_lm(
                    LitellmModel(max_tokens=article_max_tokens, **lm_kwargs)
                )
                lm_configs.set_article_polish_lm(
                    LitellmModel(max_tokens=polish_max_tokens, **lm_kwargs)
                )
                logger.info(f"Using Ollama model: {llm_model} via LitellmModel")
                logger.info(f"Formatted model name: {model_name}")
                logger.info(f"Ollama API base: {api_base}")
                logger.info(
                    f"Max tokens - Conv: {conv_max_tokens}, QA: {qa_max_tokens}, Outline: {outline_max_tokens}, Article: {article_max_tokens}, Polish: {polish_max_tokens}"
                )

            elif llm_provider == "lmstudio":
                # Use LitellmModel for LMStudio with OpenAI-compatible format
                model_name = f"openai/{llm_model}"
                lm_kwargs = {
                    "model": model_name,
                    "api_base": "http://localhost:1234/v1",  # Default LMStudio URL
                    "api_key": "lmstudio",  # LMStudio doesn't require a real key
                    "temperature": temperature,
                    "request_timeout": 600,  # 10 minute timeout for slower models
                }

                # Configure different models for different stages with appropriate max_tokens
                lm_configs.set_conv_simulator_lm(
                    LitellmModel(max_tokens=500, **lm_kwargs)
                )
                lm_configs.set_question_asker_lm(
                    LitellmModel(max_tokens=500, **lm_kwargs)
                )
                lm_configs.set_outline_gen_lm(LitellmModel(max_tokens=400, **lm_kwargs))
                lm_configs.set_article_gen_lm(LitellmModel(max_tokens=700, **lm_kwargs))
                lm_configs.set_article_polish_lm(
                    LitellmModel(max_tokens=min(max_tokens, 4000), **lm_kwargs)
                )
                logger.info(f"Using LMStudio model: {llm_model} via LitellmModel")
                logger.info(f"Formatted model name: {model_name}")
                logger.info(f"LMStudio API base: {lm_kwargs['api_base']}")

            elif llm_provider == "anthropic":
                # Use LitellmModel for Anthropic Claude models
                model_name = f"anthropic/{llm_model}"
                lm_kwargs = {
                    "model": model_name,
                    "api_key": os.getenv("ANTHROPIC_API_KEY"),
                    "temperature": temperature,
                    "request_timeout": 300,
                }

                if lm_kwargs["api_key"]:
                    # Configure different models for different stages
                    lm_configs.set_conv_simulator_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_question_asker_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_outline_gen_lm(
                        LitellmModel(max_tokens=1000, **lm_kwargs)
                    )
                    lm_configs.set_article_gen_lm(
                        LitellmModel(max_tokens=min(max_tokens, 4096), **lm_kwargs)
                    )
                    lm_configs.set_article_polish_lm(
                        LitellmModel(max_tokens=min(max_tokens, 4096), **lm_kwargs)
                    )
                    logger.info(f"Using Anthropic model: {llm_model} via LitellmModel")
                    logger.info(f"Formatted model name: {model_name}")
                else:
                    raise ValueError(
                        "Anthropic API key not found. Please set ANTHROPIC_API_KEY environment variable."
                    )

            elif llm_provider == "gemini":
                # Use LitellmModel for Google Gemini models
                model_name = f"gemini/{llm_model}"
                lm_kwargs = {
                    "model": model_name,
                    "api_key": os.getenv("GEMINI_API_KEY"),
                    "temperature": temperature,
                    "request_timeout": 300,
                }

                if lm_kwargs["api_key"]:
                    # Configure different models for different stages
                    lm_configs.set_conv_simulator_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_question_asker_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_outline_gen_lm(
                        LitellmModel(max_tokens=1000, **lm_kwargs)
                    )
                    lm_configs.set_article_gen_lm(
                        LitellmModel(max_tokens=min(max_tokens, 8192), **lm_kwargs)
                    )
                    lm_configs.set_article_polish_lm(
                        LitellmModel(max_tokens=min(max_tokens, 8192), **lm_kwargs)
                    )
                    logger.info(f"Using Gemini model: {llm_model} via LitellmModel")
                    logger.info(f"Formatted model name: {model_name}")
                else:
                    raise ValueError(
                        "Gemini API key not found. Please set GEMINI_API_KEY environment variable."
                    )

            elif llm_provider == "azure":
                # Use LitellmModel for Azure OpenAI
                model_name = f"azure/{llm_model}"
                lm_kwargs = {
                    "model": model_name,
                    "api_key": os.getenv("AZURE_API_KEY"),
                    "api_base": os.getenv("AZURE_API_BASE"),
                    "api_version": os.getenv("AZURE_API_VERSION", "2024-02-01"),
                    "temperature": temperature,
                    "request_timeout": 300,
                }

                if lm_kwargs["api_key"] and lm_kwargs["api_base"]:
                    # Configure different models for different stages
                    lm_configs.set_conv_simulator_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_question_asker_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_outline_gen_lm(
                        LitellmModel(max_tokens=400, **lm_kwargs)
                    )
                    lm_configs.set_article_gen_lm(
                        LitellmModel(max_tokens=max_tokens, **lm_kwargs)
                    )
                    lm_configs.set_article_polish_lm(
                        LitellmModel(max_tokens=max_tokens, **lm_kwargs)
                    )
                    logger.info(
                        f"Using Azure OpenAI model: {llm_model} via LitellmModel"
                    )
                    logger.info(f"Formatted model name: {model_name}")
                else:
                    raise ValueError(
                        "Azure API key or base URL not found. Please set AZURE_API_KEY and AZURE_API_BASE environment variables."
                    )

            elif llm_provider == "cohere":
                # Use LitellmModel for Cohere models
                model_name = f"cohere/{llm_model}"
                lm_kwargs = {
                    "model": model_name,
                    "api_key": os.getenv("COHERE_API_KEY"),
                    "temperature": temperature,
                    "request_timeout": 300,
                }

                if lm_kwargs["api_key"]:
                    # Configure different models for different stages
                    lm_configs.set_conv_simulator_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_question_asker_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_outline_gen_lm(
                        LitellmModel(max_tokens=1000, **lm_kwargs)
                    )
                    lm_configs.set_article_gen_lm(
                        LitellmModel(max_tokens=min(max_tokens, 4000), **lm_kwargs)
                    )
                    lm_configs.set_article_polish_lm(
                        LitellmModel(max_tokens=min(max_tokens, 4000), **lm_kwargs)
                    )
                    logger.info(f"Using Cohere model: {llm_model} via LitellmModel")
                    logger.info(f"Formatted model name: {model_name}")
                else:
                    raise ValueError(
                        "Cohere API key not found. Please set COHERE_API_KEY environment variable."
                    )

            elif llm_provider == "replicate":
                # Use LitellmModel for Replicate models
                model_name = f"replicate/{llm_model}"
                lm_kwargs = {
                    "model": model_name,
                    "api_key": os.getenv("REPLICATE_API_KEY"),
                    "temperature": temperature,
                    "request_timeout": 600,
                }

                if lm_kwargs["api_key"]:
                    # Configure different models for different stages
                    lm_configs.set_conv_simulator_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_question_asker_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_outline_gen_lm(
                        LitellmModel(max_tokens=1000, **lm_kwargs)
                    )
                    lm_configs.set_article_gen_lm(
                        LitellmModel(max_tokens=min(max_tokens, 4096), **lm_kwargs)
                    )
                    lm_configs.set_article_polish_lm(
                        LitellmModel(max_tokens=min(max_tokens, 4096), **lm_kwargs)
                    )
                    logger.info(f"Using Replicate model: {llm_model} via LitellmModel")
                    logger.info(f"Formatted model name: {model_name}")
                else:
                    raise ValueError(
                        "Replicate API key not found. Please set REPLICATE_API_KEY environment variable."
                    )

            elif llm_provider == "huggingface":
                # Use LitellmModel for HuggingFace models
                model_name = f"huggingface/{llm_model}"
                lm_kwargs = {
                    "model": model_name,
                    "api_key": os.getenv("HUGGINGFACE_API_KEY"),
                    "api_base": os.getenv(
                        "HUGGINGFACE_API_BASE",
                        "https://api-inference.huggingface.co/models",
                    ),
                    "temperature": temperature,
                    "request_timeout": 600,
                }

                if lm_kwargs["api_key"]:
                    # Configure different models for different stages
                    lm_configs.set_conv_simulator_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_question_asker_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_outline_gen_lm(
                        LitellmModel(max_tokens=1000, **lm_kwargs)
                    )
                    lm_configs.set_article_gen_lm(
                        LitellmModel(max_tokens=min(max_tokens, 2048), **lm_kwargs)
                    )
                    lm_configs.set_article_polish_lm(
                        LitellmModel(max_tokens=min(max_tokens, 2048), **lm_kwargs)
                    )
                    logger.info(
                        f"Using HuggingFace model: {llm_model} via LitellmModel"
                    )
                    logger.info(f"Formatted model name: {model_name}")
                else:
                    raise ValueError(
                        "HuggingFace API key not found. Please set HUGGINGFACE_API_KEY environment variable."
                    )

            elif llm_provider == "together":
                # Use LitellmModel for Together AI models
                model_name = f"together_ai/{llm_model}"
                lm_kwargs = {
                    "model": model_name,
                    "api_key": os.getenv("TOGETHERAI_API_KEY"),
                    "temperature": temperature,
                    "request_timeout": 600,
                }

                if lm_kwargs["api_key"]:
                    # Configure different models for different stages
                    lm_configs.set_conv_simulator_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_question_asker_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_outline_gen_lm(
                        LitellmModel(max_tokens=1000, **lm_kwargs)
                    )
                    lm_configs.set_article_gen_lm(
                        LitellmModel(max_tokens=min(max_tokens, 4096), **lm_kwargs)
                    )
                    lm_configs.set_article_polish_lm(
                        LitellmModel(max_tokens=min(max_tokens, 4096), **lm_kwargs)
                    )
                    logger.info(
                        f"Using Together AI model: {llm_model} via LitellmModel"
                    )
                    logger.info(f"Formatted model name: {model_name}")
                else:
                    raise ValueError(
                        "Together AI API key not found. Please set TOGETHERAI_API_KEY environment variable."
                    )

            elif llm_provider == "groq":
                # Use LitellmModel for Groq models (fast inference)
                model_name = f"groq/{llm_model}"
                lm_kwargs = {
                    "model": model_name,
                    "api_key": os.getenv("GROQ_API_KEY"),
                    "temperature": temperature,
                    "request_timeout": 300,
                }

                if lm_kwargs["api_key"]:
                    # Configure different models for different stages
                    lm_configs.set_conv_simulator_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_question_asker_lm(
                        LitellmModel(max_tokens=500, **lm_kwargs)
                    )
                    lm_configs.set_outline_gen_lm(
                        LitellmModel(max_tokens=1000, **lm_kwargs)
                    )
                    lm_configs.set_article_gen_lm(
                        LitellmModel(max_tokens=min(max_tokens, 8000), **lm_kwargs)
                    )
                    lm_configs.set_article_polish_lm(
                        LitellmModel(max_tokens=min(max_tokens, 8000), **lm_kwargs)
                    )
                    logger.info(f"Using Groq model: {llm_model} via LitellmModel")
                    logger.info(f"Formatted model name: {model_name}")
                else:
                    raise ValueError(
                        "Groq API key not found. Please set GROQ_API_KEY environment variable."
                    )

            else:
                # Default to OpenAI using LitellmModel (recommended approach)
                # Format model name for litellm with openai/ prefix
                model_name = f"openai/{llm_model}"

                openai_kwargs = {
                    "model": model_name,
                    "api_key": os.getenv("OPENAI_API_KEY"),
                    "temperature": temperature,
                }

                if openai_kwargs["api_key"]:
                    # Configure different models for different stages
                    lm_configs.set_conv_simulator_lm(
                        LitellmModel(max_tokens=500, **openai_kwargs)
                    )
                    lm_configs.set_question_asker_lm(
                        LitellmModel(max_tokens=500, **openai_kwargs)
                    )
                    lm_configs.set_outline_gen_lm(
                        LitellmModel(max_tokens=400, **openai_kwargs)
                    )
                    lm_configs.set_article_gen_lm(
                        LitellmModel(max_tokens=max_tokens, **openai_kwargs)
                    )
                    lm_configs.set_article_polish_lm(
                        LitellmModel(max_tokens=max_tokens, **openai_kwargs)
                    )
                    logger.info(f"Using OpenAI model: {llm_model} via LitellmModel")
                    logger.info(f"Formatted model name: {model_name}")
                else:
                    logger.warning("No OpenAI API key found. Using mock responses.")
                    # In production, you might want to handle this differently

            # Configure retriever based on available options
            rm = None

            # Try different retrievers based on config
            if retriever_type == "google" and os.getenv("GOOGLE_SEARCH_API_KEY"):
                api_key = os.getenv("GOOGLE_SEARCH_API_KEY")
                cse_id = os.getenv("GOOGLE_CSE_ID")
                if cse_id:
                    rm = GoogleSearch(
                        google_search_api_key=api_key,
                        google_cse_id=cse_id,
                        k=max_search_results,
                    )
                    logger.info(f"Using GoogleSearch for project {project_id}")
                else:
                    logger.warning("Google CSE ID not found, cannot use Google Search")
            elif retriever_type == "serper" and os.getenv("SERPER_API_KEY"):
                api_key = os.getenv("SERPER_API_KEY")
                rm = SerperRM(serper_search_api_key=api_key, k=max_search_results)
                logger.info(
                    f"Using SerperRM (Google via Serper) for project {project_id}"
                )
            elif retriever_type == "tavily" and os.getenv("TAVILY_API_KEY"):
                api_key = os.getenv("TAVILY_API_KEY")
                rm = TavilySearchRM(tavily_search_api_key=api_key, k=max_search_results)
                logger.info(f"Using TavilySearchRM for project {project_id}")
            elif retriever_type == "you" and os.getenv("YDC_API_KEY"):
                api_key = os.getenv("YDC_API_KEY")
                rm = YouRM(ydc_api_key=api_key, k=max_search_results)
                logger.info(f"Using YouRM for project {project_id}")
            elif retriever_type == "duckduckgo":
                rm = DuckDuckGoSearchRM(k=max_search_results)
                logger.info(f"Using DuckDuckGoSearchRM for project {project_id}")

            if rm is None:
                # Fallback to DuckDuckGo (no API key required)
                logger.warning(
                    f"No retriever configured for {retriever_type}, falling back to DuckDuckGo"
                )
                rm = DuckDuckGoSearchRM(k=max_search_results)

            # Configure runner arguments
            engine_args = STORMWikiRunnerArguments(
                output_dir=output_dir,
                max_conv_turn=max_conv_turn,
                max_perspective=max_perspective,
                search_top_k=search_top_k,
                max_search_queries_per_turn=max_search_queries_per_turn,
            )

            # Create STORM runner
            runner = STORMWikiRunner(engine_args, lm_configs, rm)

            # Define pipeline stages
            stages = []
            if do_research:
                stages.append("research")
            if do_generate_outline:
                stages.append("outline")
            if do_generate_article:
                stages.append("article")
            if do_polish_article:
                stages.append("polish")

            if not stages:
                raise ValueError("No pipeline stages enabled in configuration")

            total_stages = len(stages)
            completed_stages = []

            # Update progress for pipeline start
            initial_progress = ProgressData(
                stage="research" if do_research else "outline",
                status="running",
                start_time=start_time,
                current_task=f"Running STORM pipeline for topic: {topic}",
                overall_progress=5.0,
                stage_progress=0.0,
                stages_completed=[],
            )
            await self._update_progress(project_id, initial_progress, progress_callback)

            # Execute the full pipeline using the run method
            def run_pipeline():
                try:
                    logger.info(f"Starting STORM pipeline for topic: {topic}")
                    logger.info(
                        f"Pipeline stages - Research: {do_research}, Outline: {do_generate_outline}, Article: {do_generate_article}, Polish: {do_polish_article}"
                    )
                    logger.info(f"Using LLM: {llm_provider}/{llm_model}")
                    logger.info(
                        f"Note: Research phase involves multiple LLM calls and can take 10-30 minutes with local models"
                    )

                    import time

                    stage_start = time.time()

                    logger.info(
                        "Calling runner.run() - entering STORM pipeline execution..."
                    )
                    runner.run(
                        topic=topic,
                        do_research=do_research,
                        do_generate_outline=do_generate_outline,
                        do_generate_article=do_generate_article,
                        do_polish_article=do_polish_article,
                        callback_handler=BaseCallbackHandler(),
                    )

                    elapsed = time.time() - stage_start
                    logger.info(
                        f"Pipeline execution completed in {elapsed:.1f} seconds"
                    )
                    return True
                except Exception as e:
                    logger.error(f"Pipeline failed: {e}")
                    logger.error(f"Error type: {type(e).__name__}")
                    logger.error(traceback.format_exc())
                    return False

            # Run in thread pool to avoid blocking
            logger.info(f"Executing pipeline in thread pool for project {project_id}")
            loop = asyncio.get_event_loop()

            # Create a background task to update progress periodically during research
            progress_update_task = None

            async def update_research_progress():
                """Gradually increase progress during research phase"""
                try:
                    start_progress = 5.0
                    max_progress = 23.0  # Leave room for completion at 25%
                    duration = (
                        300  # Assume 5 minutes for research (adjust based on model)
                    )
                    update_interval = 10  # Update every 10 seconds

                    elapsed = 0
                    while elapsed < duration and do_research:
                        await asyncio.sleep(update_interval)
                        elapsed += update_interval

                        # Calculate gradual progress
                        progress_pct = min(
                            elapsed / duration, 0.95
                        )  # Cap at 95% of phase
                        current_progress = (
                            start_progress
                            + (max_progress - start_progress) * progress_pct
                        )

                        progress_data = ProgressData(
                            stage="research",
                            status="running",
                            start_time=start_time,
                            current_task=f"Research phase in progress ({int(elapsed)}s elapsed)... Local models may take 10-30 minutes",
                            overall_progress=current_progress,
                            stage_progress=progress_pct * 100,
                            stages_completed=completed_stages,
                        )
                        await self._update_progress(
                            project_id, progress_data, progress_callback
                        )

                        # Check if pipeline is still running
                        progress = self.file_service._load_project_progress(project_id)
                        if progress and progress.status != "running":
                            break

                except asyncio.CancelledError:
                    logger.info("Progress update task cancelled")
                except Exception as e:
                    logger.error(f"Error in progress update task: {e}")

            # Start progress update task if research is enabled
            if do_research:
                progress_update_task = asyncio.create_task(update_research_progress())

            # Execute pipeline
            success = await loop.run_in_executor(self.executor, run_pipeline)

            # Cancel progress update task if still running
            if progress_update_task and not progress_update_task.done():
                progress_update_task.cancel()
                try:
                    await progress_update_task
                except asyncio.CancelledError:
                    pass

            if not success:
                raise RuntimeError("Failed to complete pipeline")

            completed_stages = stages

            # Update progress to complete
            final_progress = ProgressData(
                stage="completed",
                status="completed",
                start_time=start_time,
                current_task="Pipeline completed successfully",
                overall_progress=100.0,
                stage_progress=100.0,
                stages_completed=completed_stages,
            )
            await self._update_progress(project_id, final_progress, progress_callback)

            # Load generated article if available
            # STORM generates the article with underscores in the directory name
            topic_dir = topic.replace(" ", "_").replace("/", "_")
            storm_output_dir = Path(output_dir) / topic_dir

            # Try to load the polished article first, then fall back to regular article
            article_candidates = [
                storm_output_dir / "storm_gen_article_polished.txt",
                storm_output_dir / "storm_gen_article.txt",
                Path(output_dir) / f"{topic}.txt",  # Fallback to old format
            ]

            generated_content = None
            for article_path in article_candidates:
                if article_path.exists():
                    logger.info(f"Loading article from: {article_path}")
                    with open(article_path, "r", encoding="utf-8") as f:
                        generated_content = f.read()
                    break

            if generated_content:
                # Update project with generated content
                self.file_service.update_project(
                    project_id, {"content": generated_content, "status": "completed"}
                )
                logger.info(f"Updated project {project_id} with generated article")
            else:
                logger.warning(
                    f"No article found for project {project_id} in {storm_output_dir}"
                )

            # Final progress update
            final_progress = ProgressData(
                stage="completed",
                status="completed",
                start_time=start_time,
                current_task="Pipeline completed successfully",
                overall_progress=100.0,
                stage_progress=100.0,
                stages_completed=completed_stages,
            )
            await self._update_progress(project_id, final_progress, progress_callback)

            return {
                "status": "completed",
                "message": "Pipeline completed successfully",
                "project_id": project_id,
                "stages_completed": completed_stages,
                "duration": (datetime.now() - start_time).total_seconds(),
            }

        except Exception as e:
            logger.error(f"Pipeline execution failed: {e}")
            logger.error(traceback.format_exc())

            error_progress = ProgressData(
                stage="error",
                status="error",
                start_time=start_time,
                error_message=str(e),
                current_task="Pipeline failed",
            )
            await self._update_progress(project_id, error_progress, progress_callback)

            raise e

    async def _update_progress(
        self,
        project_id: str,
        progress: ProgressData,
        progress_callback: Optional[Callable[[str, ProgressData], None]] = None,
    ):
        """Update progress data for a project."""

        # Save to file
        self.file_service.update_project_progress(project_id, progress)

        # Call callback if provided
        if progress_callback:
            try:
                # Check if callback is async
                if asyncio.iscoroutinefunction(progress_callback):
                    await progress_callback(project_id, progress)
                else:
                    progress_callback(project_id, progress)
            except Exception as e:
                logger.warning(f"Progress callback failed: {e}")

        logger.info(
            f"Project {project_id} - Stage: {progress.stage}, Progress: {progress.overall_progress:.1f}%"
        )

    def cancel_pipeline(self, project_id: str) -> bool:
        """Cancel a running pipeline."""

        if project_id not in self.running_tasks:
            # Check if there's a stuck pipeline state
            progress = self.file_service._load_project_progress(project_id)
            if progress and progress.status in ["running", "in_progress"]:
                # Clean up stuck state
                logger.info(
                    f"Cleaning up stuck pipeline state for project {project_id}"
                )
                progress = ProgressData(
                    stage="cancelled",
                    status="cancelled",
                    current_task="Pipeline state cleaned up",
                )
                self.file_service.update_project_progress(project_id, progress)
                return True
            return False

        task = self.running_tasks[project_id]
        task.cancel()

        # Remove from running tasks immediately
        del self.running_tasks[project_id]

        # Update progress to indicate cancellation
        progress = ProgressData(
            stage="cancelled",
            status="cancelled",
            current_task="Pipeline cancelled by user",
        )
        self.file_service.update_project_progress(project_id, progress)

        return True

    def get_pipeline_status(self, project_id: str) -> Dict[str, Any]:
        """Get current pipeline status for a project."""

        progress = self.file_service._load_project_progress(project_id)

        # Check both in-memory tasks and file state
        is_running_in_memory = project_id in self.running_tasks
        is_running_in_file = progress and progress.status in ["running", "in_progress"]

        # If there's a mismatch, clean up the state
        if is_running_in_file and not is_running_in_memory:
            logger.warning(
                f"Detected stuck pipeline state for project {project_id}, marking as stale"
            )
            # Don't automatically cancel - let the user decide
            # But indicate it's stuck
            if progress:
                progress.status = "stuck"
                progress.current_task = (
                    "Pipeline may be stuck - consider cancelling and retrying"
                )

        is_running = is_running_in_memory  # Trust in-memory state over file state

        return {
            "project_id": project_id,
            "is_running": is_running,
            "progress": progress.model_dump() if progress else {},
            "can_cancel": is_running
            or (progress and progress.status in ["running", "in_progress", "stuck"]),
        }

    def list_running_pipelines(self) -> List[str]:
        """List all currently running pipeline project IDs."""
        return list(self.running_tasks.keys())

    async def run_mock_pipeline(
        self,
        project_id: str,
        progress_callback: Optional[Callable[[str, ProgressData], None]] = None,
    ) -> Dict[str, Any]:
        """Run a mock pipeline for testing purposes."""

        start_time = datetime.now()
        project = self.file_service.get_project(project_id)
        if not project:
            raise ValueError(f"Project {project_id} not found")

        stages = ["research", "outline", "article", "polish"]
        completed_stages = []

        try:
            for i, stage in enumerate(stages):
                # Update progress
                progress = ProgressData(
                    stage=stage,
                    status="running",
                    start_time=start_time,
                    current_task=f"Running mock {stage} stage...",
                    overall_progress=(i / len(stages)) * 100,
                    stage_progress=0.0,
                    stages_completed=completed_stages.copy(),
                )
                await self._update_progress(project_id, progress, progress_callback)

                # Simulate work with shorter delays for testing
                for j in range(3):
                    await asyncio.sleep(1)  # Reduced from longer delays
                    progress.stage_progress = ((j + 1) / 3) * 100
                    await self._update_progress(project_id, progress, progress_callback)

                completed_stages.append(stage)
                progress.overall_progress = ((i + 1) / len(stages)) * 100
                progress.stages_completed = completed_stages.copy()
                await self._update_progress(project_id, progress, progress_callback)

            # Generate mock content
            mock_content = f"""# {project['title']}

## Introduction
This is a mock article generated for testing purposes about {project['topic']}.

## Main Content
Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua.

### Section 1
Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat.

### Section 2
Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur.

## Conclusion
Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.

*This article was generated using STORM (mock mode) at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}*
"""

            # Update project with mock content
            self.file_service.update_project(
                project_id, {"content": mock_content, "status": "completed"}
            )

            # Final progress
            final_progress = ProgressData(
                stage="completed",
                status="completed",
                start_time=start_time,
                current_task="Mock pipeline completed successfully",
                overall_progress=100.0,
                stage_progress=100.0,
                stages_completed=completed_stages,
            )
            await self._update_progress(project_id, final_progress, progress_callback)

            return {
                "status": "completed",
                "message": "Mock pipeline completed successfully",
                "project_id": project_id,
                "stages_completed": completed_stages,
                "duration": (datetime.now() - start_time).total_seconds(),
                "mode": "mock",
            }

        except asyncio.CancelledError:
            progress = ProgressData(
                stage="cancelled",
                status="cancelled",
                current_task="Mock pipeline cancelled",
            )
            await self._update_progress(project_id, progress, progress_callback)
            raise

        except Exception as e:
            error_progress = ProgressData(
                stage="error",
                status="error",
                error_message=str(e),
                current_task="Mock pipeline failed",
            )
            await self._update_progress(project_id, error_progress, progress_callback)
            raise
