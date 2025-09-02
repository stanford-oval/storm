"""
Pipeline router for STORM UI API.

Provides endpoints for running and managing STORM pipeline executions.
"""

from fastapi import APIRouter, HTTPException, BackgroundTasks, WebSocket, WebSocketDisconnect
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import asyncio
import json
import logging

from services.file_service import FileProjectService, ProjectConfig, ProgressData
from services.storm_runner import StormRunnerService

# Configure logging
logger = logging.getLogger(__name__)

# Initialize router
router = APIRouter()

# Initialize services
file_service = FileProjectService()
storm_runner = StormRunnerService(file_service)

# WebSocket connection manager for real-time progress
class ConnectionManager:
    """Manages WebSocket connections for real-time progress updates."""
    
    def __init__(self):
        self.active_connections: List[WebSocket] = []
        self.project_connections: Dict[str, List[WebSocket]] = {}
    
    async def connect(self, websocket: WebSocket, project_id: Optional[str] = None):
        await websocket.accept()
        self.active_connections.append(websocket)
        
        if project_id:
            if project_id not in self.project_connections:
                self.project_connections[project_id] = []
            self.project_connections[project_id].append(websocket)
    
    def disconnect(self, websocket: WebSocket, project_id: Optional[str] = None):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)
        
        if project_id and project_id in self.project_connections:
            if websocket in self.project_connections[project_id]:
                self.project_connections[project_id].remove(websocket)
            
            # Clean up empty project connections
            if not self.project_connections[project_id]:
                del self.project_connections[project_id]
    
    async def send_progress_update(self, project_id: str, progress: ProgressData):
        """Send progress update to connections for a specific project."""
        if project_id in self.project_connections:
            message = {
                "type": "progress_update",
                "project_id": project_id,
                "data": progress.model_dump()
            }
            
            # Send to project-specific connections
            connections_to_remove = []
            for connection in self.project_connections[project_id]:
                try:
                    await connection.send_text(json.dumps(message, default=str))
                except:
                    connections_to_remove.append(connection)
            
            # Remove dead connections
            for connection in connections_to_remove:
                self.disconnect(connection, project_id)


# Global connection manager
manager = ConnectionManager()


# Request/Response Models
class RunPipelineRequest(BaseModel):
    """Request model for running pipeline."""
    config: Optional[ProjectConfig] = Field(None, description="Pipeline configuration")
    mock_mode: bool = Field(False, description="Run in mock mode for testing")


class PipelineStatusResponse(BaseModel):
    """Response model for pipeline status."""
    project_id: str
    is_running: bool
    progress: Dict[str, Any]
    can_cancel: bool


class PipelineResultResponse(BaseModel):
    """Response model for pipeline execution result."""
    status: str
    message: str
    project_id: str
    stages_completed: Optional[List[str]] = None
    duration: Optional[float] = None
    mode: Optional[str] = None


# API Endpoints

@router.post("/{project_id}/run", response_model=PipelineResultResponse)
async def run_pipeline(
    project_id: str, 
    request: RunPipelineRequest,
    background_tasks: BackgroundTasks
):
    """Start pipeline execution for a project."""
    try:
        # Check if project exists
        project = file_service.get_project_summary(project_id)
        if not project:
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Check if pipeline is already running
        status = storm_runner.get_pipeline_status(project_id)
        if status["is_running"]:
            raise HTTPException(status_code=400, detail="Pipeline is already running for this project")
        
        # Progress callback for real-time updates
        async def progress_callback(proj_id: str, progress: ProgressData):
            await manager.send_progress_update(proj_id, progress)
        
        # Start pipeline in background
        if request.mock_mode:
            # For testing/demo purposes
            background_tasks.add_task(
                storm_runner.run_mock_pipeline,
                project_id,
                progress_callback
            )
            
            return PipelineResultResponse(
                status="started",
                message="Mock pipeline started successfully",
                project_id=project_id,
                mode="mock"
            )
        else:
            # Real pipeline execution
            background_tasks.add_task(
                storm_runner.run_pipeline,
                project_id,
                request.config,
                progress_callback
            )
            
            return PipelineResultResponse(
                status="started",
                message="Pipeline started successfully",
                project_id=project_id
            )
            
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error starting pipeline for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to start pipeline")


@router.post("/{project_id}/cancel")
async def cancel_pipeline(project_id: str):
    """Cancel running pipeline for a project."""
    try:
        success = storm_runner.cancel_pipeline(project_id)
        
        if not success:
            raise HTTPException(status_code=400, detail="No running pipeline found for this project")
        
        return {"message": "Pipeline cancelled successfully"}
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error cancelling pipeline for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to cancel pipeline")


@router.get("/{project_id}/status", response_model=PipelineStatusResponse)
async def get_pipeline_status(project_id: str):
    """Get pipeline status for a project."""
    try:
        # Check if project exists
        if not file_service.get_project_summary(project_id):
            raise HTTPException(status_code=404, detail="Project not found")
        
        status = storm_runner.get_pipeline_status(project_id)
        return status
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting pipeline status for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get pipeline status")


@router.get("/running", response_model=List[str])
async def list_running_pipelines():
    """List all currently running pipelines."""
    try:
        running = storm_runner.list_running_pipelines()
        return running
        
    except Exception as e:
        logger.error(f"Error listing running pipelines: {e}")
        raise HTTPException(status_code=500, detail="Failed to list running pipelines")


