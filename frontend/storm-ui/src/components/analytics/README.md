# Analytics Components

Data visualization and analytics dashboard components built with Recharts.

## Components

### AnalyticsDashboard

A comprehensive analytics dashboard for monitoring STORM pipeline performance, token usage, and system metrics.

**Features:**

- Real-time pipeline metrics visualization
- Token usage and cost analysis
- Research statistics tracking
- Performance monitoring
- Interactive charts with Recharts
- Responsive design
- Export functionality
- Customizable time ranges

**Usage:**

```tsx
import { AnalyticsDashboard } from '@/components/analytics/AnalyticsDashboard';
import { PipelineMetrics, TokenUsage } from '@/types/analytics';

const analyticsData = {
  pipelineMetrics: [
    {
      stage: 'research',
      duration: 120,
      tokensUsed: 15000,
      success: true,
      timestamp: '2024-01-01T10:00:00Z',
    },
  ],
  tokenUsage: [
    {
      model: 'GPT-4',
      inputTokens: 12000,
      outputTokens: 8000,
      totalTokens: 20000,
      cost: 0.6,
      timestamp: '2024-01-01T10:00:00Z',
      operation: 'research',
    },
  ],
};

function MyAnalytics() {
  return (
    <AnalyticsDashboard
      data={analyticsData}
      config={{
        timeRange: '24h',
        autoRefresh: true,
        refreshInterval: 30000,
        widgets: {
          pipelineProgress: true,
          tokenUsage: true,
          researchStats: true,
          performance: true,
          userActivity: true,
          costAnalysis: true,
        },
      }}
      theme={{
        primary: '#3b82f6',
        secondary: '#06b6d4',
        success: '#10b981',
        warning: '#f59e0b',
        error: '#ef4444',
      }}
    />
  );
}
```

## Chart Types

### Pipeline Metrics

- **Bar Charts**: Stage duration comparison
- **Composed Charts**: Duration vs token usage correlation
- **Success Rate**: Pipeline success/failure tracking

### Token Usage

- **Line Charts**: Token consumption over time
- **Pie Charts**: Model usage distribution
- **Cost Analysis**: Financial impact tracking

### Research Statistics

- **Area Charts**: Source utilization trends
- **Scatter Plots**: Confidence vs coverage analysis
- **Heat Maps**: Topic coverage visualization

### Performance Monitoring

- **Time Series**: Response time trends
- **Gauge Charts**: System health indicators
- **Progress Bars**: Availability metrics

## Data Types

### PipelineMetrics

```typescript
interface PipelineMetrics {
  stage: 'research' | 'outline' | 'generation' | 'polish';
  duration: number;
  tokensUsed: number;
  success: boolean;
  timestamp: string;
  errors?: string[];
}
```

### TokenUsage

```typescript
interface TokenUsage {
  model: string;
  inputTokens: number;
  outputTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: string;
  operation: string;
}
```

### ResearchStats

```typescript
interface ResearchStats {
  queriesExecuted: number;
  sourcesFound: number;
  sourcesUsed: number;
  averageConfidence: number;
  topicsCovered: number;
  timestamp: string;
}
```

## Configuration

### Dashboard Config

```typescript
interface DashboardConfig {
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
```

### Chart Themes

```typescript
interface ChartTheme {
  primary: string;
  secondary: string;
  success: string;
  warning: string;
  error: string;
  background: string;
  text: string;
  grid: string;
}
```

## Features

### Interactive Elements

- **Drill-down**: Click charts to view detailed data
- **Filtering**: Filter by time range, model, or stage
- **Zooming**: Zoom into specific time periods
- **Tooltips**: Rich hover information

### Export Options

- **JSON**: Raw data export
- **CSV**: Spreadsheet-compatible format
- **PNG/SVG**: Chart image export
- **PDF**: Report generation

### Real-time Updates

- **WebSocket**: Live data streaming
- **Auto-refresh**: Configurable refresh intervals
- **Push Notifications**: Alert on anomalies

## Best Practices

1. **Data Aggregation**: Pre-aggregate data for better performance
2. **Lazy Loading**: Load charts on demand
3. **Responsive Design**: Optimize for different screen sizes
4. **Accessibility**: Provide alternative data views
5. **Error Handling**: Graceful degradation on data issues

## Performance Considerations

- Use React.memo for expensive chart components
- Implement virtual scrolling for large datasets
- Debounce real-time updates
- Cache computed chart data
- Optimize Recharts props to prevent unnecessary re-renders

## Custom Widgets

Create custom analytics widgets:

```tsx
import { WidgetProps } from '@/types/analytics';

interface CustomWidgetProps extends WidgetProps {
  customData: any[];
}

function CustomWidget({ title, data, loading, error }: CustomWidgetProps) {
  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorMessage error={error} />;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {/* Your custom visualization */}
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data}>{/* Chart configuration */}</BarChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
```
