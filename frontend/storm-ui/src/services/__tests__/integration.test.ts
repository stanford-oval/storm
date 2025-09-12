import { http, HttpResponse } from 'msw';
import { setupServer } from 'msw/node';
import { projectService } from '../project';
import { pipelineService } from '../pipeline';
import { configService } from '../config';
import { analyticsService } from '../analytics';
import { sessionService } from '../session';
import {
  StormProject,
  CreateProjectRequest,
  StartPipelineRequest,
  PipelineProgress,
  StormConfig,
  CoStormSession,
} from '../../types/api';

// Mock data
const mockProject: StormProject = {
  id: 'test-project-id',
  title: 'Test Project',
  topic: 'Artificial Intelligence',
  description: 'A test project for integration testing',
  status: 'draft',
  config: {
    languageModel: {
      provider: 'openai',
      model: 'gpt-4',
      temperature: 0.7,
      maxTokens: 2000,
    },
    retrieval: {
      provider: 'bing',
      maxResults: 10,
      sources: ['web', 'academic'],
    },
    research: {
      maxConversations: 3,
      conversationDepth: 2,
      perspectives: ['expert', 'critic', 'journalist'],
    },
    generation: {
      maxSections: 5,
      includeImages: false,
      citationStyle: 'apa',
    },
  },
  createdAt: new Date('2023-01-01T00:00:00Z'),
  updatedAt: new Date('2023-01-01T00:00:00Z'),
  ownerId: 'test-user-id',
  collaborators: [],
  tags: [],
  isArchived: false,
  metadata: {},
};

const mockPipelineProgress: PipelineProgress = {
  stage: 'research',
  substage: 'conversation_simulation',
  progress: 0.3,
  isRunning: true,
  startedAt: new Date(),
  estimatedTimeRemaining: 300,
  currentAction: 'Simulating expert conversations',
  stages: {
    research: { status: 'running', progress: 0.3, startedAt: new Date() },
    outline: { status: 'pending', progress: 0, startedAt: null },
    article: { status: 'pending', progress: 0, startedAt: null },
    polish: { status: 'pending', progress: 0, startedAt: null },
  },
  logs: [],
  error: null,
};

const mockConfig: StormConfig = {
  languageModel: {
    provider: 'openai',
    model: 'gpt-4',
    temperature: 0.7,
    maxTokens: 2000,
  },
  retrieval: {
    provider: 'bing',
    maxResults: 10,
    sources: ['web', 'academic'],
  },
  research: {
    maxConversations: 3,
    conversationDepth: 2,
    perspectives: ['expert', 'critic', 'journalist'],
  },
  generation: {
    maxSections: 5,
    includeImages: false,
    citationStyle: 'apa',
  },
};