@router.get("/{project_id}/logs")
async def get_pipeline_logs(project_id: str):
    """Get pipeline execution logs for a project."""
    try:
        # Check if project exists
        if not file_service.get_project_summary(project_id):
            raise HTTPException(status_code=404, detail="Project not found")
        
        # Get project files to check for log files
        project_files = file_service.get_project_files(project_id)
        
        # Look for log files in the project directory
        import os
        from pathlib import Path
        
        project_dir = Path(project_files["project"]).parent
        log_files = []
        
        # Common STORM log file patterns
        log_patterns = ["*.log", "storm_*.txt", "conversation_*.json", "raw_utterances.json"]
        
        for pattern in log_patterns:
            log_files.extend(project_dir.glob(pattern))
        
        # Read available logs
        logs = {}
        for log_file in log_files[:10]:  # Limit to prevent large responses
            try:
                with open(log_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    # Limit content size
                    if len(content) > 10000:
                        content = content[:10000] + "\n... (truncated)"
                    logs[log_file.name] = content
            except Exception as e:
                logs[log_file.name] = f"Error reading file: {e}"
        
        return {
            "project_id": project_id,
            "log_files": [str(f) for f in log_files],
            "logs": logs
        }
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Error getting pipeline logs for project {project_id}: {e}")
        raise HTTPException(status_code=500, detail="Failed to get pipeline logs")


# WebSocket endpoint for real-time progress updates
@router.websocket("/{project_id}/ws")
async def websocket_endpoint(websocket: WebSocket, project_id: str):
    """WebSocket endpoint for real-time pipeline progress updates."""
    await manager.connect(websocket, project_id)
    
    try:
        # Send current status immediately
        status = storm_runner.get_pipeline_status(project_id)
        await websocket.send_text(json.dumps({
            "type": "status",
            "data": status
        }, default=str))
        
        # Keep connection alive and handle messages
        while True:
            try:
                # Wait for messages from client
                data = await websocket.receive_text()
                message = json.loads(data)
                
                # Handle different message types
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                elif message.get("type") == "get_status":
                    status = storm_runner.get_pipeline_status(project_id)
                    await websocket.send_text(json.dumps({
                        "type": "status",
                        "data": status
                    }, default=str))
                    
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"WebSocket error for project {project_id}: {e}")
                break
                
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket, project_id)


# Global WebSocket endpoint for all progress updates
@router.websocket("/ws")
async def global_websocket_endpoint(websocket: WebSocket):
    """WebSocket endpoint for all pipeline progress updates."""
    await manager.connect(websocket)
    
    try:
        # Send list of running pipelines
        running = storm_runner.list_running_pipelines()
        await websocket.send_text(json.dumps({
            "type": "running_pipelines",
            "data": running
        }))
        
        # Keep connection alive
        while True:
            try:
                data = await websocket.receive_text()
                message = json.loads(data)
                
                if message.get("type") == "ping":
                    await websocket.send_text(json.dumps({"type": "pong"}))
                elif message.get("type") == "get_running":
                    running = storm_runner.list_running_pipelines()
                    await websocket.send_text(json.dumps({
                        "type": "running_pipelines",
                        "data": running
                    }))
                    
            except WebSocketDisconnect:
                break
            except Exception as e:
                logger.error(f"Global WebSocket error: {e}")
                break
                
    except WebSocketDisconnect:
        pass
    finally:
        manager.disconnect(websocket)


# Configuration endpoints
@router.get("/config/models")
async def get_available_models():
    """Get list of available language models."""
    return {
        "models": {
            "openai": [
                "gpt-4o",
                "gpt-4o-mini", 
                "gpt-4-turbo",
                "gpt-3.5-turbo"
            ],
            "anthropic": [
                "claude-3-5-sonnet-20241022",
                "claude-3-opus-20240229",
                "claude-3-haiku-20240307"
            ],
            "azure": [
                "gpt-4",
                "gpt-35-turbo"
            ]
        },
        "default": {
            "provider": "openai",
            "model": "gpt-4o"
        }
    }


@router.get("/config/retrievers")
async def get_available_retrievers():
    """Get list of available retrieval systems."""
    # Check which retrievers are available based on API keys
    import os
    
    retrievers = {
        "bing": {
            "available": bool(os.getenv('BING_SEARCH_API_KEY')),
            "description": "Bing Web Search API"
        },
        "you": {
            "available": bool(os.getenv('YDC_API_KEY')),
            "description": "You.com Search API"
        },
        "duckduckgo": {
            "available": True,  # Usually doesn't require API key
            "description": "DuckDuckGo Search"
        },
        "tavily": {
            "available": bool(os.getenv('TAVILY_API_KEY')),
            "description": "Tavily Search API"
        },
        "serper": {
            "available": bool(os.getenv('SERPER_API_KEY')),
            "description": "Serper Google Search API"
        }
    }
    
    available_retrievers = [name for name, info in retrievers.items() if info["available"]]
    default_retriever = available_retrievers[0] if available_retrievers else "duckduckgo"
    
    return {
        "retrievers": retrievers,
        "available": available_retrievers,
        "default": default_retriever
    }


@router.get("/health")
async def pipeline_health():
    """Health check for pipeline service."""
    try:
        # Check if STORM is available
        storm_available = False
        try:
            import knowledge_storm
            storm_available = True
            storm_version = knowledge_storm.__version__
        except ImportError:
            storm_version = "not available"
        
        # Check running pipelines
        running_count = len(storm_runner.list_running_pipelines())
        
        return {
            "status": "healthy",
            "storm_available": storm_available,
            "storm_version": storm_version,
            "running_pipelines": running_count,
            "websocket_connections": len(manager.active_connections)
        }
        
    except Exception as e:
        logger.error(f"Pipeline health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }