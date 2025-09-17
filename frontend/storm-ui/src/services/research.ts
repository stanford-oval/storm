import { BaseApiService } from './base';
import { ApiResponse } from '../types/storm';
import {
  ResearchData,
  ConversationData,
  SourceData,
  SearchRequest,
  SearchResult,
  SearchFilters,
  ResearchExportRequest,
  PaginatedResponse,
} from '../types/api';

export class ResearchService extends BaseApiService {
  private readonly basePath = '/research';

  /**
   * Get research data for a project
   */
  async getProjectResearch(
    projectId: string
  ): Promise<ApiResponse<ResearchData>> {
    return this.get<ResearchData>(`${this.basePath}/projects/${projectId}`);
  }

  /**
   * Search for information using configured retrievers
   */
  async search(request: SearchRequest): Promise<ApiResponse<SearchResult[]>> {
    return this.post<SearchResult[]>(`${this.basePath}/search`, request);
  }

  /**
   * Get conversation data for a project
   */
  async getConversations(
    projectId: string,
    options?: {
      page?: number;
      limit?: number;
      perspective?: string;
      status?: 'active' | 'completed' | 'failed';
    }
  ): Promise<ApiResponse<PaginatedResponse<ConversationData>>> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.perspective) params.append('perspective', options.perspective);
    if (options?.status) params.append('status', options.status);

    const url = `${this.basePath}/projects/${projectId}/conversations${
      params.toString() ? '?' + params.toString() : ''
    }`;
    return this.get<PaginatedResponse<ConversationData>>(url);
  }

  /**
   * Get a specific conversation
   */
  async getConversation(
    projectId: string,
    conversationId: string
  ): Promise<ApiResponse<ConversationData>> {
    return this.get<ConversationData>(
      `${this.basePath}/projects/${projectId}/conversations/${conversationId}`
    );
  }

  /**
   * Get sources for a project
   */
  async getSources(
    projectId: string,
    options?: {
      page?: number;
      limit?: number;
      sortBy?: 'relevance' | 'date' | 'title';
      sortOrder?: 'asc' | 'desc';
      usedOnly?: boolean;
    }
  ): Promise<ApiResponse<PaginatedResponse<SourceData>>> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.sortBy) params.append('sortBy', options.sortBy);
    if (options?.sortOrder) params.append('sortOrder', options.sortOrder);
    if (options?.usedOnly) params.append('usedOnly', 'true');

    const url = `${this.basePath}/projects/${projectId}/sources${
      params.toString() ? '?' + params.toString() : ''
    }`;
    return this.get<PaginatedResponse<SourceData>>(url);
  }

  /**
   * Get a specific source
   */
  async getSource(
    projectId: string,
    sourceId: string
  ): Promise<ApiResponse<SourceData>> {
    return this.get<SourceData>(
      `${this.basePath}/projects/${projectId}/sources/${sourceId}`
    );
  }

  /**
   * Add a custom source
   */
  async addCustomSource(
    projectId: string,
    source: {
      title: string;
      url: string;
      snippet: string;
      content?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<ApiResponse<SourceData>> {
    return this.post<SourceData>(
      `${this.basePath}/projects/${projectId}/sources`,
      source
    );
  }

  /**
   * Update a source
   */
  async updateSource(
    projectId: string,
    sourceId: string,
    updates: Partial<SourceData>
  ): Promise<ApiResponse<SourceData>> {
    return this.patch<SourceData>(
      `${this.basePath}/projects/${projectId}/sources/${sourceId}`,
      updates
    );
  }

  /**
   * Delete a source
   */
  async deleteSource(
    projectId: string,
    sourceId: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(
      `${this.basePath}/projects/${projectId}/sources/${sourceId}`
    );
  }

  /**
   * Rate a source's relevance
   */
  async rateSource(
    projectId: string,
    sourceId: string,
    rating: number
  ): Promise<ApiResponse<SourceData>> {
    return this.post<SourceData>(
      `${this.basePath}/projects/${projectId}/sources/${sourceId}/rate`,
      { rating }
    );
  }

  /**
   * Get research perspectives
   */
  async getPerspectives(
    projectId: string
  ): Promise<ApiResponse<ResearchPerspective[]>> {
    return this.get<ResearchPerspective[]>(
      `${this.basePath}/projects/${projectId}/perspectives`
    );
  }

  /**
   * Add a research perspective
   */
  async addPerspective(
    projectId: string,
    perspective: {
      name: string;
      description: string;
      expertise?: string[];
      focus?: string;
    }
  ): Promise<ApiResponse<ResearchPerspective>> {
    return this.post<ResearchPerspective>(
      `${this.basePath}/projects/${projectId}/perspectives`,
      perspective
    );
  }

  /**
   * Update a research perspective
   */
  async updatePerspective(
    projectId: string,
    perspectiveId: string,
    updates: Partial<ResearchPerspective>
  ): Promise<ApiResponse<ResearchPerspective>> {
    return this.patch<ResearchPerspective>(
      `${this.basePath}/projects/${projectId}/perspectives/${perspectiveId}`,
      updates
    );
  }

  /**
   * Delete a research perspective
   */
  async deletePerspective(
    projectId: string,
    perspectiveId: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(
      `${this.basePath}/projects/${projectId}/perspectives/${perspectiveId}`
    );
  }

  /**
   * Generate research questions
   */
  async generateResearchQuestions(
    projectId: string,
    topic: string,
    perspective?: string
  ): Promise<ApiResponse<ResearchQuestion[]>> {
    return this.post<ResearchQuestion[]>(
      `${this.basePath}/projects/${projectId}/generate-questions`,
      { topic, perspective }
    );
  }

  /**
   * Execute a research query
   */
  async executeQuery(
    projectId: string,
    query: string,
    options?: {
      perspective?: string;
      maxSources?: number;
      filters?: SearchFilters;
    }
  ): Promise<ApiResponse<QueryResult>> {
    return this.post<QueryResult>(
      `${this.basePath}/projects/${projectId}/query`,
      {
        query,
        ...options,
      }
    );
  }

  /**
   * Get research analytics
   */
  async getResearchAnalytics(
    projectId: string
  ): Promise<ApiResponse<ResearchAnalytics>> {
    return this.get<ResearchAnalytics>(
      `${this.basePath}/projects/${projectId}/analytics`
    );
  }

  /**
   * Export research data
   */
  async exportResearch(request: ResearchExportRequest): Promise<Blob> {
    const url = `${this.basePath}/projects/${request.projectId}/export?format=${request.format}`;
    const filename = `research-${request.projectId}.${request.format}`;
    return this.downloadFile(url, filename);
  }

  /**
   * Import research data from file
   */
  async importResearch(
    projectId: string,
    file: File,
    options?: { merge?: boolean; overwrite?: boolean }
  ): Promise<ApiResponse<ResearchImportResult>> {
    const formData = new FormData();
    formData.append('file', file);
    if (options?.merge) formData.append('merge', 'true');
    if (options?.overwrite) formData.append('overwrite', 'true');

    return this.uploadFile<ResearchImportResult>(
      `${this.basePath}/projects/${projectId}/import`,
      file
    );
  }

  /**
   * Summarize research findings
   */
  async summarizeResearch(
    projectId: string,
    options?: {
      perspective?: string;
      maxLength?: number;
      includeStats?: boolean;
    }
  ): Promise<ApiResponse<ResearchSummary>> {
    return this.post<ResearchSummary>(
      `${this.basePath}/projects/${projectId}/summarize`,
      options
    );
  }

  /**
   * Find research gaps
   */
  async findResearchGaps(
    projectId: string
  ): Promise<ApiResponse<ResearchGap[]>> {
    return this.get<ResearchGap[]>(
      `${this.basePath}/projects/${projectId}/gaps`
    );
  }

  /**
   * Get research timeline
   */
  async getResearchTimeline(
    projectId: string
  ): Promise<ApiResponse<ResearchTimelineEntry[]>> {
    return this.get<ResearchTimelineEntry[]>(
      `${this.basePath}/projects/${projectId}/timeline`
    );
  }

  /**
   * Get source citations
   */
  async getSourceCitations(
    projectId: string,
    sourceId: string,
    format?: 'apa' | 'mla' | 'chicago' | 'harvard'
  ): Promise<ApiResponse<CitationInfo>> {
    const params = new URLSearchParams();
    if (format) params.append('format', format);

    const url = `${this.basePath}/projects/${projectId}/sources/${sourceId}/citation${
      params.toString() ? '?' + params.toString() : ''
    }`;
    return this.get<CitationInfo>(url);
  }

  /**
   * Validate sources
   */
  async validateSources(
    projectId: string,
    sourceIds?: string[]
  ): Promise<ApiResponse<SourceValidationResult[]>> {
    const body = sourceIds ? { sourceIds } : undefined;
    return this.post<SourceValidationResult[]>(
      `${this.basePath}/projects/${projectId}/validate-sources`,
      body
    );
  }

  /**
   * Get similar sources
   */
  async getSimilarSources(
    projectId: string,
    sourceId: string,
    limit?: number
  ): Promise<ApiResponse<SourceData[]>> {
    const params = new URLSearchParams();
    if (limit) params.append('limit', limit.toString());

    const url = `${this.basePath}/projects/${projectId}/sources/${sourceId}/similar${
      params.toString() ? '?' + params.toString() : ''
    }`;
    return this.get<SourceData[]>(url);
  }

  /**
   * Generate research report
   */
  async generateReport(
    projectId: string,
    options: {
      format: 'html' | 'pdf' | 'docx' | 'markdown';
      includeConversations?: boolean;
      includeSources?: boolean;
      includeAnalytics?: boolean;
      template?: string;
    }
  ): Promise<ApiResponse<ReportGenerationJob>> {
    return this.post<ReportGenerationJob>(
      `${this.basePath}/projects/${projectId}/generate-report`,
      options
    );
  }

  /**
   * Get report generation status
   */
  async getReportStatus(
    jobId: string
  ): Promise<ApiResponse<ReportGenerationJob>> {
    return this.get<ReportGenerationJob>(`${this.basePath}/reports/${jobId}`);
  }

  /**
   * Download generated report
   */
  async downloadReport(jobId: string): Promise<Blob> {
    return this.downloadFile(`${this.basePath}/reports/${jobId}/download`);
  }

  /**
   * Create research bookmark
   */
  async createBookmark(
    projectId: string,
    bookmark: {
      sourceId?: string;
      conversationId?: string;
      query?: string;
      note: string;
      tags?: string[];
    }
  ): Promise<ApiResponse<ResearchBookmark>> {
    return this.post<ResearchBookmark>(
      `${this.basePath}/projects/${projectId}/bookmarks`,
      bookmark
    );
  }

  /**
   * Get research bookmarks
   */
  async getBookmarks(
    projectId: string,
    options?: {
      page?: number;
      limit?: number;
      tag?: string;
    }
  ): Promise<ApiResponse<PaginatedResponse<ResearchBookmark>>> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.tag) params.append('tag', options.tag);

    const url = `${this.basePath}/projects/${projectId}/bookmarks${
      params.toString() ? '?' + params.toString() : ''
    }`;
    return this.get<PaginatedResponse<ResearchBookmark>>(url);
  }

  /**
   * Update research bookmark
   */
  async updateBookmark(
    projectId: string,
    bookmarkId: string,
    updates: Partial<ResearchBookmark>
  ): Promise<ApiResponse<ResearchBookmark>> {
    return this.patch<ResearchBookmark>(
      `${this.basePath}/projects/${projectId}/bookmarks/${bookmarkId}`,
      updates
    );
  }

  /**
   * Delete research bookmark
   */
  async deleteBookmark(
    projectId: string,
    bookmarkId: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(
      `${this.basePath}/projects/${projectId}/bookmarks/${bookmarkId}`
    );
  }
}

