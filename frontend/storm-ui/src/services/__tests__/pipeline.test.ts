import { pipelineService } from '../pipeline';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { StormProject, PipelineProgress } from '@/types/storm';

const mockProject: StormProject = {
  id: 'test-project-1',
  title: 'Test Article',
  topic: 'Test Topic',
  status: 'draft',
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  config: {
    llm: {
      model: 'gpt-4o',
      provider: 'openai',
      apiKey: 'test-key',
      temperature: 0.7,
    },
    retriever: {
      type: 'bing',
      apiKey: 'test-bing-key',
      maxResults: 10,
    },
    pipeline: {
      doResearch: true,
      doGenerateOutline: true,
      doGenerateArticle: true,
      doPolishArticle: true,
    },
  },
  outputDir: '/test/output',
};

const mockPipelineProgress: PipelineProgress = {
  stage: 'research',
  stageProgress: 45,
  overallProgress: 25,
  startTime: new Date('2024-01-01T10:00:00'),
  currentTask: 'Conducting perspective research...',
  errors: [],
};

describe('pipelineService', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  describe('startPipeline', () => {
    it('starts pipeline successfully', async () => {
      server.use(
        http.post('/api/pipeline/start', () => {
          return HttpResponse.json({success: true,
              data: {
                pipelineId: 'pipeline-123',
                status: 'initializing',
              });
      const result = await pipelineService.startPipeline(mockProject);

      expect(result.success).toBe(true);
      expect(result.data.pipelineId).toBe('pipeline-123');
    });

    it('handles start pipeline errors', async () => {
      server.use(
        http.post('/api/pipeline/start', () => {
          return HttpResponse.json({success: false,
              error: 'Invalid configuration',});
      const result = await pipelineService.startPipeline(mockProject);

      expect(result.success).toBe(false);
      expect(result.error).toBe('Invalid configuration');
    });

    it('validates project configuration', async () => {
      const invalidProject = {
        ...mockProject,
        config: {
          ...mockProject.config,
          llm: {
            ...mockProject.config.llm,
            apiKey: '',
          },
        },
      };

      const result = await pipelineService.startPipeline(invalidProject);

      expect(result.success).toBe(false);
      expect(result.error).toContain('API key is required');
    });

    it('sends correct request payload', async () => {
      server.use(
        http.post('/api/pipeline/start', async () {
          const body = await request.json();

          expect(body).toEqual({
            project: mockProject,
            options: {},
          });

          return HttpResponse.json({success: true,
              data: { pipelineId: 'pipeline-123' });
      await pipelineService.startPipeline(mockProject);
    });

    it('includes custom options in request', async () => {
      const options = {
        priority: 'high',
        timeout: 30000,
      };

      server.use(
        http.post('/api/pipeline/start', async () {
          const body = await request.json();

          expect(body.options).toEqual(options);

          return HttpResponse.json({success: true,
              data: { pipelineId: 'pipeline-123' });
      await pipelineService.startPipeline(mockProject, options);
    });

  describe('stopPipeline', () => {
    it('stops pipeline successfully', async () => {
      server.use(
        http.post('/api/pipeline/stop', () => {
          return HttpResponse.json({success: true,
              data: { status: 'stopped' });
      const result = await pipelineService.stopPipeline('pipeline-123');

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('stopped');
    });

    it('handles stop pipeline errors', async () => {
      server.use(
        http.post('/api/pipeline/stop', () => {
          return HttpResponse.json({success: false,
              error: 'Pipeline not found',});
      const result = await pipelineService.stopPipeline('invalid-pipeline');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pipeline not found');
    });

    it('sends pipeline ID in request body', async () => {
      server.use(
        http.post('/api/pipeline/stop', async () {
          const body = await request.json();

          expect(body.pipelineId).toBe('pipeline-123');

          return HttpResponse.json({success: true,
              data: { status: 'stopped' });
      await pipelineService.stopPipeline('pipeline-123');
    });

  describe('getPipelineStatus', () => {
    it('fetches pipeline status successfully', async () => {
      server.use(
        http.get('/api/pipeline/status/:pipelineId', ({ request }) => {
          expect(request.params.pipelineId).toBe('pipeline-123');

          return HttpResponse.json({success: true,
              data: mockPipelineProgress,});
      const result = await pipelineService.getPipelineStatus('pipeline-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPipelineProgress);
    });

    it('handles status fetch errors', async () => {
      server.use(
        http.get('/api/pipeline/status/:pipelineId', () => {
          return HttpResponse.json({success: false,
              error: 'Pipeline not found',});
      const result =
        await pipelineService.getPipelineStatus('invalid-pipeline');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pipeline not found');
    });

  describe('getPipelineLogs', () => {
    const mockLogs = [
      {
        timestamp: new Date('2024-01-01T10:00:00'),
        level: 'info' as const,
        message: 'Starting research phase',
        stage: 'research' as const,
      },
      {
        timestamp: new Date('2024-01-01T10:01:00'),
        level: 'debug' as const,
        message: 'Retrieved 10 sources',
        stage: 'research' as const,
      },
    ];

    it('fetches pipeline logs successfully', async () => {
      server.use(
        http.get('/api/pipeline/logs/:pipelineId', () => {
          return HttpResponse.json({success: true,
              data: mockLogs,});
      const result = await pipelineService.getPipelineLogs('pipeline-123');

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockLogs);
    });

    it('filters logs by level', async () => {
      server.use(
        http.get('/api/pipeline/logs/:pipelineId', ({ request }) => {
          const level = request.url.searchParams.get('level');
          expect(level).toBe('error');

          return HttpResponse.json({success: true,
              data: [mockLogs[0]],});
      const result = await pipelineService.getPipelineLogs('pipeline-123', {
        level: 'error',
      });

      expect(result.success).toBe(true);
    });

    it('limits log results', async () => {
      server.use(
        http.get('/api/pipeline/logs/:pipelineId', ({ request }) => {
          const limit = request.url.searchParams.get('limit');
          expect(limit).toBe('50');

          return HttpResponse.json({success: true,
              data: mockLogs.slice(0, 50),});
      await pipelineService.getPipelineLogs('pipeline-123', { limit: 50 });

    it('filters logs by stage', async () => {
      server.use(
        http.get('/api/pipeline/logs/:pipelineId', ({ request }) => {
          const stage = request.url.searchParams.get('stage');
          expect(stage).toBe('research');

          return HttpResponse.json({success: true,
              data: mockLogs.filter(log => log.stage === 'research'),});
      await pipelineService.getPipelineLogs('pipeline-123', {
        stage: 'research',
      });

  describe('pausePipeline', () => {
    it('pauses pipeline successfully', async () => {
      server.use(
        http.post('/api/pipeline/pause', async () {
          const body = await request.json();
          expect(body.pipelineId).toBe('pipeline-123');

          return HttpResponse.json({success: true,
              data: { status: 'paused' });
      const result = await pipelineService.pausePipeline('pipeline-123');

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('paused');
    });

    it('handles pause errors', async () => {
      server.use(
        http.post('/api/pipeline/pause', () => {
          return HttpResponse.json({success: false,
              error: 'Pipeline cannot be paused in current state',});
      const result = await pipelineService.pausePipeline('pipeline-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pipeline cannot be paused in current state');
    });

  describe('resumePipeline', () => {
    it('resumes pipeline successfully', async () => {
      server.use(
        http.post('/api/pipeline/resume', async () {
          const body = await request.json();
          expect(body.pipelineId).toBe('pipeline-123');

          return HttpResponse.json({success: true,
              data: { status: 'running' });
      const result = await pipelineService.resumePipeline('pipeline-123');

      expect(result.success).toBe(true);
      expect(result.data.status).toBe('running');
    });

    it('handles resume errors', async () => {
      server.use(
        http.post('/api/pipeline/resume', () => {
          return HttpResponse.json({success: false,
              error: 'Pipeline is not paused',});
      const result = await pipelineService.resumePipeline('pipeline-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Pipeline is not paused');
    });

  describe('listPipelines', () => {
    const mockPipelines = [
      {
        id: 'pipeline-1',
        projectId: 'project-1',
        status: 'completed',
        startTime: new Date('2024-01-01T10:00:00'),
        endTime: new Date('2024-01-01T11:30:00'),
      },
      {
        id: 'pipeline-2',
        projectId: 'project-2',
        status: 'running',
        startTime: new Date('2024-01-01T12:00:00'),
      },
    ];

    it('fetches pipelines list successfully', async () => {
      server.use(
        http.get('/api/pipelines', () => {
          return HttpResponse.json({success: true,
              data: mockPipelines,});
      const result = await pipelineService.listPipelines();

      expect(result.success).toBe(true);
      expect(result.data).toEqual(mockPipelines);
    });

    it('filters pipelines by status', async () => {
      server.use(
        http.get('/api/pipelines', ({ request }) => {
          const status = request.url.searchParams.get('status');
          expect(status).toBe('running');

          return HttpResponse.json({success: true,
              data: mockPipelines.filter(p => p.status === 'running'),});
      await pipelineService.listPipelines({ status: 'running' });

    it('filters pipelines by project ID', async () => {
      server.use(
        http.get('/api/pipelines', ({ request }) => {
          const projectId = request.url.searchParams.get('projectId');
          expect(projectId).toBe('project-1');

          return HttpResponse.json({success: true,
              data: mockPipelines.filter(p => p.projectId === 'project-1'),});
      await pipelineService.listPipelines({ projectId: 'project-1' });

  describe('deletePipeline', () => {
    it('deletes pipeline successfully', async () => {
      server.use(
        http.delete('/api/pipeline/:pipelineId', ({ request }) => {
          expect(request.params.pipelineId).toBe('pipeline-123');

          return HttpResponse.json({success: true,
              data: { id: 'pipeline-123' });
      const result = await pipelineService.deletePipeline('pipeline-123');

      expect(result.success).toBe(true);
      expect(result.data.id).toBe('pipeline-123');
    });

    it('handles delete errors', async () => {
      server.use(
        http.delete('/api/pipeline/:pipelineId', () => {
          return HttpResponse.json({success: false,
              error: 'Cannot delete running pipeline',});
      const result = await pipelineService.deletePipeline('pipeline-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Cannot delete running pipeline');
    });

  describe('error handling and retries', () => {
    it('retries failed requests', async () => {
      let attemptCount = 0;

      server.use(
        http.get('/api/pipeline/status/pipeline-123', () => {
          attemptCount++;

          if (attemptCount < 3) {
            return HttpResponse.json({success: false, error: 'Server error' });
          }

          return HttpResponse.json({success: true, data: mockPipelineProgress });
      const result = await pipelineService.getPipelineStatus('pipeline-123');

      expect(result.success).toBe(true);
      expect(attemptCount).toBe(3);
    });

    it('gives up after max retries', async () => {
      server.use(
        http.get('/api/pipeline/status/pipeline-123', () => {
          return HttpResponse.json({success: false, error: 'Persistent server error' });
      const result = await pipelineService.getPipelineStatus('pipeline-123');

      expect(result.success).toBe(false);
      expect(result.error).toBe('Persistent server error');
    });

    it('handles network errors', async () => {
      server.use(
        http.get('/api/pipeline/status/pipeline-123', () => {
          return HttpResponse.error('Network connection failed');
        });
      const result = await pipelineService.getPipelineStatus('pipeline-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('Network connection failed');
    });

    it('handles timeout errors', async () => {
      server.use(
        http.get('/api/pipeline/status/pipeline-123', async () => {
          await new Promise(resolve => setTimeout(resolve(5000), // Longer than typical timeout
            { success: true, data: mockPipelineProgress });
      const result = await pipelineService.getPipelineStatus('pipeline-123');

      expect(result.success).toBe(false);
      expect(result.error).toContain('timeout');
    });

  describe('request interceptors', () => {
    it('adds authentication headers', async () => {
      server.use(
        http.get('/api/pipeline/status/pipeline-123', ({ request }) => {
          const authHeader = request.headers.get('Authorization');
          expect(authHeader).toBe('Bearer test-token');

          return HttpResponse.json({success: true, data: mockPipelineProgress });
      // Mock getting auth token
      localStorage.setItem('auth-token', 'test-token');

      await pipelineService.getPipelineStatus('pipeline-123');
    });

    it('adds request ID for tracing', async () => {
      server.use(
        http.get('/api/pipeline/status/pipeline-123', ({ request }) => {
          const requestId = request.headers.get('X-Request-ID');
          expect(requestId).toBeTruthy();
          expect(requestId).toMatch(/^[0-9a-f-]+$/i);

          return HttpResponse.json({success: true, data: mockPipelineProgress });
      await pipelineService.getPipelineStatus('pipeline-123');
    });

  describe('response interceptors', () => {
    it('handles token refresh on 401', async () => {
      server.use(
        http.get('/api/pipeline/status/pipeline-123', ({ request }) => {
          const authHeader = request.headers.get('Authorization');

          if (authHeader === 'Bearer old-token') {
            return HttpResponse.json({success: false, error: 'Token expired' });
          }

          if (authHeader === 'Bearer new-token') {
            return HttpResponse.json({success: true, data: mockPipelineProgress });
          }

          return HttpResponse.json({success: false, error: 'Unauthorized' });
        }),
        http.post('/api/auth/refresh', () => {
          return HttpResponse.json({success: true, data: { token: 'new-token' } });
      localStorage.setItem('auth-token', 'old-token');

      const result = await pipelineService.getPipelineStatus('pipeline-123');

      expect(result.success).toBe(true);
      expect(localStorage.getItem('auth-token')).toBe('new-token');
    });

  describe('caching', () => {
    it('caches GET requests', async () => {
      let requestCount = 0;

      server.use(
        http.get('/api/pipeline/status/pipeline-123', ({ request }) => {
          requestCount++;
          return HttpResponse.json({success: true, data: mockPipelineProgress });
      // First request
      await pipelineService.getPipelineStatus('pipeline-123');
      expect(requestCount).toBe(1);

      // Second request should use cache
      await pipelineService.getPipelineStatus('pipeline-123');
      expect(requestCount).toBe(1);
    });

    it('invalidates cache after TTL', async () => {
      jest.useFakeTimers();
      let requestCount = 0;

      server.use(
        http.get('/api/pipeline/status/pipeline-123', ({ request }) => {
          requestCount++;
          return HttpResponse.json({success: true, data: mockPipelineProgress });
      // First request
      await pipelineService.getPipelineStatus('pipeline-123');
      expect(requestCount).toBe(1);

      // Advance time beyond cache TTL (5 minutes)
      jest.advanceTimersByTime(5 * 60 * 1000 + 1000);

      // Second request should make new API call
      await pipelineService.getPipelineStatus('pipeline-123');
      expect(requestCount).toBe(2);

      jest.useRealTimers();
    });

    it('does not cache error responses', async () => {
      let requestCount = 0;

      server.use(
        http.get('/api/pipeline/status/pipeline-123', ({ request }) => {
          requestCount++;
          return HttpResponse.json({success: false, error: 'Server error' });
      // First request (fails)
      await pipelineService.getPipelineStatus('pipeline-123');
      expect(requestCount).toBe(1);

      // Second request should not use cache for failed responses
      await pipelineService.getPipelineStatus('pipeline-123');
      expect(requestCount).toBeGreaterThan(1);
    });
});
