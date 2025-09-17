// Export all mock utilities
export {
  worker,
  enableMocking,
  disableMocking,
  updateHandler,
  resetHandlers,
} from './browser';
export { server, setupMockServer, mockServer } from './server';
export { handlers } from './handlers';

// Import utilities for internal use
import {
  resetHandlers as resetHandlersInternal,
  updateHandler as updateHandlerInternal,
} from './browser';
import { http, HttpResponse, delay } from 'msw';
import { handlers as handlersInternal } from './handlers';

// Mock data utilities
export const mockData = {
  // Generate mock project data
  generateProject: (id: string, overrides = {}) => ({
    id,
    title: `Project ${id}`,
    topic: `Topic for project ${id}`,
    description: `Description for project ${id}`,
    status: 'draft',
    createdAt: new Date(),
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
  }),

  // Generate mock source data
  generateSource: (id: string, overrides = {}) => ({
    id,
    title: `Source ${id}`,
    url: `https://example.com/source${id}`,
    snippet: `This is a sample snippet from source ${id}`,
    retrievedAt: new Date(),
    relevanceScore: Math.random(),
    ...overrides,
  }),

  // Generate mock conversation data
  generateConversation: (id: string, overrides = {}) => ({
    id,
    perspective: `Perspective ${id}`,
    turns: [],
    startTime: new Date(),
    status: 'completed',
    ...overrides,
  }),

  // Generate mock session data
  generateSession: (id: string, overrides = {}) => ({
    id,
    projectId: '1',
    title: `Session ${id}`,
    description: `Description for session ${id}`,
    participants: [],
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
    ...overrides,
  }),
};

// Mock environment setup
export const mockEnv = {
  // Set up mock environment variables
  setup: () => {
    if (typeof window !== 'undefined') {
      // Browser environment
      (window as any).__MSW_ENABLED__ = true;
    } else {
      // Node.js environment
      process.env.MSW_ENABLED = 'true';
    }
  },

  // Check if mocking is enabled
  isEnabled: () => {
    if (typeof window !== 'undefined') {
      return (window as any).__MSW_ENABLED__ === true;
    }
    return process.env.MSW_ENABLED === 'true';
  },

  // Disable mocking
  disable: () => {
    if (typeof window !== 'undefined') {
      (window as any).__MSW_ENABLED__ = false;
    } else {
      delete process.env.MSW_ENABLED;
    }
  },
};

// Scenario-based mock configurations
export const mockScenarios = {
  // Happy path scenario - all APIs work normally
  happyPath: () => {
    // Default handlers already provide happy path
    resetHandlersInternal();
  },

  // Error scenario - simulate API failures
  errorScenario: () => {
    updateHandlerInternal(
      http.get('/api/*', () => {
        return HttpResponse.json(
          { success: false, error: 'Simulated API error' },
          { status: 500 }
        );
      })
    );
  },

  // Slow response scenario - simulate network delays
  slowResponse: (delay = 3000) => {
    updateHandlerInternal(
      http.get('/api/*', async () => {
        await new Promise(resolve => setTimeout(resolve, delay));
        return HttpResponse.json({ success: true, data: null });
      })
    );
  },

  // Empty data scenario - APIs return empty results
  emptyData: () => {
    updateHandlerInternal(
      http.get('/api/projects', () => {
        return HttpResponse.json({
          success: true,
          data: {
            items: [],
            total: 0,
            page: 1,
            limit: 10,
            totalPages: 0,
            hasNext: false,
            hasPrevious: false,
          },
        });
      })
    );
  },

  // Large dataset scenario - simulate large amounts of data
  largeDataset: () => {
    const projects = Array.from({ length: 1000 }, (_, i) =>
      mockData.generateProject((i + 1).toString())
    );

    updateHandlerInternal(
      http.get('/api/projects', ({ request }) => {
        const url = new URL(request.url);
        const page = parseInt(url.searchParams.get('page') || '1');
        const limit = parseInt(url.searchParams.get('limit') || '10');

        const start = (page - 1) * limit;
        const end = start + limit;
        const paginatedProjects = projects.slice(start, end);

        return HttpResponse.json({
          success: true,
          data: {
            items: paginatedProjects,
            total: projects.length,
            page,
            limit,
            totalPages: Math.ceil(projects.length / limit),
            hasNext: end < projects.length,
            hasPrevious: page > 1,
          },
        });
      })
    );
  },
};

// Development utilities
export const devUtils = {
  // Log all API calls
  logApiCalls: () => {
    if (typeof window !== 'undefined') {
      (window as any).__MSW_LOG_CALLS__ = true;
    }
  },

  // Stop logging API calls
  stopLogging: () => {
    if (typeof window !== 'undefined') {
      (window as any).__MSW_LOG_CALLS__ = false;
    }
  },

  // Get mock statistics
  getStats: () => ({
    handlersCount: handlersInternal.length,
    isEnabled: mockEnv.isEnabled(),
    timestamp: new Date(),
  }),
};

// Type-safe mock response builder
export const mockResponse = {
  success: <T>(data: T) => ({
    success: true,
    data,
    timestamp: new Date(),
  }),

  error: (message: string, status = 500) => ({
    success: false,
    error: message,
    timestamp: new Date(),
  }),

  paginated: <T>(items: T[], page = 1, limit = 10) => ({
    items,
    total: items.length,
    page,
    limit,
    totalPages: Math.ceil(items.length / limit),
    hasNext: page * limit < items.length,
    hasPrevious: page > 1,
  }),
};
