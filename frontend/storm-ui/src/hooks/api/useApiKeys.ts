import { useState, useCallback } from 'react';
import { getApiService } from '../../services/base';
import { useToast } from '../useToast';

export function useApiKeys() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const setApiKey = useCallback(
    (apiKey: string) => {
      try {
        getApiService().setApiKey(apiKey);
        toast({
          title: 'Success',
          description: 'API key updated successfully',
          variant: 'success',
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to set API key';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const setAuthToken = useCallback(
    (token: string, persistent = false) => {
      try {
        getApiService().setAuthToken(token, persistent);
        toast({
          title: 'Success',
          description: 'Authentication token updated successfully',
          variant: 'success',
        });
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Failed to set auth token';
        setError(errorMessage);
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        });
      }
    },
    [toast]
  );

  const clearCredentials = useCallback(() => {
    try {
      getApiService().clearApiKey();
      getApiService().clearAuthToken();
      toast({
        title: 'Success',
        description: 'Credentials cleared successfully',
        variant: 'success',
      });
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to clear credentials';
      setError(errorMessage);
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      });
    }
  }, [toast]);

  const testConnection = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const isHealthy = await getApiService().healthCheck();
      if (isHealthy) {
        toast({
          title: 'Success',
          description: 'Connection test successful',
          variant: 'success',
        });
        return true;
      } else {
        toast({
          title: 'Warning',
          description: 'API is not responding',
          variant: 'destructive',
        });
        return false;
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Connection test failed';
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
  }, [toast]);

  return {
    loading,
    error,
    setApiKey,
    setAuthToken,
    clearCredentials,
    testConnection,
  };
}
