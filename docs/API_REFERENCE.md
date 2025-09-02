# STORM API Reference

This document provides comprehensive documentation for the STORM API endpoints, including request/response formats, authentication, error handling, and usage examples.

## Table of Contents

1. [Authentication](#authentication)
2. [Base URL and Headers](#base-url-and-headers)
3. [Error Handling](#error-handling)
4. [Rate Limiting](#rate-limiting)
5. [Projects API](#projects-api)
6. [Pipeline API](#pipeline-api)
7. [Configuration API](#configuration-api)
8. [Co-STORM Sessions API](#co-storm-sessions-api)
9. [Research API](#research-api)
10. [Export API](#export-api)
11. [Analytics API](#analytics-api)
12. [WebSocket Events](#websocket-events)
13. [SDK and Client Libraries](#sdk-and-client-libraries)

## Authentication

The STORM API uses JWT (JSON Web Tokens) for authentication. Include the token in the Authorization header for all authenticated requests.

### Login

```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "user@example.com",
  "password": "your-password"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "user": {
      "id": "user-123",
      "email": "user@example.com",
      "name": "John Doe",
      "role": "user"
    },
    "expiresAt": "2023-12-01T12:00:00Z"
  }
}
```

### Token Refresh

```http
POST /api/v1/auth/refresh
Authorization: Bearer <current-token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...",
    "expiresAt": "2023-12-01T12:00:00Z"
  }
}
```

## Base URL and Headers

**Base URL:** `https://your-domain.com/api/v1`

**Required Headers:**
```http
Authorization: Bearer <jwt-token>
Content-Type: application/json
Accept: application/json
```

**Optional Headers:**
```http
X-Request-ID: <unique-request-id>
X-Client-Version: 1.0.0
```

## Error Handling

All API responses follow a consistent format:

**Success Response:**
```json
{
  "success": true,
  "data": { ... }
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "details": {
    "code": "ERROR_CODE",
    "field": "fieldName",
    "timestamp": "2023-12-01T12:00:00Z"
  }
}
```

### HTTP Status Codes

| Code | Meaning | Description |
|------|---------|-------------|
| 200 | OK | Request succeeded |
| 201 | Created | Resource created successfully |
| 400 | Bad Request | Invalid request format or parameters |
| 401 | Unauthorized | Authentication required or invalid token |
| 403 | Forbidden | Insufficient permissions |
| 404 | Not Found | Resource not found |
| 409 | Conflict | Resource conflict (e.g., duplicate name) |
| 422 | Unprocessable Entity | Validation errors |
| 429 | Too Many Requests | Rate limit exceeded |
| 500 | Internal Server Error | Server error |

### Common Error Codes

| Code | Description | Solution |
|------|-------------|----------|
| `INVALID_API_KEY` | API key is invalid or expired | Check and update API keys |
| `INSUFFICIENT_QUOTA` | API quota exceeded | Upgrade plan or wait for quota reset |
| `INVALID_CONFIG` | Configuration validation failed | Fix configuration errors |
| `PROJECT_NOT_FOUND` | Project doesn't exist | Verify project ID |
| `PIPELINE_ALREADY_RUNNING` | Pipeline is already active | Stop current pipeline first |

## Rate Limiting

API requests are rate-limited to ensure fair usage and system stability.

**Default Limits:**
- Standard users: 100 requests/minute
- Premium users: 500 requests/minute
- Enterprise users: 2000 requests/minute

**Rate Limit Headers:**
```http
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1640995200
```

When rate limited, you'll receive a 429 status with retry information:
```http
HTTP/1.1 429 Too Many Requests
Retry-After: 60
```

## Projects API

### List Projects

```http
GET /api/v1/projects
```

**Query Parameters:**
- `page` (integer): Page number (default: 1)
- `limit` (integer): Items per page (default: 20, max: 100)
- `search` (string): Search query for title/topic
- `status` (string): Filter by status (comma-separated)
- `sortBy` (string): Sort field (createdAt, updatedAt, title, status)
- `sortOrder` (string): Sort order (asc, desc)
- `startDate` (string): Filter by creation date (ISO 8601)
- `endDate` (string): Filter by creation date (ISO 8601)

**Example Request:**
```http
GET /api/v1/projects?page=1&limit=10&status=completed,draft&sortBy=updatedAt&sortOrder=desc
```

**Response:**
```json
{
  "success": true,
  "data": {
    "items": [
      {
        "id": "proj-123",
        "title": "AI Safety Research",
        "topic": "Artificial Intelligence",
        "description": "Comprehensive analysis of AI safety measures",
        "status": "completed",
        "config": { ... },
        "createdAt": "2023-11-01T10:00:00Z",
        "updatedAt": "2023-11-15T14:30:00Z",
        "ownerId": "user-123",
        "collaborators": [],
        "tags": ["ai", "safety", "research"],
        "isArchived": false,
        "metadata": {
          "wordCount": 3500,
          "sectionCount": 8,
          "citationCount": 25
        }
      }
    ],
    "total": 45,
    "page": 1,
    "limit": 10,
    "totalPages": 5,
    "hasNext": true,
    "hasPrevious": false
  }
}
```

### Get Project

```http
GET /api/v1/projects/{projectId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "proj-123",
    "title": "AI Safety Research",
    "topic": "Artificial Intelligence",
    "description": "Comprehensive analysis of AI safety measures",
    "status": "completed",
    "config": {
      "languageModel": {
        "provider": "openai",
        "model": "gpt-4",
        "temperature": 0.7,
        "maxTokens": 2000
      },
      "retrieval": {
        "provider": "bing",
        "maxResults": 10,
        "sources": ["web", "academic"]
      },
      "research": {
        "maxConversations": 3,
        "conversationDepth": 2,
        "perspectives": ["expert", "critic", "journalist"]
      },
      "generation": {
        "maxSections": 5,
        "includeImages": false,
        "citationStyle": "apa"
      }
    },
    "article": {
      "title": "AI Safety Research",
      "content": "# Introduction\n\nArtificial Intelligence safety...",
      "sections": [
        {
          "id": "intro",
          "title": "Introduction",
          "content": "Content here...",
          "wordCount": 350,
          "citations": ["ref-1", "ref-2"]
        }
      ],
      "citations": [
        {
          "id": "ref-1",
          "title": "AI Safety Fundamentals",
          "url": "https://example.com/ai-safety",
          "authors": ["John Smith", "Jane Doe"],
          "publishedAt": "2023-01-15T00:00:00Z"
        }
      ],
      "wordCount": 3500,
      "lastModified": "2023-11-15T14:30:00Z"
    },
    "research": {
      "conversations": [...],
      "sources": [...],
      "queries": ["AI safety", "machine learning risks"],
      "metadata": {
        "totalSources": 45,
        "averageRelevance": 0.87,
        "searchDuration": 120000
      }
    },
    "outline": {
      "title": "AI Safety Research",
      "sections": [...],
      "totalWordCount": 3500,
      "metadata": {
        "generatedAt": "2023-11-10T09:00:00Z",
        "basedOnConversations": ["conv-1", "conv-2", "conv-3"]
      }
    },
    "createdAt": "2023-11-01T10:00:00Z",
    "updatedAt": "2023-11-15T14:30:00Z",
    "ownerId": "user-123",
    "collaborators": [],
    "tags": ["ai", "safety", "research"],
    "isArchived": false
  }
}
```

### Create Project

```http
POST /api/v1/projects
Content-Type: application/json

{
  "title": "New Research Project",
  "topic": "Climate Change",
  "description": "Analysis of climate change impacts",
  "config": {
    "languageModel": {
      "provider": "openai",
      "model": "gpt-4",
      "temperature": 0.7
    },
    "retrieval": {
      "provider": "bing",
      "maxResults": 15
    }
  },
  "tags": ["climate", "environment"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "proj-456",
    "title": "New Research Project",
    "status": "draft",
    "createdAt": "2023-12-01T10:00:00Z",
    ...
  }
}
```

### Update Project

```http
PUT /api/v1/projects/{projectId}
Content-Type: application/json

{
  "title": "Updated Project Title",
  "description": "Updated description",
  "tags": ["updated", "tags"]
}
```

### Delete Project

```http
DELETE /api/v1/projects/{projectId}
```

**Response:**
```json
{
  "success": true,
  "data": null
}
```

### Duplicate Project

```http
POST /api/v1/projects/{projectId}/duplicate
Content-Type: application/json

{
  "title": "Copy of Original Project",
  "description": "Duplicated for comparison study"
}
```

### Archive/Unarchive Project

```http
POST /api/v1/projects/{projectId}/archive
POST /api/v1/projects/{projectId}/unarchive
```

## Pipeline API

### Start Pipeline

```http
POST /api/v1/projects/{projectId}/pipeline/start
Content-Type: application/json

{
  "config": {
    "languageModel": { ... },
    "retrieval": { ... },
    "research": { ... },
    "generation": { ... }
  },
  "stages": [
    {
      "name": "research",
      "enabled": true,
      "config": {
        "maxConversations": 5,
        "perspectives": ["expert", "critic"]
      }
    },
    {
      "name": "outline",
      "enabled": true
    },
    {
      "name": "article",
      "enabled": true
    },
    {
      "name": "polish",
      "enabled": false
    }
  ]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "stage": "research",
    "substage": "initialization",
    "progress": 0.05,
    "isRunning": true,
    "startedAt": "2023-12-01T10:00:00Z",
    "estimatedTimeRemaining": 900,
    "currentAction": "Initializing research phase",
    "stages": {
      "research": {
        "status": "running",
        "progress": 0.05,
        "startedAt": "2023-12-01T10:00:00Z"
      },
      "outline": {
        "status": "pending",
        "progress": 0,
        "startedAt": null
      },
      "article": {
        "status": "pending",
        "progress": 0,
        "startedAt": null
      },
      "polish": {
        "status": "disabled",
        "progress": 0,
        "startedAt": null
      }
    },
    "logs": [],
    "error": null
  }
}
```

### Get Pipeline Status

```http
GET /api/v1/projects/{projectId}/pipeline/status
```

**Response:**
```json
{
  "success": true,
  "data": {
    "projectId": "proj-123",
    "isRunning": true,
    "progress": {
      "stage": "outline",
      "substage": "section_organization",
      "progress": 0.65,
      "isRunning": true,
      "startedAt": "2023-12-01T10:00:00Z",
      "estimatedTimeRemaining": 300,
      "currentAction": "Organizing article sections",
      "stages": {
        "research": {
          "status": "completed",
          "progress": 1.0,
          "startedAt": "2023-12-01T10:00:00Z",
          "completedAt": "2023-12-01T10:15:00Z"
        },
        "outline": {
          "status": "running",
          "progress": 0.65,
          "startedAt": "2023-12-01T10:15:00Z"
        },
        "article": {
          "status": "pending",
          "progress": 0,
          "startedAt": null
        },
        "polish": {
          "status": "disabled",
          "progress": 0,
          "startedAt": null
        }
      }
    },
    "logs": [
      {
        "id": "log-1",
        "timestamp": "2023-12-01T10:01:00Z",
        "level": "info",
        "message": "Research phase completed successfully",
        "stage": "research",
        "metadata": {
          "conversationsGenerated": 3,
          "sourcesFound": 27
        }
      }
    ]
  }
}
```

### Stop Pipeline

```http
POST /api/v1/projects/{projectId}/pipeline/stop
Content-Type: application/json

{
  "reason": "User requested stop"
}
```

### Pause/Resume Pipeline

```http
POST /api/v1/projects/{projectId}/pipeline/pause
POST /api/v1/projects/{projectId}/pipeline/resume
```

## Configuration API

### Get Configuration Templates

```http
GET /api/v1/config/templates
```

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "id": "academic",
      "name": "Academic Research",
      "description": "Configuration optimized for scholarly articles",
      "config": {
        "languageModel": {
          "provider": "openai",
          "model": "gpt-4",
          "temperature": 0.3
        },
        "retrieval": {
          "provider": "bing",
          "maxResults": 20,
          "sources": ["web", "academic"]
        },
        "research": {
          "maxConversations": 5,
          "conversationDepth": 3,
          "perspectives": ["expert", "academic", "critic"]
        },
        "generation": {
          "maxSections": 8,
          "includeImages": false,
          "citationStyle": "apa"
        }
      },
      "isDefault": false,
      "isSystem": true,
      "createdAt": "2023-01-01T00:00:00Z",
      "updatedAt": "2023-01-01T00:00:00Z"
    }
  ]
}
```

### Validate Configuration

```http
POST /api/v1/config/validate
Content-Type: application/json

{
  "config": {
    "languageModel": {
      "provider": "openai",
      "model": "gpt-4",
      "temperature": 1.5
    }
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "isValid": false,
    "errors": [
      {
        "field": "languageModel.temperature",
        "message": "Temperature must be between 0.0 and 1.0",
        "code": "INVALID_RANGE"
      }
    ],
    "warnings": [
      {
        "field": "retrieval.maxResults",
        "message": "High maxResults may increase processing time",
        "suggestion": "Consider reducing to 5-15 for optimal performance"
      }
    ]
  }
}
```

### Save Configuration Template

```http
POST /api/v1/config/templates
Content-Type: application/json

{
  "name": "Custom Template",
  "description": "My custom configuration",
  "config": { ... },
  "isDefault": false
}
```

## Co-STORM Sessions API

### Create Session

```http
POST /api/v1/sessions
Content-Type: application/json

{
  "projectId": "proj-123",
  "title": "AI Safety Discussion",
  "description": "Collaborative session on AI safety topics",
  "settings": {
    "maxParticipants": 5,
    "allowAnonymous": false,
    "moderationLevel": "medium",
    "autoSaveInterval": 30,
    "expertModels": ["gpt-4", "claude-2"]
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "session-456",
    "projectId": "proj-123",
    "title": "AI Safety Discussion",
    "description": "Collaborative session on AI safety topics",
    "participants": [],
    "mindMap": [],
    "discourse": [],
    "status": "active",
    "createdAt": "2023-12-01T10:00:00Z",
    "updatedAt": "2023-12-01T10:00:00Z",
    "settings": {
      "maxParticipants": 5,
      "allowAnonymous": false,
      "moderationLevel": "medium",
      "autoSaveInterval": 30,
      "expertModels": ["gpt-4", "claude-2"]
    }
  }
}
```

### Join Session

```http
POST /api/v1/sessions/{sessionId}/join
Content-Type: application/json

{
  "participantName": "Dr. Smith",
  "role": "AI Researcher"
}
```

### Send Message

```http
POST /api/v1/sessions/{sessionId}/messages
Content-Type: application/json

{
  "content": "What are the main challenges in AI alignment?",
  "messageType": "text",
  "references": ["source-123"]
}
```

### Update Mind Map

```http
POST /api/v1/sessions/{sessionId}/mindmap
Content-Type: application/json

{
  "action": "add",
  "nodes": [
    {
      "title": "AI Alignment",
      "content": "Ensuring AI systems align with human values",
      "position": { "x": 100, "y": 200 },
      "connections": ["node-456"]
    }
  ]
}
```

### Get Session

```http
GET /api/v1/sessions/{sessionId}
```

### End Session

```http
POST /api/v1/sessions/{sessionId}/end
```

## Research API

### Search Sources

```http
POST /api/v1/research/search
Content-Type: application/json

{
  "query": "artificial intelligence safety",
  "sources": ["bing", "academic"],
  "maxResults": 20,
  "filters": {
    "dateRange": {
      "start": "2023-01-01T00:00:00Z",
      "end": "2023-12-01T00:00:00Z"
    },
    "domains": ["arxiv.org", "scholar.google.com"],
    "language": "en",
    "contentType": "academic"
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "results": [
      {
        "id": "result-1",
        "title": "AI Safety: Technical and Social Challenges",
        "url": "https://example.com/ai-safety-paper",
        "snippet": "This paper explores the technical and social challenges in AI safety...",
        "source": "bing",
        "publishedAt": "2023-06-15T00:00:00Z",
        "relevanceScore": 0.92,
        "metadata": {
          "authors": ["John Researcher"],
          "domain": "arxiv.org",
          "contentType": "academic"
        }
      }
    ],
    "totalResults": 156,
    "query": "artificial intelligence safety",
    "searchDuration": 1234,
    "sources": ["bing", "academic"]
  }
}
```

### Get Research Data

```http
GET /api/v1/projects/{projectId}/research
```

**Response:**
```json
{
  "success": true,
  "data": {
    "conversations": [
      {
        "id": "conv-1",
        "title": "Expert Discussion on AI Safety",
        "perspective": "expert",
        "messages": [
          {
            "role": "expert",
            "content": "AI safety is fundamentally about ensuring that artificial intelligence systems behave in ways that are beneficial to humans...",
            "timestamp": "2023-12-01T10:05:00Z"
          },
          {
            "role": "moderator",
            "content": "Can you elaborate on the alignment problem?",
            "timestamp": "2023-12-01T10:06:00Z"
          }
        ],
        "sources": [
          {
            "id": "source-1",
            "title": "AI Safety Research Overview",
            "url": "https://example.com/ai-safety",
            "snippet": "Comprehensive overview of AI safety research directions..."
          }
        ]
      }
    ],
    "sources": [
      {
        "id": "source-1",
        "title": "AI Safety Research Overview",
        "url": "https://example.com/ai-safety",
        "snippet": "Comprehensive overview of AI safety research directions...",
        "relevanceScore": 0.94,
        "publishedAt": "2023-05-10T00:00:00Z"
      }
    ],
    "queries": [
      "AI safety research",
      "machine learning alignment",
      "AI risk assessment"
    ],
    "metadata": {
      "totalSources": 32,
      "averageRelevance": 0.87,
      "searchDuration": 45000,
      "conversationCount": 3,
      "generatedAt": "2023-12-01T10:15:00Z"
    }
  }
}
```

## Export API

### Start Export

```http
POST /api/v1/projects/{projectId}/export
Content-Type: application/json

{
  "format": "pdf",
  "sections": ["all"],
  "includeOutline": true,
  "includeCitations": true,
  "includeResearch": false,
  "template": "academic",
  "options": {
    "pageSize": "a4",
    "fontSize": 12,
    "includeToc": true
  }
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "jobId": "export-789",
    "status": "queued",
    "estimatedDuration": 30,
    "createdAt": "2023-12-01T10:00:00Z"
  }
}
```

### Get Export Status

```http
GET /api/v1/export/{jobId}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "export-789",
    "projectId": "proj-123",
    "format": "pdf",
    "status": "completed",
    "progress": 100,
    "downloadUrl": "https://example.com/exports/project-123.pdf",
    "fileSize": 2048576,
    "createdAt": "2023-12-01T10:00:00Z",
    "completedAt": "2023-12-01T10:02:30Z"
  }
}
```

### Download Export

```http
GET /api/v1/export/{jobId}/download
```

Returns the file directly with appropriate headers.

## Analytics API

### Track Event

```http
POST /api/v1/analytics/events
Content-Type: application/json

{
  "eventType": "project_created",
  "eventData": {
    "projectId": "proj-123",
    "projectTitle": "AI Safety Research",
    "templateUsed": "academic"
  },
  "sessionId": "session-456"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "id": "event-123",
    "eventType": "project_created",
    "timestamp": "2023-12-01T10:00:00Z"
  }
}
```

### Get Analytics Summary

```http
GET /api/v1/analytics/summary
```

**Query Parameters:**
- `startDate` (string): Start date (ISO 8601)
- `endDate` (string): End date (ISO 8601)
- `eventTypes` (string): Comma-separated event types
- `aggregation` (string): Aggregation period (day, hour, week, month)

**Response:**
```json
{
  "success": true,
  "data": {
    "totalEvents": 1234,
    "uniqueUsers": 89,
    "topEvents": [
      { "eventType": "project_created", "count": 45 },
      { "eventType": "pipeline_completed", "count": 38 }
    ],
    "timeSeriesData": [
      { "date": "2023-12-01", "count": 15 },
      { "date": "2023-12-02", "count": 22 }
    ],
    "userActivity": [
      {
        "userId": "user-123",
        "eventCount": 34,
        "lastActive": "2023-12-01T15:30:00Z"
      }
    ]
  }
}
```

## WebSocket Events

The STORM API supports real-time updates via WebSocket connections.

### Connection

```javascript
const ws = new WebSocket('ws://localhost:8000/ws');

// Authentication
ws.send(JSON.stringify({
  type: 'auth',
  data: { token: 'your-jwt-token' }
}));
```

### Subscribe to Project Updates

```javascript
ws.send(JSON.stringify({
  type: 'subscribe_project_updates',
  data: { projectId: 'proj-123' }
}));
```

### Pipeline Progress Updates

```javascript
// Incoming message
{
  "type": "pipeline_progress",
  "data": {
    "projectId": "proj-123",
    "progress": {
      "stage": "research",
      "progress": 0.45,
      "currentAction": "Processing conversation 2 of 3"
    }
  },
  "timestamp": "2023-12-01T10:05:00Z"
}
```

### Session Updates

```javascript
// Incoming message
{
  "type": "session_message",
  "data": {
    "sessionId": "session-456",
    "message": {
      "id": "msg-789",
      "senderId": "ai-expert-1",
      "content": "Based on recent research...",
      "timestamp": "2023-12-01T10:05:00Z"
    }
  }
}
```

### Common WebSocket Events

| Event Type | Description | Data Format |
|------------|-------------|-------------|
| `pipeline_progress` | Pipeline stage updates | `{ projectId, progress }` |
| `session_message` | Co-STORM messages | `{ sessionId, message }` |
| `mindmap_update` | Mind map changes | `{ sessionId, nodes, action }` |
| `export_complete` | Export job finished | `{ jobId, downloadUrl }` |
| `notification` | System notifications | `{ type, title, message }` |

## SDK and Client Libraries

### JavaScript/TypeScript SDK

```bash
npm install @storm/api-client
```

```javascript
import { StormClient } from '@storm/api-client';

const client = new StormClient({
  baseURL: 'https://api.storm.example.com',
  apiKey: 'your-api-key'
});

// Create project
const project = await client.projects.create({
  title: 'My Research Project',
  topic: 'Climate Change',
  config: client.configs.templates.academic
});

// Start pipeline
await client.pipeline.start(project.id, {
  stages: ['research', 'outline', 'article']
});

// Monitor progress
client.pipeline.onProgress(project.id, (progress) => {
  console.log(`Progress: ${progress.stage} - ${progress.progress * 100}%`);
});
```

### Python SDK

```bash
pip install storm-api-client
```

```python
from storm_client import StormClient

client = StormClient(
    base_url='https://api.storm.example.com',
    api_key='your-api-key'
)

# Create project
project = client.projects.create(
    title='My Research Project',
    topic='Climate Change',
    config=client.configs.get_template('academic')
)

# Start pipeline
client.pipeline.start(
    project.id,
    stages=['research', 'outline', 'article']
)

# Wait for completion
result = client.pipeline.wait_for_completion(project.id)
print(f"Pipeline completed: {result.status}")
```

### cURL Examples

**Create Project:**
```bash
curl -X POST "https://api.storm.example.com/v1/projects" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Climate Research",
    "topic": "Global Warming",
    "config": {
      "languageModel": {
        "provider": "openai",
        "model": "gpt-4"
      }
    }
  }'
```

**Start Pipeline:**
```bash
curl -X POST "https://api.storm.example.com/v1/projects/proj-123/pipeline/start" \
  -H "Authorization: Bearer your-token" \
  -H "Content-Type: application/json" \
  -d '{
    "stages": [
      {"name": "research", "enabled": true},
      {"name": "outline", "enabled": true},
      {"name": "article", "enabled": true}
    ]
  }'
```

**Monitor Progress:**
```bash
curl -X GET "https://api.storm.example.com/v1/projects/proj-123/pipeline/status" \
  -H "Authorization: Bearer your-token"
```

## Best Practices

### API Usage

1. **Authentication**
   - Store tokens securely
   - Implement token refresh logic
   - Handle authentication errors gracefully

2. **Rate Limiting**
   - Implement exponential backoff for 429 errors
   - Monitor rate limit headers
   - Batch requests when possible

3. **Error Handling**
   - Check response status codes
   - Parse error details for specific issues
   - Implement retry logic for transient errors

4. **Performance**
   - Use pagination for large data sets
   - Implement caching for frequently accessed data
   - Monitor API response times

### Integration Patterns

1. **Polling vs WebSocket**
   - Use WebSockets for real-time updates
   - Fall back to polling if WebSocket connection fails
   - Implement connection retry logic

2. **Batch Processing**
   - Process multiple projects in batches
   - Use bulk operations where available
   - Implement queue systems for large workloads

3. **Data Synchronization**
   - Implement optimistic updates in UI
   - Handle conflicts gracefully
   - Maintain data consistency across clients

---

This API reference provides comprehensive documentation for integrating with the STORM system. For additional support, examples, or feature requests, please refer to the main documentation or contact the development team.

*Last updated: September 2025*
*API Version: 1.0*