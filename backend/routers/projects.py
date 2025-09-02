"""
Projects router for STORM UI API.

Provides CRUD endpoints for managing STORM projects with file-based storage.
"""

from fastapi import APIRouter, HTTPException, Query, BackgroundTasks
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
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
    config: Optional[ProjectConfig] = Field(None, description="Optional pipeline configuration")


class UpdateProjectRequest(BaseModel):
    """Request model for updating a project."""
    title: Optional[str] = Field(None, min_length=1, max_length=200)
    topic: Optional[str] = Field(None, min_length=1, max_length=500)
    content: Optional[str] = Field(None, description="Article content")
    status: Optional[str] = Field(None, pattern="^(draft|researching|writing|completed|error)$")
    tags: Optional[List[str]] = Field(None, description="Project tags")


class ProjectResponse(BaseModel):
    """Response model for project data."""
    id: str
    title: str
    topic: str
    status: str
    progress: float
    word_count: int
    created_at: str
    updated_at: str
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
    metadata: Dict[str, Any]
    config: Dict[str, Any]
    progress: Dict[str, Any]


class PaginatedProjectResponse(BaseModel):
    """Paginated response for project listings."""
    projects: List[ProjectResponse]
    page: int
    limit: int
    total: int


class DuplicateProjectRequest(BaseModel):
    """Request model for duplicating a project."""
    new_title: Optional[str] = Field(None, description="Title for the duplicated project")


# API Endpoints

@router.get("/", response_model=PaginatedProjectResponse)
async def list_projects(
    page: int = Query(1, ge=1),
    limit: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None, regex="^(draft|researching|writing|completed|error)$"),
    sortBy: Optional[str] = Query("updatedAt"),
    sortOrder: Optional[str] = Query("desc", regex="^(asc|desc)$")
):
    """List all projects with optional filtering and pagination."""
    try:
        all_projects = file_service.list_projects()
        
        # Filter by status if provided
        if status:
            all_projects = [p for p in all_projects if p.get("status") == status]
        
        # Sort projects
        if sortBy == "updatedAt":
            all_projects.sort(key=lambda x: x.get("updated_at", ""), reverse=(sortOrder == "desc"))
        elif sortBy == "createdAt":
            all_projects.sort(key=lambda x: x.get("created_at", ""), reverse=(sortOrder == "desc"))
        elif sortBy == "title":
            all_projects.sort(key=lambda x: x.get("title", "").lower(), reverse=(sortOrder == "desc"))
        
        # Calculate pagination
        total = len(all_projects)
        start_idx = (page - 1) * limit
        end_idx = start_idx + limit
        
        # Apply pagination
        paginated_projects = all_projects[start_idx:end_idx]
        
        return PaginatedProjectResponse(
            projects=paginated_projects,
            page=page,
            limit=limit,
            total=total
        )
        
    except Exception as e:
        logger.error(f"Error listing projects: {e}")
        raise HTTPException(status_code=500, detail="Failed to list projects")


@router.post("/", response_model=ProjectResponse)
async def create_project(request: CreateProjectRequest):
    """Create a new project."""
    try:
        project = file_service.create_project(
            title=request.title,
            topic=request.topic,
            config=request.config
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
async def get_project(project_id: str):
    """Get a specific project by ID."""
    try:
        project = file_service.get_project(project_id)
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return project
        
    except Exception as e:
        logger.error(f"Error getting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get project")


@router.put("/{project_id}", response_model=ProjectResponse)
async def update_project(project_id: str, request: UpdateProjectRequest):
    """Update a project."""
    try:
        # Convert request to dict, excluding None values
        updates = {k: v for k, v in request.model_dump().items() if v is not None}
        
        if not updates:
            raise HTTPException(status_code=400, detail="No updates provided")
        
        success = file_service.update_project(project_id, updates)
        
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Return updated project summary
        updated_project = file_service.get_project_summary(project_id)
        if not updated_project:
            raise HTTPException(status_code=500, detail="Failed to get updated project")
        
        return updated_project
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error updating project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update project")


@router.delete("/{project_id}")
async def delete_project(project_id: str):
    """Delete a project."""
    try:
        success = file_service.delete_project(project_id)
        
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return {"message": "Project deleted successfully"}
        
    except Exception as e:
        logger.error(f"Error deleting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to delete project")


@router.post("/{project_id}/duplicate", response_model=ProjectResponse)
async def duplicate_project(project_id: str, request: DuplicateProjectRequest):
    """Duplicate a project."""
    try:
        new_project = file_service.duplicate_project(project_id, request.new_title)
        
        if not new_project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return new_project
        
    except Exception as e:
        logger.error(f"Error duplicating project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to duplicate project")


@router.get("/{project_id}/config", response_model=Dict[str, Any])
async def get_project_config(project_id: str):
    """Get project configuration."""
    try:
        project = file_service.get_project(project_id)
        
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return project["config"]
        
    except Exception as e:
        logger.error(f"Error getting project config {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get project configuration")


@router.put("/{project_id}/config")
async def update_project_config(project_id: str, config: ProjectConfig):
    """Update project configuration."""
    try:
        success = file_service.update_project_config(project_id, config)
        
        if not success:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return {"message": "Configuration updated successfully"}
        
    except Exception as e:
        logger.error(f"Error updating project config {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to update project configuration")


@router.get("/{project_id}/progress")
async def get_project_progress(project_id: str):
    """Get project progress information."""
    try:
        progress = file_service._load_project_progress(project_id)
        
        if not progress:
            raise HTTPException(status_code=404, detail="Project not found")
        
        return progress.model_dump()
        
    except Exception as e:
        logger.error(f"Error getting project progress {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get project progress")


@router.get("/{project_id}/export")
async def export_project(
    project_id: str, 
    format: str = Query("markdown", regex="^(markdown|json)$")
):
    """Export project content."""
    try:
        content = file_service.export_project(project_id, format)
        
        if content is None:
            raise HTTPException(status_code=404, detail="Project not found or export failed")
        
        # Get project for filename
        project_summary = file_service.get_project_summary(project_id)
        filename = f"{project_summary['title']}.{format}" if project_summary else f"project.{format}"
        
        # Return appropriate content type
        media_type = "text/markdown" if format == "markdown" else "application/json"
        
        return {
            "content": content,
            "filename": filename,
            "format": format,
            "media_type": media_type
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error exporting project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to export project")


@router.get("/{project_id}/files")
async def get_project_files(project_id: str):
    """Get project file paths."""
    try:
        # Check if project exists
        if not file_service.get_project_summary(project_id):
            raise HTTPException(status_code=404, detail="Project not found")
        
        files = file_service.get_project_files(project_id)
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
            "projects_by_stage": {}
        }
        
        for project in projects:
            # Count by status
            status = project.get("status", "draft")
            stats["projects_by_status"][status] = stats["projects_by_status"].get(status, 0) + 1
            
            # Sum word counts
            stats["total_words"] += project.get("word_count", 0)
            
            # Count by current stage
            stage = project.get("current_stage", "idle")
            stats["projects_by_stage"][stage] = stats["projects_by_stage"].get(stage, 0) + 1
        
        return stats
        
    except Exception as e:
        logger.error(f"Error getting projects stats: {e}")
        raise HTTPException(status_code=500, detail="Failed to get project statistics")