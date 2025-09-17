// Project management store slice
import { create } from 'zustand';
import { ProjectState, ProjectFilters, ProjectSortField } from '../types';
import {
  StormProject,
  StormConfig,
  ProjectStatus,
  CreateProjectFormData,
} from '@/types/storm';
import { persist, createPartialize } from '../middleware/persist';
import { devtools } from '../middleware/devtools';
import { immer } from '../middleware/immer';
import { subscriptions } from '../middleware/subscriptions';
import { logger } from '@/utils/logger';
import { mapConfigToBackend, mapConfigFromBackend } from '@/utils/config-mapper';

// Initial state
const initialState: ProjectState = {
  projects: [],
  currentProject: null,
  selectedProjects: [],
  filters: {
    searchQuery: '',
  },
  sortBy: 'updatedAt',
  sortOrder: 'desc',
  pagination: {
    page: 1,
    limit: 100,
    total: 0,
  },
  recentProjects: [],
  loading: false,
  error: null,
  lastUpdated: null,
};

// Project store actions interface
interface ProjectActions {
  // Project CRUD operations
  createProject: (projectData: CreateProjectFormData) => Promise<StormProject>;
  updateProject: (
    projectId: string,
    updates: Partial<StormProject>
  ) => Promise<void>;
  deleteProject: (projectId: string) => Promise<void>;
  duplicateProject: (project: StormProject) => Promise<StormProject>;
  archiveProject: (projectId: string) => Promise<void>;
  restoreProject: (projectId: string) => Promise<void>;

  // Project loading
  loadProjects: (
    filters?: ProjectFilters,
    page?: number,
    limit?: number
  ) => Promise<void>;
  loadProject: (projectId: string) => Promise<StormProject>;
  refreshProjects: () => Promise<void>;

  // Project selection and navigation
  setCurrentProject: (project: StormProject | null) => void;
  selectProject: (projectId: string, multiSelect?: boolean) => void;
  deselectProject: (projectId: string) => void;
  selectAllProjects: () => void;
  deselectAllProjects: () => void;
  toggleProjectSelection: (projectId: string) => void;
  clearSelection: () => void;
  fetchProject: (projectId: string) => Promise<StormProject>;
  addToRecentProjects: (projectId: string) => void;

  // Filtering and sorting
  setFilters: (filters: Partial<ProjectFilters>) => void;
  clearFilters: () => void;
  setSortBy: (field: ProjectSortField, order?: 'asc' | 'desc') => void;
  setPagination: (page: number, limit?: number) => void;

  // Batch operations
  bulkUpdateStatus: (
    projectIds: string[],
    status: ProjectStatus
  ) => Promise<void>;
  bulkDelete: (projectIds: string[]) => Promise<void>;
  bulkArchive: (projectIds: string[]) => Promise<void>;

  // Search and filtering
  searchProjects: (query: string) => void;
  filterByStatus: (statuses: ProjectStatus[]) => void;
  filterByDateRange: (start: Date, end: Date) => void;
  filterByTags: (tags: string[]) => void;

