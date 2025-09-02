"""
File-based storage service for STORM projects.

Manages projects using markdown files with frontmatter and JSON configuration files.
Provides CRUD operations for projects without requiring a database.
"""

import os
import json
import frontmatter
import shutil
from pathlib import Path
from datetime import datetime
from typing import List, Optional, Dict, Any
from pydantic import BaseModel, Field
import uuid


class ProjectMetadata(BaseModel):
    """Project metadata structure stored in frontmatter."""
    id: str
    title: str
    topic: str
    status: str = "draft"
    created_at: datetime
    updated_at: datetime
    progress: float = 0.0
    word_count: int = 0
    tags: List[str] = Field(default_factory=list)


class ProjectConfig(BaseModel):
    """Project configuration for STORM pipeline."""
    # LLM Configuration
    llm_provider: str = "openai"
    llm_model: str = "gpt-4o"
    temperature: float = 0.7
    max_tokens: int = 4000
    
    # Retriever Configuration
    retriever_type: str = "bing"
    max_search_results: int = 10
    search_top_k: int = 3
    
    # Pipeline Configuration
    do_research: bool = True
    do_generate_outline: bool = True
    do_generate_article: bool = True
    do_polish_article: bool = True
    
    # STORM-specific settings
    max_conv_turn: int = 3
    max_perspective: int = 4
    max_search_queries_per_turn: int = 3
    
    # Output settings
    output_format: str = "markdown"
    include_citations: bool = True


class ProgressData(BaseModel):
    """Progress tracking for pipeline execution."""
    stage: str = "idle"
    stage_progress: float = 0.0
    overall_progress: float = 0.0
    current_task: str = ""
    start_time: Optional[datetime] = None
    estimated_completion: Optional[datetime] = None
    status: str = "ready"  # ready, running, completed, error
    error_message: Optional[str] = None
    stages_completed: List[str] = Field(default_factory=list)


