import * as React from 'react';
import {
  MoreHorizontal,
  Calendar,
  Clock,
  FileText,
  Trash2,
  Copy,
} from 'lucide-react';
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  cn,
  formatRelativeTime,
  getProjectStatusColor,
  getProjectStatusLabel,
} from '@/lib/utils';
import type { ProjectCardProps, StormProject } from '@/types';

export const ProjectCard: React.FC<ProjectCardProps> = ({
  project,
  onSelect,
  onDelete,
  onDuplicate,
  className,
}) => {
  const isRunning = [
    'researching',
    'generating_outline',
    'writing_article',
    'polishing',
  ].includes(project.status);
  const progress = project.progress?.overallProgress || 0;

  const handleCardClick = (e: React.MouseEvent) => {
    // Don't trigger card selection if clicking on dropdown or buttons
    if (
      (e.target as HTMLElement).closest('[data-radix-dropdown-trigger], button')
    ) {
      return;
    }
    onSelect(project);
  };

  return (
    <Card
      className={cn(
        'group relative cursor-pointer transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md',
        isRunning && 'ring-2 ring-primary ring-opacity-50',
        className
      )}
      onClick={handleCardClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="min-w-0 flex-1">
            <CardTitle className="mb-1 truncate text-lg font-semibold">
              {project.title}
            </CardTitle>
            <p className="truncate text-sm text-muted-foreground">
              {project.topic}
            </p>
          </div>
          <div className="ml-3 flex items-center space-x-2">
            <Badge
              variant="secondary"
              className={cn('text-xs', getProjectStatusColor(project.status))}
            >
              {getProjectStatusLabel(project.status)}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 opacity-0 transition-opacity group-hover:opacity-100"
                  data-radix-dropdown-trigger
                >
                  <MoreHorizontal className="h-4 w-4" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-48">
                <DropdownMenuItem onClick={() => onSelect(project)}>
                  <FileText className="mr-2 h-4 w-4" />
                  Open Project
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDuplicate(project)}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => onDelete(project.id)}
                  className="text-destructive focus:text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>
      </CardHeader>

      <CardContent className="pb-3">
        {project.description && (
          <p className="mb-3 line-clamp-2 text-sm text-muted-foreground">
            {project.description}
          </p>
        )}

        {isRunning && (
          <div className="mb-3">
            <div className="mb-1 flex items-center justify-between text-xs text-muted-foreground">
              <span>Progress</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <Progress value={progress} className="h-1.5" />
            {project.progress?.currentTask && (
              <p className="mt-1 truncate text-xs text-muted-foreground">
                {project.progress.currentTask}
              </p>
            )}
          </div>
        )}

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <div className="flex items-center">
            <Calendar className="mr-1 h-3 w-3" />
            <span>Created {formatRelativeTime(project.createdAt)}</span>
          </div>
          <div className="flex items-center">
            <Clock className="mr-1 h-3 w-3" />
            <span>Updated {formatRelativeTime(project.updatedAt)}</span>
          </div>
        </div>
      </CardContent>

      <CardFooter className="pt-0">
        <div className="flex w-full items-center justify-between">
          <div className="flex items-center space-x-4 text-xs text-muted-foreground">
            {project.config?.llm?.model && (
              <>
                <span>Model: {project.config.llm.model}</span>
                <span>•</span>
              </>
            )}
            {project.config?.retriever?.type && (
              <span>Retriever: {project.config.retriever.type}</span>
            )}
            {!project.config && <span>No configuration</span>}
          </div>
          {project.word_count ? (
            <span className="text-xs text-muted-foreground">
              {(project.word_count || 0).toLocaleString()} words
            </span>
          ) : null}
        </div>
      </CardFooter>

      {/* Running indicator */}
      {isRunning && (
        <div className="absolute left-2 top-2">
          <div className="h-2 w-2 animate-pulse rounded-full bg-primary"></div>
        </div>
      )}
    </Card>
  );
};

ProjectCard.displayName = 'ProjectCard';