  // Configuration management
  updateProjectConfig: (
    projectId: string,
    config: Partial<StormConfig>
  ) => Promise<void>;
  cloneProjectConfig: (
    sourceProjectId: string,
    targetProjectId: string
  ) => Promise<void>;
  exportProjectConfig: (projectId: string) => StormConfig | undefined;
  importProjectConfig: (
    projectId: string,
    config: StormConfig
  ) => Promise<void>;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// Project store type
export type ProjectStore = ProjectState & ProjectActions;

// Create project store
export const useProjectStore = create<ProjectStore>()(
  devtools(
    persist(
      subscriptions(
        immer<ProjectStore>((set, get) => ({
          // Initial state
          ...initialState,

          // Project CRUD operations
          createProject: async projectData => {
            logger.log('createProject called with:', projectData);
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const apiUrl =
                process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
              // Map frontend config to backend format
              const requestData = {
                title: projectData.title,
                topic: projectData.topic,
                config: mapConfigToBackend(projectData.config),
              };
              logger.log('Sending request to:', `${apiUrl}/projects/`);
              logger.log('Request data:', requestData);

              const response = await fetch(`${apiUrl}/projects/`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(requestData),
              });

              logger.log('Response status:', response.status);
              logger.log('Response ok:', response.ok);

              if (!response.ok) {
                const errorText = await response.text();
                logger.error('Error response:', errorText);
                throw new Error(`Failed to create project: ${errorText}`);
              }

              const responseData = await response.json();
              logger.log('API Response:', responseData);

              // Validate response
              if (!responseData || typeof responseData !== 'object') {
                logger.error('Invalid response data:', responseData);
                throw new Error('Invalid response from server');
              }

              if (!responseData.id) {
                logger.error('Response missing ID:', responseData);
                throw new Error('Server response missing project ID');
              }

              const newProject: StormProject = responseData;
              logger.log('New project object:', newProject);
              logger.log('Project ID:', newProject?.id);

              set(draft => {
                // Ensure projects array exists
                if (!draft.projects) {
                  draft.projects = [];
                }
                draft.projects.unshift(newProject);
                draft.currentProject = newProject;
                if (!draft.pagination) {
                  draft.pagination = { page: 1, limit: 100, total: 0 };
                }
                draft.pagination.total += 1;
                draft.loading = false;
                draft.lastUpdated = new Date();
              });

              // Ensure we have the ID before adding to recent
              if (newProject.id) {
                get().addToRecentProjects(newProject.id);
              }

              logger.log('About to return project:', newProject);
              logger.log('Return value is:', newProject);
              return newProject;
            } catch (error) {
              logger.error('Error in createProject:', error);
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to create project';
                draft.loading = false;
              });
              throw error;
            }
          },

          updateProject: async (projectId, updates) => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const apiUrl =
                process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
              const response = await fetch(`${apiUrl}/projects/${projectId}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
              });

              if (!response.ok) {
                throw new Error('Failed to update project');
              }

              const updatedProject: StormProject = await response.json();

              set(draft => {
                const index = draft.projects.findIndex(p => p.id === projectId);
                if (index !== -1) {
                  draft.projects[index] = updatedProject;
                }
                if (draft.currentProject?.id === projectId) {
                  draft.currentProject = updatedProject;
                }
                draft.loading = false;
                draft.lastUpdated = new Date();
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to update project';
                draft.loading = false;
              });
              throw error;
            }
          },

          deleteProject: async projectId => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const apiUrl =
                process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
              const response = await fetch(`${apiUrl}/projects/${projectId}`, {
                method: 'DELETE',
              });

              if (!response.ok) {
                throw new Error('Failed to delete project');
              }

              set(draft => {
                draft.projects = draft.projects.filter(p => p.id !== projectId);
                draft.selectedProjects = draft.selectedProjects.filter(
                  id => id !== projectId
                );
                draft.recentProjects = draft.recentProjects.filter(
                  id => id !== projectId
                );
                if (draft.currentProject?.id === projectId) {
                  draft.currentProject = null;
                }
                draft.pagination.total -= 1;
                draft.loading = false;
                draft.lastUpdated = new Date();
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to delete project';
                draft.loading = false;
              });
              throw error;
            }
          },

          duplicateProject: async project => {
            try {
              const apiUrl =
                process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

              const response = await fetch(
                `${apiUrl}/projects/${project.id}/duplicate`,
                {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    new_title: `${project.title} (Copy)`,
                  }),
                }
              );

              if (!response.ok) {
                const errorData = await response.json();
                throw new Error(
                  errorData.detail || 'Failed to duplicate project'
                );
              }

              const duplicatedProject = await response.json();

              // Add the duplicated project to the list
              set(draft => {
                draft.projects.unshift(duplicatedProject);
                draft.lastUpdated = new Date();
              });

              return duplicatedProject;
            } catch (error) {
              logger.error('Error duplicating project:', error);
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to duplicate project';
              });
              throw error;
            }
          },

          archiveProject: async projectId => {
            await get().updateProject(projectId, { status: 'completed' });
          },

          restoreProject: async projectId => {
            await get().updateProject(projectId, { status: 'draft' });
          },

          // Project loading
          loadProjects: async (filters, page = 1, limit = 100) => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const queryParams = new URLSearchParams({
                page: page.toString(),
                limit: limit.toString(),
                sortBy: get().sortBy,
                sortOrder: get().sortOrder,
              });

              if (filters?.searchQuery) {
                queryParams.append('search', filters.searchQuery);
              }
              if (filters?.status) {
                filters.status.forEach(status =>
                  queryParams.append('status', status)
                );
              }
              if (filters?.dateRange) {
                queryParams.append(
                  'startDate',
                  filters.dateRange.start.toISOString()
                );
                queryParams.append(
                  'endDate',
                  filters.dateRange.end.toISOString()
                );
              }

              const apiUrl =
                process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
              const response = await fetch(
                `${apiUrl}/projects/?${queryParams}`
              );

              if (!response.ok) {
                throw new Error('Failed to load projects');
              }

              const data = await response.json();

              // Map backend config to frontend format for each project
              if (data.projects) {
                data.projects = data.projects.map((project: any) => {
                  if (project.config) {
                    // Use the mapper function to handle both old flat and new nested formats
                    project.config = mapConfigFromBackend(project.config);
                  }
                  return project;
                });
              }

              set(draft => {
                draft.projects = data.projects;
                draft.pagination = {
                  page: data.page,
                  limit: data.limit,
                  total: data.total,
                };
                draft.loading = false;
                draft.lastUpdated = new Date();
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to load projects';
                draft.loading = false;
              });
              throw error;
            }
          },

          loadProject: async projectId => {
            try {
              const apiUrl =
                process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
              const response = await fetch(`${apiUrl}/projects/${projectId}`);

              if (!response.ok) {
                throw new Error('Project not found');
              }

              const project: StormProject = await response.json();

              // Map backend config to frontend format if config exists
              if (project.config) {
                // Check if it's backend format (has retriever_type or do_research fields)
                const isBackendFormat =
                  (project.config as any).retriever?.retriever_type !== undefined ||
                  (project.config as any).pipeline?.do_research !== undefined ||
                  (project.config as any).llm?.max_tokens !== undefined;

                if (isBackendFormat) {
                  project.config = mapConfigFromBackend(project.config);
                }
                // If already in frontend format, keep it as is
              }

              set(draft => {
                const index = draft.projects.findIndex(p => p.id === projectId);
                if (index !== -1) {
                  draft.projects[index] = project;
                } else {
                  draft.projects.unshift(project);
                }
                draft.currentProject = project;
                draft.lastUpdated = new Date();
              });

              get().addToRecentProjects(projectId);
              return project;
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to load project';
              });
              throw error;
            }
          },

          refreshProjects: async () => {
            const { filters, pagination } = get();
            await get().loadProjects(
              filters,
              pagination.page,
              pagination.limit
            );
          },

          // Project selection and navigation
          setCurrentProject: project => {
            set(draft => {
              draft.currentProject = project;
              if (project) {
                // Also update the project in the projects array
                const index = draft.projects.findIndex(
                  p => p.id === project.id
                );
                if (index !== -1) {
                  draft.projects[index] = project;
                }
                get().addToRecentProjects(project.id);
              }
            });
          },

          selectProject: (projectId, multiSelect = false) => {
            set(draft => {
              if (multiSelect) {
                if (!draft.selectedProjects.includes(projectId)) {
                  draft.selectedProjects.push(projectId);
                }
              } else {
                draft.selectedProjects = [projectId];
              }
            });
          },

          deselectProject: projectId => {
            set(draft => {
              draft.selectedProjects = draft.selectedProjects.filter(
                id => id !== projectId
              );
            });
          },

          selectAllProjects: () => {
            set(draft => {
              draft.selectedProjects = draft.projects.map(p => p.id);
            });
          },

          deselectAllProjects: () => {
            set(draft => {
              draft.selectedProjects = [];
            });
          },

          // Additional selection methods for compatibility
          toggleProjectSelection: (projectId: string) => {
            const store = get();
            if (store.selectedProjects.includes(projectId)) {
              store.deselectProject(projectId);
            } else {
              store.selectProject(projectId, true);
            }
          },

          clearSelection: () => {
            get().deselectAllProjects();
          },

          // Alias for loadProject
          fetchProject: async (projectId: string) => {
            return get().loadProject(projectId);
          },

          addToRecentProjects: projectId => {
            set(draft => {
              draft.recentProjects = [
                projectId,
                ...draft.recentProjects.filter(id => id !== projectId),
              ].slice(0, 10); // Keep only last 10
            });
          },

          // Filtering and sorting
          setFilters: filters => {
            set(draft => {
              Object.assign(draft.filters, filters);
              draft.pagination.page = 1; // Reset to first page
            });

            get().loadProjects(get().filters);
          },

          clearFilters: () => {
            set(draft => {
              draft.filters = { searchQuery: '' };
              draft.pagination.page = 1;
            });

            get().loadProjects();
          },

          setSortBy: (field, order = 'desc') => {
            set(draft => {
              draft.sortBy = field;
              draft.sortOrder = order;
              draft.pagination.page = 1;
            });

            get().loadProjects(get().filters);
          },

          setPagination: (page, limit) => {
            set(draft => {
              draft.pagination.page = page;
              if (limit) {
                draft.pagination.limit = limit;
              }
            });

            get().loadProjects(get().filters, page, limit);
          },

          // Batch operations
          bulkUpdateStatus: async (projectIds, status) => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const apiUrl =
                process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
              const response = await fetch(`${apiUrl}/projects/bulk-update`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectIds, updates: { status } }),
              });

              if (!response.ok) {
                throw new Error('Failed to update projects');
              }

              set(draft => {
                draft.projects = draft.projects.map(project =>
                  projectIds.includes(project.id)
                    ? { ...project, status, updatedAt: new Date() }
                    : project
                );
                draft.selectedProjects = [];
                draft.loading = false;
                draft.lastUpdated = new Date();
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to update projects';
                draft.loading = false;
              });
              throw error;
            }
          },

          bulkDelete: async projectIds => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const apiUrl =
                process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
              const response = await fetch(`${apiUrl}/projects/bulk-delete`, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectIds }),
              });

              if (!response.ok) {
                throw new Error('Failed to delete projects');
              }

              set(draft => {
                draft.projects = draft.projects.filter(
                  p => !projectIds.includes(p.id)
                );
                draft.selectedProjects = [];
                draft.recentProjects = draft.recentProjects.filter(
                  id => !projectIds.includes(id)
                );
                if (
                  draft.currentProject &&
                  projectIds.includes(draft.currentProject.id)
                ) {
                  draft.currentProject = null;
                }
                draft.pagination.total -= projectIds.length;
                draft.loading = false;
                draft.lastUpdated = new Date();
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to delete projects';
                draft.loading = false;
              });
              throw error;
            }
          },

          bulkArchive: async projectIds => {
            await get().bulkUpdateStatus(projectIds, 'completed');
          },

          // Search and filtering
          searchProjects: query => {
            get().setFilters({ searchQuery: query });
          },

          filterByStatus: statuses => {
            get().setFilters({ status: statuses });
          },

          filterByDateRange: (start, end) => {
            get().setFilters({ dateRange: { start, end } });
          },

          filterByTags: tags => {
            get().setFilters({ tags });
          },

          // Configuration management
          updateProjectConfig: async (projectId, config) => {
            const project = get().projects.find(p => p.id === projectId);
            if (!project) {
              throw new Error('Project not found');
            }

            try {
              const apiUrl =
                process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

              // Use the mapper to convert frontend config to backend format
              const backendConfig = mapConfigToBackend(config);

              logger.log('Saving configuration to backend:', {
                max_conv_turn: backendConfig.pipeline?.max_conv_turn,
                max_perspective: backendConfig.pipeline?.max_perspective,
                llm_provider: backendConfig.llm?.provider,
                retriever_type: backendConfig.retriever?.retriever_type,
                do_research: backendConfig.pipeline?.do_research,
                do_generate_outline: backendConfig.pipeline?.do_generate_outline,
                do_generate_article: backendConfig.pipeline?.do_generate_article,
                do_polish_article: backendConfig.pipeline?.do_polish_article,
              });

              const response = await fetch(
                `${apiUrl}/projects/${projectId}/config`,
                {
                  method: 'PUT',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify(backendConfig),
                }
              );

              if (!response.ok) {
                throw new Error('Failed to update project configuration');
              }

              // Update local state with the frontend config structure
              set(draft => {
                const index = draft.projects.findIndex(p => p.id === projectId);
                if (index !== -1) {
                  draft.projects[index].config = config;
                }
                if (draft.currentProject?.id === projectId) {
                  draft.currentProject.config = config;
                }
              });

              // Reload the project to ensure we have the latest data
              await get().loadProject(projectId);
            } catch (error) {
              throw error;
            }
          },

          cloneProjectConfig: async (sourceProjectId, targetProjectId) => {
            const sourceProject = get().projects.find(
              p => p.id === sourceProjectId
            );
            if (!sourceProject) {
              throw new Error('Source project not found');
            }

            await get().updateProject(targetProjectId, {
              config: sourceProject.config,
            });
          },

          exportProjectConfig: projectId => {
            const project = get().projects.find(p => p.id === projectId);
            if (!project) {
              throw new Error('Project not found');
            }
            return project.config;
          },

          importProjectConfig: async (projectId, config) => {
            await get().updateProject(projectId, { config });
          },

          // State management
          setLoading: loading => {
            set(draft => {
              draft.loading = loading;
            });
          },

          setError: error => {
            set(draft => {
              draft.error = error;
            });
          },

          clearError: () => {
            set(draft => {
              draft.error = null;
            });
          },

          reset: () => {
            set(draft => {
              Object.assign(draft, initialState);
            });
          },
        }))
      ),
      {
        name: 'storm-project-store',
        version: 1,
        partialize: createPartialize<ProjectStore>([
          'currentProject',
          'recentProjects',
          'filters',
          'sortBy',
          'sortOrder',
          'pagination',
        ]),
      }
    ),
    { name: 'ProjectStore' }
  )
);

// Selectors
export const projectSelectors = {
  projects: (state: ProjectStore) => state.projects,
  currentProject: (state: ProjectStore) => state.currentProject,
  selectedProjects: (state: ProjectStore) => state.selectedProjects,
  recentProjects: (state: ProjectStore) => state.recentProjects,
  filters: (state: ProjectStore) => state.filters,
  pagination: (state: ProjectStore) => state.pagination,
  isLoading: (state: ProjectStore) => state.loading,
  error: (state: ProjectStore) => state.error,
  selectedProjectsData: (state: ProjectStore) =>
    state.projects.filter(p => state.selectedProjects.includes(p.id)),
  recentProjectsData: (state: ProjectStore) =>
    state.recentProjects
      .map(id => state.projects.find(p => p.id === id))
      .filter(Boolean) as StormProject[],
  filteredProjects: (state: ProjectStore) => {
    let filtered = state.projects;

    if (state.filters.searchQuery) {
      const query = state.filters.searchQuery.toLowerCase();
      filtered = filtered.filter(
        p =>
          p.title.toLowerCase().includes(query) ||
          p.topic.toLowerCase().includes(query) ||
          p.description?.toLowerCase().includes(query)
      );
    }

    if (state.filters.status && state.filters.status.length > 0) {
      filtered = filtered.filter(p => state.filters.status!.includes(p.status));
    }

    return filtered;
  },
};

// Project hooks
export const useProjects = () => {
  const store = useProjectStore();
  return {
    ...store,
    selectors: projectSelectors,
  };
};

export const useCurrentProject = () =>
  useProjectStore(projectSelectors.currentProject);
export const useProjectsList = () => useProjectStore(projectSelectors.projects);
export const useSelectedProjects = () =>
  useProjectStore(projectSelectors.selectedProjectsData);
export const useRecentProjects = () =>
  useProjectStore(projectSelectors.recentProjectsData);
export const useProjectFilters = () =>
  useProjectStore(projectSelectors.filters);
export const useProjectLoading = () =>
  useProjectStore(projectSelectors.isLoading);
export const useProjectError = () => useProjectStore(projectSelectors.error);