// Additional types specific to ResearchService
export interface ResearchPerspective {
  id: string;
  name: string;
  description: string;
  expertise: string[];
  focus?: string;
  conversationCount: number;
  sourceCount: number;
  createdAt: Date;
  isActive: boolean;
}

export interface ResearchQuestion {
  id: string;
  question: string;
  perspective: string;
  priority: 'high' | 'medium' | 'low';
  status: 'pending' | 'researched' | 'answered';
  sources: string[];
  createdAt: Date;
}

export interface QueryResult {
  query: string;
  perspective?: string;
  sources: SourceData[];
  summary: string;
  followUpQuestions: string[];
  executedAt: Date;
  tokensUsed: number;
  responseTime: number;
}

export interface ResearchAnalytics {
  projectId: string;
  totalSources: number;
  totalConversations: number;
  totalQueries: number;
  averageSourceRelevance: number;
  topPerspectives: Array<{
    name: string;
    count: number;
    percentage: number;
  }>;
  sourceDistribution: Array<{
    domain: string;
    count: number;
    percentage: number;
  }>;
  timeDistribution: Array<{
    date: string;
    sources: number;
    conversations: number;
  }>;
  qualityMetrics: {
    duplicateSources: number;
    lowRelevanceSources: number;
    brokenLinks: number;
    averageSourceAge: number; // in days
  };
  costMetrics: {
    totalTokensUsed: number;
    estimatedCost: number;
    apiCalls: number;
  };
}

