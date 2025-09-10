// API-specific types extending storm.ts types
import {
  StormProject,
  StormConfig,
  PipelineProgress,
  ResearchData,
  GeneratedArticle,
  ArticleOutline,
  ProjectStatus,
  ProjectFilters,
  ProjectListResponse,
} from './storm';

// Re-export types from storm.ts that are used in API contexts
export type {
  StormProject,
  StormConfig,
  PipelineProgress,
  ProjectFilters,
  ProjectListResponse,
  ResearchData,
  ConversationData,
  SourceData,
} from './storm';

// Re-export config service types
export type { LLMModel, RetrieverInfo } from '../services/config';

// Authentication types
export interface AuthRequest {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  user: User;
  expiresAt: Date;
}

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'user' | 'guest';
  createdAt: Date;
  preferences?: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  defaultConfig: StormConfig;
  notifications: NotificationSettings;
}

export interface NotificationSettings {
  email: boolean;
  browser: boolean;
  pipelineComplete: boolean;
  errors: boolean;
}

// Project API types
export interface CreateProjectRequest {
  title: string;
  topic: string;
  description?: string;
  config: StormConfig;
}

export interface UpdateProjectRequest extends Partial<CreateProjectRequest> {
  id: string;
}

export interface ProjectListRequest {
  page?: number;
  limit?: number;
  filters?: ProjectFilters;
  sortBy?: 'createdAt' | 'updatedAt' | 'title' | 'status';
  sortOrder?: 'asc' | 'desc';
}

export interface DuplicateProjectRequest {
  projectId: string;
  title?: string;
  description?: string;
}

// Pipeline API types
export interface StartPipelineRequest {
  projectId: string;
  config?: Partial<StormConfig>;
  stages?: PipelineStage[];
}

export interface PipelineStage {
  name: 'research' | 'outline' | 'article' | 'polish';
  enabled: boolean;
  config?: Record<string, unknown>;
}

export interface StopPipelineRequest {
  projectId: string;
  reason?: string;
}

export interface PipelineStatusResponse {
  projectId: string;
  isRunning: boolean;
  progress: PipelineProgress;
  logs: PipelineLog[];
}

export interface PipelineLog {
  id: string;
  timestamp: Date;
  level: 'debug' | 'info' | 'warn' | 'error';
  message: string;
  stage?: string;
  metadata?: Record<string, unknown>;
}

// Configuration API types
export interface SaveConfigRequest {
  name: string;
  config: StormConfig;
  isDefault?: boolean;
  description?: string;
}

