"""
File-based storage service for STORM projects.

Manages projects using markdown files with frontmatter and JSON configuration files.
Provides CRUD operations for projects without requiring a database.
"""

import os
import json
import frontmatter
import shutil
import re
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
    retriever_type: str = "tavily"  # Default to tavily (bing is not implemented)
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
            with open(self.index_file, "r", encoding="utf-8") as f:
                data: Dict[str, Any] = json.load(f)
                return data
        except (FileNotFoundError, json.JSONDecodeError):
            return {"projects": []}

    def _save_index(self, index_data: Dict[str, Any]):
        """Save projects index to JSON file."""
        with open(self.index_file, "w", encoding="utf-8") as f:
            json.dump(index_data, f, indent=2, default=str)

    def _get_project_path(self, project_id: str) -> Path:
        """Get project directory path with validation to prevent path traversal."""
        # Validate that project_id is a valid UUID format
        try:
            uuid.UUID(project_id)
        except ValueError:
            raise ValueError(f"Invalid project ID format: {project_id}")
        
        # Construct the path
        project_path = self.projects_dir / project_id
        
        # Ensure the resolved path is within the projects directory
        try:
            resolved_path = project_path.resolve()
            resolved_base = self.projects_dir.resolve()
            
            # Check if the resolved path is within the base directory
            if not str(resolved_path).startswith(str(resolved_base)):
                raise ValueError(f"Path traversal attempt detected for project ID: {project_id}")
        except Exception as e:
            if "Path traversal" in str(e):
                raise
            raise ValueError(f"Invalid project path: {e}")
        
        return project_path

    def _load_project_file(self, project_id: str) -> Optional[frontmatter.Post]:
        """Load project markdown file with frontmatter."""
        project_path = self._get_project_path(project_id)
        project_file = project_path / "project.md"

        if not project_file.exists():
            return None

        try:
            with open(project_file, "r", encoding="utf-8") as f:
                return frontmatter.load(f)
        except Exception as e:
            print(f"Error loading project {project_id}: {e}")
            return None

    def _save_project_file(self, project_id: str, post: frontmatter.Post):
        """Save project markdown file with frontmatter."""
        project_path = self._get_project_path(project_id)
        project_path.mkdir(exist_ok=True)
        project_file = project_path / "project.md"

        with open(project_file, "wb") as f:
            frontmatter.dump(post, f)

    def _load_project_config(self, project_id: str) -> ProjectConfig:
        """Load project configuration."""
        config_file = self._get_project_path(project_id) / "config.json"

        if not config_file.exists():
            return ProjectConfig()

        try:
            with open(config_file, "r", encoding="utf-8") as f:
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

        with open(config_file, "w", encoding="utf-8") as f:
            json.dump(config.model_dump(), f, indent=2)

    def _load_project_progress(self, project_id: str) -> ProgressData:
        """Load project progress data."""
        progress_file = self._get_project_path(project_id) / "progress.json"

        if not progress_file.exists():
            return ProgressData()

        try:
            with open(progress_file, "r", encoding="utf-8") as f:
                progress_data = json.load(f)
                # Convert datetime strings back to datetime objects
                if "start_time" in progress_data and progress_data["start_time"]:
                    progress_data["start_time"] = datetime.fromisoformat(
                        progress_data["start_time"]
                    )
                if (
                    "estimated_completion" in progress_data
                    and progress_data["estimated_completion"]
                ):
                    progress_data["estimated_completion"] = datetime.fromisoformat(
                        progress_data["estimated_completion"]
                    )
                return ProgressData(**progress_data)
        except Exception as e:
            print(f"Error loading progress for {project_id}: {e}")
            return ProgressData()

    def _save_project_progress(self, project_id: str, progress: ProgressData):
        """Save project progress data."""
        project_path = self._get_project_path(project_id)
        project_path.mkdir(exist_ok=True)
        progress_file = project_path / "progress.json"

        with open(progress_file, "w", encoding="utf-8") as f:
            json.dump(progress.model_dump(), f, indent=2, default=str)

    def create_project(
        self, title: str, topic: str, config: Optional[ProjectConfig] = None
    ) -> Dict[str, Any]:
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
            updated_at=current_time,
        )

        # Create frontmatter post with empty content
        post = frontmatter.Post(
            content="# " + title + "\n\n*Article content will be generated here...*",
            **metadata.model_dump(),
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
            "updated_at": current_time.isoformat(),
        }
        index["projects"].append(project_summary)
        self._save_index(index)

        # Get the full project summary and ensure it's not None
        result = self.get_project_summary(project_id)
        if result is None:
            # This shouldn't happen since we just created the project
            # but handle it to satisfy type checker
            raise RuntimeError(f"Failed to retrieve newly created project {project_id}")
        return result

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
        config = self._load_project_config(project_id)

        # Count words in content
        word_count = len(post.content.split()) if post.content else 0

        # Convert datetime to ISO string if necessary
        created_at = post.metadata.get("created_at")
        updated_at = post.metadata.get("updated_at")

        if isinstance(created_at, datetime):
            created_at = created_at.isoformat()
        if isinstance(updated_at, datetime):
            updated_at = updated_at.isoformat()

        # Extract description from content if not in metadata
        description = post.metadata.get("description", "")
        if not description and post.content:
            # Get first paragraph after title as description
            lines = post.content.split("\n")
            for line in lines:
                if line.strip() and not line.startswith("#"):
                    description = line.strip()[:200]
                    break

        # Return full config data
        config_dict = config.model_dump()

        # Prepare progress data for frontend
        progress_dict = (
            {
                "overallProgress": progress.overall_progress,
                "currentTask": progress.current_task,
                "stage": progress.stage,
            }
            if progress
            else None
        )

        return {
            "id": project_id,
            "title": post.metadata.get("title", "Untitled"),
            "topic": post.metadata.get("topic", ""),
            "status": post.metadata.get("status", "draft"),
            "description": description,
            "progress": progress_dict,
            "word_count": word_count,
            "created_at": created_at,
            "updated_at": updated_at,
            "createdAt": created_at,  # Add camelCase version for frontend
            "updatedAt": updated_at,  # Add camelCase version for frontend
            "config": config_dict,  # Include config for display
            "tags": post.metadata.get("tags", []),
            "current_stage": progress.stage,
            "pipeline_status": progress.status,
        }

    def get_project(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get complete project data including content."""
        post = self._load_project_file(project_id)
        if not post:
            return None

        config = self._load_project_config(project_id)
        progress = self._load_project_progress(project_id)
        references = self._load_project_references(project_id)

        # Convert datetime in metadata to ISO strings
        metadata = dict(post.metadata)
        if "created_at" in metadata and isinstance(metadata["created_at"], datetime):
            metadata["created_at"] = metadata["created_at"].isoformat()
        if "updated_at" in metadata and isinstance(metadata["updated_at"], datetime):
            metadata["updated_at"] = metadata["updated_at"].isoformat()

        # Add camelCase versions for frontend compatibility
        metadata["createdAt"] = metadata.get("created_at")
        metadata["updatedAt"] = metadata.get("updated_at")

        # Add clickable links to content if references exist
        content_with_links = post.content
        if references:
            content_with_links = self._add_inline_citation_links(
                post.content, references
            )

        # Calculate word count
        word_count = len(post.content.split()) if post.content else 0

        return {
            "id": project_id,
            "title": post.metadata.get("title", "Untitled"),
            "topic": post.metadata.get("topic", ""),
            "status": post.metadata.get("status", "draft"),
            "description": post.metadata.get("description", ""),
            "content": post.content,
            "contentWithLinks": content_with_links,
            "references": references,
            "metadata": metadata,
            "config": config.model_dump(),
            "progress": progress.model_dump(),
            "word_count": word_count,  # Add word count
            "createdAt": metadata.get("created_at"),  # Add for frontend
            "updatedAt": metadata.get("updated_at"),  # Add for frontend
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
            post.metadata["word_count"] = (
                len(post.content.split()) if post.content else 0
            )

        # Save updated project
        self._save_project_file(project_id, post)

        # Update index
        index = self._load_index()
        for project in index["projects"]:
            if project["id"] == project_id:
                project.update(
                    {
                        "title": post.metadata.get("title"),
                        "topic": post.metadata.get("topic"),
                        "status": post.metadata.get("status"),
                        "updated_at": current_time.isoformat(),
                    }
                )
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

    def duplicate_project(
        self, project_id: str, new_title: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Duplicate an existing project."""
        original_project = self.get_project(project_id)
        if not original_project:
            return None

        title = new_title or f"Copy of {original_project['title']}"
        config = ProjectConfig(**original_project["config"])

        # Create new project
        new_project = self.create_project(
            title=title, topic=original_project["topic"], config=config
        )

        # Copy content if it exists and is not the default
        if original_project["content"] and not original_project["content"].startswith(
            "# "
            + original_project["title"]
            + "\n\n*Article content will be generated here...*"
        ):
            self.update_project(
                new_project["id"],
                {
                    "content": original_project["content"],
                    "tags": original_project["metadata"].get("tags", []),
                },
            )

        return new_project

    def get_project_files(self, project_id: str) -> Dict[str, str]:
        """Get paths to all project files."""
        project_path = self._get_project_path(project_id)

        files = {
            "project": str(project_path / "project.md"),
            "config": str(project_path / "config.json"),
            "progress": str(project_path / "progress.json"),
            "research_dir": str(project_path / "research"),
        }

        # Create research directory if it doesn't exist
        research_dir = project_path / "research"
        research_dir.mkdir(exist_ok=True)

        return files

    def _load_project_references(self, project_id: str) -> Dict[str, Any]:
        """Load project references from url_to_info.json."""
        project_path = self._get_project_path(project_id)

        # Try multiple possible locations for the references file
        possible_paths = [
            project_path / "url_to_info.json",
            project_path / "research" / "url_to_info.json",
            project_path / project_id / "url_to_info.json",
            # Also check for project name directories
        ]

        # Check if there's a subdirectory with the project name or topic
        for item in project_path.iterdir():
            if item.is_dir():
                ref_file = item / "url_to_info.json"
                if ref_file.exists():
                    possible_paths.insert(0, ref_file)

        for ref_path in possible_paths:
            if ref_path.exists():
                try:
                    with open(ref_path, "r", encoding="utf-8") as f:
                        refs: Dict[str, Any] = json.load(f)
                        return refs
                except Exception as e:
                    print(f"Error loading references from {ref_path}: {e}")

        return {}

    def _add_inline_citation_links(
        self, content: str, references: Dict[str, Any]
    ) -> str:
        """Convert citation numbers to clickable links."""
        if not references:
            return content

        # Get the URL mapping
        url_to_unified_index = references.get("url_to_unified_index", {})
        url_to_info = references.get("url_to_info", {})

        # Create index to URL mapping
        index_to_url = {}
        for url, index in url_to_unified_index.items():
            index_to_url[index] = url

        # Pattern to match citations like [1], [2], etc.
        pattern = r"\[(\d+)\]"

        def replace_with_link(match):
            citation_num = int(match.group(1))
            url = index_to_url.get(citation_num)

            if url:
                # Return markdown link format
                return f"[[{citation_num}]]({url})"
            else:
                # Keep original if no URL found
                return match.group(0)

        # Replace all citations with links
        return re.sub(pattern, replace_with_link, content)

    def get_project_with_references(self, project_id: str) -> Optional[Dict[str, Any]]:
        """Get project with clickable references."""
        project = self.get_project(project_id)
        if not project:
            return None

        # Load references
        references = self._load_project_references(project_id)

        # Add references to project data
        project["references"] = references

        # Convert citations to links in content
        if project.get("content") and references:
            project["content_with_links"] = self._add_inline_citation_links(
                project["content"], references
            )

        return project

    def export_project(
        self, project_id: str, format: str = "markdown"
    ) -> Optional[str]:
        """Export project to specified format."""
        project = self.get_project_with_references(project_id)
        if not project:
            return None

        if format.lower() == "markdown":
            # Return content with clickable links if available
            result: Optional[str] = project.get(
                "content_with_links", project["content"]
            )
            return result
        elif format.lower() == "json":
            return json.dumps(project, indent=2, default=str)
        elif format.lower() == "html":
            # Convert markdown to HTML
            import markdown2

            content = project.get("content_with_links", project["content"])
            html_content = markdown2.markdown(
                content,
                extras=["fenced-code-blocks", "tables", "header-ids", "footnotes"],
            )
            # Wrap in basic HTML structure
            return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{project.get('title', 'STORM Article')}</title>
    <style>
        body {{
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
            line-height: 1.6;
            max-width: 900px;
            margin: 0 auto;
            padding: 2rem;
            color: #333;
        }}
        h1, h2, h3, h4, h5, h6 {{
            margin-top: 2rem;
            margin-bottom: 1rem;
            font-weight: 600;
        }}
        h1 {{ border-bottom: 2px solid #e1e4e8; padding-bottom: 0.3rem; }}
        pre {{
            background: #f6f8fa;
            padding: 1rem;
            border-radius: 6px;
            overflow-x: auto;
        }}
        code {{
            background: #f6f8fa;
            padding: 0.2rem 0.4rem;
            border-radius: 3px;
        }}
        blockquote {{
            border-left: 4px solid #dfe2e5;
            padding-left: 1rem;
            margin: 1rem 0;
            color: #6a737d;
        }}
        a {{ color: #0366d6; text-decoration: none; }}
        a:hover {{ text-decoration: underline; }}
        table {{
            border-collapse: collapse;
            width: 100%;
            margin: 1rem 0;
        }}
        th, td {{
            border: 1px solid #dfe2e5;
            padding: 0.5rem 1rem;
        }}
        th {{
            background: #f6f8fa;
            font-weight: 600;
        }}
    </style>
</head>
<body>
    {html_content}
    <hr style="margin-top: 3rem; border: 1px solid #e1e4e8;">
    <footer style="margin-top: 2rem; color: #6a737d; font-size: 0.9rem;">
        <p>Generated by STORM on {datetime.now().strftime('%Y-%m-%d %H:%M')}</p>
    </footer>
</body>
</html>"""
        elif format.lower() == "pdf":
            # Note: PDF generation requires additional dependencies
            # For now, return None. Can be implemented with weasyprint or pdfkit
            return None
        else:
            return None