class FileProjectService:
    """File-based project storage service."""
    
    def __init__(self, base_path: str = "./storm-projects"):
        self.base_path = Path(base_path)
        self.projects_dir = self.base_path / "projects"
        self.index_file = self.base_path / "projects.json"
        self._ensure_directories()
    
    def _ensure_directories(self):
        """Ensure base directories exist."""
        self.base_path.mkdir(exist_ok=True)
        self.projects_dir.mkdir(exist_ok=True)
        
        if not self.index_file.exists():
            self._save_index({"projects": []})
    
    def _load_index(self) -> Dict[str, Any]:
        """Load projects index from JSON file."""
        try:
            with open(self.index_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        except (FileNotFoundError, json.JSONDecodeError):
            return {"projects": []}
    
    def _save_index(self, index_data: Dict[str, Any]):
        """Save projects index to JSON file."""
        with open(self.index_file, 'w', encoding='utf-8') as f:
            json.dump(index_data, f, indent=2, default=str)
    
    def _get_project_path(self, project_id: str) -> Path:
        """Get project directory path."""
        return self.projects_dir / project_id
    
    def _load_project_file(self, project_id: str) -> Optional[frontmatter.Post]:
        """Load project markdown file with frontmatter."""
        project_path = self._get_project_path(project_id)
        project_file = project_path / "project.md"
        
        if not project_file.exists():
            return None
        
        try:
            with open(project_file, 'r', encoding='utf-8') as f:
                return frontmatter.load(f)
        except Exception as e:
            print(f"Error loading project {project_id}: {e}")
            return None
    
    def _save_project_file(self, project_id: str, post: frontmatter.Post):
        """Save project markdown file with frontmatter."""
        project_path = self._get_project_path(project_id)
        project_path.mkdir(exist_ok=True)
        project_file = project_path / "project.md"
        
        with open(project_file, 'wb') as f:
            frontmatter.dump(post, f)
    
    def _load_project_config(self, project_id: str) -> ProjectConfig:
        """Load project configuration."""
        config_file = self._get_project_path(project_id) / "config.json"
        
        if not config_file.exists():
            return ProjectConfig()
        
        try:
            with open(config_file, 'r', encoding='utf-8') as f:
                config_data = json.load(f)
                return ProjectConfig(**config_data)
        except Exception as e:
            print(f"Error loading config for {project_id}: {e}")
            return ProjectConfig()
    
    def _save_project_config(self, project_id: str, config: ProjectConfig):
        """Save project configuration."""
        project_path = self._get_project_path(project_id)
        project_path.mkdir(exist_ok=True)
        config_file = project_path / "config.json"
        
        with open(config_file, 'w', encoding='utf-8') as f:
            json.dump(config.model_dump(), f, indent=2)
    
    def _load_project_progress(self, project_id: str) -> ProgressData:
        """Load project progress data."""
        progress_file = self._get_project_path(project_id) / "progress.json"
        
        if not progress_file.exists():
            return ProgressData()
        
        try:
            with open(progress_file, 'r', encoding='utf-8') as f:
                progress_data = json.load(f)
                # Convert datetime strings back to datetime objects
                if 'start_time' in progress_data and progress_data['start_time']:
                    progress_data['start_time'] = datetime.fromisoformat(progress_data['start_time'])
                if 'estimated_completion' in progress_data and progress_data['estimated_completion']:
                    progress_data['estimated_completion'] = datetime.fromisoformat(progress_data['estimated_completion'])
                return ProgressData(**progress_data)
        except Exception as e:
            print(f"Error loading progress for {project_id}: {e}")
            return ProgressData()
    
    def _save_project_progress(self, project_id: str, progress: ProgressData):
        """Save project progress data."""
        project_path = self._get_project_path(project_id)
        project_path.mkdir(exist_ok=True)
        progress_file = project_path / "progress.json"
        
        with open(progress_file, 'w', encoding='utf-8') as f:
            json.dump(progress.model_dump(), f, indent=2, default=str)
    
    def create_project(self, title: str, topic: str, config: Optional[ProjectConfig] = None) -> Dict[str, Any]:
        """Create a new project."""
        project_id = str(uuid.uuid4())
        current_time = datetime.now()
        
        # Create project metadata
        metadata = ProjectMetadata(
            id=project_id,
            title=title,
            topic=topic,
            status="draft",
            created_at=current_time,
            updated_at=current_time
        )
        
        # Create frontmatter post with empty content
        post = frontmatter.Post(
            content="# " + title + "\n\n*Article content will be generated here...*",
            **metadata.model_dump()
        )
        
        # Save project file
        self._save_project_file(project_id, post)
        
        # Save configuration
        if config is None:
            config = ProjectConfig()
        self._save_project_config(project_id, config)
        
        # Initialize progress
        progress = ProgressData()
        self._save_project_progress(project_id, progress)
        
        # Update index
        index = self._load_index()
        project_summary = {
            "id": project_id,
            "title": title,
            "topic": topic,
            "status": "draft",
            "created_at": current_time.isoformat(),
            "updated_at": current_time.isoformat()
        }
        index["projects"].append(project_summary)
        self._save_index(index)
        
        return self.get_project_summary(project_id)
    
    def list_projects(self) -> List[Dict[str, Any]]:
        """List all projects with summary information."""
        index = self._load_index()
        projects = []
        
        for project_info in index["projects"]:
            project_id = project_info["id"]
            try:
                # Get detailed project info
                project_summary = self.get_project_summary(project_id)
                if project_summary:
                    projects.append(project_summary)
            except Exception as e:
                print(f"Error loading project {project_id}: {e}")
                continue
        
        # Sort by updated_at descending
        projects.sort(key=lambda x: x.get("updated_at", ""), reverse=True)
        return projects
    
    def get_project_summary(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get project summary information."""
        post = self._load_project_file(project_id)
        if not post:
            return None
        
        progress = self._load_project_progress(project_id)
        
        # Count words in content
        word_count = len(post.content.split()) if post.content else 0
        
        # Convert datetime to ISO string if necessary
        created_at = post.metadata.get("created_at")
        updated_at = post.metadata.get("updated_at")
        
        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        if isinstance(updated_at, datetime):
            updated_at = updated_at.isoformat()
        
        return {
            "id": project_id,
            "title": post.metadata.get("title", "Untitled"),
            "topic": post.metadata.get("topic", ""),
            "status": post.metadata.get("status", "draft"),
            "progress": progress.overall_progress,
            "word_count": word_count,
            "created_at": created_at,
            "updated_at": updated_at,
            "tags": post.metadata.get("tags", []),
            "current_stage": progress.stage,
            "pipeline_status": progress.status
        }
    
    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get complete project data including content."""
        post = self._load_project_file(project_id)
        if not post:
            return None
        
        config = self._load_project_config(project_id)
        progress = self._load_project_progress(project_id)
        
        return {
            "id": project_id,
            "title": post.metadata.get("title", "Untitled"),
            "topic": post.metadata.get("topic", ""),
            "status": post.metadata.get("status", "draft"),
            "description": post.metadata.get("description", ""),
            "content": post.content,
            "metadata": post.metadata,
            "config": config.model_dump(),
            "progress": progress.model_dump()
        }
    
    def update_project(self, project_id: str, updates: Dict[str, Any]) -> bool:
        """Update project data."""
        post = self._load_project_file(project_id)
        if not post:
            return False
        
        current_time = datetime.now()
        
        # Update metadata
        if "title" in updates:
            post.metadata["title"] = updates["title"]
        if "topic" in updates:
            post.metadata["topic"] = updates["topic"]
        if "status" in updates:
            post.metadata["status"] = updates["status"]
        if "tags" in updates:
            post.metadata["tags"] = updates["tags"]
        
        post.metadata["updated_at"] = current_time
        
        # Update content if provided
        if "content" in updates:
            post.content = updates["content"]
            post.metadata["word_count"] = len(post.content.split()) if post.content else 0
        
        # Save updated project
        self._save_project_file(project_id, post)
        
        # Update index
        index = self._load_index()
        for project in index["projects"]:
            if project["id"] == project_id:
                project.update({
                    "title": post.metadata.get("title"),
                    "topic": post.metadata.get("topic"),
                    "status": post.metadata.get("status"),
                    "updated_at": current_time.isoformat()
                })
                break
        self._save_index(index)
        
        return True
    
    def update_project_config(self, project_id: str, config: ProjectConfig) -> bool:
        """Update project configuration."""
        if not self._get_project_path(project_id).exists():
            return False
        
        self._save_project_config(project_id, config)
        return True
    
    def update_project_progress(self, project_id: str, progress: ProgressData) -> bool:
        """Update project progress."""
        if not self._get_project_path(project_id).exists():
            return False
        
        self._save_project_progress(project_id, progress)
        return True
    
    def delete_project(self, project_id: str) -> bool:
        """Delete a project and all its data."""
        project_path = self._get_project_path(project_id)
        
        if not project_path.exists():
            return False
        
        try:
            # Remove project directory
            shutil.rmtree(project_path)
            
            # Update index
            index = self._load_index()
            index["projects"] = [p for p in index["projects"] if p["id"] != project_id]
            self._save_index(index)
            
            return True
        except Exception as e:
            print(f"Error deleting project {project_id}: {e}")
            return False
    
    def duplicate_project(self, project_id: str, new_title: Optional[str] = None) -> Optional[Dict[str, Any]]:
        """Duplicate an existing project."""
        original_project = self.get_project(project_id)
        if not original_project:
            return None
        
        title = new_title or f"Copy of {original_project['title']}"
        config = ProjectConfig(**original_project["config"])
        
        # Create new project
        new_project = self.create_project(
            title=title,
            topic=original_project["topic"],
            config=config
        )
        
        # Copy content if it exists and is not the default
        if (original_project["content"] and 
            not original_project["content"].startswith("# " + original_project["title"] + "\n\n*Article content will be generated here...*")):
            self.update_project(new_project["id"], {
                "content": original_project["content"],
                "tags": original_project["metadata"].get("tags", [])
            })
        
        return new_project
    
    def get_project_files(self, project_id: str) -> Dict[str, str]:
        """Get paths to all project files."""
        project_path = self._get_project_path(project_id)
        
        files = {
            "project": str(project_path / "project.md"),
            "config": str(project_path / "config.json"),
            "progress": str(project_path / "progress.json"),
            "research_dir": str(project_path / "research")
        }
        
        # Create research directory if it doesn't exist
        research_dir = project_path / "research"
        research_dir.mkdir(exist_ok=True)
        
        return files
    
    def export_project(self, project_id: str, format: str = "markdown") -> Optional[str]:
        """Export project to specified format."""
        project = self.get_project(project_id)
        if not project:
            return None
        
        if format.lower() == "markdown":
            return project["content"]
        elif format.lower() == "json":
            return json.dumps(project, indent=2, default=str)
        else:
            return None