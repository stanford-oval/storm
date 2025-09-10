import { BaseApiService } from './base';
import { ApiResponse } from '../types/storm';
import { ExportRequest, ExportJob } from '../types/api';

export class ExportService extends BaseApiService {
  private readonly basePath = '/export';

  /**
   * Create an export job
   */
  async createExportJob(
    request: ExportRequest
  ): Promise<ApiResponse<ExportJob>> {
    return this.post<ExportJob>(this.basePath, request);
  }

  /**
   * Get export job status
   */
  async getExportJob(jobId: string): Promise<ApiResponse<ExportJob>> {
    return this.get<ExportJob>(`${this.basePath}/${jobId}`);
  }

  /**
   * Get all export jobs for a project
   */
  async getProjectExportJobs(
    projectId: string,
    options?: {
      page?: number;
      limit?: number;
      status?: 'queued' | 'processing' | 'completed' | 'failed';
    }
  ): Promise<ApiResponse<ExportJobListResponse>> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.status) params.append('status', options.status);

    const url = `${this.basePath}/projects/${projectId}${
      params.toString() ? '?' + params.toString() : ''
    }`;
    return this.get<ExportJobListResponse>(url);
  }

  /**
   * Cancel an export job
   */
  async cancelExportJob(jobId: string): Promise<ApiResponse<ExportJob>> {
    return this.post<ExportJob>(`${this.basePath}/${jobId}/cancel`);
  }

  /**
   * Delete an export job
   */
  async deleteExportJob(jobId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`${this.basePath}/${jobId}`);
  }

  /**
   * Download exported file
   */
  async downloadExport(
    jobId: string,
    onProgress?: (progress: number) => void
  ): Promise<Blob> {
    return this.downloadFile(
      `${this.basePath}/${jobId}/download`,
      undefined,
      onProgress
    );
  }

  /**
   * Get available export templates
   */
  async getExportTemplates(
    format?: string
  ): Promise<ApiResponse<ExportTemplate[]>> {
    const params = new URLSearchParams();
    if (format) params.append('format', format);

    const url = `${this.basePath}/templates${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<ExportTemplate[]>(url);
  }

  /**
   * Get export template
   */
  async getExportTemplate(
    templateId: string
  ): Promise<ApiResponse<ExportTemplate>> {
    return this.get<ExportTemplate>(`${this.basePath}/templates/${templateId}`);
  }

  /**
   * Create custom export template
   */
  async createExportTemplate(
    template: CreateExportTemplateRequest
  ): Promise<ApiResponse<ExportTemplate>> {
    return this.post<ExportTemplate>(`${this.basePath}/templates`, template);
  }

  /**
   * Update export template
   */
  async updateExportTemplate(
    templateId: string,
    updates: Partial<ExportTemplate>
  ): Promise<ApiResponse<ExportTemplate>> {
    return this.put<ExportTemplate>(
      `${this.basePath}/templates/${templateId}`,
      updates
    );
  }

  /**
   * Delete export template
   */
  async deleteExportTemplate(templateId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`${this.basePath}/templates/${templateId}`);
  }

  /**
   * Preview export
   */
  async previewExport(
    request: ExportRequest
  ): Promise<ApiResponse<ExportPreview>> {
    return this.post<ExportPreview>(`${this.basePath}/preview`, request);
  }

  /**
   * Export article directly (synchronous for small exports)
   */
  async exportArticle(
    projectId: string,
    format: 'html' | 'markdown' | 'txt',
    options?: {
      includeOutline?: boolean;
      includeCitations?: boolean;
      template?: string;
    }
  ): Promise<ApiResponse<ExportResult>> {
    return this.post<ExportResult>(`${this.basePath}/article/${projectId}`, {
      format,
      ...options,
    });
  }

  /**
   * Export outline
   */
  async exportOutline(
    projectId: string,
    format: 'json' | 'yaml' | 'xml' | 'markdown'
  ): Promise<ApiResponse<ExportResult>> {
    return this.post<ExportResult>(`${this.basePath}/outline/${projectId}`, {
      format,
    });
  }

  /**
   * Export research data
   */
  async exportResearch(
    projectId: string,
    format: 'json' | 'csv' | 'bibtex',
    options?: {
      includeConversations?: boolean;
      includeSources?: boolean;
      includeAnalytics?: boolean;
    }
  ): Promise<ApiResponse<ExportResult>> {
    return this.post<ExportResult>(`${this.basePath}/research/${projectId}`, {
      format,
      ...options,
    });
  }

  /**
   * Export configuration
   */
  async exportConfig(
    projectId: string,
    format: 'json' | 'yaml' | 'toml'
  ): Promise<ApiResponse<ExportResult>> {
    return this.post<ExportResult>(`${this.basePath}/config/${projectId}`, {
      format,
    });
  }

  /**
   * Bulk export multiple projects
   */
  async bulkExport(
    request: BulkExportRequest
  ): Promise<ApiResponse<ExportJob>> {
    return this.post<ExportJob>(`${this.basePath}/bulk`, request);
  }

  /**
   * Export session data
   */
  async exportSession(
    sessionId: string,
    format: 'json' | 'html' | 'pdf',
    options?: {
      includeMessages?: boolean;
      includeMindMap?: boolean;
      includeAnalytics?: boolean;
    }
  ): Promise<ApiResponse<ExportResult>> {
    return this.post<ExportResult>(`${this.basePath}/session/${sessionId}`, {
      format,
      ...options,
    });
  }

  /**
   * Get supported export formats
   */
  async getSupportedFormats(): Promise<ApiResponse<ExportFormat[]>> {
    return this.get<ExportFormat[]>(`${this.basePath}/formats`);
  }

  /**
   * Validate export request
   */
  async validateExportRequest(
    request: ExportRequest
  ): Promise<ApiResponse<ExportValidation>> {
    return this.post<ExportValidation>(`${this.basePath}/validate`, request);
  }

  /**
   * Get export statistics
   */
  async getExportStatistics(options?: {
    startDate?: Date;
    endDate?: Date;
    format?: string;
    projectId?: string;
  }): Promise<ApiResponse<ExportStatistics>> {
    const params = new URLSearchParams();
    if (options?.startDate)
      params.append('startDate', options.startDate.toISOString());
    if (options?.endDate)
      params.append('endDate', options.endDate.toISOString());
    if (options?.format) params.append('format', options.format);
    if (options?.projectId) params.append('projectId', options.projectId);

    const url = `${this.basePath}/statistics${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<ExportStatistics>(url);
  }

  /**
   * Retry failed export job
   */
  async retryExportJob(jobId: string): Promise<ApiResponse<ExportJob>> {
    return this.post<ExportJob>(`${this.basePath}/${jobId}/retry`);
  }

  /**
   * Schedule automatic export
   */
  async scheduleExport(
    request: ScheduleExportRequest
  ): Promise<ApiResponse<ScheduledExport>> {
    return this.post<ScheduledExport>(`${this.basePath}/schedule`, request);
  }

  /**
   * Get scheduled exports
   */
  async getScheduledExports(
    projectId?: string
  ): Promise<ApiResponse<ScheduledExport[]>> {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);

    const url = `${this.basePath}/scheduled${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<ScheduledExport[]>(url);
  }

  /**
   * Update scheduled export
   */
  async updateScheduledExport(
    scheduleId: string,
    updates: Partial<ScheduleExportRequest>
  ): Promise<ApiResponse<ScheduledExport>> {
    return this.patch<ScheduledExport>(
      `${this.basePath}/scheduled/${scheduleId}`,
      updates
    );
  }

  /**
   * Cancel scheduled export
   */
  async cancelScheduledExport(scheduleId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`${this.basePath}/scheduled/${scheduleId}`);
  }

  /**
   * Get export webhooks
   */
  async getExportWebhooks(
    projectId?: string
  ): Promise<ApiResponse<ExportWebhook[]>> {
    const params = new URLSearchParams();
    if (projectId) params.append('projectId', projectId);

    const url = `${this.basePath}/webhooks${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<ExportWebhook[]>(url);
  }

  /**
   * Create export webhook
   */
  async createExportWebhook(
    webhook: CreateExportWebhookRequest
  ): Promise<ApiResponse<ExportWebhook>> {
    return this.post<ExportWebhook>(`${this.basePath}/webhooks`, webhook);
  }

  /**
   * Update export webhook
   */
  async updateExportWebhook(
    webhookId: string,
    updates: Partial<ExportWebhook>
  ): Promise<ApiResponse<ExportWebhook>> {
    return this.patch<ExportWebhook>(
      `${this.basePath}/webhooks/${webhookId}`,
      updates
    );
  }

  /**
   * Delete export webhook
   */
  async deleteExportWebhook(webhookId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`${this.basePath}/webhooks/${webhookId}`);
  }

  /**
   * Test export webhook
   */
  async testExportWebhook(
    webhookId: string
  ): Promise<ApiResponse<WebhookTestResult>> {
    return this.post<WebhookTestResult>(
      `${this.basePath}/webhooks/${webhookId}/test`
    );
  }

  /**
   * Convert between formats
   */
  async convertFormat(
    content: string,
    fromFormat: string,
    toFormat: string,
    options?: Record<string, any>
  ): Promise<ApiResponse<ConversionResult>> {
    return this.post<ConversionResult>(`${this.basePath}/convert`, {
      content,
      fromFormat,
      toFormat,
      options,
    });
  }

  /**
   * Archive old exports
   */
  async archiveOldExports(
    olderThanDays: number,
    projectId?: string
  ): Promise<ApiResponse<ArchiveResult>> {
    const params = new URLSearchParams();
    params.append('olderThanDays', olderThanDays.toString());
    if (projectId) params.append('projectId', projectId);

    return this.post<ArchiveResult>(
      `${this.basePath}/archive?${params.toString()}`
    );
  }

  /**
   * Get export quota usage
   */
  async getExportQuota(): Promise<ApiResponse<ExportQuota>> {
    return this.get<ExportQuota>(`${this.basePath}/quota`);
  }

  /**
   * Subscribe to export events (WebSocket endpoint helper)
   */
  getExportWebSocketUrl(): string {
    const baseUrl = this.client.defaults.baseURL?.replace(/^http/, 'ws');
    return `${baseUrl}${this.basePath}/ws`;
  }
}

