import { BaseApiService } from './base';
import { ApiResponse } from '../types/storm';
import {
  CoStormSession,
  SessionParticipant,
  MindMapNode,
  DiscourseMessage,
  SessionSettings,
  CreateSessionRequest,
  JoinSessionRequest,
  SendMessageRequest,
  UpdateMindMapRequest,
  PaginatedResponse,
} from '../types/api';

export class SessionService extends BaseApiService {
  private readonly basePath = '/sessions';

  /**
   * Get all Co-STORM sessions
   */
  async getSessions(options?: {
    page?: number;
    limit?: number;
    status?: 'active' | 'paused' | 'completed' | 'cancelled';
    projectId?: string;
  }): Promise<ApiResponse<PaginatedResponse<CoStormSession>>> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.status) params.append('status', options.status);
    if (options?.projectId) params.append('projectId', options.projectId);

    const url = `${this.basePath}${params.toString() ? '?' + params.toString() : ''}`;
    return this.get<PaginatedResponse<CoStormSession>>(url);
  }

  /**
   * Get a specific session
   */
  async getSession(sessionId: string): Promise<ApiResponse<CoStormSession>> {
    return this.get<CoStormSession>(`${this.basePath}/${sessionId}`);
  }

  /**
   * Create a new Co-STORM session
   */
  async createSession(
    request: CreateSessionRequest
  ): Promise<ApiResponse<CoStormSession>> {
    return this.post<CoStormSession>(this.basePath, request);
  }

  /**
   * Update session settings
   */
  async updateSession(
    sessionId: string,
    updates: {
      title?: string;
      description?: string;
      settings?: Partial<SessionSettings>;
    }
  ): Promise<ApiResponse<CoStormSession>> {
    return this.patch<CoStormSession>(`${this.basePath}/${sessionId}`, updates);
  }

  /**
   * Delete a session
   */
  async deleteSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.delete<void>(`${this.basePath}/${sessionId}`);
  }

  /**
   * Join a session
   */
  async joinSession(
    request: JoinSessionRequest
  ): Promise<ApiResponse<SessionJoinResult>> {
    return this.post<SessionJoinResult>(
      `${this.basePath}/${request.sessionId}/join`,
      {
        participantName: request.participantName,
        role: request.role,
      }
    );
  }

  /**
   * Leave a session
   */
  async leaveSession(sessionId: string): Promise<ApiResponse<void>> {
    return this.post<void>(`${this.basePath}/${sessionId}/leave`);
  }

  /**
   * Get session participants
   */
  async getParticipants(
    sessionId: string
  ): Promise<ApiResponse<SessionParticipant[]>> {
    return this.get<SessionParticipant[]>(
      `${this.basePath}/${sessionId}/participants`
    );
  }

  /**
   * Update participant status
   */
  async updateParticipant(
    sessionId: string,
    participantId: string,
    updates: {
      isActive?: boolean;
      role?: string;
      expertise?: string[];
    }
  ): Promise<ApiResponse<SessionParticipant>> {
    return this.patch<SessionParticipant>(
      `${this.basePath}/${sessionId}/participants/${participantId}`,
      updates
    );
  }

  /**
   * Remove a participant from session
   */
  async removeParticipant(
    sessionId: string,
    participantId: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(
      `${this.basePath}/${sessionId}/participants/${participantId}`
    );
  }

  /**
   * Send a message in the discourse
   */
  async sendMessage(
    request: SendMessageRequest
  ): Promise<ApiResponse<DiscourseMessage>> {
    return this.post<DiscourseMessage>(
      `${this.basePath}/${request.sessionId}/messages`,
      {
        content: request.content,
        messageType: request.messageType,
        references: request.references,
      }
    );
  }

  /**
   * Get discourse messages
   */
  async getMessages(
    sessionId: string,
    options?: {
      page?: number;
      limit?: number;
      since?: Date;
      messageType?: 'text' | 'query' | 'source' | 'mindmap_update';
      senderId?: string;
    }
  ): Promise<ApiResponse<PaginatedResponse<DiscourseMessage>>> {
    const params = new URLSearchParams();
    if (options?.page) params.append('page', options.page.toString());
    if (options?.limit) params.append('limit', options.limit.toString());
    if (options?.since) params.append('since', options.since.toISOString());
    if (options?.messageType) params.append('messageType', options.messageType);
    if (options?.senderId) params.append('senderId', options.senderId);

    const url = `${this.basePath}/${sessionId}/messages${
      params.toString() ? '?' + params.toString() : ''
    }`;
    return this.get<PaginatedResponse<DiscourseMessage>>(url);
  }

  /**
   * Update a message
   */
  async updateMessage(
    sessionId: string,
    messageId: string,
    content: string
  ): Promise<ApiResponse<DiscourseMessage>> {
    return this.patch<DiscourseMessage>(
      `${this.basePath}/${sessionId}/messages/${messageId}`,
      {
        content,
      }
    );
  }

  /**
   * Delete a message
   */
  async deleteMessage(
    sessionId: string,
    messageId: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(
      `${this.basePath}/${sessionId}/messages/${messageId}`
    );
  }

  /**
   * Get session mind map
   */
  async getMindMap(sessionId: string): Promise<ApiResponse<MindMapNode[]>> {
    return this.get<MindMapNode[]>(`${this.basePath}/${sessionId}/mindmap`);
  }

  /**
   * Update mind map nodes
   */
  async updateMindMap(
    request: UpdateMindMapRequest
  ): Promise<ApiResponse<MindMapNode[]>> {
    return this.post<MindMapNode[]>(
      `${this.basePath}/${request.sessionId}/mindmap`,
      {
        nodes: request.nodes,
        action: request.action,
      }
    );
  }

  /**
   * Add a mind map node
   */
  async addMindMapNode(
    sessionId: string,
    node: Omit<MindMapNode, 'id' | 'createdAt' | 'createdBy'>
  ): Promise<ApiResponse<MindMapNode>> {
    return this.post<MindMapNode>(
      `${this.basePath}/${sessionId}/mindmap/nodes`,
      node
    );
  }

  /**
   * Update a mind map node
   */
  async updateMindMapNode(
    sessionId: string,
    nodeId: string,
    updates: Partial<MindMapNode>
  ): Promise<ApiResponse<MindMapNode>> {
    return this.patch<MindMapNode>(
      `${this.basePath}/${sessionId}/mindmap/nodes/${nodeId}`,
      updates
    );
  }

  /**
   * Delete a mind map node
   */
  async deleteMindMapNode(
    sessionId: string,
    nodeId: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(
      `${this.basePath}/${sessionId}/mindmap/nodes/${nodeId}`
    );
  }

  /**
   * Connect mind map nodes
   */
  async connectNodes(
    sessionId: string,
    sourceNodeId: string,
    targetNodeId: string,
    connectionType?: string
  ): Promise<ApiResponse<MindMapConnection>> {
    return this.post<MindMapConnection>(
      `${this.basePath}/${sessionId}/mindmap/connections`,
      {
        sourceNodeId,
        targetNodeId,
        connectionType,
      }
    );
  }

  /**
   * Disconnect mind map nodes
   */
  async disconnectNodes(
    sessionId: string,
    connectionId: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(
      `${this.basePath}/${sessionId}/mindmap/connections/${connectionId}`
    );
  }

  /**
   * Start session
   */
  async startSession(sessionId: string): Promise<ApiResponse<CoStormSession>> {
    return this.post<CoStormSession>(`${this.basePath}/${sessionId}/start`);
  }

  /**
   * Pause session
   */
  async pauseSession(sessionId: string): Promise<ApiResponse<CoStormSession>> {
    return this.post<CoStormSession>(`${this.basePath}/${sessionId}/pause`);
  }

  /**
   * Resume session
   */
  async resumeSession(sessionId: string): Promise<ApiResponse<CoStormSession>> {
    return this.post<CoStormSession>(`${this.basePath}/${sessionId}/resume`);
  }

  /**
   * Complete session
   */
  async completeSession(
    sessionId: string
  ): Promise<ApiResponse<CoStormSession>> {
    return this.post<CoStormSession>(`${this.basePath}/${sessionId}/complete`);
  }

  /**
   * Cancel session
   */
  async cancelSession(
    sessionId: string,
    reason?: string
  ): Promise<ApiResponse<CoStormSession>> {
    return this.post<CoStormSession>(`${this.basePath}/${sessionId}/cancel`, {
      reason,
    });
  }

  /**
   * Get session analytics
   */
  async getSessionAnalytics(
    sessionId: string
  ): Promise<ApiResponse<SessionAnalytics>> {
    return this.get<SessionAnalytics>(
      `${this.basePath}/${sessionId}/analytics`
    );
  }

  /**
   * Export session data
   */
  async exportSession(
    sessionId: string,
    format: 'json' | 'html' | 'pdf' | 'docx',
    options?: {
      includeMessages?: boolean;
      includeMindMap?: boolean;
      includeAnalytics?: boolean;
    }
  ): Promise<Blob> {
    const params = new URLSearchParams();
    params.append('format', format);
    if (options?.includeMessages) params.append('includeMessages', 'true');
    if (options?.includeMindMap) params.append('includeMindMap', 'true');
    if (options?.includeAnalytics) params.append('includeAnalytics', 'true');

    const url = `${this.basePath}/${sessionId}/export?${params.toString()}`;
    return this.downloadFile(url, `session-${sessionId}.${format}`);
  }

  /**
   * Import session data
   */
  async importSession(file: File): Promise<ApiResponse<CoStormSession>> {
    return this.uploadFile<CoStormSession>(`${this.basePath}/import`, file);
  }

  /**
   * Get session templates
   */
  async getSessionTemplates(): Promise<ApiResponse<SessionTemplate[]>> {
    return this.get<SessionTemplate[]>(`${this.basePath}/templates`);
  }

  /**
   * Create session from template
   */
  async createFromTemplate(
    templateId: string,
    data: {
      projectId: string;
      title: string;
      description?: string;
    }
  ): Promise<ApiResponse<CoStormSession>> {
    return this.post<CoStormSession>(
      `${this.basePath}/templates/${templateId}/create`,
      data
    );
  }

  /**
   * Save session as template
   */
  async saveAsTemplate(
    sessionId: string,
    template: {
      name: string;
      description: string;
      isPublic?: boolean;
      tags?: string[];
    }
  ): Promise<ApiResponse<SessionTemplate>> {
    return this.post<SessionTemplate>(
      `${this.basePath}/${sessionId}/save-as-template`,
      template
    );
  }

  /**
   * Get session moderator recommendations
   */
  async getModeratorRecommendations(
    sessionId: string
  ): Promise<ApiResponse<ModeratorRecommendation[]>> {
    return this.get<ModeratorRecommendation[]>(
      `${this.basePath}/${sessionId}/moderator-recommendations`
    );
  }

  /**
   * Apply moderator action
   */
  async applyModeratorAction(
    sessionId: string,
    action: {
      type:
        | 'redirect_conversation'
        | 'add_participant'
        | 'suggest_topic'
        | 'summarize_discussion';
      data: Record<string, any>;
    }
  ): Promise<ApiResponse<{ success: boolean; message: string }>> {
    return this.post<{ success: boolean; message: string }>(
      `${this.basePath}/${sessionId}/moderator-actions`,
      action
    );
  }

  /**
   * Get session insights
   */
  async getSessionInsights(
    sessionId: string
  ): Promise<ApiResponse<SessionInsights>> {
    return this.get<SessionInsights>(`${this.basePath}/${sessionId}/insights`);
  }

  /**
   * Subscribe to session events (WebSocket endpoint helper)
   */
  getSessionWebSocketUrl(sessionId: string): string {
    const baseUrl = this.client.defaults.baseURL?.replace(/^http/, 'ws');
    return `${baseUrl}${this.basePath}/${sessionId}/ws`;
  }

  /**
   * Invite participants via email
   */
  async inviteParticipants(
    sessionId: string,
    invitations: Array<{
      email: string;
      role?: string;
      message?: string;
    }>
  ): Promise<ApiResponse<SessionInvitationResult[]>> {
    return this.post<SessionInvitationResult[]>(
      `${this.basePath}/${sessionId}/invite`,
      {
        invitations,
      }
    );
  }

  /**
   * Get session invitations
   */
  async getInvitations(
    sessionId: string
  ): Promise<ApiResponse<SessionInvitation[]>> {
    return this.get<SessionInvitation[]>(
      `${this.basePath}/${sessionId}/invitations`
    );
  }

  /**
   * Cancel invitation
   */
  async cancelInvitation(
    sessionId: string,
    invitationId: string
  ): Promise<ApiResponse<void>> {
    return this.delete<void>(
      `${this.basePath}/${sessionId}/invitations/${invitationId}`
    );
  }

  /**
   * Accept invitation
   */
  async acceptInvitation(
    invitationToken: string
  ): Promise<ApiResponse<SessionJoinResult>> {
    return this.post<SessionJoinResult>(`${this.basePath}/accept-invitation`, {
      token: invitationToken,
    });
  }

  /**
   * Get session recordings
   */
  async getRecordings(
    sessionId: string
  ): Promise<ApiResponse<SessionRecording[]>> {
    return this.get<SessionRecording[]>(
      `${this.basePath}/${sessionId}/recordings`
    );
  }

  /**
   * Start session recording
   */
  async startRecording(
    sessionId: string
  ): Promise<ApiResponse<SessionRecording>> {
    return this.post<SessionRecording>(
      `${this.basePath}/${sessionId}/recordings/start`
    );
  }

  /**
   * Stop session recording
   */
  async stopRecording(
    sessionId: string,
    recordingId: string
  ): Promise<ApiResponse<SessionRecording>> {
    return this.post<SessionRecording>(
      `${this.basePath}/${sessionId}/recordings/${recordingId}/stop`
    );
  }

  /**
   * Download session recording
   */
  async downloadRecording(
    sessionId: string,
    recordingId: string
  ): Promise<Blob> {
    const url = `${this.basePath}/${sessionId}/recordings/${recordingId}/download`;
    return this.downloadFile(url);
  }
}

