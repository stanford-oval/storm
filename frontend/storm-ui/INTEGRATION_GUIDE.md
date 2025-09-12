# STORM UI Backend Integration Guide

This document describes the completed integration between the Next.js frontend and FastAPI backend for the STORM UI project.

## Overview

The frontend now connects to the actual backend API with the following features:

- ✅ REST API integration with proper error handling
- ✅ WebSocket connections for real-time updates
- ✅ Comprehensive error handling and retry logic
- ✅ Integration testing utilities
- ✅ Environment configuration

## Configuration

### Environment Variables

The following environment variables are now configured in `.env.local`:

```env
# Backend API Configuration
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws

# Development Environment
NODE_ENV=development

# Optional: Authentication configuration
NEXT_PUBLIC_AUTH_ENABLED=false

# Optional: Debug mode for API calls
NEXT_PUBLIC_API_DEBUG=true

# WebSocket configuration
NEXT_PUBLIC_WS_RECONNECT_DELAY=5000
NEXT_PUBLIC_WS_MAX_RETRY_ATTEMPTS=5

# API Request timeouts (in milliseconds)
NEXT_PUBLIC_API_TIMEOUT=30000
NEXT_PUBLIC_API_RETRY_ATTEMPTS=3
NEXT_PUBLIC_API_RETRY_DELAY=1000

# Rate limiting
NEXT_PUBLIC_API_RATE_LIMIT=10
```

## API Services

### Updated Service Structure

All services now connect to the actual backend with correct API paths:

- **Project Service**: `/v1/projects` - Manages STORM projects
- **Pipeline Service**: `/v1/pipeline` - Handles pipeline execution
- **Config Service**: `/v1/config` - Configuration management
- **Research Service**: `/v1/research` - Research operations
- **Session Service**: `/v1/sessions` - Co-STORM sessions
- **Export Service**: `/v1/export` - Export functionality
- **Analytics Service**: `/v1/analytics` - Usage analytics

### Enhanced Features

#### 1. Error Handling (`src/lib/error-handling.ts`)

- **Enhanced Error Types**: Rich error objects with context and user-friendly messages
- **Automatic Retry Logic**: Configurable retry attempts with exponential backoff
- **Error Recovery Strategies**: Handle authentication, rate limiting, and network errors
- **User Notifications**: Transform technical errors into user-friendly messages

#### 2. WebSocket Support (`src/lib/websocket.ts`)

- **Connection Management**: Automatic reconnection with backoff
- **Message Queuing**: Queue messages when disconnected
- **Heartbeat/Ping**: Keep connections alive
- **Typed Messages**: Type-safe message handling

#### 3. React WebSocket Hooks (`src/hooks/useWebSocket.ts`)

- **`useWebSocket`**: Generic WebSocket hook
- **`useProjectWebSocket`**: Project-specific real-time updates
- **`usePipelineWebSocket`**: Pipeline progress and logs
- **`useSessionWebSocket`**: Co-STORM collaborative features

## Real-Time Features

### Pipeline Real-Time Updates

```typescript
import { usePipelineWebSocket } from '@/services';

function PipelineMonitor({ projectId }: { projectId: string }) {
  const { subscribeToProgress, subscribeToLogs, isConnected } = usePipelineWebSocket(projectId);

  useEffect(() => {
    const unsubscribeProgress = subscribeToProgress((progress) => {
      console.log('Pipeline progress:', progress);
    });

    const unsubscribeLogs = subscribeToLogs((log) => {
      console.log('New log:', log);
    });

    return () => {
      unsubscribeProgress();
      unsubscribeLogs();
    };
  }, [subscribeToProgress, subscribeToLogs]);

  return (
    <div>
      Status: {isConnected ? 'Connected' : 'Disconnected'}
    </div>
  );
}
```

### Project Updates

```typescript
import { projectService } from '@/services';

// Subscribe to project updates
const cleanup = await projectService.subscribeToProjectUpdates(projectId, {
  onProjectUpdate: project => {
    console.log('Project updated:', project);
  },
  onStatusChange: status => {
    console.log('Status changed:', status);
  },
  onProgressUpdate: progress => {
    console.log('Progress:', progress);
  },
  onError: error => {
    console.error('WebSocket error:', error);
  },
});

// Clean up when done
cleanup();
```

