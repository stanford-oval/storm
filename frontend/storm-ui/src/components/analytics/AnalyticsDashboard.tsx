'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadialBarChart,
  RadialBar,
  ComposedChart,
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  Clock,
  Zap,
  Users,
  DollarSign,
  RefreshCw,
  Calendar,
  Download,
  Settings,
  Filter,
  Eye,
  EyeOff,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../ui/card';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { Switch } from '../ui/switch';
import { Select } from '../ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../ui/tabs';
import {
  DashboardConfig,
  ChartTheme,
  PipelineMetrics,
  TokenUsage,
  ResearchStats,
  PerformanceMetrics,
  UserActivity,
} from '../../types/analytics';

interface AnalyticsDashboardProps {
  className?: string;
  config?: Partial<DashboardConfig>;
  theme?: ChartTheme;
  data?: {
    pipelineMetrics?: PipelineMetrics[];
    tokenUsage?: TokenUsage[];
    researchStats?: ResearchStats[];
    performanceMetrics?: PerformanceMetrics[];
    userActivity?: UserActivity[];
  };
}

const defaultTheme: ChartTheme = {
  primary: '#3b82f6',
  secondary: '#06b6d4',
  success: '#10b981',
  warning: '#f59e0b',
  error: '#ef4444',
  background: '#ffffff',
  text: '#1f2937',
  grid: '#e5e7eb',
};