// Mock server setup
const server = setupServer(
  // Project endpoints
  http.get('http://localhost:8000/api/v1/projects', () => {
    return HttpResponse.json({success: true,
        data: {
          items: [mockProject],
          total: 1,
          page: 1,
          limit: 20,
          totalPages: 1,
          hasNext: false,
          hasPrevious: false,
        });
  }),

  http.get('http://localhost:8000/api/v1/projects/:id', ({ request }) => {
    const { id } = request.params;
    if (id === 'test-project-id') {
      return HttpResponse.json({success: true,
          data: mockProject,});
    }
    return HttpResponse.json({success: false,
        error: 'Project not found',});
  }),

  http.post('http://localhost:8000/api/v1/projects', () => {
    return HttpResponse.json({success: true,
        data: { ...mockProject, id: 'new-project-id' });
  }),

  http.put('http://localhost:8000/api/v1/projects/:id', () => {
    return HttpResponse.json({success: true,
        data: mockProject,});
  }),

  http.delete('http://localhost:8000/api/v1/projects/:id', () => {
    return HttpResponse.json({success: true,
        data: null,});
  }),

  // Pipeline endpoints
  http.post(
    'http://localhost:8000/api/v1/projects/:id/pipeline/start',
    () {
      return HttpResponse.json({success: true,
          data: mockPipelineProgress,});
    }
  ),

  http.get(
    'http://localhost:8000/api/v1/projects/:id/pipeline/status',
    () {
      return HttpResponse.json({success: true,
          data: {
            projectId: request.params.id,
            isRunning: true,
            progress: mockPipelineProgress,
            logs: [],
          });
    }
  ),

  http.post(
    'http://localhost:8000/api/v1/projects/:id/pipeline/stop',
    () {
      return HttpResponse.json({success: true,
          data: { ...mockPipelineProgress, isRunning: false });
    }
  ),

  // Config endpoints
  http.get('http://localhost:8000/api/v1/config/templates', () => {
    return HttpResponse.json({success: true,
        data: [
          {
            id: 'default',
            name: 'Default Configuration',
            description: 'Standard STORM configuration',
            config: mockConfig,
            isDefault: true,
            isSystem: true,
            createdAt: new Date(),
            updatedAt: new Date(),
          },
        ],});
  }),

  http.post('http://localhost:8000/api/v1/config/validate', () => {
    return HttpResponse.json({success: true,
        data: {
          isValid: true,
          errors: [],
          warnings: [],
        });
  }),

  // Session endpoints
  http.post('http://localhost:8000/api/v1/sessions', () => {
    return HttpResponse.json({success: true,
        data: {
          id: 'test-session-id',
          projectId: 'test-project-id',
          title: 'Test Co-STORM Session',
          participants: [],
          mindMap: [],
          discourse: [],
          status: 'active',
          createdAt: new Date(),
          updatedAt: new Date(),
          settings: {
            maxParticipants: 5,
            allowAnonymous: false,
            moderationLevel: 'medium',
            autoSaveInterval: 30,
            expertModels: ['gpt-4'],
          },
        },});
  }),

  // Analytics endpoints
  http.post(
    'http://localhost:8000/api/v1/analytics/events',
    () {
      return HttpResponse.json({success: true,
          data: {
            id: 'event-id',
            eventType: 'project_created',
            timestamp: new Date(),
          });
    }
  ),

  // Error scenarios
  http.get(
    'http://localhost:8000/api/v1/projects/error-test',
    () {
      return HttpResponse.json({success: false,
          error: 'Internal server error',});
    }
  ),

  http.get(
    'http://localhost:8000/api/v1/projects/timeout-test',
    () {
      // Simulate timeout by never resolving
      return new Promise(() => {});
    }
  )
);

beforeAll(() => server.listen({ onUnhandledRequest: 'error' });
afterEach(() => server.resetHandlers(, { status: 200 });
afterAll(() => server.close(, { status: 200 });

describe('ProjectService Integration Tests', () => {
  test('should get projects list successfully', async () => {
    const response = await projectService.getProjects();

    expect(response.success).toBe(true);
    expect(response.data.items).toHaveLength(1);
    expect(response.data.items[0]).toEqual(mockProject);
    expect(response.data.total).toBe(1);
  });

  test('should get single project successfully', async () => {
    const response = await projectService.getProject('test-project-id');

    expect(response.success).toBe(true);
    expect(response.data).toEqual(mockProject);
  });

  test('should handle project not found error', async () => {
    await expect(projectService.getProject('nonexistent-id')).rejects.toThrow();
  });

  test('should create project successfully', async () => {
    const createRequest: CreateProjectRequest = {
      title: 'New Test Project',
      topic: 'Machine Learning',
      description: 'A new test project',
      config: mockConfig,
    };

    const response = await projectService.createProject(createRequest);

    expect(response.success).toBe(true);
    expect(response.data.id).toBe('new-project-id');
    expect(response.data.title).toBe(mockProject.title);
  });

  test('should update project successfully', async () => {
    const updateRequest = {
      id: 'test-project-id',
      title: 'Updated Title',
      description: 'Updated description',
    };

    const response = await projectService.updateProject(updateRequest);

    expect(response.success).toBe(true);
    expect(response.data).toEqual(mockProject);
  });

  test('should delete project successfully', async () => {
    const response = await projectService.deleteProject('test-project-id');

    expect(response.success).toBe(true);
  });

  test('should search projects with filters', async () => {
    const response = await projectService.searchProjects('AI', {
      status: ['draft', 'completed'],
      dateRange: {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
      },
    });

    expect(response.success).toBe(true);
    expect(Array.isArray(response.data)).toBe(true);
  });

  test('should handle pagination correctly', async () => {
    const response = await projectService.getProjects({
      page: 1,
      limit: 10,
      sortBy: 'createdAt',
      sortOrder: 'desc',
    });

    expect(response.success).toBe(true);
    expect(response.data.page).toBe(1);
    expect(response.data.limit).toBe(20); // Server might override
    expect(response.data.hasNext).toBe(false);
  });

describe('PipelineService Integration Tests', () => {
  test('should start pipeline successfully', async () => {
    const startRequest: StartPipelineRequest = {
      projectId: 'test-project-id',
      config: mockConfig,
      stages: [
        { name: 'research', enabled: true },
        { name: 'outline', enabled: true },
        { name: 'article', enabled: true },
        { name: 'polish', enabled: true },
      ],
    };

    const response = await pipelineService.startPipeline(startRequest);

    expect(response.success).toBe(true);
    expect(response.data.isRunning).toBe(true);
    expect(response.data.stage).toBe('research');
  });

  test('should get pipeline status', async () => {
    const response = await pipelineService.getPipelineStatus('test-project-id');

    expect(response.success).toBe(true);
    expect(response.data.projectId).toBe('test-project-id');
    expect(response.data.isRunning).toBe(true);
  });

  test('should stop pipeline successfully', async () => {
    const response = await pipelineService.stopPipeline({
      projectId: 'test-project-id',
      reason: 'User requested stop',
    });

    expect(response.success).toBe(true);
    expect(response.data.isRunning).toBe(false);
  });

  test('should handle pipeline stage transitions', async () => {
    // Mock server responses for different stages
    server.use(
      http.get(
        'http://localhost:8000/api/v1/projects/test-project-id/pipeline/status',
        () {
          return HttpResponse.json({success: true,
              data: {
                ...mockPipelineProgress,
                stage: 'outline',
                progress: 0.6,
                stages: {
                  research: {
                    status: 'completed',
                    progress: 1.0,
                    startedAt: new Date(),
                  },
                  outline: {
                    status: 'running',
                    progress: 0.6,
                    startedAt: new Date(),
                  },
                  article: { status: 'pending', progress: 0, startedAt: null },
                  polish: { status: 'pending', progress: 0, startedAt: null },
                },
              },});
        }
      )
    );

    const response = await pipelineService.getPipelineStatus('test-project-id');

    expect(response.data.stage).toBe('outline');
    expect(response.data.stages.research.status).toBe('completed');
    expect(response.data.stages.outline.status).toBe('running');
  });

describe('ConfigService Integration Tests', () => {
  test('should get configuration templates', async () => {
    const response = await configService.getConfigTemplates();

    expect(response.success).toBe(true);
    expect(response.data).toHaveLength(1);
    expect(response.data[0].name).toBe('Default Configuration');
    expect(response.data[0].isDefault).toBe(true);
  });

  test('should validate configuration', async () => {
    const response = await configService.validateConfig({ config: mockConfig });

    expect(response.success).toBe(true);
    expect(response.data.isValid).toBe(true);
    expect(response.data.errors).toHaveLength(0);
  });

  test('should handle invalid configuration', async () => {
    server.use(
      http.post(
        'http://localhost:8000/api/v1/config/validate',
        () {
          return HttpResponse.json({success: true,
              data: {
                isValid: false,
                errors: [
                  {
                    field: 'languageModel.temperature',
                    message: 'Temperature must be between 0 and 1',
                    code: 'INVALID_RANGE',
                  },
                ],
                warnings: [
                  {
                    field: 'retrieval.maxResults',
                    message: 'High maxResults may increase processing time',
                    suggestion:
                      'Consider reducing to 5-15 for optimal performance',
                  },
                ],
              },});
        }
      )
    );

    const invalidConfig = {
      ...mockConfig,
      languageModel: {
        ...mockConfig.languageModel,
        temperature: 1.5, // Invalid value
      },
    };

    const response = await configService.validateConfig({
      config: invalidConfig,
    });

    expect(response.data.isValid).toBe(false);
    expect(response.data.errors).toHaveLength(1);
    expect(response.data.warnings).toHaveLength(1);
  });

describe('SessionService Integration Tests', () => {
  test('should create Co-STORM session successfully', async () => {
    const createRequest = {
      projectId: 'test-project-id',
      title: 'Test Co-STORM Session',
      description: 'A test collaborative session',
      settings: {
        maxParticipants: 5,
        allowAnonymous: false,
        moderationLevel: 'medium' as const,
        autoSaveInterval: 30,
        expertModels: ['gpt-4'],
      },
    };

    const response = await sessionService.createSession(createRequest);

    expect(response.success).toBe(true);
    expect(response.data.id).toBe('test-session-id');
    expect(response.data.projectId).toBe('test-project-id');
    expect(response.data.status).toBe('active');
  });

describe('AnalyticsService Integration Tests', () => {
  test('should track events successfully', async () => {
    const eventRequest = {
      eventType: 'project_created',
      eventData: {
        projectId: 'test-project-id',
        projectTitle: 'Test Project',
      },
      sessionId: 'test-session-id',
    };

    const response = await analyticsService.trackEvent(eventRequest);

    expect(response.success).toBe(true);
    expect(response.data.id).toBe('event-id');
    expect(response.data.eventType).toBe('project_created');
  });

describe('Cross-Service Integration Tests', () => {
  test('should complete full project workflow', async () => {
    // 1. Create project
    const createRequest: CreateProjectRequest = {
      title: 'Integration Test Project',
      topic: 'Full Workflow Test',
      description: 'Testing complete workflow',
      config: mockConfig,
    };

    const projectResponse = await projectService.createProject(createRequest);
    expect(projectResponse.success).toBe(true);

    const projectId = projectResponse.data.id;

    // 2. Start pipeline
    const pipelineRequest: StartPipelineRequest = {
      projectId,
      config: mockConfig,
      stages: [
        { name: 'research', enabled: true },
        { name: 'outline', enabled: true },
      ],
    };

    const pipelineResponse =
      await pipelineService.startPipeline(pipelineRequest);
    expect(pipelineResponse.success).toBe(true);
    expect(pipelineResponse.data.isRunning).toBe(true);

    // 3. Monitor pipeline
    const statusResponse = await pipelineService.getPipelineStatus(projectId);
    expect(statusResponse.success).toBe(true);
    expect(statusResponse.data.isRunning).toBe(true);

    // 4. Create collaborative session
    const sessionRequest = {
      projectId,
      title: 'Integration Test Session',
    };

    const sessionResponse = await sessionService.createSession(sessionRequest);
    expect(sessionResponse.success).toBe(true);
    expect(sessionResponse.data.projectId).toBe(projectId);

    // 5. Track analytics
    const analyticsRequest = {
      eventType: 'workflow_completed',
      eventData: {
        projectId,
        sessionId: sessionResponse.data.id,
        stagesCompleted: ['research', 'outline'],
      },
    };

    const analyticsResponse =
      await analyticsService.trackEvent(analyticsRequest);
    expect(analyticsResponse.success).toBe(true);
  });

  test('should handle service dependencies correctly', async () => {
    // Test that pipeline service depends on valid project
    const invalidPipelineRequest: StartPipelineRequest = {
      projectId: 'nonexistent-project',
      stages: [{ name: 'research', enabled: true }],
    };

    server.use(
      http.post(
        'http://localhost:8000/api/v1/projects/nonexistent-project/pipeline/start',
        () {
          return HttpResponse.json({success: false,
              error: 'Project not found',});
        }
      )
    );

    await expect(
      pipelineService.startPipeline(invalidPipelineRequest)
    ).rejects.toThrow();
  });

describe('Error Handling Integration Tests', () => {
  test('should handle network errors gracefully', async () => {
    // Temporarily stop the server to simulate network issues
    server.close();

    await expect(projectService.getProjects()).rejects.toThrow();

    // Restart server
    server.listen();
  });

  test('should handle server errors with proper error messages', async () => {
    server.use(
      http.get(
        'http://localhost:8000/api/v1/projects/error-test',
        () {
          return HttpResponse.json({success: false,
              error: 'Database connection failed',
              details: {
                code: 'DB_CONNECTION_ERROR',
                timestamp: new Date().toISOString(),
              });
        }
      )
    );

    await expect(projectService.getProject('error-test')).rejects.toThrow();
  });

  test('should handle timeout errors', async () => {
    // Create a request that will timeout
    server.use(
      http.get(
        'http://localhost:8000/api/v1/projects/timeout-test',
        () {
          return HttpResponse.json(delay('infinite', { status: 200 });
        }
      )
    );

    // Set a short timeout for this test
    const originalTimeout = projectService['timeout'];
    (projectService as any).timeout = 1000; // 1 second

    await expect(projectService.getProject('timeout-test')).rejects.toThrow();

    // Restore original timeout
    (projectService as any).timeout = originalTimeout;
  }, 10000);

  test('should handle validation errors properly', async () => {
    server.use(
      http.post('http://localhost:8000/api/v1/projects', () => {
        return HttpResponse.json({success: false,
            error: 'Validation error',
            details: {
              fields: {
                title: 'Title is required',
                topic: 'Topic must be at least 3 characters long',
              },
            },});
    const invalidRequest: CreateProjectRequest = {
      title: '', // Invalid
      topic: 'AI', // Too short
      config: mockConfig,
    };

    await expect(
      projectService.createProject(invalidRequest)
    ).rejects.toThrow();
  });

describe('Rate Limiting and Caching Tests', () => {
  test('should handle rate limiting gracefully', async () => {
    server.use(
      http.get('http://localhost:8000/api/v1/projects', () => {
        return HttpResponse.json(
          ctx.set('Retry-After', '60'),
          {
            success: false,
            error: 'Rate limit exceeded',
            details: {
              limit: 100,
              remaining: 0,
              resetAt: new Date(Date.now() + 60000).toISOString(),
            },
          });
    await expect(projectService.getProjects()).rejects.toThrow();
  });

  test('should handle concurrent requests efficiently', async () => {
    // Make multiple concurrent requests
    const requests = Array.from({ length: 5 }, () =>
      projectService.getProject('test-project-id')
    );

    const responses = await Promise.all(requests);

    responses.forEach(response => {
      expect(response.success).toBe(true);
      expect(response.data).toEqual(mockProject);
    });

describe('Real-time Updates Integration Tests', () => {
  test('should handle WebSocket connection for project updates', async () => {
    // Mock WebSocket
    const mockWebSocket = {
      connect: jest.fn().mockResolvedValue(undefined),
      disconnect: jest.fn(),
      send: jest.fn(),
      on: jest.fn().mockReturnValue(() => {}),
      setEventHandlers: jest.fn(),
    };

    // Mock the WebSocket creation
    jest.doMock('../../lib/websocket', () => ({
      createProjectWebSocket: () => mockWebSocket,
    });

    const callbacks = {
      onProjectUpdate: jest.fn(),
      onStatusChange: jest.fn(),
      onProgressUpdate: jest.fn(),
      onError: jest.fn(),
    };

    const unsubscribe = await projectService.subscribeToProjectUpdates(
      'test-project-id',
      callbacks
    );

    expect(mockWebSocket.connect).toHaveBeenCalled();
    expect(mockWebSocket.send).toHaveBeenCalledWith(
      'subscribe_project_updates',
      {
        projectId: 'test-project-id',
      }
    );

    // Test cleanup
    unsubscribe();
    expect(mockWebSocket.send).toHaveBeenCalledWith(
      'unsubscribe_project_updates',
      {
        projectId: 'test-project-id',
      }
    );
    expect(mockWebSocket.disconnect).toHaveBeenCalled();
  });

}}}}}}}}}}}}}}}}}}}
)))))))))))))))))))