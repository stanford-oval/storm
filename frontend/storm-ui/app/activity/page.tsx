'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
// Removed unused Tabs imports - will add back when needed
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Activity,
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  ArrowRight,
  Sparkles,
  FileSearch,
  Edit,
  Zap,
  Calendar,
  Download,
} from 'lucide-react';
import { useProjectStore, usePipelineStore } from '@/store';
import { cn } from '@/lib/utils';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

interface ActivityItem {
  id: string;
  type:
    | 'project_created'
    | 'pipeline_started'
    | 'pipeline_completed'
    | 'pipeline_failed'
    | 'article_updated'
    | 'research_completed'
    | 'outline_generated'
    | 'article_written';
  projectId: string;
  projectTitle: string;
  timestamp: Date;
  description: string;
  details?: string;
  status?: 'success' | 'error' | 'warning' | 'info';
  metadata?: Record<string, any>;
}

export default function ActivityPage() {
  const router = useRouter();
  const { projects, loadProjects } = useProjectStore();
  const { pipelineHistory, runningPipelines: _runningPipelines } =
    usePipelineStore();
  const [filterType, setFilterType] = useState<string>('all');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [dateRange, setDateRange] = useState<string>('all');

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Generate comprehensive activity items from all sources
  const activities = React.useMemo(() => {
    const items: ActivityItem[] = [];

    // Add project creation activities
    projects?.forEach(project => {
      items.push({
        id: `project-${project.id}`,
        type: 'project_created',
        projectId: project.id,
        projectTitle: project.title,
        timestamp: new Date(project.createdAt),
        description: `Project "${project.title}" was created`,
        details: project.description,
        status: 'info',
        metadata: {
          topic: project.topic,
          model: project.config?.llm?.model,
        },
      });

      // Add completion activities
      if (project.status === 'completed') {
        items.push({
          id: `completed-${project.id}`,
          type: 'pipeline_completed',
          projectId: project.id,
          projectTitle: project.title,
          timestamp: new Date(project.updatedAt),
          description: `Article generation completed`,
          details: `Generated ${project.word_count?.toLocaleString() || 0} words`,
          status: 'success',
          metadata: {
            wordCount: project.word_count,
            duration: project.metadata?.duration,
          },
        });
      }

      // Add failure activities
      if (project.status === 'failed') {
        items.push({
          id: `failed-${project.id}`,
          type: 'pipeline_failed',
          projectId: project.id,
          projectTitle: project.title,
          timestamp: new Date(project.updatedAt),
          description: `Pipeline failed during execution`,
          details: project.error || 'Unknown error occurred',
          status: 'error',
        });
      }
    });

    // Add activities from pipeline history
    pipelineHistory?.forEach(pipeline => {
      const project = projects?.find(p => p.id === pipeline.projectId);
      if (project) {
        // Pipeline start
        items.push({
          id: `pipeline-start-${pipeline.id}`,
          type: 'pipeline_started',
          projectId: pipeline.projectId,
          projectTitle: project.title,
          timestamp: new Date(pipeline.startTime),
          description: `Pipeline started`,
          details: `Stage: ${pipeline.progress?.stage || 'initializing'}`,
          status: 'info',
          metadata: {
            stage: pipeline.progress?.stage,
            config: pipeline.config,
          },
        });

        // Stage-specific activities
        if (
          pipeline.progress?.stage === 'research' &&
          pipeline.progress.stageProgress > 50
        ) {
          items.push({
            id: `research-${pipeline.id}`,
            type: 'research_completed',
            projectId: pipeline.projectId,
            projectTitle: project.title,
            timestamp: new Date(pipeline.startTime),
            description: `Research phase in progress`,
            details: `${Math.round(pipeline.progress.stageProgress)}% complete`,
            status: 'info',
          });
        }

        if (
          pipeline.progress?.stage === 'outline_generation' &&
          pipeline.progress.stageProgress > 0
        ) {
          items.push({
            id: `outline-${pipeline.id}`,
            type: 'outline_generated',
            projectId: pipeline.projectId,
            projectTitle: project.title,
            timestamp: new Date(pipeline.startTime),
            description: `Outline generation in progress`,
            details: `Creating article structure`,
            status: 'info',
          });
        }

        if (
          pipeline.progress?.stage === 'article_generation' &&
          pipeline.progress.stageProgress > 0
        ) {
          items.push({
            id: `writing-${pipeline.id}`,
            type: 'article_written',
            projectId: pipeline.projectId,
            projectTitle: project.title,
            timestamp: new Date(pipeline.startTime),
            description: `Writing article content`,
            details: `${Math.round(pipeline.progress.stageProgress)}% complete`,
            status: 'info',
          });
        }
      }
    });

    // Sort by timestamp descending
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply filters
    let filtered = items;

    if (filterType !== 'all') {
      filtered = filtered.filter(item => item.type === filterType);
    }

    if (filterStatus !== 'all') {
      filtered = filtered.filter(item => item.status === filterStatus);
    }

    if (dateRange !== 'all') {
      const now = new Date();
      const cutoff = new Date();

      switch (dateRange) {
        case 'today':
          cutoff.setHours(0, 0, 0, 0);
          break;
        case 'week':
          cutoff.setDate(now.getDate() - 7);
          break;
        case 'month':
          cutoff.setMonth(now.getMonth() - 1);
          break;
      }

      filtered = filtered.filter(item => item.timestamp >= cutoff);
    }

    return filtered;
  }, [projects, pipelineHistory, filterType, filterStatus, dateRange]);

  const getActivityIcon = (type: ActivityItem['type']) => {
    switch (type) {
      case 'project_created':
        return <Sparkles className="h-4 w-4" />;
      case 'pipeline_started':
        return <Zap className="h-4 w-4" />;
      case 'pipeline_completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'pipeline_failed':
        return <AlertCircle className="h-4 w-4" />;
      case 'article_updated':
        return <Edit className="h-4 w-4" />;
      case 'research_completed':
        return <FileSearch className="h-4 w-4" />;
      case 'outline_generated':
        return <FileText className="h-4 w-4" />;
      case 'article_written':
        return <Edit className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  const getActivityColor = (status?: ActivityItem['status']) => {
    switch (status) {
      case 'success':
        return 'text-green-500';
      case 'error':
        return 'text-destructive';
      case 'warning':
        return 'text-yellow-500';
      case 'info':
      default:
        return 'text-primary';
    }
  };

  const getRelativeTime = (date: Date) => {
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'just now';
    if (diffMins < 60)
      return `${diffMins} minute${diffMins === 1 ? '' : 's'} ago`;
    if (diffHours < 24)
      return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`;

    return date.toLocaleDateString();
  };

  // Group activities by date
  const groupedActivities = React.useMemo(() => {
    const groups: Record<string, ActivityItem[]> = {};

    activities.forEach(activity => {
      const dateKey = activity.timestamp.toDateString();
      if (!groups[dateKey]) {
        groups[dateKey] = [];
      }
      groups[dateKey].push(activity);
    });

    return groups;
  }, [activities]);

  const stats = {
    total: activities.length,
    success: activities.filter(a => a.status === 'success').length,
    errors: activities.filter(a => a.status === 'error').length,
    today: activities.filter(a => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return a.timestamp >= today;
    }).length,
  };

  const exportActivities = () => {
    const data = activities.map(a => ({
      timestamp: a.timestamp.toISOString(),
      type: a.type,
      project: a.projectTitle,
      description: a.description,
      details: a.details,
      status: a.status,
    }));

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `activity-log-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
  };

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Activity Timeline</h1>
          <p className="text-muted-foreground">
            Track all project and pipeline activities
          </p>
        </div>
        <Button onClick={exportActivities} variant="outline">
          <Download className="mr-2 h-4 w-4" />
          Export Log
        </Button>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              Total Activities
            </CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Today</CardTitle>
            <Calendar className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-600">
              {stats.today}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Successful</CardTitle>
            <CheckCircle className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {stats.success}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Errors</CardTitle>
            <AlertCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-red-600">
              {stats.errors}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Select value={filterType} onValueChange={setFilterType}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Activity Type" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="project_created">Project Created</SelectItem>
                <SelectItem value="pipeline_started">
                  Pipeline Started
                </SelectItem>
                <SelectItem value="pipeline_completed">
                  Pipeline Completed
                </SelectItem>
                <SelectItem value="pipeline_failed">Pipeline Failed</SelectItem>
                <SelectItem value="research_completed">
                  Research Completed
                </SelectItem>
                <SelectItem value="outline_generated">
                  Outline Generated
                </SelectItem>
                <SelectItem value="article_written">Article Written</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="success">Success</SelectItem>
                <SelectItem value="error">Error</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>

            <Select value={dateRange} onValueChange={setDateRange}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Date Range" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Time</SelectItem>
                <SelectItem value="today">Today</SelectItem>
                <SelectItem value="week">Last 7 Days</SelectItem>
                <SelectItem value="month">Last 30 Days</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* Activity Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Timeline</CardTitle>
          <CardDescription>
            {activities.length > 0
              ? `Showing ${activities.length} activities`
              : 'No activities to display'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[600px] pr-4">
            {Object.keys(groupedActivities).length > 0 ? (
              <div className="space-y-8">
                {Object.entries(groupedActivities).map(([date, items]) => (
                  <div key={date}>
                    <div className="sticky top-0 z-10 bg-background pb-2">
                      <h3 className="text-sm font-semibold text-muted-foreground">
                        {new Date(date).toDateString() ===
                        new Date().toDateString()
                          ? 'Today'
                          : new Date(date).toLocaleDateString('en-US', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric',
                            })}
                      </h3>
                    </div>
                    <div className="ml-2 space-y-4 border-l-2 border-muted pl-2">
                      {items.map(activity => (
                        <div
                          key={activity.id}
                          className="-ml-[9px] flex items-start space-x-3"
                        >
                          <div
                            className={cn(
                              'mt-0.5 rounded-full border-2 border-muted bg-background p-2',
                              getActivityColor(activity.status)
                            )}
                          >
                            {getActivityIcon(activity.type)}
                          </div>
                          <div className="flex-1 space-y-1">
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="text-sm font-medium">
                                  {activity.description}
                                </p>
                                {activity.details && (
                                  <p className="mt-1 text-xs text-muted-foreground">
                                    {activity.details}
                                  </p>
                                )}
                              </div>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6"
                                onClick={() =>
                                  router.push(`/projects/${activity.projectId}`)
                                }
                              >
                                <ArrowRight className="h-3 w-3" />
                              </Button>
                            </div>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Clock className="h-3 w-3" />
                              <span>{getRelativeTime(activity.timestamp)}</span>
                              <span>•</span>
                              <span className="truncate">
                                {activity.projectTitle}
                              </span>
                              {activity.metadata?.model && (
                                <>
                                  <span>•</span>
                                  <Badge variant="outline" className="text-xs">
                                    {activity.metadata.model}
                                  </Badge>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Activity className="mb-3 h-12 w-12 text-muted-foreground" />
                <p className="text-sm font-medium">No activity yet</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Activities will appear here as you create and run projects
                </p>
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-4"
                  onClick={() => router.push('/projects/new')}
                >
                  Create First Project
                </Button>
              </div>
            )}
          </ScrollArea>
        </CardContent>
      </Card>
    </div>
  );
}
