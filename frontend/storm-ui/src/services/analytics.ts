import { BaseApiService } from './base';
import { ApiResponse } from '../types/storm';
import {
  AnalyticsEvent,
  CreateEventRequest,
  AnalyticsQuery,
  AnalyticsSummary,
} from '../types/api';

export class AnalyticsService extends BaseApiService {
  private readonly basePath = '/analytics';

  /**
   * Track a user event
   */
  async trackEvent(
    event: CreateEventRequest
  ): Promise<ApiResponse<AnalyticsEvent>> {
    return this.post<AnalyticsEvent>(`${this.basePath}/events`, event);
  }

  /**
   * Track multiple events in batch
   */
  async trackEvents(
    events: CreateEventRequest[]
  ): Promise<ApiResponse<BatchTrackingResult>> {
    return this.post<BatchTrackingResult>(`${this.basePath}/events/batch`, {
      events,
    });
  }

  /**
   * Get analytics summary
   */
  async getAnalyticsSummary(
    query: AnalyticsQuery
  ): Promise<ApiResponse<AnalyticsSummary>> {
    return this.post<AnalyticsSummary>(`${this.basePath}/summary`, query);
  }

  /**
   * Get project analytics
   */
  async getProjectAnalytics(
    projectId: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      metrics?: string[];
    }
  ): Promise<ApiResponse<ProjectAnalytics>> {
    const params = new URLSearchParams();
    if (options?.startDate)
      params.append('startDate', options.startDate.toISOString());
    if (options?.endDate)
      params.append('endDate', options.endDate.toISOString());
    if (options?.metrics) params.append('metrics', options.metrics.join(','));

    const url = `${this.basePath}/projects/${projectId}${
      params.toString() ? '?' + params.toString() : ''
    }`;
    return this.get<ProjectAnalytics>(url);
  }

  /**
   * Get user analytics
   */
  async getUserAnalytics(
    userId?: string,
    options?: {
      startDate?: Date;
      endDate?: Date;
      includeProjects?: boolean;
    }
  ): Promise<ApiResponse<UserAnalytics>> {
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (options?.startDate)
      params.append('startDate', options.startDate.toISOString());
    if (options?.endDate)
      params.append('endDate', options.endDate.toISOString());
    if (options?.includeProjects) params.append('includeProjects', 'true');

    const url = `${this.basePath}/users${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<UserAnalytics>(url);
  }

  /**
   * Get pipeline analytics
   */
  async getPipelineAnalytics(options?: {
    projectId?: string;
    startDate?: Date;
    endDate?: Date;
    stage?: string;
  }): Promise<ApiResponse<PipelineAnalytics>> {
    const params = new URLSearchParams();
    if (options?.projectId) params.append('projectId', options.projectId);
    if (options?.startDate)
      params.append('startDate', options.startDate.toISOString());
    if (options?.endDate)
      params.append('endDate', options.endDate.toISOString());
    if (options?.stage) params.append('stage', options.stage);

    const url = `${this.basePath}/pipeline${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<PipelineAnalytics>(url);
  }

  /**
   * Get usage analytics
   */
  async getUsageAnalytics(options?: {
    period: 'day' | 'week' | 'month' | 'year';
    startDate?: Date;
    endDate?: Date;
    granularity?: 'hour' | 'day' | 'week' | 'month';
  }): Promise<ApiResponse<UsageAnalytics>> {
    const params = new URLSearchParams();
    if (options?.period) params.append('period', options.period);
    if (options?.startDate)
      params.append('startDate', options.startDate.toISOString());
    if (options?.endDate)
      params.append('endDate', options.endDate.toISOString());
    if (options?.granularity) params.append('granularity', options.granularity);

    const url = `${this.basePath}/usage${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<UsageAnalytics>(url);
  }

  /**
   * Get performance metrics
   */
  async getPerformanceMetrics(options?: {
    component?: string;
    startDate?: Date;
    endDate?: Date;
    aggregation?: 'avg' | 'min' | 'max' | 'p95' | 'p99';
  }): Promise<ApiResponse<PerformanceMetrics>> {
    const params = new URLSearchParams();
    if (options?.component) params.append('component', options.component);
    if (options?.startDate)
      params.append('startDate', options.startDate.toISOString());
    if (options?.endDate)
      params.append('endDate', options.endDate.toISOString());
    if (options?.aggregation) params.append('aggregation', options.aggregation);

    const url = `${this.basePath}/performance${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<PerformanceMetrics>(url);
  }

  /**
   * Get error analytics
   */
  async getErrorAnalytics(options?: {
    severity?: 'low' | 'medium' | 'high' | 'critical';
    component?: string;
    startDate?: Date;
    endDate?: Date;
  }): Promise<ApiResponse<ErrorAnalytics>> {
    const params = new URLSearchParams();
    if (options?.severity) params.append('severity', options.severity);
    if (options?.component) params.append('component', options.component);
    if (options?.startDate)
      params.append('startDate', options.startDate.toISOString());
    if (options?.endDate)
      params.append('endDate', options.endDate.toISOString());

    const url = `${this.basePath}/errors${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<ErrorAnalytics>(url);
  }

  /**
   * Get feature usage analytics
   */
  async getFeatureUsage(options?: {
    feature?: string;
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'user' | 'project' | 'date';
  }): Promise<ApiResponse<FeatureUsageAnalytics>> {
    const params = new URLSearchParams();
    if (options?.feature) params.append('feature', options.feature);
    if (options?.startDate)
      params.append('startDate', options.startDate.toISOString());
    if (options?.endDate)
      params.append('endDate', options.endDate.toISOString());
    if (options?.groupBy) params.append('groupBy', options.groupBy);

    const url = `${this.basePath}/features${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<FeatureUsageAnalytics>(url);
  }

  /**
   * Get cost analytics
   */
  async getCostAnalytics(options?: {
    projectId?: string;
    startDate?: Date;
    endDate?: Date;
    groupBy?: 'project' | 'model' | 'date' | 'user';
  }): Promise<ApiResponse<CostAnalytics>> {
    const params = new URLSearchParams();
    if (options?.projectId) params.append('projectId', options.projectId);
    if (options?.startDate)
      params.append('startDate', options.startDate.toISOString());
    if (options?.endDate)
      params.append('endDate', options.endDate.toISOString());
    if (options?.groupBy) params.append('groupBy', options.groupBy);

    const url = `${this.basePath}/costs${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<CostAnalytics>(url);
  }

  /**
   * Get retention analytics
   */
  async getRetentionAnalytics(options?: {
    cohortBy?: 'day' | 'week' | 'month';
    period?: number; // number of cohort periods to analyze
  }): Promise<ApiResponse<RetentionAnalytics>> {
    const params = new URLSearchParams();
    if (options?.cohortBy) params.append('cohortBy', options.cohortBy);
    if (options?.period) params.append('period', options.period.toString());

    const url = `${this.basePath}/retention${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<RetentionAnalytics>(url);
  }

  /**
   * Get conversion funnel analytics
   */
  async getFunnelAnalytics(
    steps: string[],
    options?: {
      startDate?: Date;
      endDate?: Date;
      groupBy?: string;
    }
  ): Promise<ApiResponse<FunnelAnalytics>> {
    const params = new URLSearchParams();
    steps.forEach(step => params.append('steps', step));
    if (options?.startDate)
      params.append('startDate', options.startDate.toISOString());
    if (options?.endDate)
      params.append('endDate', options.endDate.toISOString());
    if (options?.groupBy) params.append('groupBy', options.groupBy);

    const url = `${this.basePath}/funnel${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<FunnelAnalytics>(url);
  }

  /**
   * Get real-time analytics
   */
  async getRealTimeAnalytics(): Promise<ApiResponse<RealTimeAnalytics>> {
    return this.get<RealTimeAnalytics>(`${this.basePath}/realtime`);
  }

  /**
   * Create custom dashboard
   */
  async createDashboard(
    dashboard: CreateDashboardRequest
  ): Promise<ApiResponse<AnalyticsDashboard>> {
    return this.post<AnalyticsDashboard>(
      `${this.basePath}/dashboards`,
      dashboard
    );
  }

  /**
   * Get dashboards
   */
  async getDashboards(): Promise<ApiResponse<AnalyticsDashboard[]>> {
    return this.get<AnalyticsDashboard[]>(`${this.basePath}/dashboards`);
  }

  /**
   * Get dashboard data
   */
  async getDashboardData(
    dashboardId: string
  ): Promise<ApiResponse<DashboardData>> {
    return this.get<DashboardData>(
      `${this.basePath}/dashboards/${dashboardId}/data`
    );
  }

  /**
   * Update dashboard
   */
  async updateDashboard(
    dashboardId: string,
    updates: Partial<AnalyticsDashboard>
  ): Promise<ApiResponse<AnalyticsDashboard>> {
    return this.patch<AnalyticsDashboard>(
      `${this.basePath}/dashboards/${dashboardId}`,
      updates
    );
  }

  /**
   * Delete dashboard
   */
  async deleteDashboard(dashboardId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`${this.basePath}/dashboards/${dashboardId}`);
  }

  /**
   * Export analytics data
   */
  async exportAnalytics(
    query: AnalyticsQuery,
    format: 'csv' | 'json' | 'excel'
  ): Promise<Blob> {
    const response = await this.post<{ downloadUrl: string }>(
      `${this.basePath}/export`,
      { query, format },
      { responseType: 'json' }
    );

    return this.downloadFile(response.data!.downloadUrl);
  }

  /**
   * Set up analytics alerts
   */
  async createAlert(
    alert: CreateAlertRequest
  ): Promise<ApiResponse<AnalyticsAlert>> {
    return this.post<AnalyticsAlert>(`${this.basePath}/alerts`, alert);
  }

  /**
   * Get analytics alerts
   */
  async getAlerts(): Promise<ApiResponse<AnalyticsAlert[]>> {
    return this.get<AnalyticsAlert[]>(`${this.basePath}/alerts`);
  }

  /**
   * Update alert
   */
  async updateAlert(
    alertId: string,
    updates: Partial<AnalyticsAlert>
  ): Promise<ApiResponse<AnalyticsAlert>> {
    return this.patch<AnalyticsAlert>(
      `${this.basePath}/alerts/${alertId}`,
      updates
    );
  }

  /**
   * Delete alert
   */
  async deleteAlert(alertId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`${this.basePath}/alerts/${alertId}`);
  }

  /**
   * Get alert history
   */
  async getAlertHistory(
    alertId: string,
    options?: { page?: number; limit?: number }
  ): Promise<ApiResponse<AlertHistoryResponse>> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());

    const url = `${this.basePath}/alerts/${alertId}/history${
      params.toString() ? '?' + params.toString() : ''
    }`;
    return this.get<AlertHistoryResponse>(url);
  }

  /**
   * Get analytics insights
   */
  async getInsights(options?: {
    type?: 'anomaly' | 'trend' | 'pattern' | 'recommendation';
    startDate?: Date;
    endDate?: Date;
  }): Promise<ApiResponse<AnalyticsInsight[]>> {
    const params = new URLSearchParams();
    if (options?.type) params.append('type', options.type);
    if (options?.startDate)
      params.append('startDate', options.startDate.toISOString());
    if (options?.endDate)
      params.append('endDate', options.endDate.toISOString());

    const url = `${this.basePath}/insights${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<AnalyticsInsight[]>(url);
  }

  /**
   * Configure analytics settings
   */
  async updateSettings(
    settings: AnalyticsSettings
  ): Promise<ApiResponse<AnalyticsSettings>> {
    return this.put<AnalyticsSettings>(`${this.basePath}/settings`, settings);
  }

  /**
   * Get analytics settings
   */
  async getSettings(): Promise<ApiResponse<AnalyticsSettings>> {
    return this.get<AnalyticsSettings>(`${this.basePath}/settings`);
  }

  /**
   * Subscribe to real-time analytics (WebSocket endpoint helper)
   */
  getRealTimeWebSocketUrl(): string {
    const baseUrl = this.client.defaults.baseURL?.replace(/^http/, 'ws');
    return `${baseUrl}${this.basePath}/realtime/ws`;
  }

  /**
   * Trigger analytics computation
   */
  async triggerComputation(
    type: 'daily' | 'weekly' | 'monthly' | 'custom',
    options?: Record<string, any>
  ): Promise<ApiResponse<ComputationJob>> {
    return this.post<ComputationJob>(`${this.basePath}/compute`, {
      type,
      options,
    });
  }

  /**
   * Get computation job status
   */
  async getComputationStatus(
    jobId: string
  ): Promise<ApiResponse<ComputationJob>> {
    return this.get<ComputationJob>(`${this.basePath}/compute/${jobId}`);
  }
}

// Additional types specific to AnalyticsService
export interface BatchTrackingResult {
  success: number;
  failed: number;
  errors: Array<{
    index: number;
    error: string;
  }>;
}

export interface ProjectAnalytics {
  projectId: string;
  totalEvents: number;
  uniqueUsers: number;
  sessionCount: number;
  averageSessionDuration: number;
  pipelineRuns: number;
  successfulRuns: number;
  failedRuns: number;
  totalTokensUsed: number;
  estimatedCost: number;
  timeSeriesData: Array<{
    date: string;
    events: number;
    users: number;
    sessions: number;
  }>;
  topEvents: Array<{
    eventType: string;
    count: number;
    percentage: number;
  }>;
  userEngagement: {
    averageEventsPerUser: number;
    returningUsers: number;
    newUsers: number;
    userRetentionRate: number;
  };
}

export interface UserAnalytics {
  userId?: string;
  totalEvents: number;
  sessionCount: number;
  totalSessionTime: number;
  averageSessionDuration: number;
  projectsCreated: number;
  pipelinesRun: number;
  lastActive: Date;
  firstSeen: Date;
  activityHeatmap: Array<{
    hour: number;
    day: number;
    count: number;
  }>;
  topFeatures: Array<{
    feature: string;
    usage: number;
  }>;
  projects?: Array<{
    projectId: string;
    projectTitle: string;
    lastAccessed: Date;
    totalTime: number;
    eventCount: number;
  }>;
}

export interface PipelineAnalytics {
  totalRuns: number;
  successfulRuns: number;
  failedRuns: number;
  averageRunTime: number;
  totalTokensUsed: number;
  estimatedTotalCost: number;
  runsByStage: Record<
    string,
    {
      total: number;
      successful: number;
      failed: number;
      averageTime: number;
    }
  >;
  runsByModel: Record<
    string,
    {
      total: number;
      successful: number;
      failed: number;
      tokensUsed: number;
      cost: number;
    }
  >;
  timeDistribution: Array<{
    date: string;
    runs: number;
    successRate: number;
    averageTime: number;
  }>;
  errorPatterns: Array<{
    error: string;
    count: number;
    affectedStages: string[];
    recommendations: string[];
  }>;
}

export interface UsageAnalytics {
  period: string;
  totalUsers: number;
  activeUsers: number;
  newUsers: number;
  totalSessions: number;
  averageSessionDuration: number;
  totalPageViews: number;
  bounceRate: number;
  topPages: Array<{
    path: string;
    views: number;
    uniqueUsers: number;
    averageTime: number;
  }>;
  deviceBreakdown: Record<string, number>;
  browserBreakdown: Record<string, number>;
  geographicDistribution: Record<string, number>;
  timeSeriesData: Array<{
    timestamp: Date;
    users: number;
    sessions: number;
    pageViews: number;
  }>;
}

export interface PerformanceMetrics {
  responseTime: {
    average: number;
    p50: number;
    p95: number;
    p99: number;
  };
  throughput: {
    requestsPerSecond: number;
    peakRequestsPerSecond: number;
  };
  errorRate: number;
  availability: number;
  componentMetrics: Record<
    string,
    {
      responseTime: number;
      errorRate: number;
      availability: number;
    }
  >;
  timeSeriesData: Array<{
    timestamp: Date;
    responseTime: number;
    errorRate: number;
    throughput: number;
  }>;
}

export interface ErrorAnalytics {
  totalErrors: number;
  errorRate: number;
  errorsByType: Record<string, number>;
  errorsBySeverity: Record<string, number>;
  errorsByComponent: Record<string, number>;
  topErrors: Array<{
    message: string;
    count: number;
    lastOccurred: Date;
    affectedUsers: number;
  }>;
  errorTrends: Array<{
    date: string;
    count: number;
    newErrors: number;
    resolvedErrors: number;
  }>;
  meanTimeToResolution: number;
}

export interface FeatureUsageAnalytics {
  featureUsage: Record<
    string,
    {
      totalUsage: number;
      uniqueUsers: number;
      averageUsagePerUser: number;
      adoptionRate: number;
    }
  >;
  featureAdoption: Array<{
    feature: string;
    adoptionRate: number;
    trend: 'increasing' | 'decreasing' | 'stable';
  }>;
  userSegmentation: Record<
    string,
    {
      users: number;
      topFeatures: string[];
      engagementLevel: 'low' | 'medium' | 'high';
    }
  >;
}

export interface CostAnalytics {
  totalCost: number;
  costByModel: Record<
    string,
    {
      cost: number;
      tokensUsed: number;
      requests: number;
    }
  >;
  costByProject: Record<
    string,
    {
      cost: number;
      tokensUsed: number;
      percentage: number;
    }
  >;
  costByUser: Record<
    string,
    {
      cost: number;
      tokensUsed: number;
      projects: number;
    }
  >;
  costTrends: Array<{
    date: string;
    cost: number;
    tokensUsed: number;
    requests: number;
  }>;
  projectedMonthlyCost: number;
  costEfficiencyMetrics: {
    costPerSuccessfulRun: number;
    costPerToken: number;
    costSavingsFromOptimization: number;
  };
}

export interface RetentionAnalytics {
  cohorts: Array<{
    cohortDate: string;
    cohortSize: number;
    retentionRates: number[]; // retention rate for each period
  }>;
  overallRetentionRate: number;
  averageRetentionRate: number;
  churnRate: number;
  retentionByFeature: Record<string, number>;
  retentionFactors: Array<{
    factor: string;
    impact: number;
    correlation: number;
  }>;
}

export interface FunnelAnalytics {
  steps: Array<{
    step: string;
    users: number;
    conversionRate: number;
    dropoffRate: number;
  }>;
  overallConversionRate: number;
  totalUsers: number;
  averageTimeToConvert: number;
  dropoffPoints: Array<{
    fromStep: string;
    toStep: string;
    dropoffRate: number;
    reasons: string[];
  }>;
}

export interface RealTimeAnalytics {
  activeUsers: number;
  activeSessions: number;
  eventsPerMinute: number;
  topEvents: Array<{
    event: string;
    count: number;
  }>;
  activePages: Array<{
    path: string;
    users: number;
  }>;
  systemHealth: {
    responseTime: number;
    errorRate: number;
    throughput: number;
  };
  alerts: Array<{
    type: string;
    message: string;
    severity: 'low' | 'medium' | 'high';
    timestamp: Date;
  }>;
}

export interface AnalyticsDashboard {
  id: string;
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  isPublic: boolean;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
  tags: string[];
}

export interface CreateDashboardRequest {
  name: string;
  description: string;
  widgets: DashboardWidget[];
  layout: DashboardLayout;
  isPublic?: boolean;
  tags?: string[];
}

export interface DashboardWidget {
  id: string;
  type: 'chart' | 'metric' | 'table' | 'text';
  title: string;
  query: AnalyticsQuery;
  visualization: {
    chartType?: 'line' | 'bar' | 'pie' | 'area' | 'scatter';
    aggregation?: 'sum' | 'avg' | 'min' | 'max' | 'count';
    groupBy?: string;
    filters?: Record<string, any>;
  };
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  refreshInterval?: number; // in seconds
}

export interface DashboardLayout {
  columns: number;
  rowHeight: number;
  margin: number[];
  padding: number[];
  responsive: boolean;
}

export interface DashboardData {
  dashboardId: string;
  widgets: Record<
    string,
    {
      data: any;
      lastUpdated: Date;
      error?: string;
    }
  >;
  generatedAt: Date;
}

export interface AnalyticsAlert {
  id: string;
  name: string;
  description: string;
  query: AnalyticsQuery;
  condition: {
    metric: string;
    operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte' | 'ne';
    threshold: number;
    timeWindow: number; // in minutes
  };
  notifications: {
    email?: string[];
    webhook?: string;
    slack?: string;
  };
  isActive: boolean;
  lastTriggered?: Date;
  triggerCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateAlertRequest {
  name: string;
  description: string;
  query: AnalyticsQuery;
  condition: AnalyticsAlert['condition'];
  notifications: AnalyticsAlert['notifications'];
  isActive?: boolean;
}

export interface AlertHistoryResponse {
  alertId: string;
  history: Array<{
    id: string;
    triggeredAt: Date;
    value: number;
    threshold: number;
    resolved: boolean;
    resolvedAt?: Date;
    notificationsSent: string[];
  }>;
  total: number;
  page: number;
  limit: number;
}

export interface AnalyticsInsight {
  id: string;
  type: 'anomaly' | 'trend' | 'pattern' | 'recommendation';
  title: string;
  description: string;
  confidence: number; // 0-1
  impact: 'low' | 'medium' | 'high';
  data: Record<string, any>;
  actionable: boolean;
  recommendations: string[];
  detectedAt: Date;
  relevantPeriod: {
    start: Date;
    end: Date;
  };
}

export interface AnalyticsSettings {
  dataRetentionDays: number;
  samplingRate: number; // 0-1
  enableRealTimeAnalytics: boolean;
  enableUserTracking: boolean;
  enablePerformanceTracking: boolean;
  enableErrorTracking: boolean;
  excludedEvents: string[];
  anonymizeUserData: boolean;
  dataProcessingRegion: string;
  customDimensions: Array<{
    name: string;
    type: 'string' | 'number' | 'boolean';
    description: string;
  }>;
  alertDefaults: {
    emailEnabled: boolean;
    webhookEnabled: boolean;
    defaultThreshold: number;
    defaultTimeWindow: number;
  };
}

export interface ComputationJob {
  id: string;
  type: 'daily' | 'weekly' | 'monthly' | 'custom';
  status: 'queued' | 'running' | 'completed' | 'failed';
  progress: number;
  startedAt?: Date;
  completedAt?: Date;
  error?: string;
  options: Record<string, any>;
  results?: Record<string, any>;
}

// Create and export singleton instance
export const analyticsService = new AnalyticsService({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
});