// Additional types specific to SessionService
export interface SessionJoinResult {
  sessionId: string;
  participantId: string;
  participant: SessionParticipant;
  webSocketUrl: string;
  initialData: {
    mindMap: MindMapNode[];
    recentMessages: DiscourseMessage[];
    participants: SessionParticipant[];
  };
}

export interface MindMapConnection {
  id: string;
  sourceNodeId: string;
  targetNodeId: string;
  connectionType?: string;
  createdAt: Date;
  createdBy: string;
}

export interface SessionAnalytics {
  sessionId: string;
  duration: number; // in minutes
  messageStats: {
    total: number;
    byType: Record<string, number>;
    byParticipant: Record<string, number>;
    messagesPerHour: number;
  };
  participantStats: {
    total: number;
    active: number;
    averageSessionTime: number;
    participationRate: Record<string, number>; // participant ID -> message count
  };
  mindMapStats: {
    totalNodes: number;
    totalConnections: number;
    nodesPerParticipant: Record<string, number>;
    topicClusters: Array<{
      topic: string;
      nodeCount: number;
      participants: string[];
    }>;
  };
  engagementMetrics: {
    averageResponseTime: number;
    conversationThreads: number;
    topicChanges: number;
    collaborationScore: number; // 0-100
  };
  outcomeMetrics: {
    consensusReached: Array<{
      topic: string;
      agreementLevel: number;
    }>;
    knowledgeGapsIdentified: number;
    actionItemsCreated: number;
  };
}

