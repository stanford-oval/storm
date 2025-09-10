// Core store types and interfaces
import {
  StormProject,
  StormConfig,
  PipelineProgress,
  ResearchData,
  GeneratedArticle,
  ArticleOutline,
  ConversationData,
  ProjectStatus,
  PipelineStage,
} from '@/types/storm';

// Base store slice interface
export interface BaseSlice {
  loading: boolean;
  error: string | null;
  lastUpdated: Date | null;
}

// Authentication state
export interface User {
  id: string;
  email: string;
  name: string;
  avatar?: string;
  preferences: UserPreferences;
}

export interface UserPreferences {
  theme: 'light' | 'dark' | 'system';
  language: string;
  timezone: string;
  notifications: NotificationPreferences;
}

export interface NotificationPreferences {
  email: boolean;
  browser: boolean;
  pipeline: boolean;
  errors: boolean;
}

export interface AuthState extends BaseSlice {
  user: User | null;
  isAuthenticated: boolean;
  token: string | null;
  refreshToken: string | null;
  sessionExpiry: Date | null;
}

// Project management state
export interface ProjectState extends BaseSlice {
  projects: StormProject[];
  currentProject: StormProject | null;
  selectedProjects: string[];
  filters: ProjectFilters;
  sortBy: ProjectSortField;
  sortOrder: 'asc' | 'desc';
  pagination: {
    page: number;
    limit: number;
    total: number;
  };
  recentProjects: string[];
}

export interface ProjectFilters {
  status?: ProjectStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
  tags?: string[];
}

export type ProjectSortField =
  | 'title'
  | 'createdAt'
  | 'updatedAt'
  | 'status'
  | 'progress';

// Pipeline execution state
export interface PipelineState extends BaseSlice {
  runningPipelines: Record<string, PipelineExecution>;
  pipelineHistory: PipelineExecution[];
  activeStage: PipelineStage | null;
  globalProgress: number;
  estimatedTimeRemaining: number | null;
  canCancel: boolean;
  autoSave: boolean;
}

export interface PipelineExecution {
  id: string;
  projectId: string;
  progress: PipelineProgress;
  logs: PipelineLog[];
  startTime: Date;
  endTime?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  config: StormConfig;
  resourceUsage: ResourceUsage;
}

export interface PipelineLog {
  id: string;
  timestamp: Date;
  level: 'info' | 'warn' | 'error' | 'debug';
  stage: PipelineStage;
  message: string;
  data?: any;
}

export interface ResourceUsage {
  tokensUsed: number;
  apiCalls: number;
  estimatedCost: number;
  duration: number;
}

// Research data state
export interface ResearchState extends BaseSlice {
  currentResearch: ResearchData | null;
  activeConversations: ConversationData[];
  searchHistory: SearchQuery[];
  sourcesCache: Map<string, any>;
  perspectiveFilters: string[];
  viewMode: 'conversations' | 'sources' | 'timeline';
  autoRefresh: boolean;
}

export interface SearchQuery {
  id: string;
  query: string;
  timestamp: Date;
  results: number;
  perspective?: string;
}

// Co-STORM session state
export interface SessionState extends BaseSlice {
  currentSession: CoStormSession | null;
  sessions: CoStormSession[];
  activeParticipants: Participant[];
  mindMap: MindMapNode[];
  turnPolicy: TurnPolicy;
  sessionSettings: SessionSettings;
  realtimeConnection: WebSocketConnection | null;
}

export interface CoStormSession {
  id: string;
  title: string;
  topic: string;
  status: 'active' | 'paused' | 'completed';
  createdAt: Date;
  updatedAt: Date;
  participants: Participant[];
  discourse: DiscourseTurn[];
  knowledgeBase: KnowledgeItem[];
  moderator: ModeratorState;
}

export interface Participant {
  id: string;
  name: string;
  role: 'expert' | 'moderator' | 'observer';
  expertise: string[];
  isActive: boolean;
  avatar?: string;
}

export interface DiscourseTurn {
  id: string;
  participantId: string;
  content: string;
  timestamp: Date;
  type: 'question' | 'response' | 'clarification' | 'summary';
  references: string[];
  reactions?: Reaction[];
}

