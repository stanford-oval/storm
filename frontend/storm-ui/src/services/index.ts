// Base API service and utilities
export {
  BaseApiService,
  ApiError,
  DEFAULT_API_CONFIG,
  getApiService,
  resetApiService,
} from './base';

// WebSocket and real-time utilities
export * from '../lib/websocket';
export * from '../hooks/useWebSocket';

// Error handling utilities
export * from '../lib/error-handling';

// Integration testing utilities
export * from '../lib/integration-test';

// Service exports
export { ProjectService, projectService } from './project';
export { PipelineService, pipelineService } from './pipeline';
export { ConfigService, configService } from './config';
export { ResearchService, researchService } from './research';
export { SessionService, sessionService } from './session';
export { ExportService, exportService } from './export';
export { AnalyticsService, analyticsService } from './analytics';

// Import service instances for re-export
import { projectService } from './project';
import { pipelineService } from './pipeline';
import { configService } from './config';
import { researchService } from './research';
import { sessionService } from './session';
import { exportService } from './export';
import { analyticsService } from './analytics';
import { getApiService } from './base';

// Service type exports
export type {
  // Project types
  ProjectStats,
  ProjectTemplate,
  ProjectActivity,
  ProjectShareOptions,
  ProjectShareLink,
  ProjectShareInfo,
  ProjectCollaborator,
  ProjectImportValidation,
} from './project';

// Export pipeline types from pipeline service
export type {
  PipelineTemplate,
  CreatePipelineTemplateRequest,
  PipelineValidationResult,
  PipelineMetrics,
  StageMetrics,
  ResourceUsage,
  PipelineExecution,
  PipelineComparison,
  StageDetails,
  StageArtifact,
  ExecutionTimeEstimate,
  SchedulePipelineRequest,
  ScheduledExecution,
} from './pipeline';

// Export config types from config service
export type {
  LLMTestResult,
  RetrieverTestResult,
  LLMModel,
  RetrieverInfo,
  ModelPricing,
  ConfigRecommendationContext,
  ConfigRecommendation,
  ConfigHistoryEntry,
  ConfigComparison,
  ConfigDifference,
  ConfigPreset,
  ApiKeyValidation,
  ApiKeyQuota,
  OptimizationObjective,
  OptimizedConfig,
  ConfigSchema,
  ConfigRequirements,
  EnvironmentConfig,
} from './config';

// Export research types from research service
export type {
  ResearchPerspective,
  ResearchQuestion,
  QueryResult,
  ResearchAnalytics,
  ResearchImportResult,
  ResearchSummary,
  ResearchGap,
  ResearchTimelineEntry,
  CitationInfo,
  SourceValidationResult,
  ReportGenerationJob,
  ResearchBookmark,
} from './research';

// Export session types from session service
export type {
  SessionJoinResult,
  MindMapConnection,
  SessionAnalytics,
  SessionTemplate,
  ModeratorRecommendation,
  SessionInsights,
  SessionInvitationResult,
  SessionInvitation,
  SessionRecording,
} from './session';

// Export export types from export service
export type {
  ExportJobListResponse,
  ExportTemplate,
  CreateExportTemplateRequest,
  ExportPreview,
  ExportResult,
  BulkExportRequest,
  ExportFormat,
  ExportValidation,
  ExportStatistics,
  ScheduleExportRequest,
  ScheduledExport,
  ExportWebhook,
  CreateExportWebhookRequest,
  WebhookTestResult,
  ConversionResult,
  ArchiveResult,
  ExportQuota,
} from './export';

// Export analytics types from analytics service
export type {
  BatchTrackingResult,
  ProjectAnalytics,
  UserAnalytics,
  PipelineAnalytics,
  UsageAnalytics,
  PerformanceMetrics,
  ErrorAnalytics,
  FeatureUsageAnalytics,
  CostAnalytics,
  RetentionAnalytics,
  FunnelAnalytics,
  RealTimeAnalytics,
  AnalyticsDashboard,
  CreateDashboardRequest,
  DashboardWidget,
  DashboardLayout,
  DashboardData,
  AnalyticsAlert,
  CreateAlertRequest,
  AlertHistoryResponse,
  AnalyticsInsight,
  AnalyticsSettings,
  ComputationJob,
} from './analytics';

// Re-export commonly used service instances
export const services = {
  project: projectService,
  pipeline: pipelineService,
  config: configService,
  research: researchService,
  session: sessionService,
  export: exportService,
  analytics: analyticsService,
};

// Service initialization utility
export async function initializeServices(config?: {
  baseURL?: string;
  apiKey?: string;
  authToken?: string;
}) {
  if (config?.baseURL) {
    // Update base URL for all services
    const baseApiService = getApiService({ baseURL: config.baseURL });

    if (config.apiKey) {
      baseApiService.setApiKey(config.apiKey);
    }

    if (config.authToken) {
      baseApiService.setAuthToken(config.authToken);
    }
  }

  // Perform health checks
  try {
    const healthCheck = await getApiService().healthCheck();
    if (healthCheck) {
      console.log('✅ API services initialized successfully');
      return true;
    } else {
      console.warn(
        '⚠️ API health check failed - services may not be available'
      );
      return false;
    }
  } catch (error) {
    console.error('❌ Failed to initialize API services:', error);
    return false;
  }
}

// Service health check utility
export async function checkServiceHealth() {
  const results = {
    api: false,
    timestamp: new Date(),
    services: {} as Record<string, boolean>,
  };

  try {
    results.api = await getApiService().healthCheck();

    // You could add individual service health checks here
    // For now, we'll just check the main API
    results.services.main = results.api;
  } catch (error) {
    console.error('Service health check failed:', error);
  }

  return results;
}

// Global error handler for services
export function setupGlobalErrorHandler() {
  // Set up a global error handler for uncaught service errors
  if (typeof window !== 'undefined') {
    window.addEventListener('unhandledrejection', event => {
      if (event.reason?.name === 'ApiError') {
        console.error('Unhandled API Error:', event.reason);
        // You could integrate with error tracking services here
      }
    });
  }
}
