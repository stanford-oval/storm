# STORM API Services

This directory contains a comprehensive API client service layer for the STORM system, providing frontend-backend communication with proper error handling, authentication, rate limiting, and real-time features.

## Architecture Overview

### Base Service Layer

- **BaseApiService**: Core API client with axios wrapper, authentication, error handling, and retry logic
- **ApiError**: Custom error class for API-specific errors
- **Request/Response interceptors**: For authentication, rate limiting, and error handling

### Service Modules

#### 1. ProjectService (`project.ts`)

Handles STORM project CRUD operations:

- Create, read, update, delete projects
- Project templates and duplication
- Bulk operations and search
- Project sharing and collaboration
- Import/export functionality

#### 2. PipelineService (`pipeline.ts`)

Manages pipeline execution and monitoring:

- Start, stop, pause, resume pipeline operations
- Real-time progress tracking
- Pipeline logs and metrics
- Template management
- Scheduling and history

#### 3. ConfigService (`config.ts`)

Handles model and retriever configuration:

- Configuration templates and presets
- LLM and retriever testing
- Configuration validation and optimization
- Model pricing and recommendations

#### 4. ResearchService (`research.ts`)

Manages research data and operations:

- Search integration with multiple providers
- Source management and validation
- Conversation tracking
- Research analytics and reporting

#### 5. SessionService (`session.ts`)

Handles Co-STORM collaborative sessions:

- Session creation and management
- Participant management
- Mind map operations
- Discourse messaging
- Real-time collaboration features

#### 6. ExportService (`export.ts`)

Manages article export functionality:

- Multiple export formats (PDF, DOCX, HTML, etc.)
- Export job management
- Template system
- Bulk export operations
- Scheduling and webhooks

#### 7. AnalyticsService (`analytics.ts`)

Provides usage tracking and analytics:

- Event tracking
- Dashboard creation
- Real-time analytics
- Custom metrics and alerts
- Data export capabilities

## React Hooks

### API Integration Hooks

#### Project Hooks

```typescript
// Multiple projects with pagination and filtering
const { projects, loading, createProject, deleteProject } = useProjects({
  page: 1,
  limit: 10,
  filters: { status: ['draft', 'completed'] },
});

// Single project management
const { project, updateProject, refetch } = useProject({ projectId: '123' });

// Project templates
const { templates, createFromTemplate } = useProjectTemplates();
```

#### Pipeline Hooks

```typescript
// Pipeline management with real-time updates
const { status, progress, isRunning, startPipeline, stopPipeline } =
  usePipeline({
    projectId: '123',
    pollingInterval: 2000,
  });

// Pipeline logs with streaming
const { logs, clearLogs } = usePipelineLogs({
  projectId: '123',
  enableStreaming: true,
  level: 'info',
});
```

#### Research Hooks

```typescript
// Research data management
const { research, search, addCustomSource, deleteSource } = useResearch({
  projectId: '123',
});

// Conversations and sources
const { conversations } = useConversations({ projectId: '123' });
const { sources, total } = useSources({ projectId: '123', usedOnly: true });
```

### WebSocket Hooks

#### Real-time Updates

```typescript
// Pipeline progress updates
const pipeline = usePipelineWebSocket(projectId, update => {
  console.log('Pipeline update:', update);
});

// Session collaboration
const session = useSessionWebSocket(sessionId, update => {
  console.log('Session update:', update);
});

// General WebSocket connection
const { isConnected, send, sendMessage } = useWebSocket({
  url: 'ws://localhost:8000/ws',
  reconnect: true,
  heartbeat: true,
});
```

## Mock Server Setup

For development and testing, the service layer includes a comprehensive mock server using MSW (Mock Service Worker).

### Setup

```typescript
// In your app initialization
import { enableMocking } from './mocks';

if (process.env.NODE_ENV === 'development') {
  enableMocking();
}
```

### Mock Scenarios

```typescript
import { mockScenarios } from './mocks';

// Test different scenarios
mockScenarios.happyPath(); // Normal operation
mockScenarios.errorScenario(); // API failures
mockScenarios.slowResponse(5000); // Network delays
mockScenarios.emptyData(); // Empty responses
mockScenarios.largeDataset(); // Large data sets
```

## Usage Examples

### Basic Project Management

```typescript
import { useProjects, useProject } from './hooks/api';

function ProjectList() {
  const {
    projects,
    loading,
    createProject,
    deleteProject
  } = useProjects({
    autoFetch: true,
    limit: 20
  });

  const handleCreate = async () => {
    const project = await createProject({
      title: 'New Article',
      topic: 'AI in Education',
      description: 'An article about AI applications in education',
      config: defaultConfig
    });

    if (project) {
      console.log('Project created:', project.id);
    }
  };

  return (
    <div>
      {loading && <div>Loading...</div>}
      {projects.map(project => (
        <ProjectCard
          key={project.id}
          project={project}
          onDelete={() => deleteProject(project.id)}
        />
      ))}
      <button onClick={handleCreate}>Create Project</button>
    </div>
  );
}
```

