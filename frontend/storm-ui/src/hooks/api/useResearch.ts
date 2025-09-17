import { useState, useEffect, useCallback } from 'react';
import { researchService } from '../../services/research';
import {
  ResearchData,
  ConversationData,
  SourceData,
  SearchRequest,
} from '../../types/api';
import { useToast } from '../useToast';

export interface UseResearchOptions {
  projectId: string;
  autoFetch?: boolean;
}

export interface UseResearchResult {
  research: ResearchData | null;
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  search: (request: SearchRequest) => Promise<any[] | null>;
  addCustomSource: (source: {
    title: string;
    url: string;
    snippet: string;
    content?: string;
  }) => Promise<SourceData | null>;
  updateSource: (
    sourceId: string,
    updates: Partial<SourceData>
  ) => Promise<SourceData | null>;
  deleteSource: (sourceId: string) => Promise<boolean>;
  rateSource: (sourceId: string, rating: number) => Promise<SourceData | null>;
}

export function useResearch(options: UseResearchOptions): UseResearchResult {
  const [research, setResearch] = useState<ResearchData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchResearch = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await researchService.getProjectResearch(
        options.projectId
      );

      if (response.success && response.data) {
        setResearch(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch research data');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch research data';
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

  const search = useCallback(
    async (request: SearchRequest) => {
      setLoading(true);
      setError(null);

      try {
        const response = await researchService.search(request);

        if (response.success && response.data) {
          toast({
            title: 'Success',
            description: `Found ${response.data.length} search results`,
            variant: 'success',
          });
          return response.data;
        } else {
          throw new Error(response.error || 'Search failed');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Search failed';
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

  const addCustomSource = useCallback(
    async (source: {
      title: string;
      url: string;
      snippet: string;
      content?: string;
    }): Promise<SourceData | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await researchService.addCustomSource(
          options.projectId,
          source
        );

        if (response.success && response.data) {
          // Update research data with new source
          setResearch(prev =>
            prev
              ? {
                  ...prev,
                  sources: [...prev.sources, response.data!],
                  lastUpdated: new Date(),
                }
              : null
          );

          toast({
            title: 'Success',
            description: 'Source added successfully',
            variant: 'success',
          });

          return response.data;
        } else {
          throw new Error(response.error || 'Failed to add source');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to add source';
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
    [options.projectId, toast]
  );

  const updateSource = useCallback(
    async (
      sourceId: string,
      updates: Partial<SourceData>
    ): Promise<SourceData | null> => {
      setLoading(true);
      setError(null);

      try {
        const response = await researchService.updateSource(
          options.projectId,
          sourceId,
          updates
        );

        if (response.success && response.data) {
          // Update research data with updated source
          setResearch(prev =>
            prev
              ? {
                  ...prev,
                  sources: prev.sources.map(source =>
                    source.id === sourceId ? response.data! : source
                  ),
                  lastUpdated: new Date(),
                }
              : null
          );

          toast({
            title: 'Success',
            description: 'Source updated successfully',
            variant: 'success',
          });

          return response.data;
        } else {
          throw new Error(response.error || 'Failed to update source');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to update source';
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
    [options.projectId, toast]
  );

  const deleteSource = useCallback(
    async (sourceId: string): Promise<boolean> => {
      setLoading(true);
      setError(null);

      try {
        const response = await researchService.deleteSource(
          options.projectId,
          sourceId
        );

        if (response.success) {
          // Update research data by removing the source
          setResearch(prev =>
            prev
              ? {
                  ...prev,
                  sources: prev.sources.filter(
                    source => source.id !== sourceId
                  ),
                  lastUpdated: new Date(),
                }
              : null
          );

          toast({
            title: 'Success',
            description: 'Source deleted successfully',
            variant: 'success',
          });

          return true;
        } else {
          throw new Error(response.error || 'Failed to delete source');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to delete source';
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
    [options.projectId, toast]
  );

  const rateSource = useCallback(
    async (sourceId: string, rating: number): Promise<SourceData | null> => {
      try {
        const response = await researchService.rateSource(
          options.projectId,
          sourceId,
          rating
        );

        if (response.success && response.data) {
          // Update research data with rated source
          setResearch(prev =>
            prev
              ? {
                  ...prev,
                  sources: prev.sources.map(source =>
                    source.id === sourceId ? response.data! : source
                  ),
                  lastUpdated: new Date(),
                }
              : null
          );

          return response.data;
        } else {
          throw new Error(response.error || 'Failed to rate source');
        }
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to rate source';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
        return null;
      }
    },
    [options.projectId, toast]
  );

  const refetch = useCallback(() => fetchResearch(), [fetchResearch]);

  // Auto-fetch research on mount if enabled
  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchResearch();
    }
  }, [fetchResearch, options.autoFetch]);

  return {
    research,
    loading,
    error,
    refetch,
    search,
    addCustomSource,
    updateSource,
    deleteSource,
    rateSource,
  };
}

// Hook for conversations
export interface UseConversationsOptions {
  projectId: string;
  autoFetch?: boolean;
  page?: number;
  limit?: number;
  perspective?: string;
  status?: 'active' | 'completed' | 'failed';
}

export function useConversations(options: UseConversationsOptions) {
  const [conversations, setConversations] = useState<ConversationData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchConversations = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await researchService.getConversations(
        options.projectId,
        {
          page: options.page,
          limit: options.limit,
          perspective: options.perspective,
          status: options.status,
        }
      );

      if (response.success && response.data) {
        setConversations(response.data.items);
        setTotal(response.data.total);
      } else {
        throw new Error(response.error || 'Failed to fetch conversations');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch conversations';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [
    options.projectId,
    options.page,
    options.limit,
    options.perspective,
    options.status,
    toast,
  ]);

  const refetch = useCallback(() => fetchConversations(), [fetchConversations]);

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchConversations();
    }
  }, [fetchConversations, options.autoFetch]);

  return {
    conversations,
    total,
    loading,
    error,
    refetch,
  };
}

// Hook for sources
export interface UseSourcesOptions {
  projectId: string;
  autoFetch?: boolean;
  page?: number;
  limit?: number;
  sortBy?: 'relevance' | 'date' | 'title';
  sortOrder?: 'asc' | 'desc';
  usedOnly?: boolean;
}

export function useSources(options: UseSourcesOptions) {
  const [sources, setSources] = useState<SourceData[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchSources = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await researchService.getSources(options.projectId, {
        page: options.page,
        limit: options.limit,
        sortBy: options.sortBy,
        sortOrder: options.sortOrder,
        usedOnly: options.usedOnly,
      });

      if (response.success && response.data) {
        setSources(response.data.items);
        setTotal(response.data.total);
      } else {
        throw new Error(response.error || 'Failed to fetch sources');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to fetch sources';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  }, [options, toast]);

  const refetch = useCallback(() => fetchSources(), [fetchSources]);

  useEffect(() => {
    if (options.autoFetch !== false) {
      fetchSources();
    }
  }, [fetchSources, options.autoFetch]);

  return {
    sources,
    total,
    loading,
    error,
    refetch,
  };
}

// Hook for research analytics
export function useResearchAnalytics(projectId: string) {
  const [analytics, setAnalytics] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await researchService.getResearchAnalytics(projectId);

      if (response.success && response.data) {
        setAnalytics(response.data);
      } else {
        throw new Error(response.error || 'Failed to fetch research analytics');
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error
          ? err.message
          : 'Failed to fetch research analytics';
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

  const refetch = useCallback(() => fetchAnalytics(), [fetchAnalytics]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  return {
    analytics,
    loading,
    error,
    refetch,
  };
}