export interface ConfigTemplate {
  id: string;
  name: string;
  description: string;
  config: StormConfig;
  isDefault: boolean;
  isSystem: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface ValidateConfigRequest {
  config: StormConfig;
}

export interface ConfigValidationResponse {
  isValid: boolean;
  errors: ConfigValidationError[];
  warnings: ConfigValidationWarning[];
}

export interface ConfigValidationError {
  field: string;
  message: string;
  code: string;
}

export interface ConfigValidationWarning {
  field: string;
  message: string;
  suggestion?: string;
}

// Research API types
export interface SearchRequest {
  query: string;
  sources?: string[];
  maxResults?: number;
  filters?: SearchFilters;
}

export interface SearchFilters {
  dateRange?: {
    start: Date;
    end: Date;
  };
  domains?: string[];
  language?: string;
  contentType?: 'web' | 'academic' | 'news' | 'images';
}

export interface SearchResult {
  id: string;
  title: string;
  url: string;
  snippet: string;
  source: string;
  publishedAt?: Date;
  relevanceScore: number;
  metadata?: Record<string, unknown>;
}

export interface ResearchExportRequest {
  projectId: string;
  format: 'json' | 'csv' | 'bibtex';
  includeConversations?: boolean;
  includeSources?: boolean;
}

// Co-STORM Session types
export interface CoStormSession {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  participants: SessionParticipant[];
  mindMap: MindMapNode[];
  discourse: DiscourseMessage[];
  status: 'active' | 'paused' | 'completed' | 'cancelled';
  createdAt: Date;
  updatedAt: Date;
  settings: SessionSettings;
}

export interface SessionParticipant {
  id: string;
  type: 'human' | 'ai_expert' | 'moderator';
  name: string;
  role?: string;
  expertise?: string[];
  isActive: boolean;
}

export interface MindMapNode {
  id: string;
  title: string;
  content: string;
  position: { x: number; y: number };
  connections: string[];
  metadata?: Record<string, unknown>;
  createdBy: string;
  createdAt: Date;
}

export interface DiscourseMessage {
  id: string;
  sessionId: string;
  senderId: string;
  content: string;
  timestamp: Date;
  messageType: 'text' | 'query' | 'source' | 'mindmap_update';
  references?: string[];
  metadata?: Record<string, unknown>;
}

export interface SessionSettings {
  maxParticipants: number;
  allowAnonymous: boolean;
  moderationLevel: 'low' | 'medium' | 'high';
  autoSaveInterval: number;
  expertModels: string[];
}

export interface CreateSessionRequest {
  projectId: string;
  title: string;
  description?: string;
  settings?: Partial<SessionSettings>;
}

export interface JoinSessionRequest {
  sessionId: string;
  participantName: string;
  role?: string;
}

export interface SendMessageRequest {
  sessionId: string;
  content: string;
  messageType?: DiscourseMessage['messageType'];
  references?: string[];
}

export interface UpdateMindMapRequest {
  sessionId: string;
  nodes: MindMapNode[];
  action: 'add' | 'update' | 'delete';
}

// Export API types
export interface ExportRequest {
  projectId: string;
  format: 'pdf' | 'docx' | 'html' | 'markdown' | 'latex';
  sections?: string[];
  includeOutline?: boolean;
  includeCitations?: boolean;
  includeResearch?: boolean;
  template?: string;
}

export interface ExportJob {
  id: string;
  projectId: string;
  format: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  downloadUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
}

// Analytics API types
export interface AnalyticsEvent {
  id: string;
  userId?: string;
  sessionId?: string;
  eventType: string;
  eventData: Record<string, unknown>;
  timestamp: Date;
  metadata?: Record<string, unknown>;
}

export interface CreateEventRequest {
  eventType: string;
  eventData: Record<string, unknown>;
  sessionId?: string;
}

export interface AnalyticsQuery {
  startDate: Date;
  endDate: Date;
  eventTypes?: string[];
  userId?: string;
  projectId?: string;
  aggregation?: 'day' | 'hour' | 'week' | 'month';
}

export interface AnalyticsSummary {
  totalEvents: number;
  uniqueUsers: number;
  topEvents: Array<{ eventType: string; count: number }>;
  timeSeriesData: Array<{ date: string; count: number }>;
  userActivity: Array<{ userId: string; eventCount: number; lastActive: Date }>;
}

// WebSocket message types
export interface WebSocketMessage<T = unknown> {
  type: string;
  data: T;
  timestamp: Date;
  id?: string;
}

export interface PipelineUpdateMessage {
  projectId: string;
  progress: PipelineProgress;
  logs?: PipelineLog[];
}

export interface SessionUpdateMessage {
  sessionId: string;
  updateType:
    | 'participant_joined'
    | 'participant_left'
    | 'message'
    | 'mindmap_update';
  data: Record<string, unknown>;
}

export interface NotificationMessage {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  actions?: Array<{
    label: string;
    action: string;
    url?: string;
  }>;
}

// Error types
export interface ApiErrorDetails {
  code: string;
  message: string;
  field?: string;
  details?: Record<string, unknown>;
}

export interface ValidationError {
  field: string;
  message: string;
  code: string;
  value?: unknown;
}

// File upload types
export interface FileUploadRequest {
  file: File;
  projectId?: string;
  type: 'document' | 'image' | 'data';
  metadata?: Record<string, unknown>;
}

export interface UploadedFile {
  id: string;
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  projectId?: string;
  uploadedAt: Date;
  metadata?: Record<string, unknown>;
}

// Rate limiting types
export interface RateLimitInfo {
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfter?: number;
}

// Health check types
export interface HealthCheckResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: Date;
  version: string;
  services: Record<string, ServiceHealth>;
  uptime: number;
}

export interface ServiceHealth {
  status: 'up' | 'down' | 'degraded';
  responseTime?: number;
  error?: string;
  lastCheck: Date;
}

// Pagination types
export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface PaginationRequest {
  page?: number;
  limit?: number;
}

// Sorting types
export interface SortingRequest {
  sortBy: string;
  sortOrder: 'asc' | 'desc';
}

// Generic API types
export interface BulkOperationRequest<T> {
  items: T[];
  operation: 'create' | 'update' | 'delete';
}

export interface BulkOperationResponse {
  successful: number;
  failed: number;
  errors: Array<{
    index: number;
    error: string;
  }>;
}

// Cache types
export interface CacheInfo {
  key: string;
  ttl: number;
  createdAt: Date;
  hits: number;
}

export interface ClearCacheRequest {
  pattern?: string;
  tags?: string[];
}
