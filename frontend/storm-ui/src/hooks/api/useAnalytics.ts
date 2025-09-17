import { useState, useCallback } from 'react';
import { analyticsService } from '../../services/analytics';
import { CreateEventRequest, AnalyticsQuery } from '../../types/api';
import { useToast } from '../useToast';

export function useAnalytics() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const trackEvent = useCallback(async (event: CreateEventRequest) => {
    try {
      await analyticsService.trackEvent(event);
    } catch (err) {
      console.error('Failed to track event:', err);
    }
  }, []);

  const getAnalyticsSummary = useCallback(async (query: AnalyticsQuery) => {
    setLoading(true);
    try {
      const response = await analyticsService.getAnalyticsSummary(query);
      if (response.success && response.data) {
        return response.data;
      }
      return null;
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to get analytics';
      setError(errorMessage);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const getProjectAnalytics = useCallback(
    async (projectId: string, options?: any) => {
      setLoading(true);
      try {
        const response = await analyticsService.getProjectAnalytics(
          projectId,
          options
        );
        if (response.success && response.data) {
          return response.data;
        }
        return null;
      } catch (err) {
        const errorMessage =
          err instanceof Error
            ? err.message
            : 'Failed to get project analytics';
        setError(errorMessage);
        return null;
      } finally {
        setLoading(false);
      }
    },
    []
  );

  return {
    loading,
    error,
    trackEvent,
    getAnalyticsSummary,
    getProjectAnalytics,
  };
}
