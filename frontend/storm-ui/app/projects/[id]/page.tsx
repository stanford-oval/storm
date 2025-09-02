'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PipelineProgress } from '@/components/storm/PipelineProgress';
import { ConfigurationPanel } from '@/components/storm/ConfigurationPanel';
import { ResearchView } from '@/components/storm/ResearchView';
import { OutlineEditor } from '@/components/storm/OutlineEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Markdown } from '@/components/ui/markdown';
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectStore, usePipelineStore, useNotificationStore } from '@/store';
import { StormProject, StormConfig } from '@/types/storm';
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
  Wand2,
  Download,
  Share2,
  Copy,
  Trash2,
  Edit3,
  Eye,
  AlertCircle,
  CheckCircle,
  Clock,
  Activity
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { getProjectStatusIcon, getProjectStatusColor, getProjectStatusLabel } from '@/utils/status';

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
    deleteProject,
    duplicateProject 
  } = useProjectStore();
  
  const { 
    startPipeline,
    cancelPipeline, 
    runningPipelines,
    getPipelineExecution,
    updatePipelineProgress,
    archivePipeline
  } = usePipelineStore();
  
  const { addNotification } = useNotificationStore();

  const [activeTab, setActiveTab] = useState<string>('overview');
  const [isConfiguring, setIsConfiguring] = useState(false);

  // Load project on mount
  useEffect(() => {
    if (projectId) {
      loadProject(projectId);
    }
  }, [projectId, loadProject]);

  const project = currentProject || projects?.find(p => p.id === projectId);
  const runningPipeline = Object.values(runningPipelines).find(p => p.projectId === projectId);
  const isRunning = !!runningPipeline;
  const progress = runningPipeline?.progress?.overall || project?.progress || 0;

  // Poll for pipeline progress updates
  useEffect(() => {
    if (!projectId || !isRunning) return;
    
    const checkProgress = async () => {
      try {
        // Get pipeline status from backend
        const response = await fetch(`http://localhost:8000/api/pipeline/${projectId}/status`);
        if (response.ok) {
          const status = await response.json();
          
          // Update progress in store if pipeline is running
          if (status.is_running && status.progress) {
            updatePipelineProgress(projectId, {
              stage: status.progress.stage || 'running',
              stageProgress: status.progress.stage_progress || 0,
              overallProgress: status.progress.overall_progress || 0,
              startTime: new Date(status.progress.start_time || Date.now()),
              currentTask: status.progress.current_task,
              errors: status.progress.errors
            });
          }
          
          // If pipeline completed, reload the full project
          if (!status.is_running && runningPipeline) {
            await loadProject(projectId);
            // Archive the completed pipeline
            if (runningPipeline.status !== 'running') {
              archivePipeline(runningPipeline.id);
            }
          }
        }
      } catch (error) {
        console.error('Error checking pipeline status:', error);
      }
    };
    
    // Initial check
    checkProgress();
    
    // Poll every 2 seconds
    const interval = setInterval(checkProgress, 2000);
    
    return () => clearInterval(interval);
  }, [projectId, isRunning, runningPipeline, loadProject, updatePipelineProgress, archivePipeline]);

  // Handle pipeline actions
  const handleStartPipeline = async () => {
    if (!project) return;
    
    try {
      await startPipeline(project.id, project.config || {});
      addNotification({
        type: 'success',
        title: 'Pipeline Started',
        message: `STORM pipeline started for "${project.title || 'Untitled Project'}"`,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to Start Pipeline',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
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
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to Cancel Pipeline',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleConfigSave = async (config: StormConfig) => {
    if (!project) return;
    
    try {
      await updateProject({ id: project.id, config });
      setIsConfiguring(false);
      addNotification({
        type: 'success',
        title: 'Configuration Updated',
        message: 'Project configuration has been saved',
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to Update Configuration',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
      });
    }
  };

  const handleDeleteProject = async () => {
    if (!project) return;
    
    if (confirm(`Are you sure you want to delete "${project.title || 'Untitled Project'}"? This action cannot be undone.`)) {
      try {
        await deleteProject(project.id);
        addNotification({
          type: 'success',
          title: 'Project Deleted',
          message: `"${project.title || 'Untitled Project'}" has been deleted`,
        });
        router.push('/');
      } catch (error) {
        addNotification({
          type: 'error',
          title: 'Failed to Delete Project',
          message: error instanceof Error ? error.message : 'Unknown error occurred',
        });
      }
    }
  };

  const handleDuplicateProject = async () => {
    if (!project) return;
    
    try {
      const newProject = await duplicateProject(project.id, `${project.title || 'Untitled Project'} (Copy)`);
      addNotification({
        type: 'success',
        title: 'Project Duplicated',
        message: `Copy created successfully`,
      });
      router.push(`/projects/${newProject.id}`);
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to Duplicate Project',
        message: error instanceof Error ? error.message : 'Unknown error occurred',
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
              <AlertCircle className="h-12 w-12 text-destructive mb-4" />
              <h3 className="text-lg font-semibold mb-2">Project Not Found</h3>
              <p className="text-muted-foreground text-center mb-4">
                {error || 'The requested project could not be found.'}
              </p>
              <Button onClick={() => router.push('/')}>
                <ArrowLeft className="h-4 w-4 mr-2" />
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
      <ResponsiveContainer className="py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={() => router.push('/')}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Projects
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <div className="flex items-center space-x-3">
                <h1 className="text-3xl font-bold tracking-tight">{project.title || 'Untitled Project'}</h1>
                <Badge className={cn("text-xs", getProjectStatusColor(project.status))}>
                  <div className="flex items-center space-x-1">
                    {getProjectStatusIcon(project.status)}
                    <span className="capitalize">{getProjectStatusLabel(project.status)}</span>
                  </div>
                </Badge>
              </div>
              <p className="text-muted-foreground">{project.topic || 'No topic specified'}</p>
              {project.description && (
                <p className="text-sm text-muted-foreground mt-1">{project.description}</p>
              )}
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Pipeline Controls */}
            {!isRunning ? (
              <Button onClick={handleStartPipeline} className="btn-primary">
                <Play className="h-4 w-4 mr-2" />
                Run Pipeline
              </Button>
            ) : (
              <Button onClick={handleStopPipeline} variant="destructive">
                <Square className="h-4 w-4 mr-2" />
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
                <DropdownMenuItem onClick={() => setIsConfiguring(true)}>
                  <Settings className="h-4 w-4 mr-2" />
                  Configure
                </DropdownMenuItem>
                {project.article && (
                  <DropdownMenuItem onClick={() => router.push(`/projects/${project.id}/article`)}>
                    <Eye className="h-4 w-4 mr-2" />
                    View Article
                  </DropdownMenuItem>
                )}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDuplicateProject}>
                  <Copy className="h-4 w-4 mr-2" />
                  Duplicate
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Share2 className="h-4 w-4 mr-2" />
                  Share
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Download className="h-4 w-4 mr-2" />
                  Export
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleDeleteProject} className="text-destructive">
                  <Trash2 className="h-4 w-4 mr-2" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Pipeline Progress */}
        {(isRunning || progress) && (
          <Card>
            <CardContent className="pt-6">
              <PipelineProgress
                progress={progress!}
                showDetails={true}
                onCancel={isRunning ? handleStopPipeline : undefined}
              />
            </CardContent>
          </Card>
        )}

        {/* Main Content Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="grid w-full grid-cols-5">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="article">Article</TabsTrigger>
            <TabsTrigger value="research">Research</TabsTrigger>
            <TabsTrigger value="outline">Outline</TabsTrigger>
            <TabsTrigger value="settings">Settings</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Main Info */}
              <div className="lg:col-span-2 space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Project Information</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <h4 className="font-semibold text-sm text-muted-foreground">Topic</h4>
                      <p className="mt-1">{project.topic || 'No topic specified'}</p>
                    </div>
                    {project.description && (
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground">Description</h4>
                        <p className="mt-1 text-muted-foreground">{project.description}</p>
                      </div>
                    )}
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground">Created</h4>
                        <p className="mt-1">{new Date(project.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div>
                        <h4 className="font-semibold text-sm text-muted-foreground">Last Updated</h4>
                        <p className="mt-1">{new Date(project.updatedAt).toLocaleDateString()}</p>
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
                      <Button variant="outline" className="justify-start" onClick={() => setActiveTab('research')}>
                        <Search className="h-4 w-4 mr-2" />
                        View Research
                      </Button>
                      <Button variant="outline" className="justify-start" onClick={() => setActiveTab('outline')}>
                        <Brain className="h-4 w-4 mr-2" />
                        Edit Outline
                      </Button>
                      {project.article && (
                        <>
                          <Button variant="outline" className="justify-start" onClick={() => router.push(`/projects/${project.id}/article`)}>
                            <FileText className="h-4 w-4 mr-2" />
                            View Article
                          </Button>
                          <Button variant="outline" className="justify-start">
                            <Download className="h-4 w-4 mr-2" />
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
                    <CardTitle className="text-sm">Pipeline Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Research</span>
                      {project.config?.pipeline?.doResearch ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-muted" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Generate Outline</span>
                      {project.config?.pipeline?.doGenerateOutline ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-muted" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Write Article</span>
                      {project.config?.pipeline?.doGenerateArticle ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-muted" />
                      )}
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Polish Article</span>
                      {project.config?.pipeline?.doPolishArticle ? (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      ) : (
                        <div className="h-4 w-4 rounded-full bg-muted" />
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Model Info */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-sm">Model Configuration</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2">
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Language Model</span>
                      <Badge variant="secondary" className="text-xs">
                        {project.config?.llm?.model || 'Not configured'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Provider</span>
                      <Badge variant="outline" className="text-xs">
                        {project.config?.llm?.provider || 'Not configured'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-xs text-muted-foreground">Retriever</span>
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
                            <span className="text-xs text-muted-foreground">Sources Found</span>
                            <span className="text-xs">{project.research.sources.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Conversations</span>
                            <span className="text-xs">{project.research.conversations.length}</span>
                          </div>
                        </>
                      )}
                      {project.article && (
                        <>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Word Count</span>
                            <span className="text-xs">{project.article.wordCount}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Sections</span>
                            <span className="text-xs">{project.article.sections.length}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-xs text-muted-foreground">Citations</span>
                            <span className="text-xs">{project.article.citations.length}</span>
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
                <CardTitle>Generated Article</CardTitle>
              </CardHeader>
              <CardContent>
                {project.content ? (
                  <div className="max-w-none">
                    <Markdown content={project.content} />
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>No article generated yet.</p>
                    <p className="text-sm mt-2">Run the pipeline to generate an article.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="research">
            {project.research ? (
              <ResearchView
                research={project.research}
                showFilters={true}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Search className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Research Data</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Run the pipeline to start the research phase and gather information about your topic.
                  </p>
                  <Button onClick={handleStartPipeline}>
                    <Play className="h-4 w-4 mr-2" />
                    Start Research
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="outline">
            {project.outline ? (
              <OutlineEditor
                outline={project.outline}
                onChange={async (outline) => {
                  await updateProject({ id: project.id, outline });
                }}
                onSave={async () => {
                  addNotification({
                    type: 'success',
                    title: 'Outline Saved',
                    message: 'Article outline has been updated',
                  });
                }}
              />
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Brain className="h-12 w-12 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Outline Available</h3>
                  <p className="text-muted-foreground text-center mb-4">
                    Complete the research phase and run outline generation to create the article structure.
                  </p>
                  <Button onClick={handleStartPipeline} disabled={!project.research}>
                    <Play className="h-4 w-4 mr-2" />
                    Generate Outline
                  </Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="settings">
            <ConfigurationPanel
              config={project.config}
              onChange={(config) => {
                // Update local state immediately for responsive UI
                // Note: This doesn't save to backend until handleConfigSave is called
              }}
              onSave={handleConfigSave}
              onCancel={() => setIsConfiguring(false)}
              isLoading={loading}
            />
          </TabsContent>
        </Tabs>
      </ResponsiveContainer>
    </AnimatedPage>
  );
}