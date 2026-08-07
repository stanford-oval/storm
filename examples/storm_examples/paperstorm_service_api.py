"""
Optional FastAPI adapter for the PaperStorm service core.

Example:
    uvicorn examples.storm_examples.paperstorm_service_api:app --reload
"""

from pathlib import Path
from typing import Optional

from knowledge_storm.paperstorm_service import PaperStormTaskService


DEFAULT_SERVICE_ROOT = Path("./results/paperstorm_service")


def create_app(service_root=DEFAULT_SERVICE_ROOT):
    try:
        from fastapi import FastAPI
        from pydantic import BaseModel
        from starlette.middleware.cors import CORSMiddleware
    except ImportError as exc:
        raise RuntimeError(
            "FastAPI service adapter requires optional dependencies: fastapi and uvicorn."
        ) from exc

    service = PaperStormTaskService(root_dir=service_root)
    app = FastAPI(title="PaperStorm Agent Service", version="0.9")
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_methods=["*"],
        allow_headers=["*"],
    )

    class ResearchTaskRequest(BaseModel):
        topic: str
        retriever: str = "arxiv"
        output_language: str = "zh"
        run_mode: str = "fake"
        pdf_dir: Optional[str] = None
        llm_provider: str = "deepseek"
        llm_model: str = "flash"
        max_thread_num: int = 1
        max_conv_turn: int = 1
        max_perspective: int = 1
        search_top_k: int = 2
        retrieve_top_k: int = 3
        do_research: bool = True
        do_generate_outline: bool = True
        do_generate_article: bool = True
        do_polish_article: bool = True
        remove_duplicate: bool = False
        disable_trace: bool = False
        verbose: bool = False
        expected_keywords: list[str] = []
        forbidden_keywords: list[str] = []

    class KnowledgeBaseQueryRequest(BaseModel):
        question: str
        top_k: int = 3

    @app.post("/research-tasks")
    def submit_research_task(request: ResearchTaskRequest):
        return service.submit_research_task(**request.dict())

    @app.get("/research-tasks")
    def list_research_tasks(status: Optional[str] = None):
        return {"tasks": service.list_tasks(status=status)}

    @app.post("/research-tasks/{task_id}/run")
    def run_research_task(task_id: str):
        return service.run_task(task_id)

    @app.get("/research-tasks/{task_id}")
    def get_research_task(task_id: str):
        return service.get_task(task_id)

    @app.get("/research-tasks/{task_id}/article")
    def get_research_article(task_id: str):
        return service.get_article(task_id)

    @app.get("/research-tasks/{task_id}/scorecard")
    def get_research_scorecard(task_id: str):
        return service.get_scorecard(task_id)

    @app.get("/research-tasks/{task_id}/trace")
    def get_research_trace(task_id: str):
        return service.get_trace(task_id)

    @app.get("/research-tasks/{task_id}/dashboard")
    def get_research_dashboard(task_id: str):
        return service.get_dashboard_bundle(task_id)

    @app.post("/knowledge-bases/{task_id}/query")
    def query_knowledge_base(task_id: str, request: KnowledgeBaseQueryRequest):
        return service.query_knowledge_base(
            task_id,
            question=request.question,
            top_k=request.top_k,
        )

    return app


try:
    app = create_app()
except RuntimeError:
    app = None