// Additional types specific to ExportService
export interface ExportJobListResponse {
  jobs: ExportJob[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string;
  format: string;
  template: string;
  variables: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required: boolean;
    defaultValue?: any;
  }>;
  isSystem: boolean;
  isPublic: boolean;
  category: string;
  tags: string[];
  usageCount: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExportTemplateRequest {
  name: string;
  description: string;
  format: string;
  template: string;
  variables?: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean' | 'array' | 'object';
    description: string;
    required: boolean;
    defaultValue?: any;
  }>;
  isPublic?: boolean;
  category?: string;
  tags?: string[];
}

export interface ExportPreview {
  preview: string;
  estimatedSize: number;
  processingTime: number;
  warnings: string[];
  metadata: Record<string, any>;
}

export interface ExportResult {
  content: string;
  format: string;
  size: number;
  filename: string;
  metadata: Record<string, any>;
  downloadUrl?: string;
}

export interface BulkExportRequest {
  projectIds: string[];
  format: string;
  options?: Record<string, any>;
  template?: string;
  archiveFormat?: 'zip' | 'tar.gz';
  includeSeparateFiles?: boolean;
}

export interface ExportFormat {
  name: string;
  extension: string;
  mimeType: string;
  description: string;
  supportsTemplates: boolean;
  supportedSections: string[];
  maxFileSize?: number; // in MB
  processingTime?: string; // estimated
  requirements?: string[];
}

