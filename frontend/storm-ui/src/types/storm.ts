// Core STORM types and interfaces
export interface StormProject {
  id: string;
  title: string;
  topic: string;
  description?: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  config?: StormConfig; // Made optional since some projects may not have config
  outputDir?: string;
  progress?: PipelineProgress;
  content?: string; // The raw article content from backend
  word_count?: number; // Word count from backend
  article?: GeneratedArticle;
  outline?: ArticleOutline;
  research?: ResearchData;
  current_stage?: string;
  pipeline_status?: string;
  metadata?: {
    duration?: number;
    [key: string]: unknown;
  };
  error?: string; // Error message if pipeline failed
}

export type ProjectStatus =
  | 'draft'
  | 'researching'
  | 'generating_outline'
  | 'writing_article'
  | 'polishing'
  | 'completed'
  | 'failed';

export interface StormConfig {
  llm?: {
    model: string;
    provider: 'openai' | 'anthropic' | 'azure' | 'gemini' | 'ollama' | 'groq';
    apiKey?: string;
    baseUrl?: string;
    temperature?: number;
    maxTokens?: number;
  };
  retriever?: {
    type:
      | 'google'
      | 'bing'
      | 'you'
      | 'duckduckgo'
      | 'tavily'
      | 'serper'
      | 'brave'
      | 'vector';
    apiKey?: string;
    maxResults?: number;
    topK?: number;
  };
  pipeline?: {
    doResearch: boolean;
    doGenerateOutline: boolean;
    doGenerateArticle: boolean;
    doPolishArticle: boolean;
    maxConvTurns?: number;
    maxPerspectives?: number;
    maxSearchQueriesPerTurn?: number;
  };
  // Legacy backend properties (for backward compatibility)
  llm_provider?: string;
  llm_model?: string;
  retriever_type?: string;
  max_perspective?: number;
  max_conv_turn?: number;
  max_search_queries_per_turn?: number;
  temperature?: number;
  max_tokens?: number;
  max_search_results?: number;
  search_top_k?: number;
  [key: string]: any; // Allow other unknown properties from backend
}

export interface PipelineProgress {
  stage: PipelineStage;
  stageProgress: number; // 0-100
  overallProgress: number; // 0-100
  startTime: Date;
  estimatedEndTime?: Date;
  currentTask?: string;
  errors?: PipelineError[];
}

export type PipelineStage =
  | 'initializing'
  | 'research'
  | 'outline_generation'
  | 'article_generation'
  | 'polishing'
  | 'completed';

export interface PipelineError {
  stage: PipelineStage;
  message: string;
  timestamp: Date;
  severity: 'warning' | 'error' | 'critical';
}

export interface GeneratedArticle {
  title: string;
  content: string;
  summary?: string;
  sections: ArticleSection[];
  citations: Citation[];
  wordCount: number;
  lastModified: Date;
}

export interface ArticleSection {
  id: string;
  title: string;
  content: string;
  level: number; // 1-6 for heading levels
  order: number;
  citations: string[]; // citation IDs
}

export interface ArticleOutline {
  id: string;
  sections: OutlineSection[];
  lastModified: Date;
}

export interface OutlineSection {
  id: string;
  title: string;
  description?: string;
  level: number;
  order: number;
  parentId?: string;
  children?: OutlineSection[];
  isExpanded?: boolean;
}

export interface ResearchData {
  conversations: ConversationData[];
  sources: SourceData[];
  perspectives: string[];
  totalQueries: number;
  lastUpdated: Date;
}

export interface ConversationData {
  id: string;
  perspective: string;
  turns: ConversationTurn[];
  startTime: Date;
  endTime?: Date;
  status: 'active' | 'completed' | 'failed';
}

export interface ConversationTurn {
  id: string;
  speaker: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  sources?: string[]; // source IDs
  queries?: string[];
}

export interface SourceData {
  id: string;
  title: string;
  url: string;
  snippet: string;
  retrievedAt: Date;
  relevanceScore?: number;
  usedInSections?: string[]; // section IDs
}

export interface Citation {
  id: string;
  sourceId: string;
  text: string;
  page?: number;
  url: string;
}

// Component prop types
export interface ProjectCardProps {
  project: StormProject;
  onSelect: (project: StormProject) => void;
  onDelete: (projectId: string) => void;
  onDuplicate: (project: StormProject) => void;
  className?: string;
}

export interface PipelineProgressProps {
  progress: PipelineProgress;
  showDetails?: boolean;
  onCancel?: () => void;
  className?: string;
}

export interface ConfigurationPanelProps {
  config: StormConfig;
  onChange: (config: StormConfig) => void;
  onSave: (config: StormConfig) => void;
  onCancel: () => void;
  isLoading?: boolean;
  className?: string;
  allowSaveWithoutChanges?: boolean;
}

export interface ArticleEditorProps {
  article: GeneratedArticle;
  onChange: (article: GeneratedArticle) => void;
  onSave: () => void;
  readOnly?: boolean;
  showOutline?: boolean;
  className?: string;
}

export interface OutlineEditorProps {
  outline: ArticleOutline;
  onChange: (outline: ArticleOutline) => void;
  onSave: () => void;
  readOnly?: boolean;
  className?: string;
}

export interface ResearchViewProps {
  research: ResearchData;
  onSourceSelect?: (source: SourceData) => void;
  onConversationSelect?: (conversation: ConversationData) => void;
  showFilters?: boolean;
  className?: string;
}

// Form validation schemas
export interface CreateProjectFormData {
  title: string;
  topic: string;
  description?: string;
  config: StormConfig;
}

export interface ProjectFilters {
  status?: ProjectStatus[];
  dateRange?: {
    start: Date;
    end: Date;
  };
  searchQuery?: string;
}

// API response types
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  timestamp: Date;
}

export interface ProjectListResponse {
  projects: StormProject[];
  total: number;
  page: number;
  limit: number;
}
