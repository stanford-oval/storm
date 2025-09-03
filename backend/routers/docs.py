"""
API Documentation Router
"""
from fastapi import APIRouter
from typing import Dict, List, Any

router = APIRouter(prefix="/api/docs", tags=["documentation"])

@router.get("/")
async def get_api_documentation() -> Dict[str, Any]:
    """Get API documentation overview"""
    return {
        "title": "STORM UI API Documentation",
        "version": "1.0.0",
        "description": "API endpoints for STORM knowledge curation system",
        "endpoints": {
            "projects": {
                "GET /api/projects": "List all projects with pagination",
                "POST /api/projects": "Create a new project",
                "GET /api/projects/{id}": "Get project details",
                "PUT /api/projects/{id}": "Update project",
                "DELETE /api/projects/{id}": "Delete project",
                "GET /api/projects/{id}/export": "Export project in various formats"
            },
            "pipeline": {
                "POST /api/pipeline/{project_id}/run": "Start pipeline execution",
                "GET /api/pipeline/{project_id}/progress": "Get pipeline progress",
                "POST /api/pipeline/{project_id}/cancel": "Cancel running pipeline"
            },
            "health": {
                "GET /api/health": "Health check endpoint"
            },
            "docs": {
                "GET /api/docs": "Get API documentation",
                "GET /api/docs/models": "Get available models",
                "GET /api/docs/retrievers": "Get available retrievers"
            }
        }
    }

@router.get("/models")
async def get_available_models() -> Dict[str, List[Dict[str, Any]]]:
    """Get list of available LLM models"""
    return {
        "models": [
            {
                "id": "gpt-4",
                "name": "GPT-4",
                "provider": "OpenAI",
                "description": "Most capable GPT-4 model",
                "context_window": 8192,
                "recommended_for": ["article_generation", "polishing"]
            },
            {
                "id": "gpt-4-turbo",
                "name": "GPT-4 Turbo",
                "provider": "OpenAI",
                "description": "Faster and cheaper GPT-4",
                "context_window": 128000,
                "recommended_for": ["article_generation", "research"]
            },
            {
                "id": "gpt-3.5-turbo",
                "name": "GPT-3.5 Turbo",
                "provider": "OpenAI",
                "description": "Fast and cost-effective",
                "context_window": 16385,
                "recommended_for": ["research", "outline_generation"]
            },
            {
                "id": "claude-3-opus",
                "name": "Claude 3 Opus",
                "provider": "Anthropic",
                "description": "Most capable Claude model",
                "context_window": 200000,
                "recommended_for": ["article_generation", "research"]
            },
            {
                "id": "claude-3-sonnet",
                "name": "Claude 3 Sonnet",
                "provider": "Anthropic",
                "description": "Balanced performance and cost",
                "context_window": 200000,
                "recommended_for": ["outline_generation", "polishing"]
            },
            {
                "id": "claude-3-haiku",
                "name": "Claude 3 Haiku",
                "provider": "Anthropic",
                "description": "Fast and cost-effective",
                "context_window": 200000,
                "recommended_for": ["research"]
            }
        ]
    }

@router.get("/retrievers")
async def get_available_retrievers() -> Dict[str, List[Dict[str, Any]]]:
    """Get list of available search/retrieval engines"""
    return {
        "retrievers": [
            {
                "id": "tavily",
                "name": "Tavily Search",
                "description": "AI-powered search engine optimized for LLMs",
                "requires_api_key": True,
                "features": ["semantic_search", "fact_checking", "source_quality_scoring"]
            },
            {
                "id": "google",
                "name": "Google Search",
                "description": "Google Custom Search API",
                "requires_api_key": True,
                "features": ["web_search", "image_search", "news_search"]
            },
            {
                "id": "serper",
                "name": "Serper",
                "description": "Google Search results API",
                "requires_api_key": True,
                "features": ["web_search", "news_search", "shopping_search"]
            },
            {
                "id": "duckduckgo",
                "name": "DuckDuckGo",
                "description": "Privacy-focused search engine",
                "requires_api_key": False,
                "features": ["web_search", "instant_answers"]
            },
            {
                "id": "you",
                "name": "You.com",
                "description": "AI-powered search engine",
                "requires_api_key": True,
                "features": ["web_search", "code_search", "news_search"]
            },
            {
                "id": "bing",
                "name": "Bing Search",
                "description": "Microsoft Bing Search API",
                "requires_api_key": True,
                "features": ["web_search", "news_search", "image_search"]
            }
        ]
    }

@router.get("/pipeline-stages")
async def get_pipeline_stages() -> Dict[str, List[Dict[str, Any]]]:
    """Get information about pipeline stages"""
    return {
        "stages": [
            {
                "id": "research",
                "name": "Research",
                "description": "Conducts multi-perspective research through simulated conversations",
                "typical_duration": "3-5 minutes",
                "output": "Research notes and sources"
            },
            {
                "id": "outline_generation",
                "name": "Outline Generation",
                "description": "Creates hierarchical article structure",
                "typical_duration": "1-2 minutes",
                "output": "Article outline with sections"
            },
            {
                "id": "article_generation",
                "name": "Article Generation",
                "description": "Writes full article content with citations",
                "typical_duration": "5-10 minutes",
                "output": "Complete article draft"
            },
            {
                "id": "polishing",
                "name": "Polishing",
                "description": "Adds summaries and removes duplicates",
                "typical_duration": "1-2 minutes",
                "output": "Final polished article"
            }
        ]
    }

@router.get("/config-schema")
async def get_configuration_schema() -> Dict[str, Any]:
    """Get schema for pipeline configuration"""
    return {
        "schema": {
            "type": "object",
            "properties": {
                "topic": {
                    "type": "string",
                    "description": "The topic to research and write about",
                    "minLength": 1,
                    "maxLength": 500
                },
                "do_research": {
                    "type": "boolean",
                    "default": True,
                    "description": "Whether to conduct research phase"
                },
                "do_generate_outline": {
                    "type": "boolean",
                    "default": True,
                    "description": "Whether to generate article outline"
                },
                "do_generate_article": {
                    "type": "boolean",
                    "default": True,
                    "description": "Whether to generate article content"
                },
                "do_polish_article": {
                    "type": "boolean",
                    "default": True,
                    "description": "Whether to polish the article"
                },
                "retriever": {
                    "type": "object",
                    "properties": {
                        "type": {
                            "type": "string",
                            "enum": ["tavily", "google", "serper", "duckduckgo", "you", "bing"],
                            "description": "Search engine to use"
                        },
                        "api_key": {
                            "type": "string",
                            "description": "API key for the retriever (if required)"
                        }
                    }
                },
                "llm": {
                    "type": "object",
                    "properties": {
                        "model": {
                            "type": "string",
                            "enum": ["gpt-4", "gpt-4-turbo", "gpt-3.5-turbo", "claude-3-opus", "claude-3-sonnet", "claude-3-haiku"],
                            "description": "Language model to use"
                        },
                        "api_key": {
                            "type": "string",
                            "description": "API key for the model provider"
                        },
                        "temperature": {
                            "type": "number",
                            "minimum": 0,
                            "maximum": 2,
                            "default": 0.7,
                            "description": "Sampling temperature"
                        },
                        "max_tokens": {
                            "type": "integer",
                            "minimum": 100,
                            "maximum": 4000,
                            "default": 2000,
                            "description": "Maximum tokens per generation"
                        }
                    }
                }
            },
            "required": ["topic"]
        }
    }