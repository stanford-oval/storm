import { BaseApiService } from './base';
import { ApiResponse } from '../types/storm';
import {
  PipelineProgress,
  StartPipelineRequest,
  StopPipelineRequest,
  PipelineStatusResponse,
  PipelineLog,
  PipelineStage,
  StormConfig,
} from '../types/api';
import { createPipelineWebSocket, WebSocketManager } from '../lib/websocket';

export class PipelineService extends BaseApiService {
  private readonly basePath = '/v1/pipeline';

  /**
   * Start the STORM pipeline for a project
   */
  async startPipeline(
    request: StartPipelineRequest
  ): Promise<ApiResponse<PipelineStatusResponse>> {
    return this.post<PipelineStatusResponse>(`${this.basePath}/start`, request);
  }

  /**
   * Stop a running pipeline
   */
  async stopPipeline(
    request: StopPipelineRequest
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.post<{ success: boolean; message: string }>(
      `${this.basePath}/stop`,
      request
    );
  }

  /**
   * Pause a running pipeline
   */
  async pausePipeline(
    projectId: string
  ): Promise<ApiResponse<PipelineStatusResponse>> {
    return this.post<PipelineStatusResponse>(`${this.basePath}/pause`, {
      projectId,
    });
  }

  /**
   * Resume a paused pipeline
   */
  async resumePipeline(
    projectId: string
  ): Promise<ApiResponse<PipelineStatusResponse>> {
    return this.post<PipelineStatusResponse>(`${this.basePath}/resume`, {
      projectId,
    });
  }

  /**
   * Get pipeline status for a project
   */
  async getPipelineStatus(
    projectId: string
  ): Promise<ApiResponse<PipelineStatusResponse>> {
    return this.get<PipelineStatusResponse>(
      `${this.basePath}/status/${projectId}`
    );
  }

  /**
   * Get pipeline logs for a project
   */
  async getPipelineLogs(
    projectId: string,
    options?: {
      stage?: string;
      level?: 'debug' | 'info' | 'warn' | 'error';
      limit?: number;
      offset?: number;
      since?: Date;
    }
  ): Promise<ApiResponse<PipelineLog[]>> {
    const params = new URLSearchParams();

    if (options?.stage) params.append('stage', options.stage);
    if (options?.level) params.append('level', options.level);
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());
    if (options?.since) params.append('since', options.since.toISOString());

    const url = `${this.basePath}/logs/${projectId}${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<PipelineLog[]>(url);
  }

  /**
   * Get pipeline logs in real-time (streaming via WebSocket)
   */
  async streamPipelineLogs(
    projectId: string,
    onLog: (log: PipelineLog) => void,
    onError?: (error: Error) => void
  ): Promise<() => void> {
    const ws = createPipelineWebSocket(projectId);

    // Set up WebSocket event handlers
    ws.setEventHandlers({
      onError: event => {
        onError?.(new Error('WebSocket connection error'));
      },
      onClose: event => {
        if (!event.wasClean) {
          onError?.(new Error('WebSocket connection closed unexpectedly'));
        }
      },
    });

    // Connect to WebSocket
    try {
      await ws.connect();
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error
          : new Error('Failed to connect to log stream')
      );
      return () => {};
    }

    // Subscribe to log messages
    const unsubscribe = ws.on<PipelineLog>('pipeline_log', onLog);

    // Send initial request to start log streaming
    ws.send('subscribe_logs', { projectId });

    // Return cleanup function
    return () => {
      ws.send('unsubscribe_logs', { projectId });
      unsubscribe();
      ws.disconnect();
    };
  }

  /**
   * Retry a failed pipeline stage
   */
  async retryStage(
    projectId: string,
    stage: string,
    config?: Partial<StormConfig>
  ): Promise<ApiResponse<PipelineStatusResponse>> {
    return this.post<PipelineStatusResponse>(`${this.basePath}/retry-stage`, {
      projectId,
      stage,
      config,
    });
  }

  /**
   * Skip a pipeline stage
   */
  async skipStage(
    projectId: string,
    stage: string
  ): Promise<ApiResponse<PipelineStatusResponse>> {
    return this.post<PipelineStatusResponse>(`${this.basePath}/skip-stage`, {
      projectId,
      stage,
    });
  }

  /**
   * Get available pipeline templates
   */
  async getPipelineTemplates(): Promise<ApiResponse<PipelineTemplate[]>> {
    return this.get<PipelineTemplate[]>(`${this.basePath}/templates`);
  }

  /**
   * Create a custom pipeline template
   */
  async createPipelineTemplate(
    template: CreatePipelineTemplateRequest
  ): Promise<ApiResponse<PipelineTemplate>> {
    return this.post<PipelineTemplate>(`${this.basePath}/templates`, template);
  }

  /**
   * Update a pipeline template
   */
  async updatePipelineTemplate(
    templateId: string,
    updates: Partial<PipelineTemplate>
  ): Promise<ApiResponse<PipelineTemplate>> {
    return this.put<PipelineTemplate>(
      `${this.basePath}/templates/${templateId}`,
      updates
    );
  }

  /**
   * Delete a pipeline template
   */
  async deletePipelineTemplate(templateId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`${this.basePath}/templates/${templateId}`);
  }

  /**
   * Validate pipeline configuration
   */
  async validatePipelineConfig(
    config: StormConfig,
    stages: PipelineStage[]
  ): Promise<ApiResponse<PipelineValidationResult>> {
    return this.post<PipelineValidationResult>(`${this.basePath}/validate`, {
      config,
      stages,
    });
  }

  /**
   * Get pipeline performance metrics
   */
  async getPipelineMetrics(
    projectId: string
  ): Promise<ApiResponse<PipelineMetrics>> {
    return this.get<PipelineMetrics>(`${this.basePath}/metrics/${projectId}`);
  }

  /**
   * Get pipeline execution history
   */
  async getPipelineHistory(
    projectId: string,
    options?: { limit?: number; offset?: number }
  ): Promise<ApiResponse<PipelineExecution[]>> {
    const params = new URLSearchParams();
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.offset) params.append('offset', options.offset.toString());

    const url = `${this.basePath}/history/${projectId}${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<PipelineExecution[]>(url);
  }

