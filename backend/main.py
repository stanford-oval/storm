"""
STORM UI Backend API

FastAPI application providing REST endpoints for the STORM UI frontend.
Implements file-based storage for projects and integrates with STORM pipeline.
"""

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
import os
from contextlib import asynccontextmanager

from routers import projects, pipeline, docs, settings


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application lifespan management."""
    # Startup: Initialize storage directories
    os.makedirs("storm-projects/projects", exist_ok=True)

    # Create projects index if it doesn't exist
    projects_index = "storm-projects/projects.json"
    if not os.path.exists(projects_index):
        import json

        with open(projects_index, "w") as f:
            json.dump({"projects": []}, f)

    yield
    # Shutdown: Any cleanup if needed


app = FastAPI(
    title="STORM UI API",
    description="Backend API for STORM knowledge curation system",
    version="1.0.0",
    docs_url="/api/docs",
    redoc_url="/api/redoc",
    openapi_url="/api/openapi.json",
    lifespan=lifespan,
)

# CORS configuration for Next.js frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
    ],
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
)

# Include routers with API prefix
app.include_router(projects.router, prefix="/api/projects", tags=["projects"])
app.include_router(pipeline.router, prefix="/api/pipeline", tags=["pipeline"])
app.include_router(settings.router, prefix="/api/settings", tags=["settings"])
app.include_router(docs.router, tags=["documentation"])


@app.get("/api/health")
async def health_check():
    """Health check endpoint."""
    return {
        "status": "healthy",
        "message": "STORM UI Backend is running",
        "version": "1.0.0",
    }


@app.get("/api/info")
async def system_info():
    """Get system information and configuration."""
    try:
        # Check if STORM is available
        import knowledge_storm

        storm_version = knowledge_storm.__version__
    except ImportError:
        storm_version = "not installed"

    return {
        "storm_version": storm_version,
        "python_version": os.sys.version,
        "storage_path": os.path.abspath("storm-projects"),
        "features": {
            "file_storage": True,
            "storm_integration": storm_version != "not installed",
            "background_tasks": True,
        },
    }


@app.get("/")
async def root():
    """Root endpoint redirect to API docs."""
    return {"message": "STORM UI Backend API", "docs": "/api/docs"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True, log_level="info")
