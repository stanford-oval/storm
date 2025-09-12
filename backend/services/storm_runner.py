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

from .file_service import FileProjectService, ProjectConfig, ProgressData

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


class StormRunnerService:
    """Service for running STORM pipeline with progress tracking."""

    def __init__(self, file_service: FileProjectService):
        self.file_service = file_service
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
                from knowledge_storm.lm import OpenAIModel
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

            # Set up OpenAI models (you may need to configure API keys)
            openai_kwargs = {
                "api_key": os.getenv("OPENAI_API_KEY"),
                "temperature": config.temperature,
                "max_tokens": config.max_tokens,
            }

            if openai_kwargs["api_key"]:
                # Configure different models for different stages
                lm_configs.set_conv_simulator_lm(
                    OpenAIModel(model=config.llm_model, **openai_kwargs)
                )
                lm_configs.set_question_asker_lm(
                    OpenAIModel(model=config.llm_model, **openai_kwargs)
                )
                lm_configs.set_outline_gen_lm(
                    OpenAIModel(model=config.llm_model, **openai_kwargs)
                )
                lm_configs.set_article_gen_lm(
                    OpenAIModel(model=config.llm_model, **openai_kwargs)
                )
                lm_configs.set_article_polish_lm(
                    OpenAIModel(model=config.llm_model, **openai_kwargs)
                )
            else:
                logger.warning("No OpenAI API key found. Using mock responses.")
                # In production, you might want to handle this differently

            # Configure retriever based on available options
            rm = None

            # Try different retrievers based on config
            if config.retriever_type == "google" and os.getenv("GOOGLE_SEARCH_API_KEY"):
                api_key = os.getenv("GOOGLE_SEARCH_API_KEY")
                cse_id = os.getenv("GOOGLE_CSE_ID")
                if cse_id:
                    rm = GoogleSearch(
                        google_search_api_key=api_key,
                        google_cse_id=cse_id,
                        k=config.max_search_results,
                    )
                    logger.info(f"Using GoogleSearch for project {project_id}")
                else:
                    logger.warning("Google CSE ID not found, cannot use Google Search")
            elif config.retriever_type == "serper" and os.getenv("SERPER_API_KEY"):
                api_key = os.getenv("SERPER_API_KEY")
                rm = SerperRM(
                    serper_search_api_key=api_key, k=config.max_search_results
                )
                logger.info(
                    f"Using SerperRM (Google via Serper) for project {project_id}"
                )
            elif config.retriever_type == "tavily" and os.getenv("TAVILY_API_KEY"):
                api_key = os.getenv("TAVILY_API_KEY")
                rm = TavilySearchRM(
                    tavily_search_api_key=api_key, k=config.max_search_results
                )
                logger.info(f"Using TavilySearchRM for project {project_id}")
            elif config.retriever_type == "you" and os.getenv("YDC_API_KEY"):
                api_key = os.getenv("YDC_API_KEY")
                rm = YouRM(ydc_api_key=api_key, k=config.max_search_results)
                logger.info(f"Using YouRM for project {project_id}")
            elif config.retriever_type == "duckduckgo":
                rm = DuckDuckGoSearchRM(k=config.max_search_results)
                logger.info(f"Using DuckDuckGoSearchRM for project {project_id}")

            if rm is None:
                # Fallback to DuckDuckGo (no API key required)
                logger.warning(
                    f"No retriever configured for {config.retriever_type}, falling back to DuckDuckGo"
                )
                rm = DuckDuckGoSearchRM(k=config.max_search_results)

            # Configure runner arguments
            engine_args = STORMWikiRunnerArguments(
                output_dir=output_dir,
                max_conv_turn=config.max_conv_turn,
                max_perspective=config.max_perspective,
                search_top_k=config.search_top_k,
                max_search_queries_per_turn=config.max_search_queries_per_turn,
            )

            # Create STORM runner
            runner = STORMWikiRunner(engine_args, lm_configs, rm)

            # Define pipeline stages
            stages = []
            if config.do_research:
                stages.append("research")
            if config.do_generate_outline:
                stages.append("outline")
            if config.do_generate_article:
                stages.append("article")
            if config.do_polish_article:
                stages.append("polish")

            if not stages:
                raise ValueError("No pipeline stages enabled in configuration")

            total_stages = len(stages)
            completed_stages = []

            # Update progress for pipeline start
            initial_progress = ProgressData(
                stage="research" if config.do_research else "outline",
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
                        f"Pipeline stages - Research: {config.do_research}, Outline: {config.do_generate_outline}, Article: {config.do_generate_article}, Polish: {config.do_polish_article}"
                    )

                    runner.run(
                        topic=topic,
                        do_research=config.do_research,
                        do_generate_outline=config.do_generate_outline,
                        do_generate_article=config.do_generate_article,
                        do_polish_article=config.do_polish_article,
                        callback_handler=BaseCallbackHandler(),
                    )
                    return True
                except Exception as e:
                    logger.error(f"Pipeline failed: {e}")
                    logger.error(traceback.format_exc())
                    return False

            # Run in thread pool to avoid blocking
            logger.info(f"Executing pipeline in thread pool for project {project_id}")
            loop = asyncio.get_event_loop()
            success = await loop.run_in_executor(self.executor, run_pipeline)

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
            return False

        task = self.running_tasks[project_id]
        task.cancel()

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
        is_running = project_id in self.running_tasks

        return {
            "project_id": project_id,
            "is_running": is_running,
            "progress": progress.model_dump(),
            "can_cancel": is_running,
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
