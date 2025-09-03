'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { 
  BarChart, 
  Bar, 
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
  ResponsiveContainer 
} from 'recharts';
import { 
  TrendingUp, 
  DollarSign, 
  Clock, 
  FileText, 
  Cpu, 
  AlertCircle,
  Activity,
  Zap
} from 'lucide-react';
import { useProjectStore, usePipelineStore } from '@/store';

export default function AnalyticsPage() {
  const { projects, loadProjects } = useProjectStore();
  const { pipelineHistory } = usePipelineStore();
  
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Calculate real data from projects
  const calculateUsageData = () => {
    if (!projects || projects.length === 0) {
      return [];
    }

    // Group projects by month
    const monthlyData: Record<string, { tokens: number; cost: number; projects: number }> = {};
    
    projects.forEach(project => {
      const date = new Date(project.createdAt);
      const monthKey = date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
      
      if (!monthlyData[monthKey]) {
        monthlyData[monthKey] = { tokens: 0, cost: 0, projects: 0 };
      }
      
      // Estimate tokens based on word count (rough estimate: 1 word ≈ 1.3 tokens)
      const estimatedTokens = (project.word_count || 0) * 1.3;
      monthlyData[monthKey].tokens += estimatedTokens;
      monthlyData[monthKey].projects += 1;
      
      // Estimate cost based on model (rough estimates)
      const model = project.config?.llm?.model || 'gpt-3.5-turbo';
      let costPerToken = 0.000002; // Default GPT-3.5 cost
      if (model.includes('gpt-4')) costPerToken = 0.00003;
      if (model.includes('claude')) costPerToken = 0.000015;
      
      monthlyData[monthKey].cost += estimatedTokens * costPerToken;
    });

    // Convert to array and sort by date
    return Object.entries(monthlyData)
      .map(([month, data]) => ({
        month,
        tokens: Math.round(data.tokens),
        cost: Math.round(data.cost * 100) / 100,
        projects: data.projects
      }))
      .slice(-6); // Last 6 months
  };

  const calculateModelUsage = () => {
    if (!projects || projects.length === 0) {
      return [];
    }

    const modelCounts: Record<string, number> = {};
    
    projects.forEach(project => {
      const model = project.config?.llm?.model || 'unknown';
      const modelKey = model.includes('gpt-4') ? 'GPT-4' :
                      model.includes('gpt-3.5') ? 'GPT-3.5' :
                      model.includes('claude') ? 'Claude' : 'Other';
      
      modelCounts[modelKey] = (modelCounts[modelKey] || 0) + 1;
    });

    const total = Object.values(modelCounts).reduce((sum, count) => sum + count, 0);
    
    return Object.entries(modelCounts).map(([name, count]) => ({
      name,
      value: Math.round((count / total) * 100),
      count,
      color: name === 'GPT-4' ? '#0ea5e9' :
             name === 'GPT-3.5' ? '#8b5cf6' :
             name === 'Claude' ? '#ec4899' : '#6b7280'
    }));
  };

  const calculatePipelineMetrics = () => {
    if (!pipelineHistory || pipelineHistory.length === 0) {
      // Return default data if no history
      return [
        { stage: 'Research', avgTime: 0, successRate: 0 },
        { stage: 'Outline', avgTime: 0, successRate: 0 },
        { stage: 'Writing', avgTime: 0, successRate: 0 },
        { stage: 'Polish', avgTime: 0, successRate: 0 },
      ];
    }

    const stages = ['research', 'outline_generation', 'article_generation', 'polishing'];
    const metrics = stages.map(stage => {
      const stageExecutions = pipelineHistory.filter(p => 
        p.progress?.stage === stage || 
        (p.status === 'completed' && p.progress?.stage === 'completed')
      );
      
      const successCount = stageExecutions.filter(p => p.status === 'completed').length;
      const totalCount = stageExecutions.length || 1;
      
      // Calculate average time (in minutes)
      const avgTime = stageExecutions.reduce((sum, p) => {
        if (p.startTime && p.endTime) {
          const duration = new Date(p.endTime).getTime() - new Date(p.startTime).getTime();
          return sum + (duration / 60000); // Convert to minutes
        }
        return sum;
      }, 0) / (totalCount || 1);
      
      return {
        stage: stage.split('_').map(s => s.charAt(0).toUpperCase() + s.slice(1)).join(' '),
        avgTime: Math.round(avgTime),
        successRate: Math.round((successCount / totalCount) * 100)
      };
    });
    
    return metrics;
  };

  const usageData = calculateUsageData();
  const modelUsage = calculateModelUsage();
  const pipelineMetrics = calculatePipelineMetrics();

  const projectStats = {
    total: projects?.length || 0,
    completed: projects?.filter(p => p.status === 'completed').length || 0,
    inProgress: projects?.filter(p => ['researching', 'generating_outline', 'writing_article', 'polishing'].includes(p.status)).length || 0,
    failed: projects?.filter(p => p.status === 'failed').length || 0,
  };

  const totalWords = projects?.reduce((sum, p) => sum + (p.word_count || 0), 0) || 0;
  const avgWords = projectStats.total > 0 ? Math.round(totalWords / projectStats.total) : 0;
  
  // Calculate real monthly cost
  const currentMonthCost = usageData.length > 0 ? usageData[usageData.length - 1]?.cost || 0 : 0;
  const lastMonthCost = usageData.length > 1 ? usageData[usageData.length - 2]?.cost || 0 : 0;
  const costChange = lastMonthCost > 0 ? Math.round(((currentMonthCost - lastMonthCost) / lastMonthCost) * 100) : 0;
  
  // Calculate success rate
  const successRate = projectStats.total > 0 
    ? Math.round((projectStats.completed / projectStats.total) * 100) 
    : 0;

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">Track your STORM usage and performance metrics</p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{projectStats.total}</div>
            <p className="text-xs text-muted-foreground">
              {projectStats.completed} completed, {projectStats.inProgress} in progress
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Words Generated</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalWords.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              Avg {avgWords.toLocaleString()} words per article
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Cost</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">${currentMonthCost.toFixed(2)}</div>
            <p className="text-xs text-muted-foreground">
              {costChange !== 0 ? `${costChange > 0 ? '+' : ''}${costChange}% from last month` : 'No previous data'}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
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
          <TabsTrigger value="pipeline">Pipeline Performance</TabsTrigger>
          <TabsTrigger value="costs">Cost Analysis</TabsTrigger>
        </TabsList>

        <TabsContent value="usage" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Token Usage Over Time</CardTitle>
              <CardDescription>Monthly token consumption and trends</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height="300">
                <LineChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
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
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="models" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <Card>
              <CardHeader>
                <CardTitle>Model Usage Distribution</CardTitle>
                <CardDescription>Breakdown by AI model</CardDescription>
              </CardHeader>
              <CardContent>
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
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Model Performance</CardTitle>
                <CardDescription>Average response times and quality</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {modelUsage.map((model) => (
                    <div key={model.name} className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full" 
                          style={{ backgroundColor: model.color }}
                        />
                        <span className="font-medium">{model.name}</span>
                        <Badge variant="secondary" className="text-xs">
                          {model.count} {model.count === 1 ? 'project' : 'projects'}
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
                    <p className="text-sm text-muted-foreground text-center py-4">
                      No model usage data available yet
                    </p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="pipeline" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Pipeline Stage Performance</CardTitle>
              <CardDescription>Average completion time and success rate by stage</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height="300">
                <BarChart data={pipelineMetrics}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="stage" />
                  <YAxis yAxisId="left" orientation="left" stroke="#0ea5e9" />
                  <YAxis yAxisId="right" orientation="right" stroke="#10b981" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="avgTime" fill="#0ea5e9" name="Avg Time (min)" />
                  <Bar yAxisId="right" dataKey="successRate" fill="#10b981" name="Success Rate (%)" />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="costs" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Cost Breakdown</CardTitle>
              <CardDescription>Monthly API costs and projections</CardDescription>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height="300">
                <LineChart data={usageData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="month" />
                  <YAxis />
                  <Tooltip formatter={(value) => `$${value}`} />
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
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Current Month</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">${currentMonthCost.toFixed(2)}</div>
                <p className="text-xs text-muted-foreground">
                  {new Date().toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-2">
                <CardTitle className="text-sm">Total Cost</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">
                  ${usageData.reduce((sum, d) => sum + d.cost, 0).toFixed(2)}
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
                  ${projectStats.total > 0 
                    ? (usageData.reduce((sum, d) => sum + d.cost, 0) / projectStats.total).toFixed(2)
                    : '0.00'}
                </div>
                <p className="text-xs text-muted-foreground">Average</p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}