// Co-STORM session store slice
import { create } from 'zustand';
import {
  SessionState,
  CoStormSession,
  Participant,
  DiscourseTurn,
  MindMapNode,
  TurnPolicy,
  SessionSettings,
  WebSocketConnection,
  ModeratorState,
  KnowledgeItem,
  Reaction,
} from '../types';
import { persist, createPartialize } from '../middleware/persist';
import { devtools } from '../middleware/devtools';
import { immer } from '../middleware/immer';
import { subscriptions } from '../middleware/subscriptions';

// Initial state
const initialState: SessionState = {
  currentSession: null,
  sessions: [],
  activeParticipants: [],
  mindMap: [],
  turnPolicy: {
    maxTurnsPerParticipant: 5,
    turnTimeLimit: 300, // 5 minutes
    moderationEnabled: true,
    allowInterruptions: false,
  },
  sessionSettings: {
    maxParticipants: 8,
    sessionDuration: 3600, // 1 hour
    autoSaveInterval: 30, // 30 seconds
    allowAnonymous: false,
  },
  realtimeConnection: null,
  loading: false,
  error: null,
  lastUpdated: null,
};

// Session store actions interface
interface SessionActions {
  // Session lifecycle
  createSession: (sessionData: Partial<CoStormSession>) => Promise<string>;
  joinSession: (
    sessionId: string,
    participant: Omit<Participant, 'id'>
  ) => Promise<void>;
  leaveSession: (sessionId: string, participantId?: string) => Promise<void>;
  endSession: (sessionId: string) => Promise<void>;
  pauseSession: (sessionId: string) => Promise<void>;
  resumeSession: (sessionId: string) => Promise<void>;

  // Session management
  loadSession: (sessionId: string) => Promise<void>;
  loadSessions: () => Promise<void>;
  updateSession: (
    sessionId: string,
    updates: Partial<CoStormSession>
  ) => Promise<void>;
  deleteSession: (sessionId: string) => Promise<void>;
  duplicateSession: (sessionId: string, newTitle: string) => Promise<string>;
  archiveSession: (sessionId: string) => Promise<void>;

  // Participant management
  addParticipant: (participant: Omit<Participant, 'id'>) => Promise<void>;
  updateParticipant: (
    participantId: string,
    updates: Partial<Participant>
  ) => Promise<void>;
  removeParticipant: (participantId: string) => Promise<void>;
  setParticipantStatus: (participantId: string, isActive: boolean) => void;
  assignExpertise: (participantId: string, expertise: string[]) => void;

  // Discourse management
  addDiscourseTurn: (
    turn: Omit<DiscourseTurn, 'id' | 'timestamp'>
  ) => Promise<void>;
  updateDiscourseTurn: (
    turnId: string,
    updates: Partial<DiscourseTurn>
  ) => void;
  removeDiscourseTurn: (turnId: string) => void;
  addReaction: (turnId: string, reaction: Omit<Reaction, 'timestamp'>) => void;
  removeReaction: (
    turnId: string,
    reactionType: Reaction['type'],
    participantId: string
  ) => void;

  // Mind map management
  addMindMapNode: (node: Omit<MindMapNode, 'id'>) => void;
  updateMindMapNode: (nodeId: string, updates: Partial<MindMapNode>) => void;
  removeMindMapNode: (nodeId: string) => void;
  connectMindMapNodes: (nodeId1: string, nodeId2: string) => void;
  disconnectMindMapNodes: (nodeId1: string, nodeId2: string) => void;
  repositionMindMapNode: (
    nodeId: string,
    position: { x: number; y: number }
  ) => void;

  // Knowledge base management
  addKnowledgeItem: (item: Omit<KnowledgeItem, 'id' | 'createdAt'>) => void;
  updateKnowledgeItem: (
    itemId: string,
    updates: Partial<KnowledgeItem>
  ) => void;
  removeKnowledgeItem: (itemId: string) => void;
  validateKnowledgeItem: (itemId: string, validatorId: string) => void;
  searchKnowledgeBase: (query: string) => KnowledgeItem[];

  // Turn policy and moderation
  updateTurnPolicy: (policy: Partial<TurnPolicy>) => void;
  updateModerator: (updates: Partial<ModeratorState>) => void;
  requestTurn: (participantId: string) => void;
  grantTurn: (participantId: string) => void;
  skipTurn: (participantId: string) => void;
  moderateContent: (
    turnId: string,
    action: 'approve' | 'reject' | 'edit'
  ) => void;

  // Session settings
  updateSessionSettings: (settings: Partial<SessionSettings>) => void;
  enableAutoSave: (interval?: number) => void;
  disableAutoSave: () => void;
  saveSession: () => Promise<void>;

  // WebSocket connection management
  connectWebSocket: (sessionId: string) => Promise<void>;
  disconnectWebSocket: () => void;
  handleWebSocketMessage: (message: any) => void;
  sendWebSocketMessage: (type: string, payload: any) => void;