export interface ResearchImportResult {
  imported: {
    sources: number;
    conversations: number;
    perspectives: number;
  };
  skipped: {
    sources: number;
    conversations: number;
    perspectives: number;
  };
  errors: Array<{
    type: string;
    message: string;
    item?: string;
  }>;
}

export interface ResearchSummary {
  projectId: string;
  perspective?: string;
  keyFindings: string[];
  mainTopics: Array<{
    topic: string;
    confidence: number;
    sources: number;
  }>;
  summary: string;
  sourceCount: number;
  conversationCount: number;
  generatedAt: Date;
  statistics: {
    averageRelevance: number;
    sourceTypes: Record<string, number>;
    timespan: {
      earliest: Date;
      latest: Date;
    };
  };
}

export interface ResearchGap {
  id: string;
  title: string;
  description: string;
  severity: 'high' | 'medium' | 'low';
  suggestions: string[];
  affectedPerspectives: string[];
  detectedAt: Date;
}

export interface ResearchTimelineEntry {
  id: string;
  timestamp: Date;
  type:
    | 'conversation'
    | 'source_added'
    | 'query_executed'
    | 'perspective_added';
  title: string;
  description: string;
  metadata?: Record<string, any>;
}

export interface CitationInfo {
  sourceId: string;
  citations: Record<string, string>; // format -> citation string
  metadata: {
    title: string;
    authors: string[];
    publishDate?: Date;
    accessDate: Date;
    journal?: string;
    volume?: string;
    issue?: string;
    pages?: string;
    doi?: string;
    isbn?: string;
  };
}

export interface SourceValidationResult {
  sourceId: string;
  isValid: boolean;
  issues: Array<{
    type: 'broken_link' | 'moved' | 'access_denied' | 'content_changed';
    severity: 'error' | 'warning';
    message: string;
    suggestedAction?: string;
  }>;
  lastChecked: Date;
  httpStatus?: number;
  redirectUrl?: string;
}

export interface ReportGenerationJob {
  id: string;
  projectId: string;
  status: 'queued' | 'processing' | 'completed' | 'failed';
  progress: number;
  format: string;
  options: Record<string, any>;
  downloadUrl?: string;
  error?: string;
  createdAt: Date;
  completedAt?: Date;
  expiresAt?: Date;
}

export interface ResearchBookmark {
  id: string;
  projectId: string;
  sourceId?: string;
  conversationId?: string;
  query?: string;
  note: string;
  tags: string[];
  createdAt: Date;
  updatedAt: Date;
  metadata?: Record<string, any>;
}

// Create and export singleton instance
export const researchService = new ResearchService({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
});