export interface ExportValidation {
  isValid: boolean;
  errors: Array<{
    field: string;
    message: string;
    code: string;
  }>;
  warnings: Array<{
    field: string;
    message: string;
    suggestion?: string;
  }>;
  estimatedSize: number;
  estimatedTime: number; // in seconds
}

export interface ExportStatistics {
  totalExports: number;
  exportsByFormat: Record<string, number>;
  exportsByProject: Record<string, number>;
  averageFileSize: number;
  averageProcessingTime: number;
  successRate: number;
  failureReasons: Record<string, number>;
  popularTemplates: Array<{
    templateId: string;
    templateName: string;
    usage: number;
  }>;
  timeSeriesData: Array<{
    date: string;
    exports: number;
    totalSize: number;
  }>;
}

export interface ScheduleExportRequest {
  projectId: string;
  exportRequest: ExportRequest;
  schedule: {
    type: 'once' | 'daily' | 'weekly' | 'monthly' | 'cron';
    scheduledAt?: Date;
    cronExpression?: string;
    timezone?: string;
  };
  notifications?: {
    onSuccess: boolean;
    onFailure: boolean;
    webhookUrl?: string;
    emailAddresses?: string[];
  };
  retentionDays?: number;
  isActive?: boolean;
}

export interface ScheduledExport {
  id: string;
  projectId: string;
  exportRequest: ExportRequest;
  schedule: ScheduleExportRequest['schedule'];
  notifications?: ScheduleExportRequest['notifications'];
  retentionDays: number;
  isActive: boolean;
  status: 'active' | 'paused' | 'failed' | 'completed';
  nextRun?: Date;
  lastRun?: Date;
  lastJobId?: string;
  executionCount: number;
  successCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface ExportWebhook {
  id: string;
  projectId?: string;
  url: string;
  events: Array<'export_started' | 'export_completed' | 'export_failed'>;
  headers?: Record<string, string>;
  secret?: string;
  isActive: boolean;
  lastTriggered?: Date;
  successCount: number;
  failureCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateExportWebhookRequest {
  projectId?: string;
  url: string;
  events: Array<'export_started' | 'export_completed' | 'export_failed'>;
  headers?: Record<string, string>;
  secret?: string;
  isActive?: boolean;
}

export interface WebhookTestResult {
  success: boolean;
  statusCode?: number;
  responseTime: number;
  error?: string;
  response?: any;
}

export interface ConversionResult {
  content: string;
  fromFormat: string;
  toFormat: string;
  originalSize: number;
  convertedSize: number;
  metadata: Record<string, any>;
  warnings: string[];
}

export interface ArchiveResult {
  archivedCount: number;
  totalSizeSaved: number; // in bytes
  deletedFiles: string[];
  errors: string[];
}

export interface ExportQuota {
  limit: number;
  used: number;
  remaining: number;
  resetDate: Date;
  byFormat: Record<
    string,
    {
      limit: number;
      used: number;
      remaining: number;
    }
  >;
  warnings: string[];
}

// Create and export singleton instance
export const exportService = new ExportService({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
});
