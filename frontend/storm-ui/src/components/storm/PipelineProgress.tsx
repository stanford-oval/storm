import * as React from 'react';
import { X, AlertTriangle, CheckCircle, Clock, Zap } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { cn, formatDuration, getPipelineStageLabel } from '@/lib/utils';
import type {
  PipelineProgressProps,
  PipelineStage,
  PipelineError,
} from '@/types';

export const PipelineProgress: React.FC<PipelineProgressProps> = ({
  progress,
  showDetails = false,
  onCancel,
  className,
}) => {
  const [expandedStage, setExpandedStage] = React.useState<string | null>(null);
  const [elapsedTime, setElapsedTime] = React.useState<number>(0);

  // Update elapsed time every second
  React.useEffect(() => {
    if (!progress.startTime) return;

    const interval = setInterval(() => {
      const elapsed = Date.now() - new Date(progress.startTime).getTime();
      setElapsedTime(elapsed);
    }, 1000);

    return () => clearInterval(interval);
  }, [progress.startTime]);

  const stageOrder: PipelineStage[] = [
    'initializing',
    'research',
    'outline_generation',
    'article_generation',
    'polishing',
    'completed',
  ];

  const getStageIndex = (stage: PipelineStage): number => {
    return stageOrder.indexOf(stage);
  };

  const isStageCompleted = (stage: PipelineStage): boolean => {
    const currentIndex = getStageIndex(progress.stage);
    const stageIndex = getStageIndex(stage);
    return (
      stageIndex < currentIndex ||
      (stageIndex === currentIndex && progress.stage === 'completed')
    );
  };

  const isStageActive = (stage: PipelineStage): boolean => {
    return stage === progress.stage && progress.stage !== 'completed';
  };

  const getStageIcon = (stage: PipelineStage) => {
    if (isStageCompleted(stage)) {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    }
    if (isStageActive(stage)) {
      return <Zap className="h-4 w-4 animate-pulse text-primary" />;
    }
    return <Clock className="h-4 w-4 text-muted-foreground" />;
  };

  const errorsByStage = React.useMemo(() => {
    return (progress.errors || []).reduce(
      (acc, error) => {
        if (!acc[error.stage]) acc[error.stage] = [];
        acc[error.stage].push(error);
        return acc;
      },
      {} as Record<PipelineStage, PipelineError[]>
    );
  }, [progress.errors]);

  const estimatedTimeRemaining = progress.estimatedEndTime
    ? Math.max(0, new Date(progress.estimatedEndTime).getTime() - Date.now())
    : null;

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg font-semibold">
            Pipeline Progress
          </CardTitle>
          {onCancel && progress.stage !== 'completed' && (
            <Button
              variant="ghost"
              size="icon"
              onClick={onCancel}
              className="h-8 w-8"
            >
              <X className="h-4 w-4" />
              <span className="sr-only">Cancel pipeline</span>
            </Button>
          )}
        </div>
        <div className="flex items-center justify-between text-sm text-muted-foreground">
          <span>Current stage: {getPipelineStageLabel(progress.stage)}</span>
          <span>Elapsed: {formatDuration(elapsedTime)}</span>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="font-medium">Overall Progress</span>
            <span className="text-muted-foreground">
              {Math.round(progress.overallProgress || 0)}%
            </span>
          </div>
          <Progress value={progress.overallProgress || 0} className="h-2" />
          {estimatedTimeRemaining && (
            <div className="text-right text-xs text-muted-foreground">
              Est. {formatDuration(estimatedTimeRemaining)} remaining
            </div>
          )}
        </div>

        {/* Current Task */}
        {progress.currentTask && (
          <div className="rounded-md bg-muted/50 p-3">
            <p className="mb-1 text-sm font-medium">Current Task</p>
            <p className="text-sm text-muted-foreground">
              {progress.currentTask}
            </p>
          </div>
        )}

        {/* Stage Progress */}
        {showDetails && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="font-medium">Stage Progress</span>
              <span className="text-muted-foreground">
                {Math.round(progress.stageProgress || 0)}%
              </span>
            </div>
            <Progress value={progress.stageProgress || 0} className="h-1.5" />
          </div>
        )}

        {/* Pipeline Stages */}
        {showDetails && (
          <div className="space-y-3">
            <h4 className="text-sm font-medium">Pipeline Stages</h4>
            <div className="space-y-2">
              {stageOrder.map((stage, index) => {
                const stageErrors = errorsByStage[stage] || [];
                const hasErrors = stageErrors.length > 0;
                const isCompleted = isStageCompleted(stage);
                const isActive = isStageActive(stage);

                return (
                  <div
                    key={stage}
                    className={cn(
                      'flex items-center space-x-3 rounded-md p-2 transition-colors',
                      isActive && 'bg-primary/5',
                      isCompleted &&
                        !hasErrors &&
                        'bg-green-50 dark:bg-green-950/20'
                    )}
                  >
                    <div className="flex-shrink-0">{getStageIcon(stage)}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between">
                        <p
                          className={cn(
                            'truncate text-sm font-medium',
                            isCompleted && 'text-muted-foreground',
                            isActive && 'text-primary'
                          )}
                        >
                          {getPipelineStageLabel(stage)}
                        </p>
                        {hasErrors && (
                          <Badge variant="destructive" className="ml-2">
                            {stageErrors.length} error
                            {stageErrors.length > 1 ? 's' : ''}
                          </Badge>
                        )}
                      </div>
                      {isActive && progress.currentTask && (
                        <p className="mt-1 truncate text-xs text-muted-foreground">
                          {progress.currentTask}
                        </p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Errors Section */}
        {progress.errors && progress.errors.length > 0 && (
          <Accordion type="single" collapsible>
            <AccordionItem value="errors">
              <AccordionTrigger className="text-destructive">
                <div className="flex items-center">
                  <AlertTriangle className="mr-2 h-4 w-4" />
                  {progress.errors.length} Error
                  {progress.errors.length > 1 ? 's' : ''}
                </div>
              </AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  {progress.errors.map((error, index) => (
                    <div
                      key={index}
                      className="rounded-md border border-destructive/20 bg-destructive/5 p-3"
                    >
                      <div className="mb-1 flex items-center justify-between">
                        <Badge variant="destructive" className="text-xs">
                          {getPipelineStageLabel(error.stage)}
                        </Badge>
                        <span className="text-xs text-muted-foreground">
                          {new Date(error.timestamp).toLocaleTimeString()}
                        </span>
                      </div>
                      <p className="text-sm text-destructive">
                        {error.message}
                      </p>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}
      </CardContent>
    </Card>
  );
};

PipelineProgress.displayName = 'PipelineProgress';