## Error Handling

### Enhanced Error Handling Example

```typescript
import { ApiErrorHandler } from '@/lib/error-handling';

try {
  const projects = await projectService.getProjects();
} catch (error) {
  if (error instanceof Error) {
    // Error is already enhanced with user-friendly messages
    console.log('User message:', error.userMessage);
    console.log('Retryable:', error.retryable);

    // Handle specific error types
    if (error.status === 401) {
      // Redirect to login
    } else if (error.retryable) {
      // Show retry option
    }
  }
}
```

### Automatic Retry Example

```typescript
import { ApiErrorHandler } from '@/lib/error-handling';

const result = await ApiErrorHandler.handleWithRetry(
  () => projectService.createProject(data),
  'Create Project',
  {
    maxRetries: 3,
    retryDelay: 1000,
    onRetry: (attempt, error) => {
      console.log(`Retry attempt ${attempt}: ${error.message}`);
    },
  }
);
```

## Testing Integration

### Integration Test Panel

A React component is available for testing the integration:

```typescript
import { IntegrationTestPanel } from '@/components/integration-test-panel';

function DebugPage() {
  return <IntegrationTestPanel />;
}
```

### Programmatic Testing

```typescript
import {
  integrationTester,
  testIntegration,
  testProjectIntegration,
} from '@/services';

// Test all services
const results = await testIntegration();
console.log('Test results:', results);

// Test specific project
const projectResults = await testProjectIntegration('project-id');
console.log('Project test results:', projectResults);

// Test real-time features
const rtResults = await integrationTester.testRealTimeFeatures('project-id');
console.log('Real-time test results:', rtResults);
```

## Service Usage Examples

### Creating a Project

```typescript
import { projectService } from '@/services';

const newProject = await projectService.createProject({
  title: 'My New Project',
  topic: 'Artificial Intelligence',
  description: 'A comprehensive analysis of AI trends',
  config: {
    llm: {
      model: 'gpt-4',
      provider: 'openai',
      temperature: 0.7,
    },
    retriever: {
      type: 'bing',
      maxResults: 10,
    },
    pipeline: {
      doResearch: true,
      doGenerateOutline: true,
      doGenerateArticle: true,
      doPolishArticle: true,
    },
  },
});

console.log('Created project:', newProject.data);
```

### Running a Pipeline

```typescript
import { pipelineService } from '@/services';

// Start pipeline
const pipelineResult = await pipelineService.startPipeline({
  projectId: 'project-id',
  config: projectConfig,
  stages: ['research', 'outline_generation', 'article_generation', 'polishing'],
});

// Subscribe to real-time updates
const cleanup = await pipelineService.subscribeToUpdates('project-id', {
  onProgress: progress => {
    console.log(`Progress: ${progress.overallProgress}%`);
  },
  onStageStart: stage => {
    console.log(`Starting stage: ${stage}`);
  },
  onStageComplete: (stage, result) => {
    console.log(`Completed stage: ${stage}`, result);
  },
  onError: error => {
    console.error('Pipeline error:', error);
  },
});
```

### Configuration Management

```typescript
import { configService } from '@/services';

// Get available models
const models = await configService.getAvailableLLMModels();
console.log('Available models:', models.data);

// Test configuration
const testResult = await configService.testLLMConfig({
  model: 'gpt-4',
  provider: 'openai',
  apiKey: 'your-api-key',
});

if (testResult.data.success) {
  console.log('Configuration is valid');
} else {
  console.error('Configuration error:', testResult.data.error);
}
```

## Debugging

### API Debug Logging

When `NEXT_PUBLIC_API_DEBUG=true`, all API requests and responses are logged to the console:

- 🔄 Request details (method, URL, data)
- ✅ Successful responses (status, data)
- ❌ Error responses (status, error details)

### WebSocket Debug Logging

WebSocket connections also log debug information:

- 🔌 Connection status
- 📨 Received messages
- 📤 Sent messages
- 🔄 Reconnection attempts

### Health Checks

```typescript
import { getApiService, checkServiceHealth } from '@/services';

// Simple health check
const isHealthy = await getApiService().healthCheck();
console.log('API healthy:', isHealthy);

// Detailed health check
const healthStatus = await checkServiceHealth();
console.log('Service health:', healthStatus);
```

