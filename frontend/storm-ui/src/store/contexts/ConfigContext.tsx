'use client';

// Configuration context provider
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from 'react';
import { StormConfig } from '@/types/storm';

// Application configuration interface
export interface AppConfig {
  // API configuration
  api: {
    baseUrl: string;
    timeout: number;
    retries: number;
    retryDelay: number;
  };

  // Default STORM configuration
  storm: StormConfig;

  // Feature flags
  features: {
    enableCoStorm: boolean;
    enableAnalytics: boolean;
    enableTelemetry: boolean;
    enableDebugMode: boolean;
    enableExperimentalFeatures: boolean;
    enableOfflineMode: boolean;
  };

  // UI configuration
  ui: {
    defaultLanguage: string;
    supportedLanguages: string[];
    dateFormat: string;
    timeFormat: string;
    timezone: string;
    currency: string;
    numberFormat: string;
  };

  // Performance configuration
  performance: {
    enableVirtualization: boolean;
    lazyLoadingThreshold: number;
    cacheSize: number;
    debounceDelay: number;
    throttleDelay: number;
  };

  // Security configuration
  security: {
    enableCSP: boolean;
    allowedOrigins: string[];
    tokenRefreshThreshold: number;
    maxLoginAttempts: number;
    lockoutDuration: number;
  };

  // Development configuration
  development: {
    enableHotReload: boolean;
    enableSourceMaps: boolean;
    logLevel: 'debug' | 'info' | 'warn' | 'error';
    mockApi: boolean;
  };
}

// Default configuration
const defaultConfig: AppConfig = {
  api: {
    baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000',
    timeout: 30000,
    retries: 3,
    retryDelay: 1000,
  },

  storm: {
    llm: {
      model: 'gpt-4',
      provider: 'openai',
      temperature: 0.7,
      maxTokens: 4000,
    },
    retriever: {
      type: 'bing',
      maxResults: 10,
    },
    pipeline: {
      doResearch: true,
      doGenerateOutline: true,
      doGenerateArticle: true,
      doPolishArticle: true,
      maxConvTurns: 3,
      maxPerspectives: 4,
    },
  },

  features: {
    enableCoStorm: true,
    enableAnalytics: process.env.NODE_ENV === 'production',
    enableTelemetry: process.env.NODE_ENV === 'production',
    enableDebugMode: process.env.NODE_ENV === 'development',
    enableExperimentalFeatures: process.env.NODE_ENV === 'development',
    enableOfflineMode: false,
  },

  ui: {
    defaultLanguage: 'en',
    supportedLanguages: ['en', 'es', 'fr', 'de', 'ja', 'zh'],
    dateFormat: 'MM/dd/yyyy',
    timeFormat: '12h',
    timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    currency: 'USD',
    numberFormat: 'en-US',
  },

  performance: {
    enableVirtualization: true,
    lazyLoadingThreshold: 100,
    cacheSize: 50,
    debounceDelay: 300,
    throttleDelay: 100,
  },

  security: {
    enableCSP: true,
    allowedOrigins: ['http://localhost:3000', 'http://localhost:8000'],
    tokenRefreshThreshold: 300, // 5 minutes
    maxLoginAttempts: 5,
    lockoutDuration: 900, // 15 minutes
  },

  development: {
    enableHotReload: process.env.NODE_ENV === 'development',
    enableSourceMaps: process.env.NODE_ENV === 'development',
    logLevel: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
    mockApi: false,
  },
};

// Configuration context
interface ConfigContextType {
  config: AppConfig;
  updateConfig: (updates: Partial<AppConfig>) => void;
  resetConfig: () => void;
  isLoading: boolean;
  error: string | null;
  version: string;
}

const ConfigContext = createContext<ConfigContextType | undefined>(undefined);

// Configuration provider props
export interface ConfigProviderProps {
  children: ReactNode;
  configUrl?: string;
  fallbackConfig?: Partial<AppConfig>;
  enableRemoteConfig?: boolean;
  enableConfigValidation?: boolean;
}

