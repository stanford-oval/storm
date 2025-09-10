import { useState, useEffect, useCallback } from 'react';
import { projectService } from '../../services/project';
import { StormProject, ProjectFilters } from '../../types/api';
import { useToast } from '../useToast';

export interface UseProjectsOptions {
  page?: number;
  limit?: number;
  filters?: ProjectFilters;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'status';
  sortOrder?: 'asc' | 'desc';
  autoFetch?: boolean;
}

export interface UseProjectsResult {
  projects: StormProject[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  fetchProjects: (options?: UseProjectsOptions) => Promise<void>;
  createProject: (data: {
    title: string;
    topic: string;
    description?: string;
    config: any;
  }) => Promise<StormProject | null>;
  updateProject: (
    projectId: string,
    updates: Partial<StormProject>
  ) => Promise<StormProject | null>;
  deleteProject: (projectId: string) => Promise<boolean>;
  duplicateProject: (
    projectId: string,
    title?: string
  ) => Promise<StormProject | null>;
}

export function useProjects(
  options: UseProjectsOptions = {}
): UseProjectsResult {
  const [projects, setProjects] = useState<StormProject[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(options.page || 1);
  const [limit, setLimit] = useState(options.limit || 10);
  const [totalPages, setTotalPages] = useState(0);
  const [hasNext, setHasNext] = useState(false);
  const [hasPrevious, setHasPrevious] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProjects = useCallback(
    async (fetchOptions?: UseProjectsOptions) => {
      const requestOptions = { ...options, ...fetchOptions };
      setLoading(true);
      setError(null);

      try {
        const response = await projectService.getProjects({
          page: requestOptions.page || page,
          limit: requestOptions.limit || limit,
          filters: requestOptions.filters,
          sortBy: requestOptions.sortBy,
          sortOrder: requestOptions.sortOrder,
        });

        if (response.success && response.data) {
          setProjects(response.data.items);
          setTotal(response.data.total);
          setPage(response.data.page);
          setLimit(response.data.limit);
          setTotalPages(response.data.totalPages);
          setHasNext(response.data.hasNext);
          setHasPrevious(response.data.hasPrevious);
        } else {
          throw new Error(response.error || 'Failed to fetch projects');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to fetch projects';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    },
    [options, page, limit, toast]
  );

  const refetch = useCallback(() => fetchProjects(), [fetchProjects]);

  const createProject = useCallback(
    async (data: {
      title: string;
      topic: string;
      description?: string;
      config: any;
    }): Promise<StormProject | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await projectService.createProject(data);

        if (response.success && response.data) {
          // Add the new project to the beginning of the list
          setProjects(prev => [response.data!, ...prev]);
          setTotal(prev => prev + 1);

          toast({
            title: 'Success',
            description: 'Project created successfully',
          });

          return response.data;
        } else {
          throw new Error(response.error || 'Failed to create project');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create project';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const updateProject = useCallback(
    async (
      projectId: string,
      updates: Partial<StormProject>
    ): Promise<StormProject | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await projectService.updateProject({
          id: projectId,
          ...updates,
        });

        if (response.success && response.data) {
          // Update the project in the list
          setProjects(prev =>
            prev.map(project =>
              project.id === projectId ? response.data! : project
            )
          );

          toast({
            title: 'Success',
            description: 'Project updated successfully',
          });

          return response.data;
        } else {
          throw new Error(response.error || 'Failed to update project');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to update project';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const deleteProject = useCallback(
    async (projectId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await projectService.deleteProject(projectId);

        if (response.success) {
          // Remove the project from the list
          setProjects(prev => prev.filter(project => project.id !== projectId));
          setTotal(prev => prev - 1);

          toast({
            title: 'Success',
            description: 'Project deleted successfully',
          });

          return true;
        } else {
          throw new Error(response.error || 'Failed to delete project');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to delete project';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  const duplicateProject = useCallback(
    async (projectId: string, title?: string): Promise<StormProject | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await projectService.duplicateProject({
          projectId,
          title,
        });

        if (response.success && response.data) {
          // Add the duplicated project to the beginning of the list
          setProjects(prev => [response.data!, ...prev]);
          setTotal(prev => prev + 1);

          toast({
            title: 'Success',
            description: 'Project duplicated successfully',
          });

          return response.data;
        } else {
          throw new Error(response.error || 'Failed to duplicate project');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to duplicate project';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  // Auto-fetch projects on mount if enabled
  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchProjects();
    }
  }, [fetchProjects, options.autoFetch]);

  return {
    projects,
    total,
    page,
    limit,
    totalPages,
    hasNext,
    hasPrevious,
    loading,
    error,
    refetch,
    fetchProjects,
    createProject,
    updateProject,
    deleteProject,
    duplicateProject,
  };
}

// Hook for a single project
export interface UseProjectOptions {
  projectId: string;
  autoFetch?: boolean;
}

export interface UseProjectResult {
  project: StormProject | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  updateProject: (
    updates: Partial<StormProject>
  ) => Promise<StormProject | null>;
  deleteProject: () => Promise<boolean>;
}

export function useProject(options: UseProjectOptions): UseProjectResult {
  const [project, setProject] = useState<StormProject | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await projectService.getProject(options.projectId);

      if (response.success && response.data) {
        setProject(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch project');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch project';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [options.projectId, toast]);

  const updateProject = useCallback(
    async (updates: Partial<StormProject>): Promise<StormProject | null> => {
      if (!project) return null;

      setLoading(true);
      setError(null);

      try {
        const response = await projectService.updateProject({
          id: project.id,
          ...updates,
        });

        if (response.success && response.data) {
          setProject(response.data);
          toast({
            title: 'Success',
            description: 'Project updated successfully',
          });
          return response.data;
        } else {
          throw new Error(response.error || 'Failed to update project');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to update project';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [project, toast]
  );

  const deleteProject = useCallback(async (): Promise<boolean> => {
    if (!project) return false;

    setLoading(true);
    setError(null);

    try {
      const response = await projectService.deleteProject(project.id);

      if (response.success) {
        toast({
          title: 'Success',
          description: 'Project deleted successfully',
        });
        return true;
      } else {
        throw new Error(response.error || 'Failed to delete project');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to delete project';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
      return false;
    } finally {
      setLoading(false);
    }
  }, [project, toast]);

  const refetch = useCallback(() => fetchProject(), [fetchProject]);

  // Auto-fetch project on mount if enabled
  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchProject();
    }
  }, [fetchProject, options.autoFetch]);

  return {
    project,
    loading,
    error,
    refetch,
    updateProject,
    deleteProject,
  };
}

// Hook for project templates
export function useProjectTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await projectService.getProjectTemplates();

      if (response.success && response.data) {
        setTemplates(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch templates');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch templates';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  const createFromTemplate = useCallback(
    async (
      templateId: string,
      data: { title: string; topic: string; description?: string }
    ): Promise<StormProject | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await projectService.createFromTemplate(
          templateId,
          data
        );

        if (response.success && response.data) {
          toast({
            title: 'Success',
            description: 'Project created from template successfully',
          });
          return response.data;
        } else {
          throw new Error(
            response.error || 'Failed to create project from template'
          );
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to create project from template';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return null;
      } finally {
        setLoading(false);
      }
    },
    [toast]
  );

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
    createFromTemplate,
  };
}