  /**
   * Compare pipeline executions
   */
  async comparePipelineExecutions(
    executionIds: string[]
  ): Promise<ApiResponse<PipelineComparison>> {
    return this.post<PipelineComparison>(`${this.basePath}/compare`, {
      executionIds,
    });
  }

  /**
   * Get pipeline stage details
   */
  async getStageDetails(
    projectId: string,
    stage: string,
    executionId?: string
  ): Promise<ApiResponse<StageDetails>> {
    const params = new URLSearchParams();
    if (executionId) params.append('executionId', executionId);

    const url = `${this.basePath}/stage/${projectId}/${stage}${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<StageDetails>(url);
  }

  /**
   * Update stage configuration during execution
   */
  async updateStageConfig(
    projectId: string,
    stage: string,
    config: Record<string, any>
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.patch<{ success: boolean; message: string }>(
      `${this.basePath}/stage-config/${projectId}/${stage}`,
      { config }
    );
  }

  /**
   * Get real-time pipeline metrics via WebSocket
   */
  async subscribeToMetrics(
    projectId: string,
    onMetrics: (metrics: PipelineMetrics) => void,
    onError?: (error: Error) => void
  ): Promise<() => void> {
    const ws = createPipelineWebSocket(projectId);

    // Set up WebSocket event handlers
    ws.setEventHandlers({
      onError: event => {
        onError?.(new Error('WebSocket connection error'));
      },
      onClose: event => {
        if (!event.wasClean) {
          onError?.(new Error('WebSocket connection closed unexpectedly'));
        }
      },
    });

    // Connect to WebSocket
    try {
      await ws.connect();
    } catch (error) {
      onError?.(
        error instanceof Error
          ? error
          : new Error('Failed to connect to metrics stream')
      );
      return () => {};
    }

    // Subscribe to metrics messages
    const unsubscribe = ws.on<PipelineMetrics>('pipeline_metrics', onMetrics);

    // Send initial request to start metrics streaming
    ws.send('subscribe_metrics', { projectId });

    // Return cleanup function
    return () => {
      ws.send('unsubscribe_metrics', { projectId });
      unsubscribe();
      ws.disconnect();
    };
  }

  /**
   * Export pipeline logs
   */
  async exportLogs(
    projectId: string,
    format: 'json' | 'csv' | 'txt',
    options?: {
      stage?: string;
      level?: string;
      startDate?: Date;
      endDate?: Date;
    }
  ): Promise<Blob> {
    const params = new URLSearchParams();
    params.append('format', format);

    if (options?.stage) params.append('stage', options.stage);
    if (options?.level) params.append('level', options.level);
    if (options?.startDate)
      params.append('startDate', options.startDate.toISOString());
    if (options?.endDate)
      params.append('endDate', options.endDate.toISOString());

    const url = `${this.basePath}/logs/${projectId}/export?${params.toString()}`;
    return this.downloadFile(url, `pipeline-logs-${projectId}.${format}`);
  }

  /**
   * Get pipeline resource usage
   */
  async getResourceUsage(
    projectId: string
  ): Promise<ApiResponse<ResourceUsage>> {
    return this.get<ResourceUsage>(`${this.basePath}/resources/${projectId}`);
  }

  /**
   * Estimate pipeline execution time
   */
  async estimateExecutionTime(
    config: StormConfig,
    stages: PipelineStage[]
  ): Promise<ApiResponse<ExecutionTimeEstimate>> {
    return this.post<ExecutionTimeEstimate>(`${this.basePath}/estimate`, {
      config,
      stages,
    });
  }

  /**
   * Schedule a pipeline execution
   */
  async schedulePipeline(
    request: SchedulePipelineRequest
  ): Promise<ApiResponse<ScheduledExecution>> {
    return this.post<ScheduledExecution>(`${this.basePath}/schedule`, request);
  }

  /**
   * Get scheduled executions
   */
  async getScheduledExecutions(): Promise<ApiResponse<ScheduledExecution[]>> {
    return this.get<ScheduledExecution[]>(`${this.basePath}/scheduled`);
  }

  /**
   * Cancel a scheduled execution
   */
  async cancelScheduledExecution(
    scheduledId: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(`${this.basePath}/scheduled/${scheduledId}`);
  }

  /**
   * Subscribe to real-time pipeline updates (progress, status changes, etc.)
   */
  async subscribeToUpdates(
    projectId: string,
    callbacks: {
      onProgress?: (progress: PipelineProgress) => void;
      onStatusChange?: (status: PipelineStatusResponse) => void;
      onStageStart?: (stage: string) => void;
      onStageComplete?: (stage: string, result: any) => void;
      onError?: (error: Error) => void;
    }
  ): Promise<() => void> {
    const ws = createPipelineWebSocket(projectId);

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
          : new Error('Failed to connect to pipeline updates')
      );
      return () => {};
    }

    // Subscribe to different message types
    const unsubscribers: (() => void)[] = [];

    if (callbacks.onProgress) {
      unsubscribers.push(
        ws.on<PipelineProgress>('pipeline_progress', callbacks.onProgress)
      );
    }

    if (callbacks.onStatusChange) {
      unsubscribers.push(
        ws.on<PipelineStatusResponse>(
          'pipeline_status',
          callbacks.onStatusChange
        )
      );
    }

    if (callbacks.onStageStart) {
      unsubscribers.push(
        ws.on<{ stage: string }>('stage_start', data =>
          callbacks.onStageStart!(data.stage)
        )
      );
    }

    if (callbacks.onStageComplete) {
      unsubscribers.push(
        ws.on<{ stage: string; result: any }>('stage_complete', data =>
          callbacks.onStageComplete!(data.stage, data.result)
        )
      );
    }

    // Send initial request to start receiving updates
    ws.send('subscribe_updates', { projectId });

    // Return cleanup function
    return () => {
      ws.send('unsubscribe_updates', { projectId });
      unsubscribers.forEach(unsubscribe => unsubscribe());
      ws.disconnect();
    };
  }

  /**
   * Send real-time command to pipeline (pause, resume, cancel, etc.)
   */
  async sendRealtimeCommand(
    projectId: string,
    command: 'pause' | 'resume' | 'cancel' | 'skip_stage',
    options?: { stage?: string; reason?: string }
  ): Promise<void> {
    const ws = createPipelineWebSocket(projectId);

    try {
      await ws.connect();
      ws.send('pipeline_command', {
        projectId,
        command,
        options,
        timestamp: Date.now(),
      });

      // Keep connection alive for a moment to ensure command is sent
      await new Promise(resolve => setTimeout(resolve, 1000));
      ws.disconnect();
    } catch (error) {
      throw new Error(
        `Failed to send realtime command: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

// Additional types specific to PipelineService
export interface PipelineTemplate {
  id: string;
  name: string;
  description: string;
  stages: PipelineStage[];
  defaultConfig: StormConfig;
  isSystem: boolean;
  isPublic: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
  usageCount: number;
}

export interface CreatePipelineTemplateRequest {
  name: string;
  description: string;
  stages: PipelineStage[];
  defaultConfig: StormConfig;
  isPublic?: boolean;
  tags?: string[];
}

export interface PipelineValidationResult {
  isValid: boolean;
  errors: Array<{
    stage: string;
    field: string;
    message: string;
  }>;
  warnings: Array<{
    stage: string;
    field: string;
    message: string;
    suggestion?: string;
  }>;
  estimatedTime: number; // in minutes
  estimatedCost: number; // in credits/tokens
}

export interface PipelineMetrics {
  executionId: string;
  projectId: string;
  startTime: Date;
  endTime?: Date;
  duration?: number; // in milliseconds
  currentStage: string;
  stageMetrics: Record<string, StageMetrics>;
  resourceUsage: ResourceUsage;
  errorCount: number;
  warningCount: number;
  tokensUsed: number;
  estimatedCost: number;
}

export interface StageMetrics {
  stageName: string;
  startTime: Date;
  endTime?: Date;
  duration?: number;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  progress: number;
  itemsProcessed: number;
  itemsTotal: number;
  tokensUsed: number;
  apiCalls: number;
  errorCount: number;
  warningCount: number;
  memoryUsage: number; // in MB
  cpuUsage: number; // percentage
}

export interface ResourceUsage {
  memoryUsage: {
    current: number;
    peak: number;
    average: number;
  };
  cpuUsage: {
    current: number;
    peak: number;
    average: number;
  };
  diskUsage: {
    input: number;
    output: number;
    temp: number;
  };
  networkUsage: {
    bytesIn: number;
    bytesOut: number;
    requests: number;
  };
  apiUsage: {
    totalCalls: number;
    tokensUsed: number;
    estimatedCost: number;
    rateLimitHits: number;
  };
}

export interface PipelineExecution {
  id: string;
  projectId: string;
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  config: StormConfig;
  stages: PipelineStage[];
  progress: PipelineProgress;
  metrics: PipelineMetrics;
  logs: PipelineLog[];
  errorCount: number;
  warningCount: number;
}

export interface PipelineComparison {
  executions: PipelineExecution[];
  metrics: {
    durationComparison: number[];
    tokensUsedComparison: number[];
    errorCountComparison: number[];
    qualityScores: number[];
  };
  recommendations: string[];
}

export interface StageDetails {
  stageName: string;
  status: string;
  progress: number;
  startTime?: Date;
  endTime?: Date;
  config: Record<string, any>;
  inputs: Record<string, any>;
  outputs: Record<string, any>;
  metrics: StageMetrics;
  logs: PipelineLog[];
  artifacts: StageArtifact[];
}

export interface StageArtifact {
  id: string;
  name: string;
  type: 'input' | 'output' | 'intermediate';
  path: string;
  size: number;
  createdAt: Date;
  metadata?: Record<string, any>;
}

export interface ExecutionTimeEstimate {
  totalMinutes: number;
  stageEstimates: Record<string, number>;
  confidence: 'low' | 'medium' | 'high';
  factors: string[];
  basedOnExecutions: number;
}

export interface SchedulePipelineRequest {
  projectId: string;
  config: StormConfig;
  stages: PipelineStage[];
  schedule: {
    type: 'once' | 'daily' | 'weekly' | 'monthly' | 'cron';
    scheduledAt?: Date;
    cronExpression?: string;
    timezone?: string;
  };
  notifications?: {
    onStart: boolean;
    onComplete: boolean;
    onError: boolean;
    webhookUrl?: string;
    emailAddresses?: string[];
  };
}

export interface ScheduledExecution {
  id: string;
  projectId: string;
  config: StormConfig;
  stages: PipelineStage[];
  schedule: SchedulePipelineRequest['schedule'];
  notifications?: SchedulePipelineRequest['notifications'];
  status: 'active' | 'paused' | 'cancelled';
  nextRun?: Date;
  lastRun?: Date;
  executionCount: number;
  createdAt: Date;
  updatedAt: Date;
}

// Create and export singleton instance
export const pipelineService = new PipelineService({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
});
