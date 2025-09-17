/**
 * API Configuration Management
 * Centralizes all API keys and configuration from environment variables
 */

import { env } from '@/lib/env';

// API Provider Types
export type LLMProvider =
  | 'openai'
  | 'anthropic'
  | 'azure'
  | 'gemini'
  | 'ollama'
  | 'groq';
export type RetrieverType =
  | 'google'
  | 'bing'
  | 'you'
  | 'duckduckgo'
  | 'tavily'
  | 'serper'
  | 'brave'
  | 'vector';

// Configuration Interfaces
interface LLMConfig {
  provider: LLMProvider;
  apiKey?: string;
  baseUrl?: string;
  model?: string;
  deploymentName?: string; // For Azure
  apiVersion?: string; // For Azure
}

interface RetrieverConfig {
  type: RetrieverType;
  apiKey?: string;
  baseUrl?: string;
}

interface APIConfig {
  backendUrl: string;
  wsUrl: string;
  llm: {
    providers: Partial<Record<LLMProvider, LLMConfig>>;
    default: LLMProvider;
    defaultModel: string;
    defaultTemperature: number;
    defaultMaxTokens: number;
  };
  retrievers: {
    providers: Partial<Record<RetrieverType, RetrieverConfig>>;
    default: RetrieverType;
    defaultMaxResults: number;
  };
  features: {
    enableCoStorm: boolean;
    enableAnalytics: boolean;
    enableDebugMode: boolean;
  };
  limits: {
    maxConcurrentPipelines: number;
    maxRequestsPerMinute: number;
  };
  storage: {
    enabled: boolean;
    prefix: string;
  };
}

// Environment variable helpers
const getEnv = (key: string, defaultValue = ''): string => {
  if (typeof window === 'undefined') {
    // Server-side
    return process.env[key] || defaultValue;
  }
  // Client-side - Next.js prefixes with NEXT_PUBLIC_
  const value = process.env[key];

  // Debug logging for key environment variables
  if (key.includes('API_KEY') && typeof window !== 'undefined') {
    console.log(
      `🔑 getEnv('${key}'): ${value ? `Found (${value.substring(0, 10)}...)` : 'NOT FOUND'}`
    );
  }

  return value || defaultValue;
};

const getEnvBool = (key: string, defaultValue = false): boolean => {
  const value = getEnv(key);
  if (!value) return defaultValue;
  return value.toLowerCase() === 'true';
};

const getEnvNumber = (key: string, defaultValue: number): number => {
  const value = getEnv(key);
  if (!value) return defaultValue;
  const num = parseInt(value, 10);
  return isNaN(num) ? defaultValue : num;
};

// Build LLM provider configurations
const buildLLMProviders = (): Partial<Record<LLMProvider, LLMConfig>> => {
  const providers: Partial<Record<LLMProvider, LLMConfig>> = {};

  // OpenAI
  if (env.OPENAI_API_KEY) {
    providers.openai = {
      provider: 'openai',
      apiKey: env.OPENAI_API_KEY,
      baseUrl: undefined,
      model: env.DEFAULT_LLM_MODEL,
    };
  }

  // Anthropic
  if (env.ANTHROPIC_API_KEY) {
    providers.anthropic = {
      provider: 'anthropic',
      apiKey: env.ANTHROPIC_API_KEY,
      model: 'claude-3-5-sonnet-20241022',
    };
  }

  // Azure OpenAI
  if (env.AZURE_API_KEY) {
    providers.azure = {
      provider: 'azure',
      apiKey: env.AZURE_API_KEY,
      baseUrl: undefined,
      apiVersion: '2024-02-01',
    };
  }

  // Google Gemini
  if (env.GOOGLE_API_KEY) {
    providers.gemini = {
      provider: 'gemini',
      apiKey: env.GOOGLE_API_KEY,
      model: 'gemini-pro',
    };
  }

  // Groq
  if (env.GROQ_API_KEY) {
    providers.groq = {
      provider: 'groq',
      apiKey: env.GROQ_API_KEY,
      model: 'llama2-70b-4096',
    };
  }

  // Ollama (local)
  const ollamaUrl = getEnv('NEXT_PUBLIC_OLLAMA_BASE_URL');
  if (ollamaUrl) {
    providers.ollama = {
      provider: 'ollama',
      baseUrl: ollamaUrl,
      model: 'llama2',
    };
  }

  return providers;
};

// Build retriever configurations
const buildRetrieverProviders = (): Partial<
  Record<RetrieverType, RetrieverConfig>
