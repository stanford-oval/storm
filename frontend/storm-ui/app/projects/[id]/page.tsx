'use client';

import { logger } from '@/utils/logger';
import { mapConfigFromBackend } from '@/utils/config-mapper';
// Removed unused ErrorBoundary import

import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PipelineProgress } from '@/components/storm/PipelineProgress';
import { ConfigurationPanel } from '@/components/storm/ConfigurationPanel';
// Removed unused ResearchView import
import { OutlineEditor } from '@/components/storm/OutlineEditor';
import { ConversationView } from '@/components/storm/ConversationView';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Markdown } from '@/components/ui/markdown';
import { Progress } from '@/components/ui/progress';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  useProjectStore,
  usePipelineStore,
  useNotificationStore,
} from '@/store';
import { StormConfig } from '@/types/storm';
import { AnimatedPage } from '@/utils/animations/AnimatedPage';
import { ResponsiveContainer } from '@/components/ux/ResponsiveContainer';
import {
  ArrowLeft,
  Play,
  Square,
  MoreHorizontal,
  Settings,
  FileText,
  Search,
  Brain,
  Download,
  Share2,
  Copy,
  Trash2,
  Eye,
  AlertCircle,
  CheckCircle,
  Circle,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  getProjectStatusIcon,
  getProjectStatusColor,
  getProjectStatusLabel,
} from '@/utils/status';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const {
    projects,
    currentProject,
    loading,
    error,
    loadProject,
    updateProject,
    updateProjectConfig,
    deleteProject,
    duplicateProject,
  } = useProjectStore();

  const {
    startPipeline,
    cancelPipeline,
    runningPipelines,
    getPipelineExecution: _getPipelineExecution,
    updatePipelineProgress,
  } = usePipelineStore();

  const { addNotification } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [_isConfiguring, _setIsConfiguring] = useState(false);
  const [projectConfig, setProjectConfig] = useState<StormConfig | undefined>();

  // Load project on mount and ensure fresh data
  useEffect(() => {
    if (projectId) {
      // Force fresh load from backend
      const loadFreshProject = async () => {
        try {
          const apiUrl =
            process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';

          // Fetch both project and default config in parallel
          const [projectResponse, configResponse] = await Promise.all([
            fetch(`${apiUrl}/projects/${projectId}`),
            fetch(`${apiUrl}/settings/default-config`),
          ]);

          if (projectResponse.ok) {
            const freshProject = await projectResponse.json();

            // Get default config if available
            let defaultConfig = null;
            if (configResponse.ok) {
              defaultConfig = await configResponse.json();
            }

            // Map backend config to frontend format if config exists
            if (freshProject.config) {
              // Use the mapper function to handle both old flat and new nested formats
              freshProject.config = mapConfigFromBackend(freshProject.config);
            } else if (defaultConfig) {
              // If no config exists, use default config from backend
              freshProject.config = mapConfigFromBackend(defaultConfig);
            } else {
              // Last resort: minimal defaults without hardcoded models
              freshProject.config = {
                llm: {
                  model: '', // Will be populated from available models
                  provider: 'openai',
                  temperature: 0.7,
                  maxTokens: 4000,
                },
                retriever: {
                  type: 'tavily',
                  maxResults: 10,
                },
                pipeline: {
                  doResearch: true,
                  doGenerateOutline: true,
                  doGenerateArticle: true,
                  doPolishArticle: true,
                },
                output: {
                  format: 'markdown',
                  includeCitations: true,
                },
              };
            }

            // Update store with fresh data
            const { setCurrentProject } = useProjectStore.getState();
            setCurrentProject(freshProject);

            // Set the project config state
            setProjectConfig(freshProject.config);

            // The setCurrentProject method already updates the projects array
          }
        } catch (error) {
          logger.error('Error loading fresh project data:', error);
          // Fall back to regular load
          loadProject(projectId);
        }
      };

      loadFreshProject();
    }
  }, [projectId, loadProject]);

  const project = currentProject || projects?.find(p => p.id === projectId);
  const runningPipeline = Object.values(runningPipelines).find(
    p => p.projectId === projectId
  );
  const isRunning = !!runningPipeline;
  const pipelineProgress = runningPipeline?.progress;

  // Poll for pipeline progress updates
  useEffect(() => {
    if (!projectId || !isRunning) return;

    const checkProgress = async () => {
      try {
        // Get pipeline status from backend
        const response = await fetch(
          `http://localhost:8000/api/pipeline/${projectId}/status`
        );
        if (response.ok) {
          const status = await response.json();

          // Update progress in store if pipeline is running
          if (status.is_running && status.progress && runningPipeline) {
            updatePipelineProgress(runningPipeline.id, {
              stage: status.progress.stage || 'running',
              stageProgress: status.progress.stage_progress || 0,
              overallProgress: status.progress.overall_progress || 0,
              startTime: new Date(status.progress.start_time || Date.now()),
              currentTask: status.progress.current_task,
              errors: status.progress.errors,
            });
          }

          // If pipeline completed, reload the full project
          if (!status.is_running && runningPipeline) {
            // Force reload the project to get updated data including word_count
            await loadProject(projectId);

            // Also refresh from API directly to ensure we have latest data
            try {
              const projectResponse = await fetch(
                `http://localhost:8000/api/projects/${projectId}`
              );
              if (projectResponse.ok) {
                const updatedProject = await projectResponse.json();
                // Update the project in the store with fresh data
                const { setCurrentProject } = useProjectStore.getState();
                setCurrentProject(updatedProject);
              }
            } catch (err) {
              logger.error('Error refreshing project data:', err);
            }

            // Update pipeline status to completed which will move it to history
            // and remove it from runningPipelines
            const { setPipelineStatus } = usePipelineStore.getState();
            setPipelineStatus(runningPipeline.id, 'completed');
          }
        }
      } catch (error) {
        logger.error('Error checking pipeline status:', error);
      }
    };

    // Initial check
    checkProgress();

    // Poll every 2 seconds
    const interval = setInterval(checkProgress, 2000);

    return () => clearInterval(interval);
  }, [
    projectId,
    isRunning,
    runningPipeline,
    loadProject,
    updatePipelineProgress,
  ]);

  // Handle pipeline actions
  const handleStartPipeline = async () => {
    if (!project) return;

    try {
      // Use loaded config, project config, or default config
      const configToUse = projectConfig ||
        project.config || {
          llm: {
            model: '', // Will be populated from available models
            provider: 'openai',
          },
          retriever: {
            type: 'bing',
          },
          pipeline: {
            doResearch: true,
            doGenerateOutline: true,
            doGenerateArticle: true,
            doPolishArticle: true,
          },
        };

      await startPipeline(project.id, configToUse);
      addNotification({
        type: 'success',
        title: 'Pipeline Started',
        message: `STORM pipeline started for "${project.title || 'Untitled Project'}"`,
        read: false,
        persistent: false,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to Start Pipeline',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
        read: false,
        persistent: false,
      });
    }
  };

  const handleStopPipeline = async () => {
    if (!project || !runningPipeline) return;

    try {
      await cancelPipeline(runningPipeline.id);
      addNotification({
        type: 'info',
        title: 'Pipeline Cancelled',
        message: `Pipeline cancelled for "${project.title || 'Untitled Project'}"`,
        read: false,
        persistent: false,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to Cancel Pipeline',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
        read: false,
        persistent: false,
      });
    }
  };

  const handleConfigSave = async (config: StormConfig) => {
    if (!project) return;

    try {
      await updateProjectConfig(project.id, config);
      setProjectConfig(config); // Update local state
      _setIsConfiguring(false);
      addNotification({
        type: 'success',
        title: 'Configuration Updated',
        message: 'Project configuration has been saved',
        read: false,
        persistent: false,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to Update Configuration',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
        read: false,
        persistent: false,
      });
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;

    if (
      confirm(
        `Are you sure you want to delete "${project.title || 'Untitled Project'}"? This action cannot be undone.`
      )
    ) {
      try {
        await deleteProject(project.id);
        addNotification({
          type: 'success',
          title: 'Project Deleted',
          message: `"${project.title || 'Untitled Project'}" has been deleted`,
          read: false,
          persistent: false,
        });
        router.push('/');
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Failed to Delete Project',
          message:
            error instanceof Error ? error.message : 'Unknown error occurred',
          read: false,
          persistent: false,
        });
      }
    }
  };

  const handleDuplicateProject = async () => {
    if (!project) return;

    try {
      const newProject = await duplicateProject(project);
      addNotification({
        type: 'success',
        title: 'Project Duplicated',
        message: `Copy created successfully`,
        read: false,
        persistent: false,
      });
      router.push(`/projects/${newProject.id}`);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to Duplicate Project',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
        read: false,
        persistent: false,
      });
    }
  };

  const handleExport = async (format: 'markdown' | 'html' | 'json') => {
    if (!project) return;

    try {
      const apiUrl =
        process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
      const response = await fetch(
        `${apiUrl}/projects/${project.id}/export?format=${format}`
      );

      if (!response.ok) {
        throw new Error(`Export failed: ${response.statusText}`);
      }

      const data = await response.json();

      // Create blob and download
      const blob = new Blob([data.content], { type: data.media_type });
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = data.filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      addNotification({
        type: 'success',
        title: 'Export Successful',
        message: `Article exported as ${format.toUpperCase()}`,
        read: false,
        persistent: false,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Export Failed',
        message:
          error instanceof Error ? error.message : 'Failed to export article',
        read: false,
        persistent: false,
      });
    }
  };

  if (loading) {
    return (
      <AnimatedPage>
        <ResponsiveContainer className="py-6">
          <div className="space-y-4">
            <div className="loading-skeleton h-8 w-64" />
            <div className="loading-skeleton h-4 w-96" />
            <div className="loading-skeleton h-48 w-full" />
          </div>
        </ResponsiveContainer>
      </AnimatedPage>
    );
  }

  if (error || !project) {
    return (
      <AnimatedPage>
        <ResponsiveContainer className="py-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <AlertCircle className="mb-4 h-12 w-12 text-destructive" />
              <h3 className="mb-2 text-lg font-semibold">Project Not Found</h3>
              <p className="mb-4 text-center text-muted-foreground">
                {error || 'The requested project could not be found.'}
              </p>
              <Button onClick={() => router.push('/')}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Projects
              </Button>
            </CardContent>
          </Card>
        </ResponsiveContainer>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <ResponsiveContainer className="space-y-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button variant="ghost" size="sm" onClick={() => router.push('/')}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Projects
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold tracking-tight">
                  {project.title || 'Untitled Project'}
                </h1>
                <Badge
                  className={cn(
                    'text-xs',
                    getProjectStatusColor(project.status)
                  )}
                >
                  <div className="flex items-center space-x-1">
                    {getProjectStatusIcon(project.status)}
                    <span className="capitalize">
                      {getProjectStatusLabel(project.status)}
                    </span>
                  </div>
                </Badge>
              </div>
              <p className="text-muted-foreground">
                {project.topic || 'No topic specified'}
              </p>
              {project.description && (
                <p className="mt-1 text-sm text-muted-foreground">
                  {project.description}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Pipeline Controls */}
            {!isRunning ? (
              <Button onClick={handleStartPipeline} className="btn-primary">
                <Play className="mr-2 h-4 w-4" />
                Run Pipeline
              </Button>
            ) : (
              <Button
                onClick={handleStopPipeline}
                variant="destructive"
                disabled={runningPipeline?.status !== 'running'}
              >
                <Square className="mr-2 h-4 w-4" />
                Stop Pipeline
              </Button>
            )}

            {/* More Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => _setIsConfiguring(true)}>
                  <Settings className="mr-2 h-4 w-4" />
                  Configure
                </DropdownMenuItem>
                {project.article && (
                  <DropdownMenuItem
                    onClick={() =>
                      router.push(`/projects/${project.id}/article`)
                    }
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View Article
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDuplicateProject}>
                  <Copy className="mr-2 h-4 w-4" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="mr-2 h-4 w-4" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDeleteProject}
                  className="text-destructive"
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Pipeline Progress or Status */}
        {(pipelineProgress || project?.status === 'completed') && (
          <Card>
            <CardContent className="pt-6">
              {pipelineProgress ? (
                <PipelineProgress
                  progress={pipelineProgress}
                  showDetails={true}
                  onCancel={isRunning ? handleStopPipeline : undefined}
                />
              ) : (
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Pipeline Status</h3>
                    <Badge className="border-green-500/20 bg-green-500/10 text-green-600">
                      <CheckCircle className="mr-1 h-3 w-3" />
                      Completed
                    </Badge>
                  </div>
                  <Progress value={100} className="h-2" />
                  <div className="text-sm text-muted-foreground">
                    Article generated successfully with{' '}
                    {(project?.metadata?.word_count || 0).toLocaleString()}{' '}
                    words
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs
          value={activeTab}
          onValueChange={setActiveTab}
          className="space-y-4"
        >
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="article">Article</TabsTrigger>
            <TabsTrigger value="research">Research</TabsTrigger>
            <TabsTrigger value="outline">Outline</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
              {/* Main Info */}
              <div className="space-y-4 lg:col-span-2">
                <Card>
                  <CardHeader>
                    <CardTitle>Project Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="text-sm font-semibold text-muted-foreground">
                        Topic
                      </h4>
                      <p className="mt-1">
                        {project.topic || 'No topic specified'}
                      </p>
                    </div>
                    {project.description && (
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground">
                          Description
                        </h4>
                        <p className="mt-1 text-muted-foreground">
                          {project.description}
                        </p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground">
                          Created
                        </h4>
                        <p className="mt-1">
                          {new Date(project.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div>
                        <h4 className="text-sm font-semibold text-muted-foreground">
                          Last Updated
                        </h4>
                        <p className="mt-1">
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Quick Actions */}
                <Card>
                  <CardHeader>
                    <CardTitle>Quick Actions</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-2">
                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => setActiveTab('research')}
                      >
                        <Search className="mr-2 h-4 w-4" />
                        View Research
                      </Button>
                      <Button
                        variant="outline"
                        className="justify-start"
                        onClick={() => setActiveTab('outline')}
                      >
                        <Brain className="mr-2 h-4 w-4" />
                        Edit Outline
                      </Button>
                      {project.article && (
                        <>
                          <Button
                            variant="outline"
                            className="justify-start"
                            onClick={() =>
                              router.push(`/projects/${project.id}/article`)
                            }
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            View Article
                          </Button>
                          <Button variant="outline" className="justify-start">
                            <Download className="mr-2 h-4 w-4" />
                            Export Article
                          </Button>
                        </>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar */}
              <div className="space-y-4">
                {/* Pipeline Status */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Pipeline Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Research</span>
                      {pipelineProgress?.stages_completed?.includes('research') ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : project.config?.pipeline?.doResearch ? (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Generate Outline</span>
                      {pipelineProgress?.stages_completed?.includes('outline') ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : project.config?.pipeline?.doGenerateOutline ? (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Write Article</span>
                      {pipelineProgress?.stages_completed?.includes('article') ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : project.config?.pipeline?.doGenerateArticle ? (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Polish Article</span>
                      {pipelineProgress?.stages_completed?.includes('polish') ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : project.config?.pipeline?.doPolishArticle ? (
                        <Circle className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <X className="h-4 w-4 text-muted-foreground/50" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Model Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">
                      Model Configuration
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Language Model
                      </span>
                      <Badge variant="secondary" className="text-xs">
                        {project.config?.llm?.model || 'Not configured'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Provider
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {project.config?.llm?.provider || 'Not configured'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">
                        Retriever
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {project.config?.retriever?.type || 'Not configured'}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>

                {/* Statistics */}
                {(project.research || project.article) && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-sm">Statistics</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {project.research && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">
                              Sources Found
                            </span>
                            <span className="text-xs">
                              {project.research.sources.length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">
                              Conversations
                            </span>
                            <span className="text-xs">
                              {project.research.conversations.length}
                            </span>
                          </div>
                        </>
                      )}
                      {project.article && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">
                              Word Count
                            </span>
                            <span className="text-xs">
                              {(project?.metadata as any)?.word_count || 0}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">
                              Sections
                            </span>
                            <span className="text-xs">
                              {project.article.sections.length}
                            </span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">
                              Citations
                            </span>
                            <span className="text-xs">
                              {project.article.citations.length}
                            </span>
                          </div>
                        </>
                      )}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </TabsContent>

          <TabsContent value="article">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Generated Article</CardTitle>
                  {project.content && (
                    <div className="flex items-center space-x-2">
                      <Badge variant="outline">
                        {(project?.metadata as any)?.word_count || 0} words
                      </Badge>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="outline" size="sm">
                            <Download className="mr-2 h-4 w-4" />
                            Export
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem
                            onClick={() => handleExport('markdown')}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            Markdown (.md)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleExport('html')}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            HTML (.html)
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            onClick={() => handleExport('json')}
                          >
                            <FileText className="mr-2 h-4 w-4" />
                            JSON (.json)
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {project.content ? (
                  <div className="space-y-6">
                    <div className="prose prose-gray max-w-none dark:prose-invert">
                      <Markdown content={project.content} />
                    </div>
                    {/* References section */}
                    {(project as any).references &&
                      Object.keys((project as any).references).length > 0 && (
                        <div className="border-t pt-6">
                          <h3 className="mb-4 text-lg font-semibold">
                            References
                          </h3>
                          <div className="space-y-3">
                            {(() => {
                              const urlToIndex =
                                (project as any).references
                                  .url_to_unified_index || {};
                              const urlToInfo =
                                (project as any).references.url_to_info || {};

                              // Create sorted list of references
                              const references = Object.entries(urlToIndex)
                                .map(([url, index]) => ({
                                  index: index as number,
                                  url,
                                  info: urlToInfo[url] || {},
                                }))
                                .sort((a, b) => a.index - b.index);

                              if (references.length > 0) {
                                return references.map(ref => (
                                  <div
                                    key={ref.index}
                                    className="border-l-2 border-muted py-2 pl-4"
                                  >
                                    <div className="flex items-start gap-2">
                                      <span className="min-w-[2rem] text-sm font-medium">
                                        [{ref.index}]
                                      </span>
                                      <div className="flex-1">
                                        <a
                                          href={ref.url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="break-words text-sm text-blue-600 hover:underline"
                                        >
                                          {ref.info.title || ref.url}
                                        </a>
                                        {ref.info.snippet && (
                                          <p className="mt-1 text-xs text-muted-foreground">
                                            {ref.info.snippet.substring(0, 200)}
                                            {ref.info.snippet.length > 200
                                              ? '...'
                                              : ''}
                                          </p>
                                        )}
                                      </div>
                                    </div>
                                  </div>
                                ));
                              } else {
                                return (
                                  <p className="text-sm text-muted-foreground">
                                    No reference details available.
                                  </p>
                                );
                              }
                            })()}
                          </div>
                        </div>
                      )}
                  </div>
                ) : (
                  <div className="py-8 text-center text-muted-foreground">
                    <FileText className="mx-auto mb-4 h-12 w-12 opacity-50" />
                    <p>No article generated yet.</p>
                    <p className="mt-2 text-sm">
                      Run the pipeline to generate an article.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="research">
            <ConversationView projectId={projectId} />
          </TabsContent>

          <TabsContent value="outline">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Article Outline</CardTitle>
                  {isRunning &&
                    pipelineProgress?.stage === 'outline_generation' && (
                      <Badge variant="default" className="animate-pulse">
                        <div className="mr-1 h-2 w-2 animate-pulse rounded-full bg-green-500" />
                        Generating Outline
                      </Badge>
                    )}
                </div>
              </CardHeader>
              <CardContent>
                {project.outline ? (
                  <OutlineEditor
                    outline={project.outline}
                    onChange={async outline => {
                      await updateProject(project.id, { outline });
                    }}
                    onSave={async () => {
                      addNotification({
                        type: 'success',
                        title: 'Outline Saved',
                        message: 'Article outline has been updated',
                        read: false,
                        persistent: false,
                      });
                    }}
                  />
                ) : project.status === 'completed' && project.content ? (
                  <div className="space-y-4">
                    <p className="mb-4 text-sm text-muted-foreground">
                      Article structure extracted from the generated content:
                    </p>
                    <div className="space-y-2">
                      {project.content
                        .split('\n')
                        .filter(line => line.startsWith('#'))
                        .map((heading, index) => {
                          const level = heading.match(/^#+/)?.[0].length || 1;
                          const text = heading.replace(/^#+\s*/, '');
                          return (
                            <div
                              key={index}
                              className="flex items-center space-x-2 py-1"
                              style={{ paddingLeft: `${(level - 1) * 1.5}rem` }}
                            >
                              <div className="h-1.5 w-1.5 rounded-full bg-primary/50" />
                              <span className="text-sm">{text}</span>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-12">
                    <Brain className="mb-4 h-12 w-12 text-muted-foreground" />
                    <h3 className="mb-2 text-lg font-semibold">
                      No Outline Available
                    </h3>
                    <p className="mb-4 text-center text-muted-foreground">
                      Complete the research phase and run outline generation to
                      create the article structure.
                    </p>
                    <Button
                      onClick={handleStartPipeline}
                      disabled={!project.research}
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Generate Outline
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="settings">
            <ConfigurationPanel
              config={
                projectConfig ||
                project.config || {
                  llm: {
                    model: '', // Will be populated from available models
                    provider: 'openai',
                  },
                  retriever: {
                    type: 'tavily',
                  },
                  pipeline: {
                    doResearch: true,
                    doGenerateOutline: true,
                    doGenerateArticle: true,
                    doPolishArticle: true,
                  },
                }
              }
              onChange={(config: StormConfig) => {
                // Update local state when config changes
                setProjectConfig(config);
              }}
              onSave={handleConfigSave}
              onCancel={() => _setIsConfiguring(false)}
              isLoading={loading}
            />
          </TabsContent>
        </Tabs>
      </ResponsiveContainer>
    </AnimatedPage>
  );
}
