import { useState, useEffect, useCallback } from 'react';
import { configService } from '../../services/config';
import {
  StormConfig,
  ConfigTemplate,
  LLMModel,
  RetrieverInfo,
} from '../../types/api';
import { useToast } from '../useToast';

export function useConfig() {
  const [templates, setTemplates] = useState<ConfigTemplate[]>([]);
  const [defaultConfig, setDefaultConfig] = useState<StormConfig | null>(null);
  const [llmModels, setLlmModels] = useState<LLMModel[]>([]);
  const [retrievers, setRetrievers] = useState<RetrieverInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  const fetchTemplates = useCallback(async () => {
    try {
      const response = await configService.getConfigTemplates();
      if (response.success && response.data) {
        setTemplates(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch config templates:', err);
    }
  }, []);

  const fetchDefaultConfig = useCallback(async () => {
    try {
      const response = await configService.getDefaultConfig();
      if (response.success && response.data) {
        setDefaultConfig(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch default config:', err);
    }
  }, []);

  const fetchLlmModels = useCallback(async () => {
    try {
      const response = await configService.getAvailableLLMModels();
      if (response.success && response.data) {
        setLlmModels(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch LLM models:', err);
    }
  }, []);

  const fetchRetrievers = useCallback(async () => {
    try {
      const response = await configService.getAvailableRetrievers();
      if (response.success && response.data) {
        setRetrievers(response.data);
      }
    } catch (err) {
      console.error('Failed to fetch retrievers:', err);
    }
  }, []);

  const validateConfig = useCallback(
    async (config: StormConfig) => {
      setLoading(true);
      try {
        const response = await configService.validateConfig({ config });
        return response.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Validation failed';
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

  const testLlmConfig = useCallback(
    async (llmConfig: StormConfig['llm']) => {
      setLoading(true);
      try {
        const response = await configService.testLLMConfig(llmConfig);
        return response.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'LLM test failed';
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

  const testRetrieverConfig = useCallback(
    async (retrieverConfig: StormConfig['retriever']) => {
      setLoading(true);
      try {
        const response =
          await configService.testRetrieverConfig(retrieverConfig);
        return response.data;
      } catch (err) {
        const errorMessage =
          err instanceof Error ? err.message : 'Retriever test failed';
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
    fetchDefaultConfig();
    fetchLlmModels();
    fetchRetrievers();
  }, [fetchTemplates, fetchDefaultConfig, fetchLlmModels, fetchRetrievers]);

  return {
    templates,
    defaultConfig,
    llmModels,
    retrievers,
    loading,
    error,
    validateConfig,
    testLlmConfig,
    testRetrieverConfig,
    refetch: () => {
      fetchTemplates();
      fetchDefaultConfig();
      fetchLlmModels();
      fetchRetrievers();
    },
  };
}
