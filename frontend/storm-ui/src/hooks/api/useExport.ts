import { useState, useCallback } from 'react';
import { exportService } from '../../services/export';
import { ExportJob, ExportRequest } from '../../types/api';
import { useToast } from '../useToast';

export function useExport() {
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const createExport = useCallback(
    async (request: ExportRequest) => {
      setLoading(true);
      try {
        const response = await exportService.createExportJob(request);
        if (response.success && response.data) {
          setJobs(prev => [response.data!, ...prev]);
          toast({
            title: 'Success',
            description: 'Export job created successfully',
            variant: 'success',
          });
          return response.data;
        }
        return null;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to create export';
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

  const getExportJob = useCallback(async (jobId: string) => {
    try {
      const response = await exportService.getExportJob(jobId);
      if (response.success && response.data) {
        setJobs(prev =>
          prev.map(job => (job.id === jobId ? response.data! : job))
        );
        return response.data;
      }
      return null;
    } catch (err) {
      console.error('Failed to get export job:', err);
      return null;
    }
  }, []);

  const downloadExport = useCallback(
    async (jobId: string) => {
      try {
        await exportService.downloadExport(jobId);
        toast({
          title: 'Success',
          description: 'Download started',
          variant: 'success',
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Download failed';
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  return {
    jobs,
    loading,
    error,
    createExport,
    getExportJob,
    downloadExport,
  };
}
