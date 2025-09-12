import { renderHook, act, waitFor } from '@/test/utils';
import { useProjects } from '../useProjects';
import { server } from '@/mocks/server';
import { http, HttpResponse } from 'msw';
import { StormProject } from '@/types/storm';

const mockProjects: StormProject[] = [
  {
    id: 'project-1',
    title: 'First Project',
    topic: 'Artificial Intelligence',
    description: 'An exploration of AI technologies',
    status: 'completed',
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
        apiKey: 'bing-key',
        maxResults: 10,
      },
      pipeline: {
        doResearch: true,
        doGenerateOutline: true,
        doGenerateArticle: true,
        doPolishArticle: true,
      },
    },
    outputDir: '/output/project-1',
  },
  {
    id: 'project-2',
    title: 'Second Project',
    topic: 'Climate Change',
    status: 'draft',
    createdAt: new Date('2024-01-03'),
    updatedAt: new Date('2024-01-03'),
    config: {
      llm: {
        model: 'gpt-3.5-turbo',
        provider: 'openai',
        temperature: 0.5,
      },
      retriever: {
        type: 'you',
        maxResults: 15,
      },
      pipeline: {
        doResearch: true,
        doGenerateOutline: true,
        doGenerateArticle: false,
        doPolishArticle: false,
      },
    },
    outputDir: '/output/project-2',
  },
];

