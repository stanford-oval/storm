import { BaseApiService } from './base';
import { ApiResponse } from '../types/storm';
import {
  StormConfig,
  SaveConfigRequest,
  ConfigTemplate,
  ValidateConfigRequest,
  ConfigValidationResponse,
} from '../types/api';

export class ConfigService extends BaseApiService {
  private readonly basePath = '/v1/config';

  /**
   * Get all configuration templates
   */
  async getConfigTemplates(): Promise<ApiResponse<ConfigTemplate[]>> {
    return this.get<ConfigTemplate[]>(`${this.basePath}/templates`);
  }

  /**
   * Get a specific configuration template
   */
  async getConfigTemplate(
    templateId: string
  ): Promise<ApiResponse<ConfigTemplate>> {
    return this.get<ConfigTemplate>(`${this.basePath}/templates/${templateId}`);
  }

  /**
   * Create a new configuration template
   */
  async createConfigTemplate(
    request: SaveConfigRequest
  ): Promise<ApiResponse<ConfigTemplate>> {
    return this.post<ConfigTemplate>(`${this.basePath}/templates`, request);
  }

  /**
   * Update a configuration template
   */
  async updateConfigTemplate(
    templateId: string,
    updates: Partial<SaveConfigRequest>
  ): Promise<ApiResponse<ConfigTemplate>> {
    return this.put<ConfigTemplate>(
      `${this.basePath}/templates/${templateId}`,
      updates
    );
  }