  // Analytics and insights
  getSessionAnalytics: (sessionId?: string) => SessionAnalytics;
  getParticipantAnalytics: (participantId: string) => ParticipantAnalytics;
  getDiscourseAnalytics: (sessionId?: string) => DiscourseAnalytics;

  // Export functionality
  exportSession: (
    sessionId: string,
    format: 'json' | 'txt' | 'pdf'
  ) => Promise<string>;
  exportMindMap: (format: 'json' | 'svg' | 'png') => string;
  exportKnowledgeBase: (format: 'json' | 'csv') => string;

  // State management
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// Additional types
interface SessionAnalytics {
  totalSessions: number;
  averageSessionDuration: number;
  averageParticipants: number;
  totalDiscourseTurns: number;
  activeSessionsCount: number;
  completedSessionsCount: number;
  topTopics: Array<{ topic: string; frequency: number }>;
  participationRate: number;
}

interface ParticipantAnalytics {
  totalTurns: number;
  averageTurnLength: number;
  topicsContributed: string[];
  collaborationScore: number;
  reactionsReceived: number;
  reactionsGiven: number;
  expertiseUtilization: number;
}

interface DiscourseAnalytics {
  totalTurns: number;
  turnsByType: Record<DiscourseTurn['type'], number>;
  averageTurnLength: number;
  mostActiveParticipants: Array<{
    participant: Participant;
    turnCount: number;
  }>;
  topicEvolution: Array<{ topic: string; timestamp: Date }>;
  consensusLevel: number;
}

// Session store type
export type SessionStore = SessionState & SessionActions;

// WebSocket instance and auto-save timer
let websocket: WebSocket | null = null;
let autoSaveTimer: NodeJS.Timeout | null = null;

// Create session store
export const useSessionStore = create<SessionStore>()(
  devtools(
    persist(
      subscriptions(
        immer<SessionStore>((set, get) => ({
          // Initial state
          ...initialState,

          // Session lifecycle
          createSession: async sessionData => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const response = await fetch('/api/sessions', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  title: sessionData.title || 'New Co-STORM Session',
                  topic: sessionData.topic || '',
                  status: 'active',
                  participants: [],
                  discourse: [],
                  knowledgeBase: [],
                  moderator: {
                    isActive: true,
                    currentTopic: sessionData.topic || '',
                    nextParticipant: null,
                    agenda: [],
                  },
                  ...sessionData,
                }),
              });

              if (!response.ok) {
                throw new Error('Failed to create session');
              }

              const newSession: CoStormSession = await response.json();

              set(draft => {
                draft.sessions.unshift(newSession);
                draft.currentSession = newSession;
                draft.loading = false;
                draft.lastUpdated = new Date();
              });

              // Connect to WebSocket for real-time updates
              await get().connectWebSocket(newSession.id);

              return newSession.id;
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to create session';
                draft.loading = false;
              });
              throw error;
            }
          },