describe('useProjects', () => {
  beforeEach(() => {
    server.resetHandlers();
  });

  describe('fetching projects', () => {
    it('fetches projects successfully', async () => {
      server.use(
        http.get('/api/projects', () => {
          return HttpResponse.json({success: true,
              data: {
                projects: mockProjects,
                total: mockProjects.length,
                page: 1,
                limit: 10,
              });
      const { result } = renderHook(() => useProjects());

      expect(result.current.isLoading).toBe(true);

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.projects).toEqual(mockProjects);
      expect(result.current.total).toBe(2);
      expect(result.current.error).toBeNull();
    });

    it('handles fetch errors', async () => {
      server.use(
        http.get('/api/projects', () => {
          return HttpResponse.json({success: false,
              error: 'Server error',});
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(result.current.projects).toEqual([]);
      expect(result.current.error).toBe('Server error');
    });

    it('supports pagination', async () => {
      server.use(
        http.get('/api/projects', ({ request }) => {
          const page = request.url.searchParams.get('page');
          const limit = request.url.searchParams.get('limit');

          expect(page).toBe('2');
          expect(limit).toBe('5');

          return HttpResponse.json({success: true,
              data: {
                projects: [mockProjects[1]],
                total: 2,
                page: 2,
                limit: 5,
              });
      const { result } = renderHook(() => useProjects({ page: 2, limit: 5 });

      await waitFor(() => {
        expect(result.current.projects).toEqual([mockProjects[1]]);
        expect(result.current.currentPage).toBe(2);
      });

    it('supports filtering by status', async () => {
      server.use(
        http.get('/api/projects', ({ request }) => {
          const status = request.url.searchParams.get('status');
          expect(status).toBe('completed');

          return HttpResponse.json({success: true,
              data: {
                projects: [mockProjects[0]],
                total: 1,
                page: 1,
                limit: 10,
              });
      const { result } = renderHook(() =>
        useProjects({ filters: { status: ['completed'] } });
      await waitFor(() => {
        expect(result.current.projects).toEqual([mockProjects[0]]);
      });

    it('supports search query', async () => {
      server.use(
        http.get('/api/projects', ({ request }) => {
          const search = request.url.searchParams.get('search');
          expect(search).toBe('AI');

          return HttpResponse.json({success: true,
              data: {
                projects: [mockProjects[0]],
                total: 1,
                page: 1,
                limit: 10,
              });
      const { result } = renderHook(() =>
        useProjects({ filters: { searchQuery: 'AI' } });
      await waitFor(() => {
        expect(result.current.projects).toEqual([mockProjects[0]]);
      });

  describe('creating projects', () => {
    it('creates project successfully', async () => {
      const newProject = {
        title: 'New Project',
        topic: 'Machine Learning',
        description: 'ML project description',
        config: mockProjects[0].config,
      };

      const createdProject = {
        ...newProject,
        id: 'project-3',
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        outputDir: '/output/project-3',
      };

      server.use(
        http.post('/api/projects', () => {
          return HttpResponse.json({success: true,
              data: createdProject,});
      const { result } = renderHook(() => useProjects());

      await act(async () => {
        const response = await result.current.createProject(newProject);
        expect(response.success).toBe(true);
        expect(response.data.id).toBe('project-3');
      });

      expect(result.current.isCreating).toBe(false);
    });

    it('handles create errors', async () => {
      server.use(
        http.post('/api/projects', () => {
          return HttpResponse.json({success: false,
              error: 'Invalid project data',});
      const { result } = renderHook(() => useProjects());

      await act(async () => {
        const response = await result.current.createProject({} as any);
        expect(response.success).toBe(false);
        expect(response.error).toBe('Invalid project data');
      });

    it('validates project data before creating', async () => {
      const { result } = renderHook(() => useProjects());

      await act(async () => {
        const response = await result.current.createProject({
          title: '', // Invalid empty title
          topic: 'Test',
          config: mockProjects[0].config,
        });
        expect(response.success).toBe(false);
        expect(response.error).toContain('Title is required');
      });

  describe('updating projects', () => {
    it('updates project successfully', async () => {
      const updatedProject = {
        ...mockProjects[0],
        title: 'Updated Title',
        updatedAt: new Date(),
      };

      server.use(
        http.put('/api/projects/:id', ({ request }) => {
          expect(request.params.id).toBe('project-1');

          return HttpResponse.json({success: true,
              data: updatedProject,});
      const { result } = renderHook(() => useProjects());

      await act(async () => {
        const response = await result.current.updateProject('project-1', {
          title: 'Updated Title',
        });
        expect(response.success).toBe(true);
        expect(response.data.title).toBe('Updated Title');
      });

      expect(result.current.isUpdating).toBe(false);
    });

    it('handles update errors', async () => {
      server.use(
        http.put('/api/projects/:id', () => {
          return HttpResponse.json({success: false,
              error: 'Project not found',});
      const { result } = renderHook(() => useProjects());

      await act(async () => {
        const response = await result.current.updateProject('invalid-id', {
          title: 'New Title',
        });
        expect(response.success).toBe(false);
        expect(response.error).toBe('Project not found');
      });

  describe('deleting projects', () => {
    it('deletes project successfully', async () => {
      server.use(
        http.delete('/api/projects/:id', ({ request }) => {
          expect(request.params.id).toBe('project-1');

          return HttpResponse.json({success: true,
              data: { id: 'project-1' });
      const { result } = renderHook(() => useProjects());

      await act(async () => {
        const response = await result.current.deleteProject('project-1');
        expect(response.success).toBe(true);
      });

      expect(result.current.isDeleting).toBe(false);
    });

    it('handles delete errors', async () => {
      server.use(
        http.delete('/api/projects/:id', () => {
          return HttpResponse.json({success: false,
              error: 'Cannot delete project in progress',});
      const { result } = renderHook(() => useProjects());

      await act(async () => {
        const response = await result.current.deleteProject('project-1');
        expect(response.success).toBe(false);
        expect(response.error).toBe('Cannot delete project in progress');
      });

    it('requires confirmation for deletion', async () => {
      const { result } = renderHook(() => useProjects());

      await act(async () => {
        const response = await result.current.deleteProject('project-1', {
          skipConfirmation: false,
        });
        expect(response.success).toBe(false);
        expect(response.error).toContain('confirmation required');
      });

  describe('duplicating projects', () => {
    it('duplicates project successfully', async () => {
      const duplicatedProject = {
        ...mockProjects[0],
        id: 'project-1-copy',
        title: 'First Project (Copy)',
        status: 'draft' as const,
        createdAt: new Date(),
        updatedAt: new Date(),
        outputDir: '/output/project-1-copy',
      };

      server.use(
        http.post('/api/projects/:id/duplicate', ({ request }) => {
          expect(request.params.id).toBe('project-1');

          return HttpResponse.json({success: true,
              data: duplicatedProject,});
      const { result } = renderHook(() => useProjects());

      await act(async () => {
        const response = await result.current.duplicateProject('project-1');
        expect(response.success).toBe(true);
        expect(response.data.title).toBe('First Project (Copy)');
      });

    it('handles duplicate errors', async () => {
      server.use(
        http.post('/api/projects/:id/duplicate', () => {
          return HttpResponse.json({success: false,
              error: 'Original project not found',});
      const { result } = renderHook(() => useProjects());

      await act(async () => {
        const response = await result.current.duplicateProject('invalid-id');
        expect(response.success).toBe(false);
        expect(response.error).toBe('Original project not found');
      });

  describe('archiving projects', () => {
    it('archives project successfully', async () => {
      server.use(
        http.post('/api/projects/:id/archive', ({ request }) => {
          expect(request.params.id).toBe('project-1');

          return HttpResponse.json({success: true,
              data: { id: 'project-1', archived: true });
      const { result } = renderHook(() => useProjects());

      await act(async () => {
        const response = await result.current.archiveProject('project-1');
        expect(response.success).toBe(true);
      });

    it('unarchives project successfully', async () => {
      server.use(
        http.post('/api/projects/:id/unarchive', ({ request }) => {
          expect(request.params.id).toBe('project-1');

          return HttpResponse.json({success: true,
              data: { id: 'project-1', archived: false });
      const { result } = renderHook(() => useProjects());

      await act(async () => {
        const response = await result.current.unarchiveProject('project-1');
        expect(response.success).toBe(true);
      });

  describe('refresh functionality', () => {
    it('refreshes projects list', async () => {
      server.use(
        http.get('/api/projects', () => {
          return HttpResponse.json({success: true,
              data: {
                projects: mockProjects,
                total: mockProjects.length,
                page: 1,
                limit: 10,
              });
      const { result } = renderHook(() => useProjects());

      // Wait for initial load
      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Refresh
      await act(async () => {
        await result.current.refetch();
      });

      expect(result.current.projects).toEqual(mockProjects);
    });

    it('handles refresh errors gracefully', async () => {
      // Initial successful load
      server.use(
        http.get('/api/projects', () => {
          return HttpResponse.json({success: true,
              data: {
                projects: mockProjects,
                total: mockProjects.length,
                page: 1,
                limit: 10,
              });
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mock refresh failure
      server.use(
        http.get('/api/projects', () => {
          return HttpResponse.json({success: false,
              error: 'Refresh failed',});
      await act(async () => {
        await result.current.refetch();
      });

      // Should preserve existing data and set error
      expect(result.current.projects).toEqual(mockProjects);
      expect(result.current.error).toBe('Refresh failed');
    });

  describe('optimistic updates', () => {
    it('optimistically updates project title', async () => {
      // Set up initial projects
      server.use(
        http.get('/api/projects', () => {
          return HttpResponse.json({success: true,
              data: {
                projects: mockProjects,
                total: mockProjects.length,
                page: 1,
                limit: 10,
              });
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Mock slow update
      server.use(
        http.put('/api/projects/:id', async () => {
          await new Promise(resolve => setTimeout(resolve(1000),
            {
              success: true,
              data: {
                ...mockProjects[0],
                title: 'Updated Title',
              },
            });
      act(() => {
        result.current.updateProject(
          'project-1',
          {
            title: 'Updated Title',
          },
          { optimistic: true }
        );
      });

      // Should immediately show optimistic update
      const updatedProject = result.current.projects.find(
        p => p.id === 'project-1'
      );
      expect(updatedProject?.title).toBe('Updated Title');
    });

    it('reverts optimistic updates on failure', async () => {
      server.use(
        http.get('/api/projects', () => {
          return HttpResponse.json({success: true,
              data: {
                projects: mockProjects,
                total: mockProjects.length,
                page: 1,
                limit: 10,
              });
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      const originalTitle = mockProjects[0].title;

      // Mock failed update
      server.use(
        http.put('/api/projects/:id', () => {
          return HttpResponse.json({success: false,
              error: 'Update failed',});
      await act(async () => {
        await result.current.updateProject(
          'project-1',
          {
            title: 'Failed Update',
          },
          { optimistic: true }
        );
      });

      // Should revert to original title
      const project = result.current.projects.find(p => p.id === 'project-1');
      expect(project?.title).toBe(originalTitle);
    });

  describe('caching', () => {
    it('caches project data', async () => {
      let requestCount = 0;

      server.use(
        http.get('/api/projects', ({ request }) => {
          requestCount++;
          return HttpResponse.json({success: true,
              data: {
                projects: mockProjects,
                total: mockProjects.length,
                page: 1,
                limit: 10,
              });
      const { result, rerender } = renderHook(() => useProjects();

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      // Rerender should not trigger new request
      rerender();

      expect(requestCount).toBe(1);
      expect(result.current.projects).toEqual(mockProjects);
    });

    it('invalidates cache on mutations', async () => {
      let getRequestCount = 0;

      server.use(
        http.get('/api/projects', () => {
          getRequestCount++;
          return HttpResponse.json({success: true,
              data: {
                projects: mockProjects,
                total: mockProjects.length,
                page: 1,
                limit: 10,
              });
        }),
        http.post('/api/projects', () => {
          return HttpResponse.json({success: true,
              data: { id: 'new-project' });
      const { result } = renderHook(() => useProjects());

      await waitFor(() => {
        expect(result.current.isLoading).toBe(false);
      });

      expect(getRequestCount).toBe(1);

      // Create new project should invalidate cache
      await act(async () => {
        await result.current.createProject({
          title: 'New Project',
          topic: 'New Topic',
          config: mockProjects[0].config,
        });

      // Should trigger new request to refresh data
      await waitFor(() => {
        expect(getRequestCount).toBe(2);
      });
});
