import { BaseApiService } from './base';
import { ApiResponse } from '../types/storm';
import {
  StormProject,
  ProjectFilters,
  ProjectListResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
  ProjectListRequest,
  DuplicateProjectRequest,
  PaginatedResponse,
} from '../types/api';
import { createProjectWebSocket } from '../lib/websocket';

export class ProjectService extends BaseApiService {
  private readonly basePath = '/api/projects';

  /**
   * Get all projects with optional filtering and pagination
   */
  async getProjects(
    request?: ProjectListRequest
  ): Promise<ApiResponse<PaginatedResponse<StormProject>>> {
    const params = new URLSearchParams();

    if (request?.page) params.append('page', request.page.toString());
    if (request?.limit) params.append('limit', request.limit.toString());
    if (request?.sortBy) params.append('sortBy', request.sortBy);
    if (request?.sortOrder) params.append('sortOrder', request.sortOrder);

    // Handle filters
    if (request?.filters) {
      const { filters } = request;

      if (filters.status && filters.status.length > 0) {
        params.append('status', filters.status.join(','));
      }

      if (filters.searchQuery) {
        params.append('search', filters.searchQuery);
      }

      if (filters.dateRange) {
        params.append('startDate', filters.dateRange.start.toISOString());
        params.append('endDate', filters.dateRange.end.toISOString());
      }
    }

    const url = `${this.basePath}${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<PaginatedResponse<StormProject>>(url);
  }

  /**
   * Get a single project by ID
   */
  async getProject(projectId: string): Promise<ApiResponse<StormProject>> {
    return this.get<StormProject>(`${this.basePath}/${projectId}`);
  }

  /**
   * Create a new project
   */
  async createProject(
    request: CreateProjectRequest
  ): Promise<ApiResponse<StormProject>> {
    return this.post<StormProject>(this.basePath, request);
  }

  /**
   * Update an existing project
   */
  async updateProject(
    request: UpdateProjectRequest
  ): Promise<ApiResponse<StormProject>> {
    const { id, ...updateData } = request;
    return this.put<StormProject>(`${this.basePath}/${id}`, updateData);
  }

  /**
   * Partially update a project (PATCH)
   */
  async patchProject(
    projectId: string,
    updates: Partial<StormProject>
  ): Promise<ApiResponse<StormProject>> {
    return this.patch<StormProject>(`${this.basePath}/${projectId}`, updates);
  }

  /**
   * Delete a project
   */
  async deleteProject(projectId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`${this.basePath}/${projectId}`);
  }

  /**
   * Bulk delete projects
   */
  async deleteProjects(
    projectIds: string[]
  ): Promise<ApiResponse<{ deleted: number; errors: string[] }>> {
    return this.post<{ deleted: number; errors: string[] }>(
      `${this.basePath}/bulk-delete`,
      {
        projectIds,
      }
    );
  }

  /**
   * Duplicate a project
   */
  async duplicateProject(
    request: DuplicateProjectRequest
  ): Promise<ApiResponse<StormProject>> {
    return this.post<StormProject>(
      `${this.basePath}/${request.projectId}/duplicate`,
      {
        new_title: request.title,
        description: request.description,
      }
    );
  }

  /**
   * Get project statistics
   */
  async getProjectStats(projectId: string): Promise<ApiResponse<ProjectStats>> {
    return this.get<ProjectStats>(`${this.basePath}/${projectId}/stats`);
  }

  /**
   * Search projects
   */
  async searchProjects(
    query: string,
    filters?: ProjectFilters
  ): Promise<ApiResponse<StormProject[]>> {
    const params = new URLSearchParams();
    params.append('q', query);

    if (filters?.status && filters.status.length > 0) {
      params.append('status', filters.status.join(','));
    }

    if (filters?.dateRange) {
      params.append('startDate', filters.dateRange.start.toISOString());
      params.append('endDate', filters.dateRange.end.toISOString());
    }

    return this.get<StormProject[]>(
      `${this.basePath}/search?${params.toString()}`
    );
  }

  /**
   * Get project templates
   */
  async getProjectTemplates(): Promise<ApiResponse<ProjectTemplate[]>> {
    return this.get<ProjectTemplate[]>(`${this.basePath}/templates`);
  }

  /**
   * Create project from template
   */
  async createFromTemplate(
    templateId: string,
    data: { title: string; topic: string; description?: string }
  ): Promise<ApiResponse<StormProject>> {
    return this.post<StormProject>(
      `${this.basePath}/templates/${templateId}/create`,
      data
    );
  }

  /**
   * Archive a project
   */
  async archiveProject(projectId: string): Promise<ApiResponse<StormProject>> {
    return this.post<StormProject>(`${this.basePath}/${projectId}/archive`);
  }

  /**
   * Unarchive a project
   */
  async unarchiveProject(
    projectId: string
  ): Promise<ApiResponse<StormProject>> {
    return this.post<StormProject>(`${this.basePath}/${projectId}/unarchive`);
  }

  /**
   * Get project activity log
   */
  async getProjectActivity(
    projectId: string,
    options?: { page?: number; limit?: number }
  ): Promise<ApiResponse<PaginatedResponse<ProjectActivity>>> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const url = `${this.basePath}/${projectId}/activity${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<PaginatedResponse<ProjectActivity>>(url);
  }

  /**
   * Add tags to a project
   */
  async addProjectTags(
    projectId: string,
    tags: string[]
  ): Promise<ApiResponse<StormProject>> {
    return this.post<StormProject>(`${this.basePath}/${projectId}/tags`, {
      tags,
    });
  }

  /**
   * Remove tags from a project
   */
  async removeProjectTags(
    projectId: string,
    tags: string[]
  ): Promise<ApiResponse<StormProject>> {
    return this.delete<StormProject>(`${this.basePath}/${projectId}/tags`, {
      data: { tags },
    });
  }

  /**
   * Get all available tags
   */
  async getAllTags(): Promise<ApiResponse<string[]>> {
    return this.get<string[]>(`${this.basePath}/tags`);
  }

  /**
   * Share a project
   */
  async shareProject(
    projectId: string,
    options: ProjectShareOptions
  ): Promise<ApiResponse<ProjectShareLink>> {
    return this.post<ProjectShareLink>(
      `${this.basePath}/${projectId}/share`,
      options
    );
  }

  /**
   * Get project sharing info
   */
  async getProjectSharing(
    projectId: string
  ): Promise<ApiResponse<ProjectShareInfo>> {
    return this.get<ProjectShareInfo>(`${this.basePath}/${projectId}/share`);
  }

  /**
   * Revoke project sharing
   */
  async revokeProjectSharing(
    projectId: string,
    shareId: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(`${this.basePath}/${projectId}/share/${shareId}`);
  }

  /**
   * Import project from file
   */
  async importProject(
    file: File,
    options?: { validateOnly?: boolean }
  ): Promise<ApiResponse<StormProject | ProjectImportValidation>> {
    const url = `${this.basePath}/import${options?.validateOnly ? '?validate=true' : ''}`;
    return this.uploadFile<StormProject | ProjectImportValidation>(url, file);
  }

  /**
   * Export project to file
   */
  async exportProject(
    projectId: string,
    format: 'json' | 'zip',
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    const url = `${this.basePath}/${projectId}/export?format=${format}`;
    return this.downloadFile(url, `project-${projectId}.${format}`, onProgress);
  }

  /**
   * Get project collaborators
   */
  async getProjectCollaborators(
    projectId: string
  ): Promise<ApiResponse<ProjectCollaborator[]>> {
    return this.get<ProjectCollaborator[]>(
      `${this.basePath}/${projectId}/collaborators`
    );
  }

  /**
   * Add project collaborator
   */
  async addProjectCollaborator(
    projectId: string,
    collaborator: { email: string; role: 'viewer' | 'editor' | 'admin' }
  ): Promise<ApiResponse<ProjectCollaborator>> {
    return this.post<ProjectCollaborator>(
      `${this.basePath}/${projectId}/collaborators`,
      collaborator
    );
  }

  /**
   * Update collaborator role
   */
  async updateCollaboratorRole(
    projectId: string,
    collaboratorId: string,
    role: 'viewer' | 'editor' | 'admin'
  ): Promise<ApiResponse<ProjectCollaborator>> {
    return this.patch<ProjectCollaborator>(
      `${this.basePath}/${projectId}/collaborators/${collaboratorId}`,
      {
        role,
      }
    );
  }

  /**
   * Remove project collaborator
   */
  async removeProjectCollaborator(
    projectId: string,
    collaboratorId: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(
      `${this.basePath}/${projectId}/collaborators/${collaboratorId}`
    );
  }

  /**
   * Subscribe to real-time project updates
   */
  async subscribeToProjectUpdates(
    projectId: string,
    callbacks: {
      onProjectUpdate?: (project: StormProject) => void;
      onStatusChange?: (status: string) => void;
      onProgressUpdate?: (progress: any) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<() => void> {
    const ws = createProjectWebSocket(projectId);

    // Set up WebSocket event handlers
    ws.setEventHandlers({
      onError: event => {
        callbacks.onError?.(new Error('WebSocket connection error'));
      },
      onClose: event => {
        if (!event.wasClean) {
          callbacks.onError?.(
            new Error('WebSocket connection closed unexpectedly')
          );
        }
      },
    });

    // Connect to WebSocket
    try {
      await ws.connect();
    } catch (error) {
      callbacks.onError?.(
        error instanceof Error
          ? error
          : new Error('Failed to connect to project updates')
      );
      return () => {};
    }

    // Subscribe to different message types
    const unsubscribers: (() => void)[] = [];

    if (callbacks.onProjectUpdate) {
      unsubscribers.push(
        ws.on<StormProject>('project_update', callbacks.onProjectUpdate)
      );
    }

    if (callbacks.onStatusChange) {
      unsubscribers.push(
        ws.on<{ status: string }>('status_change', data =>
          callbacks.onStatusChange!(data.status)
        )
      );
    }

    if (callbacks.onProgressUpdate) {
      unsubscribers.push(ws.on('progress_update', callbacks.onProgressUpdate));
    }

    // Send initial request to start receiving updates
    ws.send('subscribe_project_updates', { projectId });

    // Return cleanup function
    return () => {
      ws.send('unsubscribe_project_updates', { projectId });
      unsubscribers.forEach(unsubscribe => unsubscribe());
      ws.disconnect();
    };
  }

  /**
   * Enhanced error handling for project operations
   */
  private async handleProjectOperation<T>(
    operation: () => Promise<ApiResponse<T>>,
    operationName: string
  ): Promise<ApiResponse<T>> {
    try {
      return await operation();
    } catch (error) {
      // Enhanced error logging and transformation
      const enhancedError = this.enhanceError(error, operationName);
      throw enhancedError;
    }
  }

  private enhanceError(error: any, operationName: string): Error {
    const message = error?.message || 'Unknown error occurred';
    const status = error?.status || error?.response?.status;

    // Provide more specific error messages based on status codes
    let enhancedMessage = `${operationName} failed: ${message}`;

    switch (status) {
      case 400:
        enhancedMessage = `Invalid request for ${operationName}. Please check your input.`;
        break;
      case 401:
        enhancedMessage = `Authentication required for ${operationName}. Please log in.`;
        break;
      case 403:
        enhancedMessage = `Access denied for ${operationName}. You don't have permission.`;
        break;
      case 404:
        enhancedMessage = `Resource not found for ${operationName}. The project may have been deleted.`;
        break;
      case 409:
        enhancedMessage = `Conflict in ${operationName}. The project may be locked or in use.`;
        break;
      case 422:
        enhancedMessage = `Validation error in ${operationName}. Please check your data.`;
        break;
      case 429:
        enhancedMessage = `Rate limit exceeded for ${operationName}. Please try again later.`;
        break;
      case 500:
      case 502:
      case 503:
      case 504:
        enhancedMessage = `Server error in ${operationName}. Please try again or contact support.`;
        break;
    }

    const enhancedError = new Error(enhancedMessage);
    (enhancedError as any).originalError = error;
    (enhancedError as any).operation = operationName;
    (enhancedError as any).status = status;

    return enhancedError;
  }
}

// Additional types specific to ProjectService
export interface ProjectStats {
  wordCount: number;
  sectionCount: number;
  citationCount: number;
  sourceCount: number;
  conversationCount: number;
  lastModified: Date;
  timeSpent: number; // in minutes
  completionPercentage: number;
}

export interface ProjectTemplate {
  id: string;
  name: string;
  description: string;
  category: string;
  config: any;
  isDefault: boolean;
  thumbnail?: string;
  createdAt: Date;
}

export interface ProjectActivity {
  id: string;
  projectId: string;
  userId?: string;
  action: string;
  description: string;
  timestamp: Date;
  metadata?: Record<string, any>;
}

export interface ProjectShareOptions {
  permissions: 'view' | 'edit';
  expiresAt?: Date;
  password?: string;
  allowDownload?: boolean;
  allowComments?: boolean;
}

export interface ProjectShareLink {
  id: string;
  url: string;
  permissions: 'view' | 'edit';
  expiresAt?: Date;
  hasPassword: boolean;
  createdAt: Date;
  accessCount: number;
}

export interface ProjectShareInfo {
  isShared: boolean;
  links: ProjectShareLink[];
  collaborators: ProjectCollaborator[];
}

export interface ProjectCollaborator {
  id: string;
  email: string;
  name: string;
  role: 'viewer' | 'editor' | 'admin';
  status: 'pending' | 'active' | 'inactive';
  joinedAt?: Date;
  lastActive?: Date;
}

export interface ProjectImportValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  projectPreview: Partial<StormProject>;
}

// Create and export singleton instance
export const projectService = new ProjectService({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
});
