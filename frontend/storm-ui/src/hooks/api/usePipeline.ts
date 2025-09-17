import { useState, useEffect, useCallback, useRef } from 'react';
import { pipelineService } from '../../services/pipeline';
import {
  PipelineProgress,
  PipelineStatusResponse,
  StartPipelineRequest,
} from '../../types/api';
import { useToast } from '../useToast';

export interface UsePipelineOptions {
  projectId: string;
  autoFetch?: boolean;
  pollingInterval?: number; // in milliseconds
}

export interface UsePipelineResult {
  status: PipelineStatusResponse | null;
  progress: PipelineProgress | null;
  isRunning: boolean;
  loading: boolean;
  error: string | null;
  startPipeline: (config?: StartPipelineRequest) => Promise<boolean>;
  stopPipeline: (reason?: string) => Promise<boolean>;
  pausePipeline: () => Promise<boolean>;
  resumePipeline: () => Promise<boolean>;
  refetch: () => Promise<void>;
}

export function usePipeline(options: UsePipelineOptions): UsePipelineResult {
  const [status, setStatus] = useState<PipelineStatusResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();
  const pollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const fetchStatus = useCallback(async () => {
    setError(null);

    try {
      const response = await pipelineService.getPipelineStatus(
        options.projectId
      );

      if (response.success && response.data) {
        setStatus(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch pipeline status');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch pipeline status';
      setError(errorMessage);
      console.error('Pipeline status fetch error:', errorMessage);
    }
  }, [options.projectId]);

  const startPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
    }

    const interval = options.pollingInterval || 2000; // Default 2 seconds
    pollingIntervalRef.current = setInterval(fetchStatus, interval);
  }, [fetchStatus, options.pollingInterval]);

  const stopPolling = useCallback(() => {
    if (pollingIntervalRef.current) {
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }
  }, []);

  const startPipeline = useCallback(
    async (config?: StartPipelineRequest): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const request: StartPipelineRequest = config || {
          projectId: options.projectId,
          stages: [
            { name: 'research', enabled: true },
            { name: 'outline', enabled: true },
            { name: 'article', enabled: true },
            { name: 'polish', enabled: true },
          ],
        };

        const response = await pipelineService.startPipeline(request);

        if (response.success && response.data) {
          setStatus(response.data);
          startPolling(); // Start polling when pipeline starts

          toast({
            title: 'Success',
            description: 'Pipeline started successfully',
            variant: 'success',
          });

          return true;
        } else {
          throw new Error(response.error || 'Failed to start pipeline');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to start pipeline';
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
    [options.projectId, startPolling, toast]
  );

  const stopPipeline = useCallback(
    async (reason?: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await pipelineService.stopPipeline({
          projectId: options.projectId,
          reason,
        });

        if (response.success) {
          await fetchStatus(); // Refresh status
          stopPolling(); // Stop polling when pipeline stops

          toast({
            title: 'Success',
            description: 'Pipeline stopped successfully',
            variant: 'success',
          });

          return true;
        } else {
          throw new Error(response.error || 'Failed to stop pipeline');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to stop pipeline';
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
    [options.projectId, fetchStatus, stopPolling, toast]
  );

  const pausePipeline = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await pipelineService.pausePipeline(options.projectId);

      if (response.success && response.data) {
        setStatus(response.data);

        toast({
          title: 'Success',
          description: 'Pipeline paused successfully',
          variant: 'success',
        });

        return true;
      } else {
        throw new Error(response.error || 'Failed to pause pipeline');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to pause pipeline';
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
  }, [options.projectId, toast]);

  const resumePipeline = useCallback(async (): Promise<boolean> => {
    setLoading(true);
    setError(null);

    try {
      const response = await pipelineService.resumePipeline(options.projectId);

      if (response.success && response.data) {
        setStatus(response.data);
        startPolling(); // Resume polling when pipeline resumes

        toast({
          title: 'Success',
          description: 'Pipeline resumed successfully',
          variant: 'success',
        });

        return true;
      } else {
        throw new Error(response.error || 'Failed to resume pipeline');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to resume pipeline';
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
  }, [options.projectId, startPolling, toast]);

  const refetch = useCallback(() => fetchStatus(), [fetchStatus]);

  // Auto-fetch status on mount if enabled
  useEffect(() => {
    if (options.autoFetch !== false) {
      setLoading(true);
      fetchStatus().finally(() => setLoading(false));
    }
  }, [fetchStatus, options.autoFetch]);

  // Start/stop polling based on pipeline status
  useEffect(() => {
    if (status?.isRunning) {
      startPolling();
    } else {
      stopPolling();
    }

    return () => stopPolling();
  }, [status?.isRunning, startPolling, stopPolling]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => stopPolling();
  }, [stopPolling]);

  return {
    status,
    progress: status?.progress || null,
    isRunning: status?.isRunning || false,
    loading,
    error,
    startPipeline,
    stopPipeline,
    pausePipeline,
    resumePipeline,
    refetch,
  };
}

// Hook for pipeline logs
export interface UsePipelineLogsOptions {
  projectId: string;
  autoFetch?: boolean;
  stage?: string;
  level?: 'debug' | 'info' | 'warn' | 'error';
  limit?: number;
  enableStreaming?: boolean;
}

export function usePipelineLogs(options: UsePipelineLogsOptions) {
  const [logs, setLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const streamCleanupRef = useRef<(() => void) | null>(null);
  const { toast } = useToast();

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await pipelineService.getPipelineLogs(
        options.projectId,
        {
          stage: options.stage,
          level: options.level,
          limit: options.limit || 100,
        }
      );

      if (response.success && response.data) {
        setLogs(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch pipeline logs');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch pipeline logs';
      setError(errorMessage);
      console.error('Pipeline logs fetch error:', errorMessage);
    } finally {
      setLoading(false);
    }
  }, [options.projectId, options.stage, options.level, options.limit]);

  const startStreaming = useCallback(() => {
    if (streamCleanupRef.current) {
      streamCleanupRef.current();
    }

    pipelineService
      .streamPipelineLogs(
        options.projectId,
        newLog => {
          setLogs(prev => [...prev, newLog]);
        },
        error => {
          console.error('Pipeline log streaming error:', error);
          setError(error.message);
        }
      )
      .then(cleanup => {
        streamCleanupRef.current = cleanup;
      });
  }, [options.projectId]);

  const stopStreaming = useCallback(() => {
    if (streamCleanupRef.current) {
      streamCleanupRef.current();
      streamCleanupRef.current = null;
    }
  }, []);

  const clearLogs = useCallback(() => {
    setLogs([]);
  }, []);

  // Auto-fetch logs on mount
  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchLogs();
    }
  }, [fetchLogs, options.autoFetch]);

  // Start/stop streaming based on options
  useEffect(() => {
    if (options.enableStreaming) {
      startStreaming();
    } else {
      stopStreaming();
    }

    return () => stopStreaming();
  }, [options.enableStreaming, startStreaming, stopStreaming]);

  return {
    logs,
    loading,
    error,
    refetch: fetchLogs,
    clearLogs,
    startStreaming,
    stopStreaming,
  };
}

// Hook for pipeline templates
export function usePipelineTemplates() {
  const [templates, setTemplates] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await pipelineService.getPipelineTemplates();

      if (response.success && response.data) {
        setTemplates(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch pipeline templates');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to fetch pipeline templates';
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

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  return {
    templates,
    loading,
    error,
    refetch: fetchTemplates,
  };
}

// Hook for pipeline metrics
export function usePipelineMetrics(projectId: string) {
  const [metrics, setMetrics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await pipelineService.getPipelineMetrics(projectId);

      if (response.success && response.data) {
        setMetrics(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch pipeline metrics');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch pipeline metrics';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => {
    fetchMetrics();
  }, [fetchMetrics]);

  return {
    metrics,
    loading,
    error,
    refetch: fetchMetrics,
  };
}