## Backend Requirements

The backend should provide these endpoints:

### REST API Endpoints

- `GET /api/health` - Health check
- `GET /api/v1/projects` - List projects
- `POST /api/v1/projects` - Create project
- `GET /api/v1/projects/{id}` - Get project
- `PUT /api/v1/projects/{id}` - Update project
- `DELETE /api/v1/projects/{id}` - Delete project

- `POST /api/v1/pipeline/start` - Start pipeline
- `POST /api/v1/pipeline/stop` - Stop pipeline
- `GET /api/v1/pipeline/status/{project_id}` - Get pipeline status

- `GET /api/v1/config/templates` - Get config templates
- `GET /api/v1/config/models` - Get available models
- `GET /api/v1/config/retrievers` - Get available retrievers

### WebSocket Endpoints

- `ws://localhost:8000/ws/projects/{project_id}` - Project updates
- `ws://localhost:8000/ws/pipeline/{project_id}` - Pipeline updates
- `ws://localhost:8000/ws/sessions/{session_id}` - Co-STORM sessions

### WebSocket Message Types

#### Pipeline Messages

- `pipeline_progress` - Progress updates
- `pipeline_log` - Log messages
- `pipeline_metrics` - Performance metrics
- `stage_start` - Stage started
- `stage_complete` - Stage completed

#### Project Messages

- `project_update` - Project data updated
- `status_change` - Project status changed
- `progress_update` - Overall progress updated

## Error Handling

### Status Code Handling

The frontend handles these HTTP status codes:

- **200-299**: Success
- **400**: Invalid request (validation errors)
- **401**: Authentication required
- **403**: Access denied
- **404**: Resource not found
- **409**: Conflict (resource in use)
- **422**: Validation error
- **429**: Rate limit exceeded
- **500-504**: Server errors

### Network Error Handling

- Connection timeouts
- Network failures
- DNS resolution errors
- WebSocket connection issues

### Retry Logic

Automatic retry for:

- Network errors
- Server errors (5xx)
- Rate limiting (429)
- Timeout errors

No retry for:

- Client errors (4xx except 429)
- Authentication errors
- Validation errors

## Performance Considerations

### API Request Optimization

- Request deduplication
- Response caching
- Automatic retry with backoff
- Rate limiting compliance

### WebSocket Optimization

- Connection pooling
- Automatic reconnection
- Message queuing during disconnection
- Heartbeat to keep connections alive

### Memory Management

- Automatic cleanup of WebSocket connections
- Event listener cleanup
- Request cancellation on component unmount

## Security

### API Key Management

- Secure storage in localStorage
- Automatic header injection
- Key validation before requests

### CORS Handling

The backend should configure CORS to allow the frontend origin:

```python
from fastapi.middleware.cors import CORSMiddleware

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],  # Frontend URL
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Ensure backend is running on `http://localhost:8000`
   - Check firewall settings
   - Verify API URLs in `.env.local`

2. **WebSocket Connection Failed**
   - Ensure WebSocket server is running
   - Check `NEXT_PUBLIC_WS_URL` configuration
   - Verify WebSocket endpoint paths

3. **API Errors**
   - Check network tab in browser dev tools
   - Enable debug logging with `NEXT_PUBLIC_API_DEBUG=true`
   - Verify API key configuration

4. **CORS Errors**
   - Configure backend CORS settings
   - Check origin URLs match

### Debug Commands

```bash
# Check environment variables
npm run env

# Run with debug logging
NEXT_PUBLIC_API_DEBUG=true npm run dev

# Test integration in browser console
window.testIntegration = () => import('/src/services').then(s => s.testIntegration())
```

## Next Steps

The integration is complete and ready for use. Consider these enhancements:

1. **Authentication**: Add user authentication flow
2. **Caching**: Implement response caching
3. **Offline Support**: Add offline capabilities
4. **Push Notifications**: Browser push notifications
5. **Analytics**: Track API usage and performance

## Support

For issues or questions about the integration:

1. Check the browser console for debug logs
2. Use the Integration Test Panel for diagnostics
3. Review error messages for specific guidance
4. Test individual services using the provided utilities