export interface Reaction {
  type: 'agree' | 'disagree' | 'question' | 'insight';
  participantId: string;
  timestamp: Date;
}

export interface MindMapNode {
  id: string;
  title: string;
  type: 'concept' | 'question' | 'insight' | 'source';
  position: { x: number; y: number };
  connections: string[];
  metadata: any;
}

export interface TurnPolicy {
  maxTurnsPerParticipant: number;
  turnTimeLimit: number;
  moderationEnabled: boolean;
  allowInterruptions: boolean;
}

export interface ModeratorState {
  isActive: boolean;
  currentTopic: string;
  nextParticipant: string | null;
  agenda: string[];
}

export interface SessionSettings {
  maxParticipants: number;
  sessionDuration: number;
  autoSaveInterval: number;
  allowAnonymous: boolean;
}

export interface WebSocketConnection {
  status: 'connecting' | 'connected' | 'disconnected' | 'reconnecting';
  lastPing: Date | null;
  reconnectAttempts: number;
  maxReconnectAttempts: number;
}

export interface KnowledgeItem {
  id: string;
  content: string;
  source: string;
  confidence: number;
  tags: string[];
  createdAt: Date;
  validatedBy: string[];
}

// UI state
export interface UIState extends BaseSlice {
  theme: 'light' | 'dark' | 'system';
  sidebarCollapsed: boolean;
  activePanel: string | null;
  openDialogs: string[];
  notifications: StormNotification[];
  layout: LayoutConfig;
  keyboard: KeyboardShortcuts;
  accessibility: AccessibilitySettings;
}

export interface LayoutConfig {
  density: 'comfortable' | 'compact' | 'cozy';
  panelSizes: Record<string, number>;
  customPanels: CustomPanel[];
}

export interface CustomPanel {
  id: string;
  title: string;
  component: string;
  position: { x: number; y: number; width: number; height: number };
  visible: boolean;
}

export interface KeyboardShortcuts {
  enabled: boolean;
  shortcuts: Record<string, string>;
  customShortcuts: Record<string, string>;
}

export interface AccessibilitySettings {
  reducedMotion: boolean;
  highContrast: boolean;
  fontSize: 'small' | 'medium' | 'large' | 'xl';
  screenReader: boolean;
}

// Notifications state
export interface StormNotification {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error';
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  persistent: boolean;
  actions?: NotificationAction[];
  metadata?: any;
}

export interface NotificationAction {
  label: string;
  action: string;
  variant: 'primary' | 'secondary' | 'destructive';
}

export interface NotificationState extends BaseSlice {
  notifications: StormNotification[];
  unreadCount: number;
  settings: NotificationSettings;
  history: StormNotification[];
}

export interface NotificationSettings {
  enabled: boolean;
  maxVisible: number;
  autoHideTimeout: number;
  groupSimilar: boolean;
  soundEnabled: boolean;
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}

// Store actions
export interface StoreActions {
  // Common actions
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  clearError: () => void;
  reset: () => void;
}

// Persistence options
export interface PersistOptions {
  name: string;
  version: number;
  migrate?: (persistedState: any, version: number) => any;
  partialize?: (state: any) => any;
  storage?: any;
}

// Undo/Redo state
export interface HistoryState {
  past: any[];
  present: any;
  future: any[];
  canUndo: boolean;
  canRedo: boolean;
}

// WebSocket message types
export interface WebSocketMessage {
  type: string;
  payload: any;
  timestamp: Date;
  id: string;
}

// Store subscription types
export interface StoreSubscription {
  id: string;
  selector: (state: any) => any;
  callback: (state: any, prevState: any) => void;
  active: boolean;
}

// State migration types
export interface StateMigration {
  version: number;
  migrate: (state: any) => any;
}

// Store devtools options
export interface DevtoolsOptions {
  enabled: boolean;
  name: string;
  serialize?: boolean;
  actionSanitizer?: (action: any) => any;
  stateSanitizer?: (state: any) => any;
}