          joinSession: async (sessionId, participant) => {
            try {
              const response = await fetch(`/api/sessions/${sessionId}/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(participant),
              });

              if (!response.ok) {
                throw new Error('Failed to join session');
              }

              const updatedSession: CoStormSession = await response.json();

              set(draft => {
                const sessionIndex = draft.sessions.findIndex(
                  s => s.id === sessionId
                );
                if (sessionIndex !== -1) {
                  draft.sessions[sessionIndex] = updatedSession;
                }
                if (draft.currentSession?.id === sessionId) {
                  draft.currentSession = updatedSession;
                }
                draft.activeParticipants = updatedSession.participants.filter(
                  p => p.isActive
                );
                draft.lastUpdated = new Date();
              });

              // Connect to WebSocket if not already connected
              if (!websocket || websocket.readyState !== WebSocket.OPEN) {
                await get().connectWebSocket(sessionId);
              }
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to join session';
              });
              throw error;
            }
          },

          leaveSession: async (sessionId, participantId) => {
            try {
              const response = await fetch(`/api/sessions/${sessionId}/leave`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ participantId }),
              });

              if (!response.ok) {
                throw new Error('Failed to leave session');
              }

              set(draft => {
                if (draft.currentSession?.id === sessionId) {
                  if (!participantId) {
                    // User is leaving the session entirely
                    draft.currentSession = null;
                    draft.activeParticipants = [];
                  } else {
                    // Remove specific participant
                    draft.currentSession.participants =
                      draft.currentSession.participants.filter(
                        p => p.id !== participantId
                      );
                    draft.activeParticipants = draft.activeParticipants.filter(
                      p => p.id !== participantId
                    );
                  }
                }
                draft.lastUpdated = new Date();
              });

              // Disconnect WebSocket if user is leaving entirely
              if (!participantId) {
                get().disconnectWebSocket();
              }
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to leave session';
              });
              throw error;
            }
          },

          endSession: async sessionId => {
            try {
              const response = await fetch(`/api/sessions/${sessionId}/end`, {
                method: 'POST',
              });

              if (!response.ok) {
                throw new Error('Failed to end session');
              }

              set(draft => {
                const sessionIndex = draft.sessions.findIndex(
                  s => s.id === sessionId
                );
                if (sessionIndex !== -1) {
                  draft.sessions[sessionIndex].status = 'completed';
                  draft.sessions[sessionIndex].updatedAt = new Date();
                }
                if (draft.currentSession?.id === sessionId) {
                  draft.currentSession.status = 'completed';
                }
                draft.lastUpdated = new Date();
              });

              get().disconnectWebSocket();
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to end session';
              });
              throw error;
            }
          },

          pauseSession: async sessionId => {
            await get().updateSession(sessionId, { status: 'paused' });
          },

          resumeSession: async sessionId => {
            await get().updateSession(sessionId, { status: 'active' });
          },

          // Session management
          loadSession: async sessionId => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const response = await fetch(`/api/sessions/${sessionId}`);

              if (!response.ok) {
                throw new Error('Session not found');
              }

              const session: CoStormSession = await response.json();

              set(draft => {
                draft.currentSession = session;
                draft.activeParticipants = session.participants.filter(
                  p => p.isActive
                );

                // Update mind map if available
                if (session.knowledgeBase) {
                  // Convert knowledge items to mind map nodes (simplified)
                  draft.mindMap = session.knowledgeBase.map((item, index) => ({
                    id: item.id,
                    title: item.content.substring(0, 50),
                    type: 'concept' as const,
                    position: { x: index * 100, y: index * 100 },
                    connections: [],
                    metadata: item,
                  }));
                }

                draft.loading = false;
                draft.lastUpdated = new Date();
              });

              // Update session in sessions list
              set(draft => {
                const sessionIndex = draft.sessions.findIndex(
                  s => s.id === sessionId
                );
                if (sessionIndex !== -1) {
                  draft.sessions[sessionIndex] = session;
                } else {
                  draft.sessions.unshift(session);
                }
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to load session';
                draft.loading = false;
              });
              throw error;
            }
          },

          loadSessions: async () => {
            set(draft => {
              draft.loading = true;
              draft.error = null;
            });

            try {
              const response = await fetch('/api/sessions');

              if (!response.ok) {
                throw new Error('Failed to load sessions');
              }

              const sessions: CoStormSession[] = await response.json();

              set(draft => {
                draft.sessions = sessions;
                draft.loading = false;
                draft.lastUpdated = new Date();
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to load sessions';
                draft.loading = false;
              });
              throw error;
            }
          },

          updateSession: async (sessionId, updates) => {
            try {
              const response = await fetch(`/api/sessions/${sessionId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(updates),
              });

              if (!response.ok) {
                throw new Error('Failed to update session');
              }

              const updatedSession: CoStormSession = await response.json();

              set(draft => {
                const sessionIndex = draft.sessions.findIndex(
                  s => s.id === sessionId
                );
                if (sessionIndex !== -1) {
                  draft.sessions[sessionIndex] = updatedSession;
                }
                if (draft.currentSession?.id === sessionId) {
                  draft.currentSession = updatedSession;
                }
                draft.lastUpdated = new Date();
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to update session';
              });
              throw error;
            }
          },

          deleteSession: async sessionId => {
            try {
              const response = await fetch(`/api/sessions/${sessionId}`, {
                method: 'DELETE',
              });

              if (!response.ok) {
                throw new Error('Failed to delete session');
              }

              set(draft => {
                draft.sessions = draft.sessions.filter(s => s.id !== sessionId);
                if (draft.currentSession?.id === sessionId) {
                  draft.currentSession = null;
                  draft.activeParticipants = [];
                  draft.mindMap = [];
                }
                draft.lastUpdated = new Date();
              });
            } catch (error) {
              set(draft => {
                draft.error =
                  error instanceof Error
                    ? error.message
                    : 'Failed to delete session';
              });
              throw error;
            }
          },

          duplicateSession: async (sessionId, newTitle) => {
            const originalSession = get().sessions.find(
              s => s.id === sessionId
            );
            if (!originalSession) {
              throw new Error('Session not found');
            }

            return get().createSession({
              title: newTitle,
              topic: originalSession.topic,
              participants: [],
              discourse: [],
              knowledgeBase: [...originalSession.knowledgeBase],
              moderator: { ...originalSession.moderator },
            });
          },

          archiveSession: async sessionId => {
            await get().updateSession(sessionId, { status: 'completed' });
          },

          // Participant management
          addParticipant: async participant => {
            if (!get().currentSession) {
              throw new Error('No active session');
            }

            await get().joinSession(get().currentSession!.id, participant);
          },

          updateParticipant: async (participantId, updates) => {
            const { currentSession } = get();
            if (!currentSession) {
              throw new Error('No active session');
            }

            const updatedParticipants = currentSession.participants.map(p =>
              p.id === participantId ? { ...p, ...updates } : p
            );

            await get().updateSession(currentSession.id, {
              participants: updatedParticipants,
            });
          },