const defaultConfig: DashboardConfig = {
  timeRange: '24h',
  refreshInterval: 30000,
  autoRefresh: true,
  widgets: {
    pipelineProgress: true,
    tokenUsage: true,
    researchStats: true,
    performance: true,
    userActivity: true,
    costAnalysis: true,
  },
};

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  className = '',
  config: configOverride,
  theme = defaultTheme,
  data = {},
}) => {
  const [config, setConfig] = useState<DashboardConfig>({
    ...defaultConfig,
    ...configOverride,
  });
  const [isLoading, setIsLoading] = useState(false);
  const [lastRefresh, setLastRefresh] = useState(new Date());
  const [activeTab, setActiveTab] = useState('overview');

  // Mock data generation for demo purposes
  const mockPipelineData = useMemo(
    () => [
      {
        stage: 'research',
        duration: 120,
        tokensUsed: 15000,
        success: true,
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        stage: 'outline',
        duration: 45,
        tokensUsed: 8000,
        success: true,
        timestamp: '2024-01-01T10:02:00Z',
      },
      {
        stage: 'generation',
        duration: 180,
        tokensUsed: 25000,
        success: true,
        timestamp: '2024-01-01T10:05:00Z',
      },
      {
        stage: 'polish',
        duration: 60,
        tokensUsed: 5000,
        success: true,
        timestamp: '2024-01-01T10:08:00Z',
      },
    ],
    []
  );

  const mockTokenUsage = useMemo(
    () => [
      {
        model: 'GPT-4',
        inputTokens: 12000,
        outputTokens: 8000,
        totalTokens: 20000,
        cost: 0.6,
        timestamp: '2024-01-01T10:00:00Z',
        operation: 'research',
      },
      {
        model: 'GPT-3.5',
        inputTokens: 8000,
        outputTokens: 5000,
        totalTokens: 13000,
        cost: 0.026,
        timestamp: '2024-01-01T10:02:00Z',
        operation: 'outline',
      },
      {
        model: 'GPT-4',
        inputTokens: 18000,
        outputTokens: 12000,
        totalTokens: 30000,
        cost: 0.9,
        timestamp: '2024-01-01T10:05:00Z',
        operation: 'generation',
      },
    ],
    []
  );

  const mockResearchStats = useMemo(
    () => [
      {
        queriesExecuted: 25,
        sourcesFound: 120,
        sourcesUsed: 45,
        averageConfidence: 0.87,
        topicsCovered: 8,
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        queriesExecuted: 30,
        sourcesFound: 150,
        sourcesUsed: 52,
        averageConfidence: 0.91,
        topicsCovered: 10,
        timestamp: '2024-01-01T11:00:00Z',
      },
      {
        queriesExecuted: 22,
        sourcesFound: 98,
        sourcesUsed: 38,
        averageConfidence: 0.83,
        topicsCovered: 7,
        timestamp: '2024-01-01T12:00:00Z',
      },
    ],
    []
  );

  const mockPerformanceData = useMemo(
    () => [
      {
        responseTime: 1200,
        throughput: 45,
        errorRate: 0.02,
        availability: 0.999,
        timestamp: '2024-01-01T10:00:00Z',
      },
      {
        responseTime: 980,
        throughput: 52,
        errorRate: 0.01,
        availability: 1.0,
        timestamp: '2024-01-01T11:00:00Z',
      },
      {
        responseTime: 1450,
        throughput: 38,
        errorRate: 0.03,
        availability: 0.997,
        timestamp: '2024-01-01T12:00:00Z',
      },
    ],
    []
  );

  // Auto-refresh functionality
  useEffect(() => {
    if (!config.autoRefresh) return;

    const interval = setInterval(() => {
      setLastRefresh(new Date());
      // In a real implementation, this would trigger data refetch
    }, config.refreshInterval);

    return () => clearInterval(interval);
  }, [config.autoRefresh, config.refreshInterval]);

  // Manual refresh
  const handleRefresh = async () => {
    setIsLoading(true);
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));
    setLastRefresh(new Date());
    setIsLoading(false);
  };

  // Export data
  const handleExport = () => {
    const exportData = {
      pipelineMetrics: data.pipelineMetrics || mockPipelineData,
      tokenUsage: data.tokenUsage || mockTokenUsage,
      researchStats: data.researchStats || mockResearchStats,
      performanceMetrics: data.performanceMetrics || mockPerformanceData,
      timestamp: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${new Date().toISOString().split('T')[0]}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Summary metrics
  const summaryMetrics = useMemo(() => {
    const totalTokens = (data.tokenUsage || mockTokenUsage).reduce(
      (sum, item) => sum + item.totalTokens,
      0
    );
    const totalCost = (data.tokenUsage || mockTokenUsage).reduce(
      (sum, item) => sum + item.cost,
      0
    );
    const avgResponseTime =
      (data.performanceMetrics || mockPerformanceData).reduce(
        (sum, item) => sum + item.responseTime,
        0
      ) / (data.performanceMetrics || mockPerformanceData).length;
    const successRate =
      (data.pipelineMetrics || mockPipelineData).filter(item => item.success)
        .length / (data.pipelineMetrics || mockPipelineData).length;

    return [
      {
        title: 'Total Tokens',
        value: totalTokens.toLocaleString(),
        icon: Zap,
        color: theme.primary,
        trend: '+12%',
      },
      {
        title: 'Total Cost',
        value: `$${totalCost.toFixed(2)}`,
        icon: DollarSign,
        color: theme.warning,
        trend: '+5%',
      },
      {
        title: 'Avg Response Time',
        value: `${avgResponseTime.toFixed(0)}ms`,
        icon: Clock,
        color: theme.secondary,
        trend: '-8%',
      },
      {
        title: 'Success Rate',
        value: `${(successRate * 100).toFixed(1)}%`,
        icon: TrendingUp,
        color: theme.success,
        trend: '+2%',
      },
    ];
  }, [data, mockPipelineData, mockTokenUsage, mockPerformanceData, theme]);

  return (
    <div className={`analytics-dashboard space-y-6 p-6 ${className}`}>
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            Analytics Dashboard
          </h1>
          <p className="mt-1 text-gray-600">
            Last updated: {lastRefresh.toLocaleTimeString()}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleExport}>
            <Download className="mr-2 h-4 w-4" />
            Export
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isLoading}
          >
            <RefreshCw
              className={`mr-2 h-4 w-4 ${isLoading ? 'animate-spin' : ''}`}
            />
            Refresh
          </Button>

          <div className="flex items-center gap-2">
            <Switch
              checked={config.autoRefresh}
              onCheckedChange={checked =>
                setConfig(prev => ({ ...prev, autoRefresh: checked }))
              }
            />
            <span className="text-sm text-gray-600">Auto-refresh</span>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {summaryMetrics.map((metric, index) => (
          <motion.div
            key={metric.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
          >
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-600">
                      {metric.title}
                    </p>
                    <p className="mt-1 text-2xl font-bold text-gray-900">
                      {metric.value}
                    </p>
                    <div className="mt-1 flex items-center">
                      <span className="text-sm text-green-600">
                        {metric.trend}
                      </span>
                    </div>
                  </div>
                  <div
                    className="rounded-lg p-2"
                    style={{ backgroundColor: `${metric.color}20` }}
                  >
                    <metric.icon
                      className="h-6 w-6"
                      style={{ color: metric.color }}
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Main Dashboard */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="pipeline">Pipeline</TabsTrigger>
          <TabsTrigger value="tokens">Tokens & Cost</TabsTrigger>
          <TabsTrigger value="performance">Performance</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Pipeline Progress */}
            <Card>
              <CardHeader>
                <CardTitle>Pipeline Stage Duration</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.pipelineMetrics || mockPipelineData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                    <XAxis dataKey="stage" />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="duration" fill={theme.primary} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Token Usage Pie Chart */}
            <Card>
              <CardHeader>
                <CardTitle>Token Usage by Model</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={data.tokenUsage || mockTokenUsage}
                      dataKey="totalTokens"
                      nameKey="model"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, value }: any) => `${name} ${value}%`}
                    >
                      {(data.tokenUsage || mockTokenUsage).map(
                        (entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={index === 0 ? theme.primary : theme.secondary}
                          />
                        )
                      )}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Research Statistics */}
            <Card>
              <CardHeader>
                <CardTitle>Research Statistics</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <ComposedChart data={data.researchStats || mockResearchStats}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={value =>
                        new Date(value).toLocaleTimeString()
                      }
                    />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="sourcesUsed" fill={theme.success} />
                    <Line
                      type="monotone"
                      dataKey="averageConfidence"
                      stroke={theme.warning}
                    />
                  </ComposedChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            {/* Performance Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>System Performance</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <AreaChart
                    data={data.performanceMetrics || mockPerformanceData}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={value =>
                        new Date(value).toLocaleTimeString()
                      }
                    />
                    <YAxis />
                    <Tooltip />
                    <Area
                      type="monotone"
                      dataKey="responseTime"
                      stackId="1"
                      stroke={theme.primary}
                      fill={theme.primary}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-6">
          {/* Detailed Pipeline Analytics */}
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Stage Analysis</CardTitle>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={400}>
                <ComposedChart data={data.pipelineMetrics || mockPipelineData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                  <XAxis dataKey="stage" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Legend />
                  <Bar
                    yAxisId="left"
                    dataKey="duration"
                    fill={theme.primary}
                    name="Duration (s)"
                  />
                  <Bar
                    yAxisId="right"
                    dataKey="tokensUsed"
                    fill={theme.secondary}
                    name="Tokens Used"
                  />
                </ComposedChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tokens" className="space-y-6">
          {/* Token Usage and Cost Analysis */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Token Usage Over Time</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={data.tokenUsage || mockTokenUsage}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={value =>
                        new Date(value).toLocaleTimeString()
                      }
                    />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="inputTokens"
                      stroke={theme.primary}
                      name="Input Tokens"
                    />
                    <Line
                      type="monotone"
                      dataKey="outputTokens"
                      stroke={theme.secondary}
                      name="Output Tokens"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Cost Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={data.tokenUsage || mockTokenUsage}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                    <XAxis dataKey="operation" />
                    <YAxis />
                    <Tooltip formatter={value => `$${value}`} />
                    <Bar dataKey="cost" fill={theme.warning} />
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="performance" className="space-y-6">
          {/* Performance Monitoring */}
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Response Time Trends</CardTitle>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart
                    data={data.performanceMetrics || mockPerformanceData}
                  >
                    <CartesianGrid strokeDasharray="3 3" stroke={theme.grid} />
                    <XAxis
                      dataKey="timestamp"
                      tickFormatter={value =>
                        new Date(value).toLocaleTimeString()
                      }
                    />
                    <YAxis />
                    <Tooltip />
                    <Line
                      type="monotone"
                      dataKey="responseTime"
                      stroke={theme.error}
                      strokeWidth={2}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>System Health</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {(data.performanceMetrics || mockPerformanceData).map(
                    (metric, index) => (
                      <div
                        key={index}
                        className="flex items-center justify-between rounded-lg bg-gray-50 p-3"
                      >
                        <span className="font-medium">Availability</span>
                        <div className="flex items-center gap-2">
                          <div className="h-2 w-24 rounded-full bg-gray-200">
                            <div
                              className="h-2 rounded-full bg-green-500 transition-all duration-300"
                              style={{ width: `${metric.availability * 100}%` }}
                            />
                          </div>
                          <span className="text-sm font-medium">
                            {(metric.availability * 100).toFixed(1)}%
                          </span>
                        </div>
                      </div>
                    )
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Loading overlay */}
      <AnimatePresence>
        {isLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
          >
            <div className="flex items-center gap-4 rounded-lg bg-white p-6 shadow-lg">
              <div className="h-6 w-6 animate-spin rounded-full border-b-2 border-blue-500" />
              <span>Refreshing dashboard data...</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};
