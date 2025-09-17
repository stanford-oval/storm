export interface AnalyticsData {
  timestamp: string;
  value: number;
  category?: string;
  metadata?: Record<string, unknown>;
}

export interface PipelineMetrics {
  stage: 'research' | 'outline' | 'generation' | 'polish';
  duration: number;
  tokensUsed: number;
  success: boolean;
  timestamp: string;
  errors?: string[];
}

export interface TokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: string;
  operation: string;
}

export interface ResearchStats {
  queriesExecuted: number;
  sourcesFound: number;
  sourcesUsed: number;
  averageConfidence: number;
  topicsCovered: number;
  timestamp: string;
}

export interface PerformanceMetrics {
  responseTime: number;
  throughput: number;
  errorRate: number;
  availability: number;
  timestamp: string;
  endpoint?: string;
}

export interface UserActivity {
  action: 'view' | 'edit' | 'create' | 'delete' | 'export';
  resource: string;
  duration?: number;
  timestamp: string;
  userId?: string;
}

export interface DashboardConfig {
  timeRange: '1h' | '24h' | '7d' | '30d' | 'custom';
  refreshInterval: number;
  autoRefresh: boolean;
  widgets: {
    pipelineProgress: boolean;
    tokenUsage: boolean;
    researchStats: boolean;
    performance: boolean;
    userActivity: boolean;
    costAnalysis: boolean;
  };
  customDateRange?: {
    start: string;
    end: string;
  };
}

export interface ChartTheme {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  text: string;
  grid: string;
}

export interface WidgetProps {
  title: string;
  data: unknown[];
  loading?: boolean;
  error?: string;
  config?: Record<string, unknown>;
  theme?: ChartTheme;
  onRefresh?: () => void;
  className?: string;
}