// Configuration provider component
export const ConfigProvider: React.FC<ConfigProviderProps> = ({
  children,
  configUrl,
  fallbackConfig,
  enableRemoteConfig = false,
  enableConfigValidation = true,
}) => {
  const [config, setConfig] = useState<AppConfig>(defaultConfig);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState('1.0.0');

  // Load configuration on mount
  useEffect(() => {
    loadConfiguration();
  }, []);

  // Load configuration from various sources
  const loadConfiguration = async () => {
    setIsLoading(true);
    setError(null);

    try {
      let loadedConfig = { ...defaultConfig };

      // Merge with fallback config if provided
      if (fallbackConfig) {
        loadedConfig = mergeConfig(loadedConfig, fallbackConfig);
      }

      // Load from environment variables
      const envConfig = loadFromEnvironment();
      if (envConfig) {
        loadedConfig = mergeConfig(loadedConfig, envConfig);
      }

      // Load from localStorage
      const localConfig = loadFromLocalStorage();
      if (localConfig) {
        loadedConfig = mergeConfig(loadedConfig, localConfig);
      }

      // Load from remote URL if enabled
      if (enableRemoteConfig && configUrl) {
        try {
          const remoteConfig = await loadFromRemote(configUrl);
          if (remoteConfig) {
            loadedConfig = mergeConfig(loadedConfig, remoteConfig);
          }
        } catch (remoteError) {
          console.warn('Failed to load remote configuration:', remoteError);
          // Continue with local configuration
        }
      }

      // Validate configuration if enabled
      if (enableConfigValidation) {
        const validationResult = validateConfig(loadedConfig);
        if (!validationResult.isValid) {
          console.warn(
            'Configuration validation warnings:',
            validationResult.warnings
          );
          if (validationResult.errors.length > 0) {
            throw new Error(
              `Configuration validation failed: ${validationResult.errors.join(', ')}`
            );
          }
        }
      }

      setConfig(loadedConfig);
      setVersion((loadedConfig as any).version || '1.0.0');
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : 'Failed to load configuration';
      setError(errorMessage);
      console.error('Configuration loading error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Update configuration
  const updateConfig = (updates: Partial<AppConfig>) => {
    setConfig(prev => {
      const newConfig = mergeConfig(prev, updates);

      // Save to localStorage
      try {
        localStorage.setItem('app-config', JSON.stringify(updates));
      } catch (error) {
        console.warn('Failed to save configuration to localStorage:', error);
      }

      return newConfig;
    });
  };

  // Reset configuration to defaults
  const resetConfig = () => {
    setConfig(defaultConfig);

    // Clear localStorage
    try {
      localStorage.removeItem('app-config');
    } catch (error) {
      console.warn('Failed to clear configuration from localStorage:', error);
    }
  };

  const contextValue: ConfigContextType = {
    config,
    updateConfig,
    resetConfig,
    isLoading,
    error,
    version,
  };

  return (
    <ConfigContext.Provider value={contextValue}>
      {children}
    </ConfigContext.Provider>
  );
};

// Hook to use configuration context
export const useConfig = (): ConfigContextType => {
  const context = useContext(ConfigContext);
  if (context === undefined) {
    throw new Error('useConfig must be used within a ConfigProvider');
  }
  return context;
};

// Hook for specific configuration sections
export const useApiConfig = () => useConfig().config.api;
export const useStormConfig = () => useConfig().config.storm;
export const useFeatureFlags = () => useConfig().config.features;
export const useUIConfig = () => useConfig().config.ui;
export const usePerformanceConfig = () => useConfig().config.performance;
export const useSecurityConfig = () => useConfig().config.security;
export const useDevelopmentConfig = () => useConfig().config.development;

// Feature flag hook
export const useFeature = (
  featureName: keyof AppConfig['features']
): boolean => {
  const features = useFeatureFlags();
  return features[featureName];
};

// Configuration loading utilities
const loadFromEnvironment = (): Partial<AppConfig> | null => {
  try {
    const envConfig: Partial<AppConfig> = {};

    // API configuration from environment
    if (process.env.NEXT_PUBLIC_API_BASE_URL) {
      envConfig.api = {
        ...(envConfig.api || {}),
        baseUrl: process.env.NEXT_PUBLIC_API_BASE_URL,
      } as AppConfig['api'];
    }

    // Feature flags from environment
    const features: Partial<AppConfig['features']> = {};
    if (process.env.NEXT_PUBLIC_ENABLE_ANALYTICS !== undefined) {
      features.enableAnalytics =
        process.env.NEXT_PUBLIC_ENABLE_ANALYTICS === 'true';
    }
    if (process.env.NEXT_PUBLIC_ENABLE_TELEMETRY !== undefined) {
      features.enableTelemetry =
        process.env.NEXT_PUBLIC_ENABLE_TELEMETRY === 'true';
    }
    if (process.env.NEXT_PUBLIC_DEBUG_MODE !== undefined) {
      features.enableDebugMode = process.env.NEXT_PUBLIC_DEBUG_MODE === 'true';
    }

    if (Object.keys(features).length > 0) {
      envConfig.features = features as AppConfig['features'];
    }

    return Object.keys(envConfig).length > 0 ? envConfig : null;
  } catch (error) {
    console.warn('Failed to load configuration from environment:', error);
    return null;
  }
};

const loadFromLocalStorage = (): Partial<AppConfig> | null => {
  try {
    const stored = localStorage.getItem('app-config');
    if (stored) {
      return JSON.parse(stored);
    }
    return null;
  } catch (error) {
    console.warn('Failed to load configuration from localStorage:', error);
    return null;
  }
};

const loadFromRemote = async (
  url: string
): Promise<Partial<AppConfig> | null> => {
  try {
    const response = await fetch(url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    console.warn('Failed to load remote configuration:', error);
    throw error;
  }
};

// Configuration validation
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

const validateConfig = (config: AppConfig): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  // Validate API configuration
  if (!config.api.baseUrl) {
    errors.push('API base URL is required');
  } else {
    try {
      new URL(config.api.baseUrl);
    } catch {
      errors.push('Invalid API base URL format');
    }
  }

  if (config.api.timeout < 1000) {
    warnings.push('API timeout is very low (< 1 second)');
  }

  if (config.api.retries < 0 || config.api.retries > 10) {
    warnings.push('API retry count should be between 0 and 10');
  }

  // Validate STORM configuration
  if (!config.storm.llm?.model) {
    errors.push('STORM LLM model is required');
  }

  if (!config.storm.llm?.provider) {
    errors.push('STORM LLM provider is required');
  }

  if (
    config.storm.llm?.temperature !== undefined &&
    (config.storm.llm.temperature < 0 || config.storm.llm.temperature > 2)
  ) {
    warnings.push('STORM LLM temperature should be between 0 and 2');
  }

  // Validate performance configuration
  if (config.performance.cacheSize < 0) {
    warnings.push('Cache size should be positive');
  }

  if (config.performance.debounceDelay < 0) {
    warnings.push('Debounce delay should be positive');
  }

  // Validate security configuration
  if (config.security.maxLoginAttempts < 1) {
    warnings.push('Max login attempts should be at least 1');
  }

  if (config.security.lockoutDuration < 0) {
    warnings.push('Lockout duration should be positive');
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

// Configuration merging utility
const mergeConfig = (
  base: AppConfig,
  updates: Partial<AppConfig>
): AppConfig => {
  const merged = { ...base };

  Object.keys(updates).forEach(key => {
    const section = key as keyof AppConfig;
    const update = updates[section];

    if (update && typeof update === 'object' && !Array.isArray(update)) {
      merged[section] = {
        ...merged[section],
        ...update,
      } as any;
    } else if (update !== undefined) {
      (merged as any)[section] = update;
    }
  });

  return merged;
};

// Higher-order component for configuration injection
export const withConfig = <P extends object>(
  Component: React.ComponentType<P & { config: AppConfig }>
) => {
  return React.forwardRef<any, P>((props, ref) => {
    const { config } = useConfig();
    return <Component {...(props as P)} config={config} ref={ref} />;
  });
};

// Configuration debug component
export const ConfigDebug: React.FC<{ expanded?: boolean }> = ({
  expanded = false,
}) => {
  const { config, version, isLoading, error } = useConfig();
  const [isExpanded, setIsExpanded] = useState(expanded);

  if (process.env.NODE_ENV === 'production') {
    return null;
  }

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '10px',
        right: '10px',
        backgroundColor: '#1f2937',
        color: '#f9fafb',
        padding: '8px',
        borderRadius: '4px',
        fontSize: '12px',
        maxWidth: isExpanded ? '400px' : '150px',
        maxHeight: isExpanded ? '300px' : '40px',
        overflow: 'auto',
        zIndex: 10000,
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)',
      }}
    >
      <div
        style={{ cursor: 'pointer', fontWeight: 'bold' }}
        onClick={() => setIsExpanded(!isExpanded)}
      >
        Config Debug v{version} {isExpanded ? '▼' : '▲'}
      </div>

      {isExpanded && (
        <div style={{ marginTop: '8px' }}>
          {isLoading && <div>Loading configuration...</div>}
          {error && <div style={{ color: '#f87171' }}>Error: {error}</div>}

          <pre
            style={{
              margin: 0,
              whiteSpace: 'pre-wrap',
              fontSize: '10px',
              maxHeight: '200px',
              overflow: 'auto',
            }}
          >
            {JSON.stringify(config, null, 2)}
          </pre>
        </div>
      )}
    </div>
  );
};