export interface SessionTemplate {
  id: string;
  name: string;
  description: string;
  settings: SessionSettings;
  initialMindMap?: MindMapNode[];
  suggestedParticipants: Array<{
    type: 'human' | 'ai_expert';
    role: string;
    expertise: string[];
  }>;
  isPublic: boolean;
  isSystem: boolean;
  tags: string[];
  usageCount: number;
  createdBy?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ModeratorRecommendation {
  id: string;
  type:
    | 'redirect_conversation'
    | 'add_expert'
    | 'suggest_topic'
    | 'summarize_discussion'
    | 'resolve_conflict';
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low';
  confidence: number; // 0-1
  actionData: Record<string, any>;
  reasoning: string[];
  estimatedImpact: 'high' | 'medium' | 'low';
}

export interface SessionInsights {
  sessionId: string;
  keyTopics: Array<{
    topic: string;
    relevance: number;
    mentionCount: number;
    participants: string[];
  }>;
  discussionFlow: Array<{
    phase: string;
    startTime: Date;
    endTime?: Date;
    mainTopics: string[];
    participantActivity: Record<string, number>;
  }>;
  consensusAreas: Array<{
    topic: string;
    agreementLevel: number;
    supportingParticipants: string[];
    keyPoints: string[];
  }>;
  conflictAreas: Array<{
    topic: string;
    disagreementLevel: number;
    conflictingViewpoints: Array<{
      viewpoint: string;
      supporters: string[];
    }>;
  }>;
  knowledgeGaps: Array<{
    gap: string;
    severity: 'high' | 'medium' | 'low';
    suggestedExperts: string[];
  }>;
  actionItems: Array<{
    item: string;
    priority: 'high' | 'medium' | 'low';
    assignee?: string;
    dueDate?: Date;
    status: 'pending' | 'in_progress' | 'completed';
  }>;
  recommendations: string[];
  overallQuality: {
    score: number; // 0-100
    factors: Record<string, number>;
    improvements: string[];
  };
}

export interface SessionInvitationResult {
  email: string;
  status: 'sent' | 'failed';
  invitationId?: string;
  error?: string;
}

export interface SessionInvitation {
  id: string;
  sessionId: string;
  email: string;
  role?: string;
  message?: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  token: string;
  sentAt: Date;
  expiresAt: Date;
  respondedAt?: Date;
}

export interface SessionRecording {
  id: string;
  sessionId: string;
  status: 'recording' | 'stopped' | 'processing' | 'ready' | 'failed';
  startedAt: Date;
  stoppedAt?: Date;
  duration?: number; // in seconds
  fileSize?: number; // in bytes
  format: 'json' | 'video' | 'audio';
  downloadUrl?: string;
  metadata?: Record<string, any>;
}

// Create and export singleton instance
export const sessionService = new SessionService({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api',
});