          removeParticipant: async participantId => {
            const { currentSession } = get();
            if (!currentSession) {
              throw new Error('No active session');
            }

            await get().leaveSession(currentSession.id, participantId);
          },

          setParticipantStatus: (participantId, isActive) => {
            set(draft => {
              if (draft.currentSession) {
                const participant = draft.currentSession.participants.find(
                  p => p.id === participantId
                );
                if (participant) {
                  participant.isActive = isActive;

                  // Update active participants list
                  draft.activeParticipants =
                    draft.currentSession.participants.filter(p => p.isActive);
                }
              }
            });
          },

          assignExpertise: async (participantId, expertise) => {
            await get().updateParticipant(participantId, { expertise });
          },

          // Discourse management
          addDiscourseTurn: async turn => {
            const { currentSession } = get();
            if (!currentSession) {
              throw new Error('No active session');
            }

            const newTurn: DiscourseTurn = {
              ...turn,
              id: `turn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              timestamp: new Date(),
            };

            set(draft => {
              if (draft.currentSession) {
                draft.currentSession.discourse.push(newTurn);
                draft.currentSession.updatedAt = new Date();
              }
            });

            // Send via WebSocket for real-time updates
            get().sendWebSocketMessage('discourse_turn', newTurn);
          },

          updateDiscourseTurn: (turnId, updates) => {
            set(draft => {
              if (draft.currentSession) {
                const turn = draft.currentSession.discourse.find(
                  t => t.id === turnId
                );
                if (turn) {
                  Object.assign(turn, updates);
                  draft.currentSession.updatedAt = new Date();
                }
              }
            });
          },

          removeDiscourseTurn: turnId => {
            set(draft => {
              if (draft.currentSession) {
                draft.currentSession.discourse =
                  draft.currentSession.discourse.filter(t => t.id !== turnId);
                draft.currentSession.updatedAt = new Date();
              }
            });
          },

          addReaction: (turnId, reaction) => {
            set(draft => {
              if (draft.currentSession) {
                const turn = draft.currentSession.discourse.find(
                  t => t.id === turnId
                );
                if (turn) {
                  if (!turn.reactions) {
                    turn.reactions = [];
                  }

                  // Remove existing reaction from same participant with same type
                  turn.reactions = turn.reactions.filter(
                    r =>
                      !(
                        r.participantId === reaction.participantId &&
                        r.type === reaction.type
                      )
                  );

                  turn.reactions.push({
                    ...reaction,
                    timestamp: new Date(),
                  });

                  draft.currentSession.updatedAt = new Date();
                }
              }
            });
          },

          removeReaction: (turnId, reactionType, participantId) => {
            set(draft => {
              if (draft.currentSession) {
                const turn = draft.currentSession.discourse.find(
                  t => t.id === turnId
                );
                if (turn && turn.reactions) {
                  turn.reactions = turn.reactions.filter(
                    r =>
                      !(
                        r.type === reactionType &&
                        r.participantId === participantId
                      )
                  );
                  draft.currentSession.updatedAt = new Date();
                }
              }
            });
          },

          // Mind map management
          addMindMapNode: node => {
            set(draft => {
              const newNode: MindMapNode = {
                ...node,
                id: `node_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              };
              draft.mindMap.push(newNode);
            });
          },

          updateMindMapNode: (nodeId, updates) => {
            set(draft => {
              const node = draft.mindMap.find(n => n.id === nodeId);
              if (node) {
                Object.assign(node, updates);
              }
            });
          },

          removeMindMapNode: nodeId => {
            set(draft => {
              // Remove node
              draft.mindMap = draft.mindMap.filter(n => n.id !== nodeId);

              // Remove all connections to this node
              draft.mindMap.forEach(node => {
                node.connections = node.connections.filter(id => id !== nodeId);
              });
            });
          },

          connectMindMapNodes: (nodeId1, nodeId2) => {
            set(draft => {
              const node1 = draft.mindMap.find(n => n.id === nodeId1);
              const node2 = draft.mindMap.find(n => n.id === nodeId2);

              if (node1 && !node1.connections.includes(nodeId2)) {
                node1.connections.push(nodeId2);
              }
              if (node2 && !node2.connections.includes(nodeId1)) {
                node2.connections.push(nodeId1);
              }
            });
          },

          disconnectMindMapNodes: (nodeId1, nodeId2) => {
            set(draft => {
              const node1 = draft.mindMap.find(n => n.id === nodeId1);
              const node2 = draft.mindMap.find(n => n.id === nodeId2);

              if (node1) {
                node1.connections = node1.connections.filter(
                  id => id !== nodeId2
                );
              }
              if (node2) {
                node2.connections = node2.connections.filter(
                  id => id !== nodeId1
                );
              }
            });
          },

          repositionMindMapNode: (nodeId, position) => {
            set(draft => {
              const node = draft.mindMap.find(n => n.id === nodeId);
              if (node) {
                node.position = position;
              }
            });
          },

          // Knowledge base management
          addKnowledgeItem: item => {
            set(draft => {
              if (draft.currentSession) {
                const newItem: KnowledgeItem = {
                  ...item,
                  id: `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                  createdAt: new Date(),
                };
                draft.currentSession.knowledgeBase.push(newItem);
                draft.currentSession.updatedAt = new Date();
              }
            });
          },

          updateKnowledgeItem: (itemId, updates) => {
            set(draft => {
              if (draft.currentSession) {
                const item = draft.currentSession.knowledgeBase.find(
                  i => i.id === itemId
                );
                if (item) {
                  Object.assign(item, updates);
                  draft.currentSession.updatedAt = new Date();
                }
              }
            });
          },

          removeKnowledgeItem: itemId => {
            set(draft => {
              if (draft.currentSession) {
                draft.currentSession.knowledgeBase =
                  draft.currentSession.knowledgeBase.filter(
                    i => i.id !== itemId
                  );
                draft.currentSession.updatedAt = new Date();
              }
            });
          },

          validateKnowledgeItem: (itemId, validatorId) => {
            set(draft => {
              if (draft.currentSession) {
                const item = draft.currentSession.knowledgeBase.find(
                  i => i.id === itemId
                );
                if (item && !item.validatedBy.includes(validatorId)) {
                  item.validatedBy.push(validatorId);
                  draft.currentSession.updatedAt = new Date();
                }
              }
            });
          },

          searchKnowledgeBase: query => {
            const { currentSession } = get();
            if (!currentSession) return [];

            const lowerQuery = query.toLowerCase();
            return currentSession.knowledgeBase.filter(
              item =>
                item.content.toLowerCase().includes(lowerQuery) ||
                item.tags.some(tag => tag.toLowerCase().includes(lowerQuery)) ||
                item.source.toLowerCase().includes(lowerQuery)
            );
          },

          // Turn policy and moderation
          updateTurnPolicy: policy => {
            set(draft => {
              Object.assign(draft.turnPolicy, policy);
            });
          },

          updateModerator: updates => {
            set(draft => {
              if (draft.currentSession) {
                Object.assign(draft.currentSession.moderator, updates);
                draft.currentSession.updatedAt = new Date();
              }
            });
          },

          requestTurn: participantId => {
            // This would typically send a request to the moderator
            get().sendWebSocketMessage('turn_request', { participantId });
          },

          grantTurn: participantId => {
            get().updateModerator({ nextParticipant: participantId });
            get().sendWebSocketMessage('turn_granted', { participantId });
          },

          skipTurn: participantId => {
            get().updateModerator({ nextParticipant: null });
            get().sendWebSocketMessage('turn_skipped', { participantId });
          },

          moderateContent: (turnId, action) => {
            // This would implement content moderation logic
            get().sendWebSocketMessage('content_moderated', { turnId, action });
          },

          // Session settings
          updateSessionSettings: settings => {
            set(draft => {
              Object.assign(draft.sessionSettings, settings);
            });
          },

          enableAutoSave: (interval = 30) => {
            get().disableAutoSave(); // Clear existing timer

            autoSaveTimer = setInterval(() => {
              get().saveSession();
            }, interval * 1000);
          },

          disableAutoSave: () => {
            if (autoSaveTimer) {
              clearInterval(autoSaveTimer);
              autoSaveTimer = null;
            }
          },

          saveSession: async () => {
            const { currentSession } = get();
            if (!currentSession) return;

            try {
              await get().updateSession(currentSession.id, {
                discourse: currentSession.discourse,
                knowledgeBase: currentSession.knowledgeBase,
                participants: currentSession.participants,
                moderator: currentSession.moderator,
              });
            } catch (error) {
              console.error('Auto-save failed:', error);
            }
          },

          // WebSocket connection management
          connectWebSocket: async sessionId => {
            return new Promise((resolve, reject) => {
              try {
                // Close existing connection
                get().disconnectWebSocket();

                const wsUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/api/sessions/${sessionId}/ws`;
                websocket = new WebSocket(wsUrl);

                websocket.onopen = () => {
                  set(draft => {
                    draft.realtimeConnection = {
                      status: 'connected',
                      lastPing: new Date(),
                      reconnectAttempts: 0,
                      maxReconnectAttempts: 5,
                    };
                  });
                  resolve();
                };

                websocket.onmessage = event => {
                  try {
                    const message = JSON.parse(event.data);
                    get().handleWebSocketMessage(message);
                  } catch (error) {
                    console.error('Failed to parse WebSocket message:', error);
                  }
                };

                websocket.onclose = () => {
                  set(draft => {
                    if (draft.realtimeConnection) {
                      draft.realtimeConnection.status = 'disconnected';
                    }
                  });

                  // Attempt to reconnect
                  const connection = get().realtimeConnection;
                  if (
                    connection &&
                    connection.reconnectAttempts <
                      connection.maxReconnectAttempts
                  ) {
                    setTimeout(
                      () => {
                        set(draft => {
                          if (draft.realtimeConnection) {
                            draft.realtimeConnection.status = 'reconnecting';
                            draft.realtimeConnection.reconnectAttempts += 1;
                          }
                        });

                        get().connectWebSocket(sessionId);
                      },
                      1000 * Math.pow(2, connection.reconnectAttempts)
                    );
                  }
                };

                websocket.onerror = error => {
                  console.error('WebSocket error:', error);
                  reject(error);
                };
              } catch (error) {
                reject(error);
              }
            });
          },

          disconnectWebSocket: () => {
            if (websocket) {
              websocket.close();
              websocket = null;
            }

            set(draft => {
              draft.realtimeConnection = null;
            });
          },

          handleWebSocketMessage: message => {
            const { type, payload } = message;

            switch (type) {
              case 'discourse_turn':
                set(draft => {
                  if (draft.currentSession) {
                    draft.currentSession.discourse.push(payload);
                    draft.currentSession.updatedAt = new Date();
                  }
                });
                break;

              case 'participant_joined':
                set(draft => {
                  if (draft.currentSession) {
                    draft.currentSession.participants.push(payload);
                    draft.activeParticipants =
                      draft.currentSession.participants.filter(p => p.isActive);
                    draft.currentSession.updatedAt = new Date();
                  }
                });
                break;

              case 'participant_left':
                set(draft => {
                  if (draft.currentSession) {
                    draft.currentSession.participants =
                      draft.currentSession.participants.filter(
                        p => p.id !== payload.participantId
                      );
                    draft.activeParticipants =
                      draft.currentSession.participants.filter(p => p.isActive);
                    draft.currentSession.updatedAt = new Date();
                  }
                });
                break;

              case 'knowledge_item_added':
                set(draft => {
                  if (draft.currentSession) {
                    draft.currentSession.knowledgeBase.push(payload);
                    draft.currentSession.updatedAt = new Date();
                  }
                });
                break;

              case 'session_ended':
                set(draft => {
                  if (draft.currentSession) {
                    draft.currentSession.status = 'completed';
                    draft.currentSession.updatedAt = new Date();
                  }
                });
                break;

              default:
                console.log('Unhandled WebSocket message:', type, payload);
            }
          },

          sendWebSocketMessage: (type, payload) => {
            if (websocket && websocket.readyState === WebSocket.OPEN) {
              websocket.send(JSON.stringify({ type, payload }));
            }
          },

          // Analytics and insights
          getSessionAnalytics: sessionId => {
            const sessions = sessionId
              ? get().sessions.filter(s => s.id === sessionId)
              : get().sessions;

            const totalSessions = sessions.length;
            const averageSessionDuration =
              sessions.length > 0
                ? sessions.reduce((sum, s) => {
                    const duration =
                      s.status === 'completed'
                        ? s.updatedAt.getTime() - s.createdAt.getTime()
                        : 0;
                    return sum + duration;
                  }, 0) / sessions.length
                : 0;

            const averageParticipants =
              sessions.length > 0
                ? sessions.reduce((sum, s) => sum + s.participants.length, 0) /
                  sessions.length
                : 0;

            const totalDiscourseTurns = sessions.reduce(
              (sum, s) => sum + s.discourse.length,
              0
            );
            const activeSessionsCount = sessions.filter(
              s => s.status === 'active'
            ).length;
            const completedSessionsCount = sessions.filter(
              s => s.status === 'completed'
            ).length;

            // Extract topics from session titles and discourse
            const topicCounts = new Map<string, number>();
            sessions.forEach(session => {
              // This is a simplified topic extraction
              const topics = session.topic.toLowerCase().split(/\s+/);
              topics.forEach(topic => {
                if (topic.length > 2) {
                  const count = topicCounts.get(topic) || 0;
                  topicCounts.set(topic, count + 1);
                }
              });
            });

            const topTopics = Array.from(topicCounts.entries())
              .map(([topic, frequency]) => ({ topic, frequency }))
              .sort((a, b) => b.frequency - a.frequency)
              .slice(0, 10);

            const participationRate =
              totalSessions > 0
                ? (totalDiscourseTurns /
                    totalSessions /
                    (averageParticipants || 1)) *
                  100
                : 0;

            return {
              totalSessions,
              averageSessionDuration,
              averageParticipants,
              totalDiscourseTurns,
              activeSessionsCount,
              completedSessionsCount,
              topTopics,
              participationRate,
            };
          },

          getParticipantAnalytics: participantId => {
            const sessions = get().sessions.filter(s =>
              s.participants.some(p => p.id === participantId)
            );

            const participantTurns = sessions.flatMap(s =>
              s.discourse.filter(turn => turn.participantId === participantId)
            );

            const totalTurns = participantTurns.length;
            const averageTurnLength =
              totalTurns > 0
                ? participantTurns.reduce(
                    (sum, turn) => sum + turn.content.length,
                    0
                  ) / totalTurns
                : 0;

            const topicsContributed = Array.from(
              new Set(sessions.map(s => s.topic))
            );

            const reactionsReceived = sessions.reduce((sum, s) => {
              return (
                sum +
                s.discourse.reduce((turnSum, turn) => {
                  if (turn.participantId === participantId) {
                    return turnSum + (turn.reactions?.length || 0);
                  }
                  return turnSum;
                }, 0)
              );
            }, 0);

            const reactionsGiven = sessions.reduce((sum, s) => {
              return (
                sum +
                s.discourse.reduce((turnSum, turn) => {
                  return (
                    turnSum +
                    (turn.reactions?.filter(
                      r => r.participantId === participantId
                    ).length || 0)
                  );
                }, 0)
              );
            }, 0);

            return {
              totalTurns,
              averageTurnLength,
              topicsContributed,
              collaborationScore:
                (reactionsReceived + reactionsGiven) / Math.max(totalTurns, 1),
              reactionsReceived,
              reactionsGiven,
              expertiseUtilization: 0.75, // This would be calculated based on expertise usage
            };
          },

          getDiscourseAnalytics: sessionId => {
            const session = sessionId
              ? get().sessions.find(s => s.id === sessionId)
              : get().currentSession;

            if (!session) {
              return {
                totalTurns: 0,
                turnsByType: {} as Record<DiscourseTurn['type'], number>,
                averageTurnLength: 0,
                mostActiveParticipants: [],
                topicEvolution: [],
                consensusLevel: 0,
              };
            }

            const discourse = session.discourse;
            const totalTurns = discourse.length;

            const turnsByType = discourse.reduce(
              (acc, turn) => {
                acc[turn.type] = (acc[turn.type] || 0) + 1;
                return acc;
              },
              {} as Record<DiscourseTurn['type'], number>
            );

            const averageTurnLength =
              totalTurns > 0
                ? discourse.reduce(
                    (sum, turn) => sum + turn.content.length,
                    0
                  ) / totalTurns
                : 0;

            const participantTurnCounts = new Map<string, number>();
            discourse.forEach(turn => {
              const count = participantTurnCounts.get(turn.participantId) || 0;
              participantTurnCounts.set(turn.participantId, count + 1);
            });

            const mostActiveParticipants = Array.from(
              participantTurnCounts.entries()
            )
              .map(([participantId, turnCount]) => {
                const participant = session.participants.find(
                  p => p.id === participantId
                );
                return { participant: participant!, turnCount };
              })
              .filter(item => item.participant)
              .sort((a, b) => b.turnCount - a.turnCount)
              .slice(0, 5);

            // Simple topic evolution tracking
            const topicEvolution = discourse.map(turn => ({
              topic: turn.content.split(' ').slice(0, 3).join(' '), // First 3 words as topic
              timestamp: turn.timestamp,
            }));

            // Simple consensus level calculation based on agreement reactions
            const totalReactions = discourse.reduce(
              (sum, turn) => sum + (turn.reactions?.length || 0),
              0
            );
            const agreementReactions = discourse.reduce((sum, turn) => {
              return (
                sum +
                (turn.reactions?.filter(r => r.type === 'agree').length || 0)
              );
            }, 0);
            const consensusLevel =
              totalReactions > 0
                ? (agreementReactions / totalReactions) * 100
                : 0;

            return {
              totalTurns,
              turnsByType,
              averageTurnLength,
              mostActiveParticipants,
              topicEvolution,
              consensusLevel,
            };
          },

          // Export functionality
          exportSession: async (sessionId, format) => {
            const session = get().sessions.find(s => s.id === sessionId);
            if (!session) {
              throw new Error('Session not found');
            }

            switch (format) {
              case 'json':
                return JSON.stringify(session, null, 2);

              case 'txt':
                let txtOutput = `Co-STORM Session: ${session.title}\n${'='.repeat(50)}\n\n`;
                txtOutput += `Topic: ${session.topic}\n`;
                txtOutput += `Status: ${session.status}\n`;
                txtOutput += `Created: ${session.createdAt.toISOString()}\n`;
                txtOutput += `Updated: ${session.updatedAt.toISOString()}\n\n`;

                txtOutput += `Participants (${session.participants.length}):\n`;
                session.participants.forEach((p, i) => {
                  txtOutput += `${i + 1}. ${p.name} (${p.role}) - ${p.expertise.join(', ')}\n`;
                });

                txtOutput += `\nDiscourse (${session.discourse.length} turns):\n${'='.repeat(30)}\n`;
                session.discourse.forEach((turn, i) => {
                  const participant = session.participants.find(
                    p => p.id === turn.participantId
                  );
                  txtOutput += `\n${i + 1}. ${participant?.name || 'Unknown'} (${turn.type}):\n`;
                  txtOutput += `${turn.content}\n`;
                  if (turn.reactions && turn.reactions.length > 0) {
                    txtOutput += `   Reactions: ${turn.reactions.map(r => r.type).join(', ')}\n`;
                  }
                });

                txtOutput += `\nKnowledge Base (${session.knowledgeBase.length} items):\n${'='.repeat(30)}\n`;
                session.knowledgeBase.forEach((item, i) => {
                  txtOutput += `\n${i + 1}. ${item.content}\n`;
                  txtOutput += `   Source: ${item.source}\n`;
                  txtOutput += `   Confidence: ${item.confidence}\n`;
                  txtOutput += `   Tags: ${item.tags.join(', ')}\n`;
                });

                return txtOutput;

              case 'pdf':
                // This would require a PDF generation library
                throw new Error('PDF export not implemented');

              default:
                throw new Error('Unsupported format');
            }
          },

          exportMindMap: format => {
            const { mindMap } = get();

            switch (format) {
              case 'json':
                return JSON.stringify(mindMap, null, 2);

              case 'svg':
              case 'png':
                // This would require a graph visualization library
                throw new Error(
                  `${format.toUpperCase()} export not implemented`
                );

              default:
                throw new Error('Unsupported format');
            }
          },

          exportKnowledgeBase: format => {
            const { currentSession } = get();
            if (!currentSession) return '';

            const knowledgeBase = currentSession.knowledgeBase;

            switch (format) {
              case 'json':
                return JSON.stringify(knowledgeBase, null, 2);

              case 'csv':
                const csvHeaders =
                  'Content,Source,Confidence,Tags,Created At,Validated By\n';
                const csvRows = knowledgeBase
                  .map(
                    item =>
                      `"${item.content}","${item.source}","${item.confidence}","${item.tags.join(';')}","${item.createdAt}","${item.validatedBy.join(';')}"`
                  )
                  .join('\n');
                return csvHeaders + csvRows;

              default:
                throw new Error('Unsupported format');
            }
          },

          // State management
          setLoading: loading => {
            set(draft => {
              draft.loading = loading;
            });
          },

          setError: error => {
            set(draft => {
              draft.error = error;
            });
          },

          clearError: () => {
            set(draft => {
              draft.error = null;
            });
          },

          reset: () => {
            get().disconnectWebSocket();
            get().disableAutoSave();

            set(draft => {
              Object.assign(draft, initialState);
            });
          },
        }))
      ),
      {
        name: 'storm-session-store',
        version: 1,
        partialize: createPartialize<SessionStore>([
          'sessions',
          'turnPolicy',
          'sessionSettings',
        ]),
      }
    ),
    { name: 'SessionStore' }
  )
);

