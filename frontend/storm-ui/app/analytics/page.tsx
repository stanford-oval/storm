'use client';

import React, { useEffect, useState } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, DollarSign, FileText, Cpu, Activity } from 'lucide-react';
import { useProjectStore, usePipelineStore } from '@/store';
import { Skeleton } from '@/components/ui/skeleton';

export default function AnalyticsPage() {
  const { projects, loadProjects, loading: _loading } = useProjectStore();
  const { pipelineHistory: _pipelineHistory } = usePipelineStore();
  const [dataLoading, setDataLoading] = useState(true);

  // State for time range selection
  const [timeRange, setTimeRange] = useState<'day' | 'week' | 'month' | 'year'>(
    'month'
  );
  const [dateRange, setDateRange] = useState<number>(6); // Number of periods to show

  useEffect(() => {
    const loadData = async () => {
      setDataLoading(true);
      await loadProjects();
      setDataLoading(false);
    };
    loadData();
  }, [loadProjects]);

  // Calculate real data from projects with time range support
  const calculateUsageData = () => {
    if (!projects || projects.length === 0) {
      return [];
    }

    // Group projects by time period
    const periodData: Record<
      string,
      { tokens: number; cost: number; projects: number }
    > = {};

    projects.forEach(project => {
      const date = new Date(project.createdAt);
      let periodKey = '';

      // Format the key based on selected time range
      switch (timeRange) {
        case 'day':
          periodKey = date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
          });
          break;
        case 'week':
          // Get week number and year
          const weekStart = new Date(date);
          weekStart.setDate(date.getDate() - date.getDay());
          periodKey = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          break;
        case 'month':
          periodKey = date.toLocaleDateString('en-US', {
            month: 'short',
            year: 'numeric',
          });
          break;
        case 'year':
          periodKey = date.getFullYear().toString();
          break;
      }

      if (!periodData[periodKey]) {
        periodData[periodKey] = { tokens: 0, cost: 0, projects: 0 };
      }

      // Estimate tokens based on word count (rough estimate: 1 word ≈ 1.3 tokens)
      const estimatedTokens = (project.word_count || 0) * 1.3;
      periodData[periodKey].tokens += estimatedTokens;
      periodData[periodKey].projects += 1;

      // Estimate cost based on model (rough estimates)
      const model = project.config?.llm?.model || 'gpt-3.5-turbo';
      let costPerToken = 0.000002; // Default GPT-3.5 cost
      if (model.includes('gpt-4')) costPerToken = 0.00003;
      if (model.includes('claude')) costPerToken = 0.000015;

      periodData[periodKey].cost += estimatedTokens * costPerToken;
    });

    // Convert to array and sort by date
    const sortedData = Object.entries(periodData)
      .map(([period, data]) => ({
        period,
        tokens: Math.round(data.tokens),
        cost: Math.round(data.cost * 100) / 100,
        projects: data.projects,
      }))
      .sort((a, b) => {
        // Sort chronologically (this is simplified, might need better date parsing)
        return new Date(a.period).getTime() - new Date(b.period).getTime();
      });

    // Return the requested number of periods
    return sortedData.slice(-dateRange);
  };

  const calculateModelUsage = () => {
    if (!projects || projects.length === 0) {
      return [];
    }

    const modelCounts: Record<string, number> = {};

    projects.forEach(project => {
      const model = project.config?.llm?.model || 'unknown';
      const modelKey = model.includes('gpt-4')
        ? 'GPT-4'
        : model.includes('gpt-3.5')
          ? 'GPT-3.5'
          : model.includes('claude')
            ? 'Claude'
            : 'Other';

      modelCounts[modelKey] = (modelCounts[modelKey] || 0) + 1;
    });

    const total = Object.values(modelCounts).reduce(
      (sum, count) => sum + count,
      0
    );

    return Object.entries(modelCounts).map(([name, count]) => ({
      name,
      value: Math.round((count / total) * 100),
      count,
      color:
        name === 'GPT-4'
          ? '#0ea5e9'
          : name === 'GPT-3.5'
            ? '#8b5cf6'
            : name === 'Claude'
              ? '#ec4899'
              : '#6b7280',
    }));
  };

  const usageData = calculateUsageData();
  const modelUsage = calculateModelUsage();

  const projectStats = {
    total: projects?.length || 0,
    completed: projects?.filter(p => p.status === 'completed').length || 0,
    inProgress:
      projects?.filter(p =>
        [
          'researching',
          'generating_outline',
          'writing_article',
          'polishing',
        ].includes(p.status)
      ).length || 0,
    failed: projects?.filter(p => p.status === 'failed').length || 0,
  };

  const totalWords =
    projects?.reduce((sum, p) => sum + (p.word_count || 0), 0) || 0;
  const avgWords =
    projectStats.total > 0 ? Math.round(totalWords / projectStats.total) : 0;

  // Calculate real monthly cost
  const currentMonthCost =
    usageData.length > 0 ? usageData[usageData.length - 1]?.cost || 0 : 0;
  const lastMonthCost =
    usageData.length > 1 ? usageData[usageData.length - 2]?.cost || 0 : 0;
  const costChange =
    lastMonthCost > 0
      ? Math.round(((currentMonthCost - lastMonthCost) / lastMonthCost) * 100)
      : 0;

  // Calculate success rate
  const successRate =
    projectStats.total > 0
      ? Math.round((projectStats.completed / projectStats.total) * 100)
      : 0;

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">
            Track your STORM usage and performance metrics
          </p>
        </div>
      </div>

      {dataLoading ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[1, 2, 3, 4].map(i => (
              <Card key={i}>
                <CardHeader className="pb-2">
                  <Skeleton className="h-4 w-20" />
                </CardHeader>
                <CardContent>
                  <Skeleton className="mb-2 h-8 w-24" />
                  <Skeleton className="h-3 w-16" />
                </CardContent>
              </Card>
            ))}
          </div>
          <Card>
            <CardHeader>
              <Skeleton className="h-6 w-32" />
            </CardHeader>
            <CardContent>
              <Skeleton className="h-64 w-full" />
            </CardContent>
          </Card>
        </div>
      ) : (
        <>
          {/* Summary Cards */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Projects
                </CardTitle>
                <FileText className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{projectStats.total}</div>
                <p className="text-xs text-muted-foreground">
                  {projectStats.completed} completed, {projectStats.inProgress}{' '}
                  in progress
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Total Words Generated
                </CardTitle>
                <Activity className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  {totalWords.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  Avg {avgWords.toLocaleString()} words per article
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Monthly Cost
                </CardTitle>
                <DollarSign className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${currentMonthCost.toFixed(2)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {costChange !== 0
                    ? `${costChange > 0 ? '+' : ''}${costChange}% from last month`
                    : 'No previous data'}
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  Success Rate
                </CardTitle>
                <TrendingUp className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{successRate}%</div>
                <p className="text-xs text-muted-foreground">
                  Pipeline completion rate
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="usage" className="space-y-4">
            <TabsList>
              <TabsTrigger value="usage">Usage Trends</TabsTrigger>
              <TabsTrigger value="models">Model Distribution</TabsTrigger>
              <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
            </TabsList>

            <TabsContent value="usage" className="space-y-4">
              <Card>
                <CardHeader>
                  <CardTitle>Token Usage Over Time</CardTitle>
                  <CardDescription>
                    Monthly token consumption and trends
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {usageData && usageData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={usageData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="tokens"
                          stroke="#0ea5e9"
                          name="Tokens Used"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[300px] flex-col items-center justify-center text-center">
                      <Activity className="mb-4 h-12 w-12 text-muted-foreground" />
                      <h3 className="mb-2 text-lg font-medium">
                        No Usage Data Yet
                      </h3>
                      <p className="max-w-md text-sm text-muted-foreground">
                        Token usage will appear here once you start generating
                        articles with the STORM pipeline.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="models" className="space-y-4">
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Model Usage Distribution</CardTitle>
                    <CardDescription>Breakdown by AI model</CardDescription>
                  </CardHeader>
                  <CardContent>
                    {modelUsage && modelUsage.length > 0 ? (
                      <ResponsiveContainer width="100%" height="300">
                        <PieChart>
                          <Pie
                            data={modelUsage}
                            cx="50%"
                            cy="50%"
                            labelLine={false}
                            label={({ name, value }) => `${name}: ${value}%`}
                            outerRadius={80}
                            fill="#8884d8"
                            dataKey="value"
                          >
                            {modelUsage.map((entry, index) => (
                              <Cell key={`cell-${index}`} fill={entry.color} />
                            ))}
                          </Pie>
                          <Tooltip />
                        </PieChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="flex h-[300px] flex-col items-center justify-center text-center">
                        <Cpu className="mb-4 h-12 w-12 text-muted-foreground" />
                        <h3 className="mb-2 text-lg font-medium">
                          No Model Usage Yet
                        </h3>
                        <p className="text-sm text-muted-foreground">
                          Model distribution will appear here once projects are
                          created.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Model Performance</CardTitle>
                    <CardDescription>
                      Average response times and quality
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {modelUsage.map(model => (
                        <div
                          key={model.name}
                          className="flex items-center justify-between"
                        >
                          <div className="flex items-center space-x-2">
                            <div
                              className="h-3 w-3 rounded-full"
                              style={{ backgroundColor: model.color }}
                            />
                            <span className="font-medium">{model.name}</span>
                            <Badge variant="secondary" className="text-xs">
                              {model.count}{' '}
                              {model.count === 1 ? 'project' : 'projects'}
                            </Badge>
                          </div>
                          <div className="flex items-center space-x-4 text-sm">
                            <span className="text-muted-foreground">
                              {model.value}% of total
                            </span>
                          </div>
                        </div>
                      ))}
                      {modelUsage.length === 0 && (
                        <p className="py-4 text-center text-sm text-muted-foreground">
                          No model usage data available yet
                        </p>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            <TabsContent value="costs" className="space-y-4">
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle>Cost Breakdown</CardTitle>
                      <CardDescription>API costs over time</CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex rounded-lg border p-1">
                        <Button
                          variant={timeRange === 'day' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setTimeRange('day');
                            setDateRange(30);
                          }}
                          className="h-8 px-3 py-1"
                        >
                          Day
                        </Button>
                        <Button
                          variant={timeRange === 'week' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setTimeRange('week');
                            setDateRange(12);
                          }}
                          className="h-8 px-3 py-1"
                        >
                          Week
                        </Button>
                        <Button
                          variant={timeRange === 'month' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setTimeRange('month');
                            setDateRange(6);
                          }}
                          className="h-8 px-3 py-1"
                        >
                          Month
                        </Button>
                        <Button
                          variant={timeRange === 'year' ? 'default' : 'ghost'}
                          size="sm"
                          onClick={() => {
                            setTimeRange('year');
                            setDateRange(3);
                          }}
                          className="h-8 px-3 py-1"
                        >
                          Year
                        </Button>
                      </div>
                      <Select
                        value={dateRange.toString()}
                        onValueChange={value => setDateRange(parseInt(value))}
                      >
                        <SelectTrigger className="h-8 w-24">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {timeRange === 'day' && (
                            <>
                              <SelectItem value="7">7 days</SelectItem>
                              <SelectItem value="14">14 days</SelectItem>
                              <SelectItem value="30">30 days</SelectItem>
                              <SelectItem value="90">90 days</SelectItem>
                            </>
                          )}
                          {timeRange === 'week' && (
                            <>
                              <SelectItem value="4">4 weeks</SelectItem>
                              <SelectItem value="8">8 weeks</SelectItem>
                              <SelectItem value="12">12 weeks</SelectItem>
                              <SelectItem value="26">26 weeks</SelectItem>
                            </>
                          )}
                          {timeRange === 'month' && (
                            <>
                              <SelectItem value="3">3 months</SelectItem>
                              <SelectItem value="6">6 months</SelectItem>
                              <SelectItem value="12">12 months</SelectItem>
                              <SelectItem value="24">24 months</SelectItem>
                            </>
                          )}
                          {timeRange === 'year' && (
                            <>
                              <SelectItem value="1">1 year</SelectItem>
                              <SelectItem value="2">2 years</SelectItem>
                              <SelectItem value="3">3 years</SelectItem>
                              <SelectItem value="5">5 years</SelectItem>
                            </>
                          )}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  {usageData && usageData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <LineChart data={usageData}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis dataKey="period" />
                        <YAxis />
                        <Tooltip formatter={value => `$${value}`} />
                        <Legend />
                        <Line
                          type="monotone"
                          dataKey="cost"
                          stroke="#10b981"
                          name="Cost ($)"
                          strokeWidth={2}
                        />
                      </LineChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="flex h-[300px] flex-col items-center justify-center text-center">
                      <DollarSign className="mb-4 h-12 w-12 text-muted-foreground" />
                      <h3 className="mb-2 text-lg font-medium">
                        No Cost Data Yet
                      </h3>
                      <p className="max-w-md text-sm text-muted-foreground">
                        Cost analysis will appear here once you start using the
                        STORM pipeline.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Current Month</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      ${currentMonthCost.toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {new Date().toLocaleDateString('en-US', {
                        month: 'long',
                        year: 'numeric',
                      })}
                    </p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Total Cost</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      $
                      {usageData.reduce((sum, d) => sum + d.cost, 0).toFixed(2)}
                    </div>
                    <p className="text-xs text-muted-foreground">All time</p>
                  </CardContent>
                </Card>
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">Cost per Article</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-2xl font-bold">
                      $
                      {projectStats.total > 0
                        ? (
                            usageData.reduce((sum, d) => sum + d.cost, 0) /
                            projectStats.total
                          ).toFixed(2)
                        : '0.00'}
                    </div>
                    <p className="text-xs text-muted-foreground">Average</p>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </Tabs>
        </>
      )}
    </div>
  );
}