  /**
   * Delete a configuration template
   */
  async deleteConfigTemplate(templateId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`${this.basePath}/templates/${templateId}`);
  }

  /**
   * Set a template as default
   */
  async setDefaultTemplate(
    templateId: string
  ): Promise<ApiResponse<ConfigTemplate>> {
    return this.post<ConfigTemplate>(
      `${this.basePath}/templates/${templateId}/set-default`
    );
  }

  /**
   * Get the default configuration
   */
  async getDefaultConfig(): Promise<ApiResponse<StormConfig>> {
    return this.get<StormConfig>(`${this.basePath}/default`);
  }

  /**
   * Update the default configuration
   */
  async updateDefaultConfig(
    config: StormConfig
  ): Promise<ApiResponse<StormConfig>> {
    return this.put<StormConfig>(`${this.basePath}/default`, { config });
  }

  /**
   * Validate a configuration
   */
  async validateConfig(
    request: ValidateConfigRequest
  ): Promise<ApiResponse<ConfigValidationResponse>> {
    return this.post<ConfigValidationResponse>(
      `${this.basePath}/validate`,
      request
    );
  }

  /**
   * Test LLM configuration
   */
  async testLLMConfig(
    llmConfig: StormConfig['llm']
  ): Promise<ApiResponse<LLMTestResult>> {
    return this.post<LLMTestResult>(`${this.basePath}/test/llm`, { llmConfig });
  }

  /**
   * Test retriever configuration
   */
  async testRetrieverConfig(
    retrieverConfig: StormConfig['retriever']
  ): Promise<ApiResponse<RetrieverTestResult>> {
    return this.post<RetrieverTestResult>(`${this.basePath}/test/retriever`, {
      retrieverConfig,
    });
  }

  /**
   * Get available LLM models
   */
  async getAvailableLLMModels(
    provider?: string
  ): Promise<ApiResponse<LLMModel[]>> {
    const params = new URLSearchParams();
    if (provider) params.append('provider', provider);

    const url = `${this.basePath}/models${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<LLMModel[]>(url);
  }

  /**
   * Get available retriever types
   */
  async getAvailableRetrievers(): Promise<ApiResponse<RetrieverInfo[]>> {
    return this.get<RetrieverInfo[]>(`${this.basePath}/retrievers`);
  }

  /**
   * Get model pricing information
   */
  async getModelPricing(model?: string): Promise<ApiResponse<ModelPricing[]>> {
    const params = new URLSearchParams();
    if (model) params.append('model', model);

    const url = `${this.basePath}/pricing${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<ModelPricing[]>(url);
  }

  /**
   * Get configuration recommendations
   */
  async getConfigRecommendations(
    context: ConfigRecommendationContext
  ): Promise<ApiResponse<ConfigRecommendation[]>> {
    return this.post<ConfigRecommendation[]>(
      `${this.basePath}/recommendations`,
      context
    );
  }

  /**
   * Import configuration from file
   */
  async importConfig(file: File): Promise<ApiResponse<StormConfig>> {
    return this.uploadFile<StormConfig>(`${this.basePath}/import`, file);
  }

  /**
   * Export configuration to file
   */
  async exportConfig(
    config: StormConfig,
    format: 'json' | 'yaml' | 'toml'
  ): Promise<Blob> {
    const response = await this.post<{ content: string; filename: string }>(
      `${this.basePath}/export`,
      { config, format },
      { responseType: 'json' }
    );

    const blob = new Blob([response.data!.content], {
      type: format === 'json' ? 'application/json' : 'text/plain',
    });

    // Auto-download
    if (typeof window !== 'undefined') {
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = response.data!.filename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    }

    return blob;
  }

  /**
   * Get configuration history for a project
   */
  async getConfigHistory(
    projectId: string
  ): Promise<ApiResponse<ConfigHistoryEntry[]>> {
    return this.get<ConfigHistoryEntry[]>(
      `${this.basePath}/history/${projectId}`
    );
  }

  /**
   * Revert to a previous configuration
   */
  async revertConfig(
    projectId: string,
    historyEntryId: string
  ): Promise<ApiResponse<StormConfig>> {
    return this.post<StormConfig>(`${this.basePath}/revert`, {
      projectId,
      historyEntryId,
    });
  }

  /**
   * Compare configurations
   */
  async compareConfigs(
    config1: StormConfig,
    config2: StormConfig
  ): Promise<ApiResponse<ConfigComparison>> {
    return this.post<ConfigComparison>(`${this.basePath}/compare`, {
      config1,
      config2,
    });
  }

  /**
   * Get configuration presets for specific use cases
   */
  async getConfigPresets(): Promise<ApiResponse<ConfigPreset[]>> {
    return this.get<ConfigPreset[]>(`${this.basePath}/presets`);
  }

  /**
   * Apply a configuration preset
   */
  async applyConfigPreset(
    presetId: string,
    customizations?: Partial<StormConfig>
  ): Promise<ApiResponse<StormConfig>> {
    return this.post<StormConfig>(
      `${this.basePath}/presets/${presetId}/apply`,
      {
        customizations,
      }
    );
  }

  /**
   * Get API key validation status
   */
  async validateApiKeys(
    config: StormConfig
  ): Promise<ApiResponse<ApiKeyValidation>> {
    return this.post<ApiKeyValidation>(`${this.basePath}/validate-keys`, {
      config,
    });
  }

  /**
   * Get quota information for API keys
   */
  async getApiKeyQuotas(
    config: StormConfig
  ): Promise<ApiResponse<ApiKeyQuota[]>> {
    return this.post<ApiKeyQuota[]>(`${this.basePath}/quotas`, { config });
  }

  /**
   * Optimize configuration for performance
   */
  async optimizeConfig(
    config: StormConfig,
    objectives: OptimizationObjective[]
  ): Promise<ApiResponse<OptimizedConfig>> {
    return this.post<OptimizedConfig>(`${this.basePath}/optimize`, {
      config,
      objectives,
    });
  }

  /**
   * Get configuration schema for validation
   */
  async getConfigSchema(): Promise<ApiResponse<ConfigSchema>> {
    return this.get<ConfigSchema>(`${this.basePath}/schema`);
  }

  /**
   * Generate configuration from requirements
   */
  async generateConfig(
    requirements: ConfigRequirements
  ): Promise<ApiResponse<StormConfig>> {
    return this.post<StormConfig>(`${this.basePath}/generate`, requirements);
  }

  /**
   * Get environment-specific configurations
   */
  async getEnvironmentConfigs(): Promise<ApiResponse<EnvironmentConfig[]>> {
    return this.get<EnvironmentConfig[]>(`${this.basePath}/environments`);
  }

  /**
   * Switch to environment-specific configuration
   */
  async switchEnvironment(
    environment: string
  ): Promise<ApiResponse<StormConfig>> {
    return this.post<StormConfig>(
      `${this.basePath}/environments/${environment}/activate`
    );
  }
}

// Additional types specific to ConfigService
export interface LLMTestResult {
  success: boolean;
  model: string;
  provider: string;
  responseTime: number;
  tokenCount: number;
  error?: string;
  capabilities: {
    chat: boolean;
    streaming: boolean;
    functionCalling: boolean;
    maxTokens: number;
  };
  sampleResponse: string;
}

export interface RetrieverTestResult {
  success: boolean;
  type: string;
  responseTime: number;
  resultCount: number;
  error?: string;
  sampleResults: Array<{
    title: string;
    url: string;
    snippet: string;
  }>;
  rateLimit?: {
    remaining: number;
    resetAt: Date;
  };
}

