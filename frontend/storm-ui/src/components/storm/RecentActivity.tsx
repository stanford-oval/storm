import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  FileText,
  Clock,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  ArrowRight,
  Sparkles,
  FileSearch,
  Edit,
  Zap,
} from 'lucide-react';
import { useProjectStore, usePipelineStore } from '@/store';
import { cn, formatDuration } from '@/lib/utils';

interface ActivityItem {
  id: string;
  type:
    | 'project_created'
    | 'pipeline_started'
    | 'pipeline_completed'
    | 'pipeline_failed'
    | 'article_updated'
    | 'research_completed';
  projectId: string;
  projectTitle: string;
  timestamp: Date;
  description: string;
  status?: 'success' | 'error' | 'warning' | 'info';
}

export const RecentActivity: React.FC<{
  maxItems?: number;
  className?: string;
}> = ({ maxItems = 10, className }) => {
  const router = useRouter();
  const { projects, loadProjects } = useProjectStore();
  const { pipelineHistory, runningPipelines } = usePipelineStore();

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Generate activity items from projects and pipeline history
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
        status: 'info',
      });

      // Add pipeline activities from project status
      if (project.status === 'completed') {
        items.push({
          id: `completed-${project.id}`,
          type: 'pipeline_completed',
          projectId: project.id,
          projectTitle: project.title,
          timestamp: new Date(project.updatedAt),
          description: `Article generation completed with ${project.word_count?.toLocaleString() || 0} words`,
          status: 'success',
        });
      } else if (project.status === 'failed') {
        items.push({
          id: `failed-${project.id}`,
          type: 'pipeline_failed',
          projectId: project.id,
          projectTitle: project.title,
          timestamp: new Date(project.updatedAt),
          description: `Pipeline failed during execution`,
          status: 'error',
        });
      }
    });

    // Add activities from pipeline history
    pipelineHistory?.forEach(pipeline => {
      const project = projects?.find(p => p.id === pipeline.projectId);
      if (project) {
        if (pipeline.status === 'running') {
          items.push({
            id: `pipeline-${pipeline.id}`,
            type: 'pipeline_started',
            projectId: pipeline.projectId,
            projectTitle: project.title,
            timestamp: new Date(pipeline.startTime),
            description: `Pipeline started - ${pipeline.progress?.stage || 'initializing'}`,
            status: 'info',
          });
        }

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
            status: 'info',
          });
        }
      }
    });

    // Sort by timestamp descending
    items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return items.slice(0, maxItems);
  }, [projects, pipelineHistory, maxItems]);

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
      default:
        return <FileText className="h-4 w-4" />;
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

  // Check if there are any running pipelines
  const hasRunningPipelines = Object.keys(runningPipelines).length > 0;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Recent Activity</CardTitle>
            <CardDescription>Latest updates from your projects</CardDescription>
          </div>
          {hasRunningPipelines && (
            <Badge variant="outline" className="animate-pulse">
              <RefreshCw className="mr-1 h-3 w-3 animate-spin" />
              Active
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <ScrollArea className="h-[400px] pr-4">
          {activities.length > 0 ? (
            <div className="space-y-4">
              {activities.map((activity, index) => (
                <div
                  key={activity.id}
                  className={cn(
                    'flex items-start space-x-3 pb-4',
                    index < activities.length - 1 && 'border-b'
                  )}
                >
                  <div
                    className={cn(
                      'mt-0.5 rounded-full bg-muted p-2',
                      getActivityColor(activity.status)
                    )}
                  >
                    {getActivityIcon(activity.type)}
                  </div>
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-medium">
                        {activity.description}
                      </p>
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
                      <span className="truncate">{activity.projectTitle}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <FileText className="mb-3 h-12 w-12 text-muted-foreground" />
              <p className="text-sm font-medium">No recent activity</p>
              <p className="mt-1 text-xs text-muted-foreground">
                Start creating projects to see activity here
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
  );
};

RecentActivity.displayName = 'RecentActivity';
