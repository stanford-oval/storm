import { useState, useEffect } from 'react';

interface LLMModel {
  id: string;
  name: string;
  provider: string;
  description?: string;
  contextLength?: number;
}

interface LLMProvider {
  name: string;
  endpoint?: string;
  available: boolean;
  models: LLMModel[];
  error?: string;
}

interface UseAvailableModelsResult {
  models: LLMModel[];
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useAvailableModels(provider: string): UseAvailableModelsResult {
  const [models, setModels] = useState<LLMModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchModels = async () => {
    if (!provider) {
      setModels([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

      // Add query params for local providers
      let url = `${apiUrl}/models/providers/${provider}/models`;
      if (provider === 'ollama') {
        url += '?host=localhost&port=11434';
      } else if (provider === 'lmstudio') {
        url += '?host=localhost&port=1234';
      }

      const response = await fetch(url);
      const data: LLMProvider = await response.json();

      if (data.available && data.models) {
        setModels(data.models);
      } else {
        setModels([]);
        if (data.error) {
          setError(data.error);
        }
      }
    } catch (err) {
      console.error('Failed to fetch models:', err);
      setError('Failed to fetch available models');
      setModels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchModels();
  }, [provider]);

  return {
    models,
    loading,
    error,
    refetch: fetchModels
  };
}

// Hook to get all providers and their status
export function useAllProviders() {
  const [providers, setProviders] = useState<Record<string, LLMProvider>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProviders = async () => {
    setLoading(true);
    setError(null);

    try {
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const response = await fetch(`${apiUrl}/models/providers`);
      const data = await response.json();
      setProviders(data);
    } catch (err) {
      console.error('Failed to fetch providers:', err);
      setError('Failed to fetch providers');
      setProviders({});
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProviders();
  }, []);

  return {
    providers,
    loading,
    error,
    refetch: fetchProviders
  };
}

// Get default models for a provider - always empty, forcing API query
export function getDefaultModels(provider: string): LLMModel[] {
  // Always return empty array to force fetching from API
  // This ensures we never use hardcoded models
  return [];
}