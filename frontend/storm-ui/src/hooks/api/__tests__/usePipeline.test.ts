import { renderHook, act, waitFor } from '@/test/utils';
import { usePipeline } from '../usePipeline';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';

const mockProject = {
  id: 'test-project-1',
  title: 'Test Article',
  topic: 'Test Topic',
  status: 'draft' as const,
  createdAt: new Date('2024-01-01'),
  updatedAt: new Date('2024-01-02'),
  config: {
    llm: {
      model: 'gpt-4o',
      provider: 'openai' as const,
      apiKey: 'test-key',
      temperature: 0.7,
    },
    retriever: {
      type: 'bing' as const,
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

describe('usePipeline', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  describe('startPipeline', () => {
    it('starts pipeline successfully', async () => {
      server.use(
        http.post('/api/pipeline/start', () => {
          return HttpResponse.json({
            success: true,
            data: {
              pipelineId: 'pipeline-123',
              status: 'initializing',
            },
          });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.startPipeline(mockProject);
        expect(response.success).toBe(true);
        expect(response.data.pipelineId).toBe('pipeline-123');
      });

      expect(result.current.isStarting).toBe(false);
    });

    it('handles start pipeline errors', async () => {
      server.use(
        http.post('/api/pipeline/start', () => {
          return HttpResponse.json({
            success: false,
            error: 'Invalid configuration',
          });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.startPipeline(mockProject);
        expect(response.success).toBe(false);
        expect(response.error).toBe('Invalid configuration');
      });

      expect(result.current.error).toBe('Invalid configuration');
      expect(result.current.isStarting).toBe(false);
    });

    it('sets loading state during pipeline start', async () => {
      server.use(
        http.post('/api/pipeline/start', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({
            success: true,
            data: { pipelineId: 'pipeline-123' },
          });
        })
      );

      const { result } = renderHook(() => usePipeline());

      act(() => {
        result.current.startPipeline(mockProject);
      });

      expect(result.current.isStarting).toBe(true);

      await waitFor(() => {
        expect(result.current.isStarting).toBe(false);
      });
    });

    it('validates project config before starting', async () => {
      const invalidProject = {
        ...mockProject,
        config: {
          ...mockProject.config,
          llm: {
            ...mockProject.config.llm,
            apiKey: '', // Missing API key
          },
        },
      };

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.startPipeline(invalidProject);
        expect(response.success).toBe(false);
        expect(response.error).toContain('API key is required');
      });
    });
  });

  describe('stopPipeline', () => {
    it('stops pipeline successfully', async () => {
      server.use(
        http.post('/api/pipeline/stop', () => {
          return HttpResponse.json({
            success: true,
            data: { status: 'stopped' },
          });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.stopPipeline('pipeline-123');
        expect(response.success).toBe(true);
      });

      expect(result.current.isStopping).toBe(false);
    });

    it('handles stop pipeline errors', async () => {
      server.use(
        http.post('/api/pipeline/stop', () => {
          return HttpResponse.json({
            success: false,
            error: 'Pipeline not found',
          });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.stopPipeline('invalid-pipeline');
        expect(response.success).toBe(false);
        expect(response.error).toBe('Pipeline not found');
      });
    });
  });

  describe('getPipelineStatus', () => {
    it('fetches pipeline status successfully', async () => {
      const mockProgress = {
        stage: 'research' as const,
        stageProgress: 45,
        overallProgress: 25,
        startTime: new Date('2024-01-01T10:00:00'),
        currentTask: 'Conducting perspective research...',
        errors: [],
      };

      server.use(
        http.get('/api/pipeline/status/:pipelineId', () => {
          return HttpResponse.json({
            success: true,
            data: mockProgress,
          });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.getPipelineStatus('pipeline-123');
        expect(response.success).toBe(true);
        expect(response.data.stage).toBe('research');
        expect(response.data.stageProgress).toBe(45);
      });
    });

    it('handles status fetch errors', async () => {
      server.use(
        http.get('/api/pipeline/status/:pipelineId', () => {
          return HttpResponse.json({
            success: false,
            error: 'Pipeline not found',
          });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response =
          await result.current.getPipelineStatus('invalid-pipeline');
        expect(response.success).toBe(false);
        expect(response.error).toBe('Pipeline not found');
      });
    });
  });

  describe('getPipelineLogs', () => {
    it('fetches pipeline logs successfully', async () => {
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

      server.use(
        http.get('/api/pipeline/logs/:pipelineId', () => {
          return HttpResponse.json({
            success: true,
            data: mockLogs,
          });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.getPipelineLogs('pipeline-123');
        expect(response.success).toBe(true);
        expect(response.data).toHaveLength(2);
        expect(response.data[0].message).toBe('Starting research phase');
      });
    });

    it('filters logs by level', async () => {
      server.use(
        http.get('/api/pipeline/logs/:pipelineId', ({ request }) => {
          const level = request.url.searchParams.get('level');
          expect(level).toBe('error');

          return HttpResponse.json({
            success: true,
            data: [
              {
                timestamp: new Date(),
                level: 'error',
                message: 'API rate limit exceeded',
                stage: 'research',
              },
            ],
          });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.getPipelineLogs('pipeline-123', {
          level: 'error',
        });
        expect(response.success).toBe(true);
        expect(response.data[0].level).toBe('error');
      });
    });
  });

  describe('pausePipeline', () => {
    it('pauses pipeline successfully', async () => {
      server.use(
        http.post('/api/pipeline/pause', () => {
          return HttpResponse.json({
            success: true,
            data: { status: 'paused' },
          });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.pausePipeline('pipeline-123');
        expect(response.success).toBe(true);
      });
    });

    it('resumes pipeline successfully', async () => {
      server.use(
        http.post('/api/pipeline/resume', () => {
          return HttpResponse.json({
            success: true,
            data: { status: 'running' },
          });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.resumePipeline('pipeline-123');
        expect(response.success).toBe(true);
      });
    });
  });

  describe('retry functionality', () => {
    it('retries failed requests', async () => {
      let attemptCount = 0;

      server.use(
        http.post('/api/pipeline/start', () => {
          attemptCount++;

          if (attemptCount < 3) {
            return HttpResponse.json({success: false, error: 'Server error' });
          }

          return HttpResponse.json({success: true, data: { pipelineId: 'pipeline-123' } });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.startPipeline(mockProject, {
          retries: 3,
          retryDelay: 10,
        });
        expect(response.success).toBe(true);
      });

      expect(attemptCount).toBe(3);
    });

    it('gives up after max retries', async () => {
      server.use(
        http.post('/api/pipeline/start', () => {
          return HttpResponse.json({success: false, error: 'Server error' });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.startPipeline(mockProject, {
          retries: 2,
          retryDelay: 10,
        });
        expect(response.success).toBe(false);
        expect(response.error).toBe('Server error');
      });
    });
  });

  describe('concurrent operations', () => {
    it('prevents multiple simultaneous starts', async () => {
      server.use(
        http.post('/api/pipeline/start', async () => {
          await new Promise(resolve => setTimeout(resolve, 100));
          return HttpResponse.json({ success: true, data: { pipelineId: 'pipeline-123' } });
        })
      );

      const { result } = renderHook(() => usePipeline());

      act(() => {
        result.current.startPipeline(mockProject);
      });

      expect(result.current.isStarting).toBe(true);

      await act(async () => {
        const response = await result.current.startPipeline(mockProject);
        expect(response.success).toBe(false);
        expect(response.error).toContain('already starting');
      });
    });

    it('allows start after previous operation completes', async () => {
      server.use(
        http.post('/api/pipeline/start', () => {
          return HttpResponse.json({success: true, data: { pipelineId: 'pipeline-123' } });
        })
      );

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        await result.current.startPipeline(mockProject);
      });

      expect(result.current.isStarting).toBe(false);

      await act(async () => {
        const response = await result.current.startPipeline(mockProject);
        expect(response.success).toBe(true);
      });
    });
  });

  describe('cleanup', () => {
    it('cancels pending requests on unmount', async () => {
      server.use(
        http.post('/api/pipeline/start', async () => {
          await new Promise(resolve => setTimeout(resolve, 1000));
          return HttpResponse.json({ success: true, data: { pipelineId: 'pipeline-123' } });
        })
      );

      const { result, unmount } = renderHook(() => usePipeline());

      act(() => {
        result.current.startPipeline(mockProject);
      });

      expect(result.current.isStarting).toBe(true);

      unmount();
      // Should not throw any errors or warnings about setting state after unmount
    });
  });

  describe('error recovery', () => {
    it('clears errors when starting new pipeline', async () => {
      server.use(
        http.post('/api/pipeline/start', ({ request }) => {
          return HttpResponse.json({success: false, error: 'Initial error' });
        })
      );

      const { result } = renderHook(() => usePipeline());

      // First request fails
      await act(async () => {
        await result.current.startPipeline(mockProject);
      });

      expect(result.current.error).toBe('Initial error');

      // Mock successful response
      server.use(
        http.post('/api/pipeline/start', ({ request }) => {
          return HttpResponse.json({success: true, data: { pipelineId: 'pipeline-123' } });
        })
      );

      // Second request succeeds and clears error
      await act(async () => {
        await result.current.startPipeline(mockProject);
      });

      expect(result.current.error).toBeNull();
    });
  });

  describe('configuration validation', () => {
    it('validates LLM configuration', async () => {
      const invalidProject = {
        ...mockProject,
        config: {
          ...mockProject.config,
          llm: {
            ...mockProject.config.llm,
            temperature: 2.0, // Invalid temperature
          },
        },
      };

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.startPipeline(invalidProject);
        expect(response.success).toBe(false);
        expect(response.error).toContain('temperature must be between 0 and 1');
      });
    });

    it('validates retriever configuration', async () => {
      const invalidProject = {
        ...mockProject,
        config: {
          ...mockProject.config,
          retriever: {
            ...mockProject.config.retriever,
            maxResults: -1, // Invalid max results
          },
        },
      };

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.startPipeline(invalidProject);
        expect(response.success).toBe(false);
        expect(response.error).toContain('maxResults must be positive');
      });
    });

    it('validates pipeline configuration', async () => {
      const invalidProject = {
        ...mockProject,
        config: {
          ...mockProject.config,
          pipeline: {
            ...mockProject.config.pipeline,
            doResearch: false,
            doGenerateOutline: false,
            doGenerateArticle: false,
            doPolishArticle: false,
          },
        },
      };

      const { result } = renderHook(() => usePipeline());

      await act(async () => {
        const response = await result.current.startPipeline(invalidProject);
        expect(response.success).toBe(false);
        expect(response.error).toContain(
          'at least one pipeline step must be enabled'
        );
      });
    });
  });
});
