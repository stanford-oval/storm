"""
Projects router for STORM UI API.

Provides CRUD endpoints for managing STORM projects with file-based storage.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import List, Optional, Dict, Any
from uuid import UUID
from pydantic import BaseModel, Field
from uuid import UUID
import logging

from services.file_service import FileProjectService, ProjectConfig

# Configure logging
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter()

# Initialize file service (could be dependency injected in larger apps)
file_service = FileProjectService()


# Request/Response Models
class CreateProjectRequest(BaseModel):
    """Request model for creating a new project."""

    title: str = Field(..., min_length=1, max_length=200, description="Project title")
    topic: str = Field(..., min_length=1, max_length=500, description="Research topic")
    config: Optional[ProjectConfig] = Field(
        None, description="Optional pipeline configuration"
    )


class UpdateProjectRequest(BaseModel):
    """Request model for updating a project."""

    title: Optional[str] = Field(None, min_length=1, max_length=200)
    topic: Optional[str] = Field(None, min_length=1, max_length=500)
    content: Optional[str] = Field(None, description="Article content")
    status: Optional[str] = Field(
        None, pattern="^(draft|researching|writing|completed|error)$"
    )
    tags: Optional[List[str]] = Field(None, description="Project tags")


class ProjectResponse(BaseModel):
    """Response model for project data."""

    id: str
    title: str
    topic: str
    status: str
    progress: Optional[Dict[str, Any]] = None
    word_count: int
    created_at: str
    updated_at: str
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None
    config: Optional[Dict[str, Any]] = None
    description: Optional[str] = None
    tags: List[str]
    current_stage: str
    pipeline_status: str


class ProjectDetailResponse(BaseModel):
    """Detailed response model for full project data."""

    id: str
    title: str
    topic: str
    status: str
    description: Optional[str] = None
    content: str
    contentWithLinks: Optional[str] = None
    references: Optional[Dict[str, Any]] = None
    metadata: Dict[str, Any]
    config: Dict[str, Any]
    progress: Dict[str, Any]
    createdAt: Optional[str] = None
    updatedAt: Optional[str] = None


class PaginatedProjectResponse(BaseModel):
    """Paginated response for project listings."""

    projects: List[ProjectResponse]
    page: int
    limit: int
    total: int


class DuplicateProjectRequest(BaseModel):
    """Request model for duplicating a project."""

    new_title: Optional[str] = Field(
        None, description="Title for the duplicated project"
    )


# API Endpoints


@router.get("/", response_model=PaginatedProjectResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(
        None, regex="^(draft|researching|writing|completed|error)$"
    ),
    sortBy: Optional[str] = Query("updatedAt"),
    sortOrder: Optional[str] = Query("desc", regex="^(asc|desc)$"),
):
    """List all projects with optional filtering and pagination."""
    try:
        all_projects = file_service.list_projects()

        # Filter by status if provided
        if status:
            all_projects = [p for p in all_projects if p.get("status") == status]

        # Sort projects
        if sortBy == "updatedAt":
            all_projects.sort(
                key=lambda x: x.get("updated_at", ""), reverse=(sortOrder == "desc")
            )
        elif sortBy == "createdAt":
            all_projects.sort(
                key=lambda x: x.get("created_at", ""), reverse=(sortOrder == "desc")
            )
        elif sortBy == "title":
            all_projects.sort(
                key=lambda x: x.get("title", "").lower(), reverse=(sortOrder == "desc")
            )

        # Calculate pagination
        total = len(all_projects)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit

        # Apply pagination
        paginated_projects = all_projects[start_idx:end_idx]

        return PaginatedProjectResponse(
            projects=paginated_projects, page=page, limit=limit, total=total
        )

    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        raise HTTPException(status_code=500, detail="Failed to list projects")


@router.post("/", response_model=ProjectResponse)
async def create_project(request: CreateProjectRequest):
    """Create a new project."""
    try:
        project = file_service.create_project(
            title=request.title, topic=request.topic, config=request.config
        )

        if not project:
            raise HTTPException(status_code=500, detail="Failed to create project")

        logger.info(f"Created project: {project}")
        logger.info(f"Project ID: {project.get('id')}")
        return project

    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        logger.error(f"Error creating project: {e}")
        raise HTTPException(status_code=500, detail="Failed to create project")


@router.get("/{project_id}", response_model=ProjectDetailResponse)
async def get_project(project_id: UUID):
    """Get a specific project by ID."""
    try:
        project = file_service.get_project(str(project_id))

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        return project

    except Exception as e:
        logger.error(f"Error getting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get project")


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: UUID, request: UpdateProjectRequest):
    """Update a project."""
    try:
        # Convert request to dict, excluding None values
        updates = {k: v for k, v in request.model_dump().items() if v is not None}

        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")

        success = file_service.update_project(str(project_id), updates)

        if not success:
            raise HTTPException(status_code=404, detail="Project not found")

        # Return updated project summary
        updated_project = file_service.get_project_summary(str(project_id))
        if not updated_project:
            raise HTTPException(status_code=500, detail="Failed to get updated project")

        return updated_project

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update project")


@router.delete("/{project_id}")
async def delete_project(project_id: UUID):
    """Delete a project."""
    try:
        success = file_service.delete_project(str(project_id))

        if not success:
            raise HTTPException(status_code=404, detail="Project not found")

        return {"message": "Project deleted successfully"}

    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete project")


@router.post("/{project_id}/duplicate", response_model=ProjectResponse)
async def duplicate_project(project_id: UUID, request: DuplicateProjectRequest):
    """Duplicate a project."""
    try:
        new_project = file_service.duplicate_project(str(project_id), request.new_title)

        if not new_project:
            raise HTTPException(status_code=404, detail="Project not found")

        return new_project

    except Exception as e:
        logger.error(f"Error duplicating project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to duplicate project")


@router.get("/{project_id}/config", response_model=Dict[str, Any])
async def get_project_config(project_id: UUID):
    """Get project configuration."""
    try:
        project = file_service.get_project(str(project_id))

        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        return project["config"]

    except Exception as e:
        logger.error(f"Error getting project config {project_id}: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get project configuration"
        )


@router.put("/{project_id}/config")
async def update_project_config(project_id: UUID, config: ProjectConfig):
    """Update project configuration."""
    try:
        success = file_service.update_project_config(str(project_id), config)

        if not success:
            raise HTTPException(status_code=404, detail="Project not found")

        return {"message": "Configuration updated successfully"}

    except Exception as e:
        logger.error(f"Error updating project config {project_id}: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to update project configuration"
        )


@router.get("/{project_id}/progress")
async def get_project_progress(project_id: UUID):
    """Get project progress information."""
    try:
        progress = file_service._load_project_progress(str(project_id))

        if not progress:
            raise HTTPException(status_code=404, detail="Project not found")

        return progress.model_dump()

    except Exception as e:
        logger.error(f"Error getting project progress {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get project progress")


@router.get("/{project_id}/export")
async def export_project(
    project_id: UUID, format: str = Query("markdown", regex="^(markdown|json|html|pdf)$")
):
    """Export project content."""
    try:
        content = file_service.export_project(str(project_id), format)

        if content is None:
            if format == "pdf":
                raise HTTPException(
                    status_code=501, detail="PDF export not yet implemented"
                )
            raise HTTPException(
                status_code=404, detail="Project not found or export failed"
            )

        # Get project for filename
        project_summary = file_service.get_project_summary(str(project_id))
        filename = (
            f"{project_summary['title']}.{format}"
            if project_summary
            else f"project.{format}"
        )

        # Return appropriate content type
        media_types = {
            "markdown": "text/markdown",
            "json": "application/json",
            "html": "text/html",
            "pdf": "application/pdf",
        }
        media_type = media_types.get(format, "text/plain")

        return {
            "content": content,
            "filename": filename,
            "format": format,
            "media_type": media_type,
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to export project")


@router.get("/{project_id}/files")
async def get_project_files(project_id: UUID):
    """Get project file paths."""
    try:
        # Check if project exists
        if not file_service.get_project_summary(str(project_id)):
            raise HTTPException(status_code=404, detail="Project not found")

        files = file_service.get_project_files(str(project_id))
        return files

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project files {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get project files")


# Statistics endpoints
@router.get("/stats/summary")
async def get_projects_stats():
    """Get project statistics summary."""
    try:
        projects = file_service.list_projects()

        stats = {
            "total_projects": len(projects),
            "projects_by_status": {},
            "total_words": 0,
            "projects_by_stage": {},
        }

        for project in projects:
            # Count by status
            status = project.get("status", "draft")
            stats["projects_by_status"][status] = (
                stats["projects_by_status"].get(status, 0) + 1
            )

            # Sum word counts
            stats["total_words"] += project.get("word_count", 0)

            # Count by current stage
            stage = project.get("current_stage", "idle")
            stats["projects_by_stage"][stage] = (
                stats["projects_by_stage"].get(stage, 0) + 1
            )

        return stats

    except Exception as e:
        logger.error(f"Error getting projects stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get project statistics")


@router.get("/{project_id}/conversations")
async def get_project_conversations(project_id: UUID, live: bool = Query(False)):
    """Get project research conversations.

    Args:
        project_id: Project ID
        live: If True, returns partial conversations during active research
    """
    import json
    import os
    from pathlib import Path

    try:
        # Get project to ensure it exists
        project = file_service.get_project_summary(str(project_id))
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")

        # Look for conversation log in various possible locations
        project_path = Path(file_service._get_project_path(str(project_id)))

        # Try to find conversation log in subdirectories
        conversation_file = None
        possible_paths = [
            project_path / "conversation_log.json",
            # Also check in topic-named subdirectories
        ]

        # Check subdirectories for conversation logs
        for item in project_path.iterdir():
            if item.is_dir():
                conv_path = item / "conversation_log.json"
                if conv_path.exists():
                    conversation_file = conv_path
                    break

        # Try direct path if not found in subdirs
        if not conversation_file:
            for path in possible_paths:
                if path.exists():
                    conversation_file = path
                    break

        if not conversation_file or not conversation_file.exists():
            return {
                "conversations": [],
                "message": "No conversation data available for this project",
            }

        # Load and return conversation data
        with open(conversation_file, "r", encoding="utf-8") as f:
            conversations = json.load(f)

        return {
            "project_id": project_id,
            "conversations": conversations,
            "conversation_count": (
                len(conversations) if isinstance(conversations, list) else 0
            ),
        }

    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting project conversations {project_id}: {e}")
        raise HTTPException(
            status_code=500, detail="Failed to get project conversations"
        )