// Selectors
export const sessionSelectors = {
  currentSession: (state: SessionStore) => state.currentSession,
  sessions: (state: SessionStore) => state.sessions,
  activeParticipants: (state: SessionStore) => state.activeParticipants,
  mindMap: (state: SessionStore) => state.mindMap,
  turnPolicy: (state: SessionStore) => state.turnPolicy,
  sessionSettings: (state: SessionStore) => state.sessionSettings,
  realtimeConnection: (state: SessionStore) => state.realtimeConnection,
  isLoading: (state: SessionStore) => state.loading,
  error: (state: SessionStore) => state.error,
  isConnected: (state: SessionStore) =>
    state.realtimeConnection?.status === 'connected',
  activeSessions: (state: SessionStore) =>
    state.sessions.filter(s => s.status === 'active'),
  completedSessions: (state: SessionStore) =>
    state.sessions.filter(s => s.status === 'completed'),
  currentDiscourse: (state: SessionStore) =>
    state.currentSession?.discourse || [],
  currentKnowledgeBase: (state: SessionStore) =>
    state.currentSession?.knowledgeBase || [],
};

// Session hooks
export const useSession = () => {
  const store = useSessionStore();
  return {
    ...store,
    selectors: sessionSelectors,
  };
};

export const useCurrentSession = () =>
  useSessionStore(sessionSelectors.currentSession);
export const useSessionsList = () => useSessionStore(sessionSelectors.sessions);
export const useActiveParticipants = () =>
  useSessionStore(sessionSelectors.activeParticipants);
export const useMindMap = () => useSessionStore(sessionSelectors.mindMap);
export const useRealtimeConnection = () =>
  useSessionStore(sessionSelectors.realtimeConnection);
export const useSessionLoading = () =>
  useSessionStore(sessionSelectors.isLoading);
export const useSessionError = () => useSessionStore(sessionSelectors.error);
export const useIsConnected = () =>
  useSessionStore(sessionSelectors.isConnected);
export const useCurrentDiscourse = () =>
  useSessionStore(sessionSelectors.currentDiscourse);
export const useCurrentKnowledgeBase = () =>
  useSessionStore(sessionSelectors.currentKnowledgeBase);