> => {
  const providers: Partial<Record<RetrieverType, RetrieverConfig>> = {};

  // Tavily
  if (env.TAVILY_API_KEY) {
    providers.tavily = {
      type: 'tavily',
      apiKey: env.TAVILY_API_KEY,
    };
  }

  // Google Search
  if (env.GOOGLE_SEARCH_API_KEY && env.GOOGLE_CSE_ID) {
    providers.google = {
      type: 'google',
      apiKey: env.GOOGLE_SEARCH_API_KEY,
      baseUrl: env.GOOGLE_CSE_ID, // Store CSE ID in baseUrl for now
    };
  }

  // Serper
  if (env.SERPER_API_KEY) {
    providers.serper = {
      type: 'serper',
      apiKey: env.SERPER_API_KEY,
    };
  }

  // You.com
  if (env.YDC_API_KEY) {
    providers.you = {
      type: 'you',
      apiKey: env.YDC_API_KEY,
    };
  }

  // Bing Search
  if (env.BING_SEARCH_API_KEY) {
    providers.bing = {
      type: 'bing',
      apiKey: env.BING_SEARCH_API_KEY,
    };
  }

  // Brave
  if (env.BRAVE_API_KEY) {
    providers.brave = {
      type: 'brave',
      apiKey: env.BRAVE_API_KEY,
    };
  }

  // DuckDuckGo (no API key needed)
  if (env.USE_DUCKDUCKGO) {
    providers.duckduckgo = {
      type: 'duckduckgo',
    };
  }

  // Vector DB (Qdrant)
  const qdrantKey = getEnv('NEXT_PUBLIC_QDRANT_API_KEY');
  const qdrantUrl = getEnv('NEXT_PUBLIC_QDRANT_URL');
  if (qdrantKey || qdrantUrl) {
    providers.vector = {
      type: 'vector',
      apiKey: qdrantKey,
      baseUrl: qdrantUrl,
    };
  }

  return providers;
};

// Main API Configuration
export const apiConfig: APIConfig = {
  backendUrl: env.API_URL,
  wsUrl: env.WS_URL,

  llm: {
    providers: buildLLMProviders(),
    default: env.DEFAULT_LLM_PROVIDER as LLMProvider,
    defaultModel: env.DEFAULT_LLM_MODEL,
    defaultTemperature: env.DEFAULT_TEMPERATURE,
    defaultMaxTokens: env.DEFAULT_MAX_TOKENS,
  },

  retrievers: {
    providers: buildRetrieverProviders(),
    default: env.DEFAULT_RETRIEVER_TYPE as RetrieverType,
    defaultMaxResults: env.DEFAULT_MAX_SEARCH_RESULTS,
  },

  features: {
    enableCoStorm: false,
    enableAnalytics: false,
    enableDebugMode: env.ENABLE_DEBUG_MODE,
  },

  limits: {
    maxConcurrentPipelines: getEnvNumber(
      'NEXT_PUBLIC_MAX_CONCURRENT_PIPELINES',
      3
    ),
    maxRequestsPerMinute: getEnvNumber(
      'NEXT_PUBLIC_MAX_REQUESTS_PER_MINUTE',
      60
    ),
  },

  storage: {
    enabled: getEnvBool('NEXT_PUBLIC_ENABLE_LOCAL_STORAGE', true),
    prefix: getEnv('NEXT_PUBLIC_STORAGE_PREFIX', 'storm_ui_'),
  },
};

// Helper functions to get specific configurations
export const getLLMConfig = (provider?: LLMProvider): LLMConfig | undefined => {
  const p = provider || apiConfig.llm.default;
  return apiConfig.llm.providers[p];
};

export const getRetrieverConfig = (
  type?: RetrieverType
): RetrieverConfig | undefined => {
  const t = type || apiConfig.retrievers.default;
  return apiConfig.retrievers.providers[t];
};

// Check if a provider is configured
export const isLLMProviderConfigured = (provider: LLMProvider): boolean => {
  const config = apiConfig.llm.providers[provider];
  return !!(config && (config.apiKey || config.baseUrl));
};

export const isRetrieverConfigured = (type: RetrieverType): boolean => {
  const config = apiConfig.retrievers.providers[type];
  // DuckDuckGo doesn't need an API key
  if (type === 'duckduckgo') return true;
  return !!(config && (config.apiKey || config.baseUrl));
};

// Get available providers
export const getAvailableLLMProviders = (): LLMProvider[] => {
  return Object.keys(apiConfig.llm.providers) as LLMProvider[];
};

export const getAvailableRetrievers = (): RetrieverType[] => {
  return Object.keys(apiConfig.retrievers.providers) as RetrieverType[];
};

// Validate configuration
export const validateConfig = (): { valid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check if at least one LLM provider is configured
  const llmProviders = getAvailableLLMProviders();
  if (llmProviders.length === 0) {
    errors.push(
      'No LLM providers configured. Please add at least one API key.'
    );
  }

  // Check if at least one retriever is configured
  const retrievers = getAvailableRetrievers();
  if (retrievers.length === 0) {
    errors.push(
      'No retrievers configured. Please add at least one search API key.'
    );
  }

  // Check if backend URL is configured
  if (!apiConfig.backendUrl) {
    errors.push('Backend API URL is not configured.');
  }

  return {
    valid: errors.length === 0,
    errors,
  };
};

// Export configuration for debugging
if (typeof window !== 'undefined' && apiConfig.features.enableDebugMode) {
  (window as any).__API_CONFIG__ = apiConfig;
  console.log(
    '🔧 API Configuration loaded. Access via __API_CONFIG__ in console.'
  );
}
