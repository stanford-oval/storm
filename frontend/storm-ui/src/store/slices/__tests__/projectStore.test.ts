import { act, renderHook } from '@/test/utils';
import { create } from 'zustand';
import { projectSlice, ProjectSlice } from '../projectStore';
import { StormProject, ProjectFilters } from '@/types/storm';

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

// Create store factory for testing
const createTestStore = (initialState?: Partial<ProjectSlice>) => {
  return create<ProjectSlice>()((set, get, api) => ({
    ...projectSlice(set, get, api),
    ...initialState,
  }));
};

describe('projectStore', () => {
  describe('initial state', () => {
    it('has correct initial state', () => {
      const { result } = renderHook(() => createTestStore());
      const state = result.current;

      expect(state.projects).toEqual([]);
      expect(state.currentProject).toBeNull();
      expect(state.isLoading).toBe(false);
      expect(state.error).toBeNull();
      expect(state.filters).toEqual({});
      expect(state.sortBy).toBe('updatedAt');
      expect(state.sortOrder).toBe('desc');
      expect(state.pagination).toEqual({
        page: 1,
        limit: 10,
        total: 0,
      });

  describe('project management', () => {
    it('sets projects', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      expect(result.current.projects).toEqual(mockProjects);
    });

    it('adds a new project', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects([mockProjects[0]]);
      });

      const newProject = { ...mockProjects[1] };

      act(() => {
        result.current.addProject(newProject);
      });

      expect(result.current.projects).toHaveLength(2);
      expect(result.current.projects).toContainEqual(newProject);
    });

    it('updates existing project', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      const updatedTitle = 'Updated Project Title';

      act(() => {
        result.current.updateProject('project-1', { title: updatedTitle });

      const updatedProject = result.current.projects.find(
        p => p.id === 'project-1'
      );
      expect(updatedProject?.title).toBe(updatedTitle);
    });

    it('removes project', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      act(() => {
        result.current.removeProject('project-1');
      });

      expect(result.current.projects).toHaveLength(1);
      expect(
        result.current.projects.find(p => p.id === 'project-1')
      ).toBeUndefined();
    });

    it('sets current project', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      act(() => {
        result.current.setCurrentProject('project-1');
      });

      expect(result.current.currentProject).toEqual(mockProjects[0]);
    });

    it('clears current project', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.setCurrentProject('project-1');
      });

      expect(result.current.currentProject).not.toBeNull();

      act(() => {
        result.current.clearCurrentProject();
      });

      expect(result.current.currentProject).toBeNull();
    });

  describe('loading and error states', () => {
    it('sets loading state', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setLoading(true);
      });

      expect(result.current.isLoading).toBe(true);

      act(() => {
        result.current.setLoading(false);
      });

      expect(result.current.isLoading).toBe(false);
    });

    it('sets error state', () => {
      const { result } = renderHook(() => createTestStore());
      const error = 'Something went wrong';

      act(() => {
        result.current.setError(error);
      });

      expect(result.current.error).toBe(error);
    });

    it('clears error state', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setError('Initial error');
      });

      expect(result.current.error).toBe('Initial error');

      act(() => {
        result.current.clearError();
      });

      expect(result.current.error).toBeNull();
    });

  describe('filtering', () => {
    it('sets filters', () => {
      const { result } = renderHook(() => createTestStore());
      const filters: ProjectFilters = {
        status: ['completed', 'draft'],
        searchQuery: 'AI',
      };

      act(() => {
        result.current.setFilters(filters);
      });

      expect(result.current.filters).toEqual(filters);
    });

    it('gets filtered projects by status', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.setFilters({ status: ['completed'] });

      const filteredProjects = result.current.getFilteredProjects();

      expect(filteredProjects).toHaveLength(1);
      expect(filteredProjects[0].status).toBe('completed');
    });

    it('gets filtered projects by search query', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.setFilters({ searchQuery: 'AI' });

      const filteredProjects = result.current.getFilteredProjects();

      expect(filteredProjects).toHaveLength(1);
      expect(filteredProjects[0].title).toContain('AI');
    });

    it('gets filtered projects by date range', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.setFilters({
          dateRange: {
            start: new Date('2024-01-01'),
            end: new Date('2024-01-02'),
          },
        });

      const filteredProjects = result.current.getFilteredProjects();

      expect(filteredProjects).toHaveLength(1);
      expect(filteredProjects[0].id).toBe('project-1');
    });

    it('combines multiple filters', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.setFilters({
          status: ['completed'],
          searchQuery: 'First',
        });

      const filteredProjects = result.current.getFilteredProjects();

      expect(filteredProjects).toHaveLength(1);
      expect(filteredProjects[0].id).toBe('project-1');
    });

    it('clears filters', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setFilters({ status: ['completed'] });

      expect(result.current.filters).toEqual({ status: ['completed'] });

      act(() => {
        result.current.clearFilters();
      });

      expect(result.current.filters).toEqual({});

  describe('sorting', () => {
    it('sets sort criteria', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setSorting('title', 'asc');
      });

      expect(result.current.sortBy).toBe('title');
      expect(result.current.sortOrder).toBe('asc');
    });

    it('gets sorted projects by title ascending', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.setSorting('title', 'asc');
      });

      const sortedProjects = result.current.getSortedProjects();

      expect(sortedProjects[0].title).toBe('First Project');
      expect(sortedProjects[1].title).toBe('Second Project');
    });

    it('gets sorted projects by title descending', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.setSorting('title', 'desc');
      });

      const sortedProjects = result.current.getSortedProjects();

      expect(sortedProjects[0].title).toBe('Second Project');
      expect(sortedProjects[1].title).toBe('First Project');
    });

    it('gets sorted projects by date', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.setSorting('createdAt', 'desc');
      });

      const sortedProjects = result.current.getSortedProjects();

      expect(sortedProjects[0].id).toBe('project-2'); // More recent
      expect(sortedProjects[1].id).toBe('project-1');
    });

    it('gets sorted projects by status', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.setSorting('status', 'asc');
      });

      const sortedProjects = result.current.getSortedProjects();

      // 'completed' comes before 'draft' alphabetically
      expect(sortedProjects[0].status).toBe('completed');
      expect(sortedProjects[1].status).toBe('draft');
    });

  describe('pagination', () => {
    it('sets pagination', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setPagination({ page: 2, limit: 5, total: 20 });

      expect(result.current.pagination).toEqual({
        page: 2,
        limit: 5,
        total: 20,
      });

    it('gets paginated projects', () => {
      const { result } = renderHook(() => createTestStore());

      // Create more projects for pagination testing
      const moreProjects = Array.from({ length: 15 }, (_, i) => ({
        ...mockProjects[0],
        id: `project-${i + 1}`,
        title: `Project ${i + 1}`,
      }));

      act(() => {
        result.current.setProjects(moreProjects);
        result.current.setPagination({ page: 2, limit: 5, total: 15 });
      });

      const paginatedProjects = result.current.getPaginatedProjects();

      expect(paginatedProjects).toHaveLength(5);
      // Should be projects 6-10 (page 2, limit 5)
      expect(paginatedProjects[0].id).toBe('project-6');
      expect(paginatedProjects[4].id).toBe('project-10');
    });

    it('handles last page with fewer items', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects); // Only 2 projects
        result.current.setPagination({ page: 2, limit: 5, total: 2 });

      const paginatedProjects = result.current.getPaginatedProjects();

      expect(paginatedProjects).toHaveLength(0); // No projects on page 2
    });

  describe('project queries', () => {
    it('finds project by id', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      const project = result.current.getProjectById('project-1');

      expect(project).toEqual(mockProjects[0]);
    });

    it('returns undefined for non-existent project', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      const project = result.current.getProjectById('non-existent');

      expect(project).toBeUndefined();
    });

    it('gets projects by status', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      const completedProjects = result.current.getProjectsByStatus('completed');
      const draftProjects = result.current.getProjectsByStatus('draft');

      expect(completedProjects).toHaveLength(1);
      expect(completedProjects[0].status).toBe('completed');
      expect(draftProjects).toHaveLength(1);
      expect(draftProjects[0].status).toBe('draft');
    });

    it('searches projects by title and topic', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      const aiProjects = result.current.searchProjects('AI');
      const climateProjects = result.current.searchProjects('Climate');

      expect(aiProjects).toHaveLength(1);
      expect(aiProjects[0].topic).toContain('Intelligence');
      expect(climateProjects).toHaveLength(1);
      expect(climateProjects[0].topic).toContain('Climate');
    });

    it('searches projects case-insensitively', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      const results = result.current.searchProjects('first');

      expect(results).toHaveLength(1);
      expect(results[0].title).toBe('First Project');
    });

  describe('bulk operations', () => {
    it('selects multiple projects', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      act(() => {
        result.current.selectProject('project-1');
        result.current.selectProject('project-2');
      });

      expect(result.current.selectedProjects).toEqual([
        'project-1',
        'project-2',
      ]);
    });

    it('deselects projects', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.selectProject('project-1');
        result.current.selectProject('project-2');
      });

      act(() => {
        result.current.deselectProject('project-1');
      });

      expect(result.current.selectedProjects).toEqual(['project-2']);
    });

    it('selects all projects', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      act(() => {
        result.current.selectAllProjects();
      });

      expect(result.current.selectedProjects).toEqual([
        'project-1',
        'project-2',
      ]);
    });

    it('clears all selections', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.selectAllProjects();
      });

      expect(result.current.selectedProjects).toHaveLength(2);

      act(() => {
        result.current.clearSelection();
      });

      expect(result.current.selectedProjects).toEqual([]);
    });

    it('deletes selected projects', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.selectProject('project-1');
      });

      act(() => {
        result.current.deleteSelectedProjects();
      });

      expect(result.current.projects).toHaveLength(1);
      expect(result.current.projects[0].id).toBe('project-2');
      expect(result.current.selectedProjects).toEqual([]);
    });

  describe('computed values', () => {
    it('computes project statistics', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      const stats = result.current.getProjectStats();

      expect(stats.total).toBe(2);
      expect(stats.completed).toBe(1);
      expect(stats.draft).toBe(1);
      expect(stats.researching).toBe(0);
      expect(stats.generating_outline).toBe(0);
      expect(stats.writing_article).toBe(0);
      expect(stats.polishing).toBe(0);
      expect(stats.failed).toBe(0);
    });

    it('computes recent projects', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      const recentProjects = result.current.getRecentProjects(1);

      expect(recentProjects).toHaveLength(1);
      expect(recentProjects[0].id).toBe('project-2'); // Most recent
    });

    it('checks if store has projects', () => {
      const { result } = renderHook(() => createTestStore());

      expect(result.current.hasProjects()).toBe(false);

      act(() => {
        result.current.setProjects(mockProjects);
      });

      expect(result.current.hasProjects()).toBe(true);
    });

    it('checks if project is selected', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.selectProject('project-1');
      });

      expect(result.current.isProjectSelected('project-1')).toBe(true);
      expect(result.current.isProjectSelected('project-2')).toBe(false);
    });

  describe('persistence', () => {
    it('resets store to initial state', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
        result.current.setCurrentProject('project-1');
        result.current.setFilters({ status: ['completed'] });
        result.current.selectProject('project-1');
      });

      // Verify state has changed
      expect(result.current.projects).toHaveLength(2);
      expect(result.current.currentProject).not.toBeNull();
      expect(result.current.selectedProjects).toHaveLength(1);

      act(() => {
        result.current.reset();
      });

      // Verify state is reset
      expect(result.current.projects).toEqual([]);
      expect(result.current.currentProject).toBeNull();
      expect(result.current.filters).toEqual({});
      expect(result.current.selectedProjects).toEqual([]);
      expect(result.current.error).toBeNull();
    });

  describe('optimistic updates', () => {
    it('handles optimistic project updates', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      const updatedTitle = 'Optimistically Updated Title';

      act(() => {
        result.current.optimisticUpdateProject('project-1', {
          title: updatedTitle,
        });

      const project = result.current.getProjectById('project-1');
      expect(project?.title).toBe(updatedTitle);
    });

    it('reverts optimistic updates on error', () => {
      const { result } = renderHook(() => createTestStore());

      act(() => {
        result.current.setProjects(mockProjects);
      });

      const originalTitle = mockProjects[0].title;
      const updatedTitle = 'Optimistically Updated Title';

      act(() => {
        result.current.optimisticUpdateProject('project-1', {
          title: updatedTitle,
        });

      expect(result.current.getProjectById('project-1')?.title).toBe(
        updatedTitle
      );

      act(() => {
        result.current.revertOptimisticUpdate('project-1');
      });

      expect(result.current.getProjectById('project-1')?.title).toBe(
        originalTitle
      );
    });
  });
  });
  });
  });
  });
  });
  });
  });
  });
  });
  });
});