### Pipeline Execution

```typescript
function PipelineManager({ projectId }: { projectId: string }) {
  const {
    progress,
    isRunning,
    startPipeline,
    stopPipeline
  } = usePipeline({
    projectId,
    pollingInterval: 2000
  });

  const handleStart = async () => {
    const success = await startPipeline({
      projectId,
      stages: [
        { name: 'research', enabled: true },
        { name: 'outline', enabled: true },
        { name: 'article', enabled: true },
        { name: 'polish', enabled: true }
      ]
    });

    if (success) {
      console.log('Pipeline started successfully');
    }
  };

  return (
    <div>
      <div>Progress: {progress?.overallProgress || 0}%</div>
      <div>Stage: {progress?.stage}</div>
      <div>Current Task: {progress?.currentTask}</div>

      {!isRunning ? (
        <button onClick={handleStart}>Start Pipeline</button>
      ) : (
        <button onClick={() => stopPipeline()}>Stop Pipeline</button>
      )}
    </div>
  );
}
```

### Real-time Collaboration

```typescript
function CollaborativeSession({ sessionId }: { sessionId: string }) {
  const [messages, setMessages] = useState<any[]>([]);

  const session = useSessionWebSocket(sessionId, (update) => {
    if (update.updateType === 'message') {
      setMessages(prev => [...prev, update.data]);
    }
  });

  const sendMessage = (content: string) => {
    session.sendMessage('send_message', {
      sessionId,
      content,
      messageType: 'text'
    });
  };

  return (
    <div>
      <div>
        Connection: {session.isConnected ? '🟢 Connected' : '🔴 Disconnected'}
      </div>

      <div>
        {messages.map(message => (
          <div key={message.id}>
            <strong>{message.senderId}:</strong> {message.content}
          </div>
        ))}
      </div>

      <input
        onKeyPress={(e) => {
          if (e.key === 'Enter' && e.currentTarget.value) {
            sendMessage(e.currentTarget.value);
            e.currentTarget.value = '';
          }
        }}
        placeholder="Type a message..."
      />
    </div>
  );
}
```

### Configuration Management

```typescript
function ConfigurationPanel() {
  const {
    templates,
    llmModels,
    retrievers,
    validateConfig,
    testLlmConfig
  } = useConfig();

  const [config, setConfig] = useState<StormConfig>();

  const handleTest = async () => {
    if (config?.llm) {
      const result = await testLlmConfig(config.llm);
      if (result?.success) {
        console.log('LLM test successful:', result);
      }
    }
  };

  const handleValidate = async () => {
    if (config) {
      const validation = await validateConfig(config);
      console.log('Validation result:', validation);
    }
  };

  return (
    <div>
      {/* Configuration form */}
      <button onClick={handleTest}>Test LLM</button>
      <button onClick={handleValidate}>Validate Config</button>
    </div>
  );
}
```

## Error Handling

The service layer provides comprehensive error handling:

```typescript
import { ApiError } from './services';

try {
  await projectService.createProject(data);
} catch (error) {
  if (error instanceof ApiError) {
    console.error('API Error:', {
      message: error.message,
      status: error.status,
      code: error.code,
      details: error.details,
    });
  }
}
```

## Authentication

Set up authentication tokens and API keys:

```typescript
import { getApiService } from './services';

// Set API key
getApiService().setApiKey('your-api-key');

// Set auth token (persistent)
getApiService().setAuthToken('your-jwt-token', true);

// Clear credentials
getApiService().clearAuthToken();
getApiService().clearApiKey();
```

## Rate Limiting

The base service includes automatic rate limiting:

```typescript
// Configuration is set in base.ts
const apiService = new BaseApiService({
  baseURL: 'http://localhost:8000/api',
  rateLimitPerSecond: 10, // Max 10 requests per second
  retryAttempts: 3,
  retryDelay: 1000,
});
```

## Environment Configuration

Set up environment variables:

```env
NEXT_PUBLIC_API_URL=http://localhost:8000/api
NEXT_PUBLIC_WS_URL=ws://localhost:8000/ws
```

## Testing

The mock server provides comprehensive testing capabilities:

```typescript
// In your test files
import { setupMockServer } from './mocks/server';

describe('Project Service', () => {
  setupMockServer();

  test('should create project', async () => {
    const project = await projectService.createProject({
      title: 'Test Project',
      topic: 'Test Topic',
      config: mockConfig,
    });

    expect(project.data).toBeDefined();
  });
});
```

## Performance Considerations

- **Request batching**: Multiple requests are batched when possible
- **Caching**: Responses are cached with appropriate TTL
- **Lazy loading**: Data is fetched only when needed
- **Pagination**: Large datasets are paginated
- **WebSocket management**: Connections are properly cleaned up

## Security Features

- **Authentication**: JWT token and API key support
- **Rate limiting**: Prevents abuse
- **Input validation**: Request data is validated
- **Error sanitization**: Sensitive data is not exposed in errors
- **CORS handling**: Proper cross-origin request handling