export interface LLMModel {
  id: string;
  name: string;
  provider: string;
  type: 'chat' | 'completion' | 'embedding';
  contextLength: number;
  inputPricing: number;
  outputPricing: number;
  currency: string;
  capabilities: string[];
  status: 'available' | 'deprecated' | 'beta';
  description?: string;
}

export interface RetrieverInfo {
  type: string;
  name: string;
  description: string;
  requiresApiKey: boolean;
  maxResults: number;
  supportedFilters: string[];
  rateLimit?: {
    requestsPerMinute: number;
    requestsPerDay: number;
  };
  documentation: string;
}

export interface ModelPricing {
  model: string;
  provider: string;
  inputPricing: number;
  outputPricing: number;
  currency: string;
  unit: string;
  lastUpdated: Date;
  estimatedCostPer1000Tokens: number;
}

export interface ConfigRecommendationContext {
  useCase:
    | 'research'
    | 'creative_writing'
    | 'academic'
    | 'news'
    | 'technical'
    | 'general';
  budget: 'low' | 'medium' | 'high' | 'unlimited';
  priority: 'speed' | 'quality' | 'cost' | 'balanced';
  language?: string;
  domain?: string;
  complexity: 'simple' | 'medium' | 'complex';
}

export interface ConfigRecommendation {
  id: string;
  name: string;
  description: string;
  config: StormConfig;
  score: number;
  pros: string[];
  cons: string[];
  estimatedCost: number;
  estimatedTime: number;
  useCase: string[];
}

export interface ConfigHistoryEntry {
  id: string;
  projectId: string;
  config: StormConfig;
  version: number;
  createdAt: Date;
  createdBy?: string;
  description?: string;
  isActive: boolean;
  performance?: {
    executionTime: number;
    tokenUsage: number;
    cost: number;
    qualityScore: number;
  };
}

export interface ConfigComparison {
  differences: ConfigDifference[];
  summary: {
    totalChanges: number;
    majorChanges: number;
    minorChanges: number;
  };
  impact: {
    performance: 'better' | 'worse' | 'similar';
    cost: 'higher' | 'lower' | 'similar';
    quality: 'better' | 'worse' | 'similar';
  };
  recommendations: string[];
}

export interface ConfigDifference {
  path: string;
  type: 'added' | 'removed' | 'changed';
  oldValue?: any;
  newValue?: any;
  impact: 'major' | 'minor' | 'cosmetic';
  description: string;
}

export interface ConfigPreset {
  id: string;
  name: string;
  description: string;
  category: string;
  config: StormConfig;
  useCase: string[];
  tags: string[];
  popularity: number;
  isSystem: boolean;
  createdAt: Date;
}

export interface ApiKeyValidation {
  llm: {
    isValid: boolean;
    provider: string;
    error?: string;
    expiresAt?: Date;
  };
  retriever: {
    isValid: boolean;
    type: string;
    error?: string;
    expiresAt?: Date;
  };
  overallStatus: 'valid' | 'partial' | 'invalid';
}

export interface ApiKeyQuota {
  service: string;
  provider: string;
  quota: {
    limit: number;
    used: number;
    remaining: number;
    resetAt: Date;
  };
  billing: {
    currentUsage: number;
    billingCycle: string;
    currency: string;
  };
  warnings: string[];
}

export interface OptimizationObjective {
  type:
    | 'minimize_cost'
    | 'maximize_quality'
    | 'minimize_time'
    | 'maximize_throughput';
  weight: number; // 0-1
  constraints?: Record<string, any>;
}

export interface OptimizedConfig {
  config: StormConfig;
  improvements: {
    costReduction: number; // percentage
    speedImprovement: number; // percentage
    qualityChange: number; // percentage
  };
  changes: ConfigDifference[];
  reasoning: string[];
  alternatives: Array<{
    config: StormConfig;
    score: number;
    description: string;
  }>;
}

export interface ConfigSchema {
  $schema: string;
  type: 'object';
  properties: Record<string, any>;
  required: string[];
  definitions: Record<string, any>;
}

export interface ConfigRequirements {
  useCase: string;
  budget?: number;
  timeConstraint?: number;
  qualityLevel: 'basic' | 'good' | 'high' | 'premium';
  language?: string;
  domain?: string;
  specialRequirements?: string[];
}

export interface EnvironmentConfig {
  name: string;
  displayName: string;
  description: string;
  config: StormConfig;
  isActive: boolean;
  variables: Record<string, string>;
  createdAt: Date;
  updatedAt: Date;
}

// Create and export singleton instance
export const configService = new ConfigService({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
});
