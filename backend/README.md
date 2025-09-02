# STORM UI Backend

FastAPI-based backend for the STORM knowledge curation system UI. Provides REST API endpoints for project management and WebSocket support for real-time pipeline progress tracking.

## Features

- **File-based Storage**: No database required - projects stored as markdown with JSON metadata
- **STORM Integration**: Direct integration with knowledge-storm package for pipeline execution
- **Real-time Progress**: WebSocket support for live progress tracking during pipeline execution
- **RESTful API**: Comprehensive REST endpoints for project and pipeline management
- **Mock Mode**: Testing mode for development without running actual STORM pipeline
- **Export Support**: Export projects to markdown or JSON formats

## Quick Start

### 1. Install Dependencies

```bash
cd backend
pip install -r requirements.txt
```

### 2. Install STORM Package

```bash
# From the storm root directory
pip install -e .
```

### 3. Configure API Keys (Optional)

Create a `.env` file or set environment variables:

```bash
# Language Model APIs
export OPENAI_API_KEY="your-openai-key"
export ANTHROPIC_API_KEY="your-anthropic-key"

# Search/Retrieval APIs
export BING_SEARCH_API_KEY="your-bing-key"
export YDC_API_KEY="your-you-com-key"
export TAVILY_API_KEY="your-tavily-key"
export SERPER_API_KEY="your-serper-key"
```

### 4. Start the Server

```bash
# Using the startup script
python start.py

# Or directly with uvicorn
uvicorn main:app --reload --port 8000
```

The API will be available at `http://localhost:8000` with documentation at `http://localhost:8000/api/docs`.

## Project Structure

```
backend/
├── main.py              # FastAPI application entry point
├── requirements.txt     # Python dependencies
├── start.py            # Development startup script
├── services/           # Business logic services
│   ├── file_service.py # File-based storage operations
│   └── storm_runner.py # STORM pipeline integration
└── routers/            # API endpoint definitions
    ├── projects.py     # Project CRUD operations
    └── pipeline.py     # Pipeline execution endpoints
```

## API Endpoints

### Projects API (`/api/projects`)

- `GET /` - List all projects with optional filtering
- `POST /` - Create a new project
- `GET /{project_id}` - Get project details
- `PUT /{project_id}` - Update project
- `DELETE /{project_id}` - Delete project
- `POST /{project_id}/duplicate` - Duplicate project
- `GET /{project_id}/config` - Get project configuration
- `PUT /{project_id}/config` - Update project configuration
- `GET /{project_id}/export` - Export project content
- `GET /stats/summary` - Get project statistics

### Pipeline API (`/api/pipeline`)

- `POST /{project_id}/run` - Start pipeline execution
- `POST /{project_id}/cancel` - Cancel running pipeline
- `GET /{project_id}/status` - Get pipeline status
- `GET /running` - List all running pipelines
- `GET /{project_id}/logs` - Get pipeline logs
- `GET /config/models` - Get available language models
- `GET /config/retrievers` - Get available retrievers

### WebSocket Endpoints

- `WS /api/pipeline/{project_id}/ws` - Real-time progress for specific project
- `WS /api/pipeline/ws` - Global pipeline updates

## File Storage Structure

Projects are stored in a `storm-projects/` directory:

```
storm-projects/
├── projects.json              # Project index
└── projects/
    └── [project-id]/
        ├── project.md         # Article content with frontmatter metadata
        ├── config.json        # Pipeline configuration
        ├── progress.json      # Real-time progress tracking
        └── research/          # STORM research outputs
            ├── conversations.md  # Research conversations (if generated)
            └── sources.json     # Retrieved sources (if generated)
```

### Project Metadata (Frontmatter)

```yaml
---
id: "uuid-string"
title: "Project Title"
topic: "Research Topic"
status: "draft|researching|writing|completed|error"
created_at: "2024-01-01T00:00:00"
updated_at: "2024-01-01T00:00:00"
progress: 0.0
word_count: 0
tags: []
---

# Project Title

Article content goes here...
```

## Development

### Running in Development Mode

```bash
# With reload and debug logging
python start.py

# Or with environment variables
HOST=localhost PORT=8000 RELOAD=true LOG_LEVEL=debug python start.py
```

### Testing API Endpoints

```bash
# Health check
curl http://localhost:8000/api/health

# Create a project
curl -X POST http://localhost:8000/api/projects \
  -H "Content-Type: application/json" \
  -d '{"title": "Test Project", "topic": "Artificial Intelligence"}'

# Run mock pipeline
curl -X POST http://localhost:8000/api/pipeline/{project-id}/run \
  -H "Content-Type: application/json" \
  -d '{"mock_mode": true}'
```

### WebSocket Testing

Use the browser console or a WebSocket client:

```javascript
// Connect to project-specific progress updates
const ws = new WebSocket('ws://localhost:8000/api/pipeline/{project-id}/ws');
ws.onmessage = (event) => console.log(JSON.parse(event.data));
```

## Configuration

### Environment Variables

- `HOST` - Server host (default: 0.0.0.0)
- `PORT` - Server port (default: 8000)
- `RELOAD` - Enable auto-reload in development (default: true)
- `LOG_LEVEL` - Logging level (default: info)

### Pipeline Configuration

Each project has a `config.json` with pipeline settings:

```json
{
  "llm_provider": "openai",
  "llm_model": "gpt-4o",
  "temperature": 0.7,
  "max_tokens": 4000,
  "retriever_type": "bing",
  "max_search_results": 10,
  "do_research": true,
  "do_generate_outline": true,
  "do_generate_article": true,
  "do_polish_article": true,
  "max_conv_turn": 3,
  "max_perspective": 4
}
```

## Error Handling

The API provides comprehensive error handling with appropriate HTTP status codes:

- `400 Bad Request` - Invalid input or pipeline already running
- `404 Not Found` - Project not found
- `500 Internal Server Error` - Server or STORM pipeline errors

Error responses include detailed messages:

```json
{
  "detail": "Project not found"
}
```

## Logging

Logs are written to stdout with configurable levels. Key log events:

- Project CRUD operations
- Pipeline start/stop/error events
- WebSocket connection events
- API request/response logging (when enabled)

## Production Deployment

### Using Docker

```dockerfile
FROM python:3.11-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["python", "start.py"]
```

### Using systemd

```ini
[Unit]
Description=STORM UI Backend
After=network.target

[Service]
Type=simple
User=storm
WorkingDirectory=/path/to/storm/backend
Environment=HOST=0.0.0.0
Environment=PORT=8000
Environment=RELOAD=false
ExecStart=/usr/bin/python3 start.py
Restart=always

[Install]
WantedBy=multi-user.target
```

## Security Considerations

- API keys are loaded from environment variables only
- CORS is configured for specific frontend origins
- File operations are limited to the storm-projects directory
- WebSocket connections are validated
- Input validation using Pydantic models

## Troubleshooting

### Common Issues

1. **STORM not found**: Install knowledge-storm package with `pip install -e ../`
2. **API key errors**: Set required environment variables for your chosen LLM/retriever
3. **Permission errors**: Ensure write access to storm-projects directory
4. **Port conflicts**: Change PORT environment variable if 8000 is in use

### Debug Mode

Enable debug logging:

```bash
LOG_LEVEL=debug python start.py
```

### Health Check

```bash
curl http://localhost:8000/api/health
```

Should return:

```json
{
  "status": "healthy",
  "message": "STORM UI Backend is running",
  "version": "1.0.0"
}
```