import { http, HttpResponse } from 'msw';
import {
  StormProject,
  ProjectStatus,
  PipelineProgress,
  ResearchData,
} from '../types/storm';
import {
  PaginatedResponse,
  PipelineStatusResponse,
  ConfigTemplate,
  CoStormSession,
  ExportJob,
  AnalyticsSummary,
} from '../types/api';

// Mock data generators
const generateMockProject = (
  id: string,
  overrides?: Partial<StormProject>
): StormProject => ({
  id,
  title: `Project ${id}`,
  topic: `Topic for project ${id}`,
  description: `Description for project ${id}`,
  status: 'draft' as ProjectStatus,
  createdAt: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000),
  updatedAt: new Date(),
  config: {
    llm: {
      model: 'gpt-4',
      provider: 'openai',
      temperature: 0.7,
      maxTokens: 4000,
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
  outputDir: `/output/project-${id}`,
  ...overrides,
});

const generateMockProjects = (count: number): StormProject[] => {
  return Array.from({ length: count }, (_, i) =>
    generateMockProject((i + 1).toString(), {
      status: ['draft', 'researching', 'completed', 'failed'][
        Math.floor(Math.random() * 4)
      ] as ProjectStatus,
    })
  );
};

const generateMockPipelineProgress = (): PipelineProgress => ({
  stage: 'research',
  stageProgress: Math.floor(Math.random() * 100),
  overallProgress: Math.floor(Math.random() * 100),
  startTime: new Date(Date.now() - Math.random() * 60 * 60 * 1000),
  currentTask: 'Conducting research on topic...',
});

const generateMockResearchData = (): ResearchData => ({
  conversations: [],
  sources: [
    {
      id: '1',
      title: 'Sample Source 1',
      url: 'https://example.com/source1',
      snippet: 'This is a sample snippet from source 1',
      retrievedAt: new Date(),
      relevanceScore: 0.85,
    },
    {
      id: '2',
      title: 'Sample Source 2',
      url: 'https://example.com/source2',
      snippet: 'This is a sample snippet from source 2',
      retrievedAt: new Date(),
      relevanceScore: 0.92,
    },
  ],
  perspectives: ['Academic', 'Industry Expert', 'General Public'],
  totalQueries: 15,
  lastUpdated: new Date(),
});

// API Handlers
export const handlers = [
  // Projects API
  http.get('/api/projects', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const search = url.searchParams.get('search');
    const status = url.searchParams.get('status');

    let projects = generateMockProjects(50);

    // Apply filters
    if (search) {
      projects = projects.filter(
        p =>
          p.title.toLowerCase().includes(search.toLowerCase()) ||
          p.topic.toLowerCase().includes(search.toLowerCase())
      );
    }

    if (status) {
      const statusFilters = status.split(',');
      projects = projects.filter(p => statusFilters.includes(p.status));
    }

    const start = (page - 1) * limit;
    const end = start + limit;
    const paginatedProjects = projects.slice(start, end);

    const response: PaginatedResponse<StormProject> = {
      items: paginatedProjects,
      total: projects.length,
      page,
      limit,
      totalPages: Math.ceil(projects.length / limit),
      hasNext: end < projects.length,
      hasPrevious: page > 1,
    };

    return HttpResponse.json({
      success: true,
      data: response,
      timestamp: new Date(),
    });
  }),

  http.get('/api/projects/:projectId', ({ params }) => {
    const { projectId } = params;
    const project = generateMockProject(projectId as string, {
      progress: generateMockPipelineProgress(),
      research: generateMockResearchData(),
    });

    return HttpResponse.json({
      success: true,
      data: project,
      timestamp: new Date(),
    });
  }),

  http.post('/api/projects', async ({ request }) => {
    const body = (await request.json()) as any;
    const newProject = generateMockProject(Date.now().toString(), {
      title: body.title,
      topic: body.topic,
      description: body.description,
      config: body.config,
    });

    return HttpResponse.json({
      success: true,
      data: newProject,
      timestamp: new Date(),
    });
  }),

  http.put('/api/projects/:projectId', async ({ params, request }) => {
    const { projectId } = params;
    const body = (await request.json()) as any;
    const updatedProject = generateMockProject(projectId as string, body);

    return HttpResponse.json({
      success: true,
      data: updatedProject,
      timestamp: new Date(),
    });
  }),

  http.delete('/api/projects/:projectId', ({ params }) => {
    return HttpResponse.json({
      success: true,
      timestamp: new Date(),
    });
  }),

  http.post(
    '/api/projects/:projectId/duplicate',
    async ({ params, request }) => {
      const { projectId } = params;
      const body = (await request.json()) as any;
      const duplicatedProject = generateMockProject(Date.now().toString(), {
        title: body.title || `Copy of Project ${projectId}`,
        description: body.description,
      });

      return HttpResponse.json({
        success: true,
        data: duplicatedProject,
        timestamp: new Date(),
      });
    }
  ),

  // Pipeline API
  http.get('/api/pipeline/status/:projectId', ({ params }) => {
    const { projectId } = params;
    const isRunning = Math.random() > 0.5;

    const response: PipelineStatusResponse = {
      projectId: projectId as string,
      isRunning,
      progress: generateMockPipelineProgress(),
      logs: [
        {
          id: '1',
          timestamp: new Date(),
          level: 'info',
          message: 'Pipeline started successfully',
          stage: 'initialization',
        },
        {
          id: '2',
          timestamp: new Date(),
          level: 'info',
          message: 'Research stage completed',
          stage: 'research',
        },
      ],
    };

    return HttpResponse.json({
      success: true,
      data: response,
      timestamp: new Date(),
    });
  }),

  http.post('/api/pipeline/start', async ({ request }) => {
    const body = (await request.json()) as any;
    const response: PipelineStatusResponse = {
      projectId: body.projectId,
      isRunning: true,
      progress: {
        stage: 'initializing',
        stageProgress: 0,
        overallProgress: 0,
        startTime: new Date(),
        currentTask: 'Initializing pipeline...',
      },
      logs: [],
    };

    return HttpResponse.json({
      success: true,
      data: response,
      timestamp: new Date(),
    });
  }),

  http.post('/api/pipeline/stop', async ({ request }) => {
    const body = (await request.json()) as any;

    return HttpResponse.json({
      success: true,
      data: { success: true, message: 'Pipeline stopped successfully' },
      timestamp: new Date(),
    });
  }),

  // Config API
  http.get('/api/config/templates', () => {
    const templates: ConfigTemplate[] = [
      {
        id: '1',
        name: 'Academic Research',
        description: 'Optimized for academic research papers',
        config: {
          llm: { model: 'gpt-4', provider: 'openai', temperature: 0.3 },
          retriever: { type: 'bing', maxResults: 20 },
          pipeline: {
            doResearch: true,
            doGenerateOutline: true,
            doGenerateArticle: true,
            doPolishArticle: true,
          },
        },
        isDefault: false,
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        name: 'Quick Draft',
        description: 'Fast article generation with basic research',
        config: {
          llm: { model: 'gpt-3.5-turbo', provider: 'openai', temperature: 0.7 },
          retriever: { type: 'duckduckgo', maxResults: 10 },
          pipeline: {
            doResearch: true,
            doGenerateOutline: true,
            doGenerateArticle: true,
            doPolishArticle: false,
          },
        },
        isDefault: true,
        isSystem: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ];

    return HttpResponse.json({
      success: true,
      data: templates,
      timestamp: new Date(),
    });
  }),

  // Research API
  http.get('/api/research/projects/:projectId', ({ params }) => {
    const { projectId } = params;
    const research = generateMockResearchData();

    return HttpResponse.json({
      success: true,
      data: research,
      timestamp: new Date(),
    });
  }),

  http.post('/api/research/search', async ({ request }) => {
    const body = (await request.json()) as any;
    const mockResults = [
      {
        id: '1',
        title: `Search result for "${body.query}"`,
        url: 'https://example.com/result1',
        snippet: `This is a mock search result snippet for the query "${body.query}"`,
        source: 'Example Source',
        relevanceScore: 0.95,
      },
      {
        id: '2',
        title: `Another result for "${body.query}"`,
        url: 'https://example.com/result2',
        snippet: `Another mock search result snippet for the query "${body.query}"`,
        source: 'Another Source',
        relevanceScore: 0.87,
      },
    ];

    return HttpResponse.json({
      success: true,
      data: mockResults,
      timestamp: new Date(),
    });
  }),

  // Sessions API
  http.get('/api/sessions', ({ request }) => {
    const url = new URL(request.url);
    const page = parseInt(url.searchParams.get('page') || '1');
    const limit = parseInt(url.searchParams.get('limit') || '10');

    const sessions: CoStormSession[] = [
      {
        id: '1',
        projectId: '1',
        title: 'Sample Co-STORM Session',
        description: 'A sample collaborative session',
        participants: [
          {
            id: '1',
            type: 'human',
            name: 'User',
            role: 'moderator',
            isActive: true,
          },
          {
            id: '2',
            type: 'ai_expert',
            name: 'AI Expert',
            role: 'expert',
            expertise: ['Technology', 'AI'],
            isActive: true,
          },
        ],
        mindMap: [],
        discourse: [],
        status: 'active',
        createdAt: new Date(),
        updatedAt: new Date(),
        settings: {
          maxParticipants: 10,
          allowAnonymous: false,
          moderationLevel: 'medium',
          autoSaveInterval: 30000,
          expertModels: ['gpt-4'],
        },
      },
    ];

    const response: PaginatedResponse<CoStormSession> = {
      items: sessions,
      total: sessions.length,
      page,
      limit,
      totalPages: 1,
      hasNext: false,
      hasPrevious: false,
    };

    return HttpResponse.json({
      success: true,
      data: response,
      timestamp: new Date(),
    });
  }),

  // Export API
  http.post('/api/export', async ({ request }) => {
    const body = (await request.json()) as any;
    const exportJob: ExportJob = {
      id: Date.now().toString(),
      projectId: body.projectId,
      format: body.format,
      status: 'processing',
      progress: 0,
      createdAt: new Date(),
    };

    // Simulate processing
    setTimeout(() => {
      exportJob.status = 'completed';
      exportJob.progress = 100;
      exportJob.completedAt = new Date();
      exportJob.downloadUrl = `/api/export/${exportJob.id}/download`;
    }, 2000);

    return HttpResponse.json({
      success: true,
      data: exportJob,
      timestamp: new Date(),
    });
  }),

  http.get('/api/export/:jobId', ({ params }) => {
    const { jobId } = params;
    const exportJob: ExportJob = {
      id: jobId as string,
      projectId: '1',
      format: 'pdf',
      status: Math.random() > 0.5 ? 'completed' : 'processing',
      progress: Math.floor(Math.random() * 100),
      downloadUrl:
        Math.random() > 0.5 ? `/api/export/${jobId}/download` : undefined,
      createdAt: new Date(Date.now() - Math.random() * 60 * 60 * 1000),
      completedAt: Math.random() > 0.5 ? new Date() : undefined,
    };

    return HttpResponse.json({
      success: true,
      data: exportJob,
      timestamp: new Date(),
    });
  }),

  // Analytics API
  http.post('/api/analytics/events', async ({ request }) => {
    const body = (await request.json()) as any;
    const event = {
      id: Date.now().toString(),
      userId: 'user-1',
      sessionId: body.sessionId,
      eventType: body.eventType,
      eventData: body.eventData,
      timestamp: new Date(),
    };

    return HttpResponse.json({
      success: true,
      data: event,
      timestamp: new Date(),
    });
  }),

  http.post('/api/analytics/summary', async ({ request }) => {
    const body = (await request.json()) as any;
    const summary: AnalyticsSummary = {
      totalEvents: Math.floor(Math.random() * 10000),
      uniqueUsers: Math.floor(Math.random() * 1000),
      topEvents: [
        {
          eventType: 'project_created',
          count: Math.floor(Math.random() * 100),
        },
        {
          eventType: 'pipeline_started',
          count: Math.floor(Math.random() * 100),
        },
        {
          eventType: 'article_exported',
          count: Math.floor(Math.random() * 100),
        },
      ],
      timeSeriesData: Array.from({ length: 30 }, (_, i) => ({
        date: new Date(Date.now() - (29 - i) * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
        count: Math.floor(Math.random() * 100),
      })),
      userActivity: [
        {
          userId: 'user-1',
          eventCount: Math.floor(Math.random() * 100),
          lastActive: new Date(),
        },
        {
          userId: 'user-2',
          eventCount: Math.floor(Math.random() * 100),
          lastActive: new Date(),
        },
      ],
    };

    return HttpResponse.json({
      success: true,
      data: summary,
      timestamp: new Date(),
    });
  }),

  // Health check
  http.get('/api/health', () => {
    return HttpResponse.json({
      success: true,
      data: {
        status: 'healthy',
        timestamp: new Date(),
        version: '1.0.0',
        services: {
          database: {
            status: 'up',
            responseTime: Math.floor(Math.random() * 100),
          },
          redis: { status: 'up', responseTime: Math.floor(Math.random() * 50) },
          search: {
            status: 'up',
            responseTime: Math.floor(Math.random() * 200),
          },
        },
        uptime: Math.floor(Math.random() * 86400),
      },
      timestamp: new Date(),
    });
  }),

  // Error simulation for testing
  http.get('/api/projects/error-test', () => {
    return HttpResponse.json(
      {
        success: false,
        error: 'This is a test error for development',
        timestamp: new Date(),
      },
      { status: 500 }
    );
  }),

  // Catch-all for unhandled requests
  http.all('/api/*', ({ request }) => {
    console.warn(`Unhandled ${request.method} request to ${request.url}`);
    return HttpResponse.json(
      {
        success: false,
        error: `Unhandled API endpoint: ${request.method} ${request.url}`,
        timestamp: new Date(),
      },
      { status: 404 }
    );
  }),
];

export { handlers as default };
