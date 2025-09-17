'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { ArticleEditor } from '@/components/storm/ArticleEditor';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useProjectStore, useNotificationStore } from '@/store';
import { GeneratedArticle } from '@/types/storm';
import { AnimatedPage } from '@/utils/animations/AnimatedPage';
import { ResponsiveContainer } from '@/components/ux/ResponsiveContainer';
import {
  ArrowLeft,
  FileText,
  Download,
  Share2,
  Edit3,
  Eye,
  MoreHorizontal,
  BookOpen,
  Quote,
  Hash,
  Clock,
  ExternalLink,
  Printer,
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function ArticlePage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const { currentProject, projects, loading, fetchProject, updateProject } =
    useProjectStore();

  const { addNotification } = useNotificationStore();

  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('article');
  const [showOutline, setShowOutline] = useState(true);

  // Load project on mount
  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
    }
  }, [projectId, fetchProject]);

  const project = currentProject || projects?.find(p => p.id === projectId);
  const article = project?.article;

  const handleSaveArticle = async (updatedArticle: GeneratedArticle) => {
    if (!project) return;

    try {
      await updateProject(project.id, { article: updatedArticle });
      addNotification({
        type: 'success',
        title: 'Article Saved',
        message: 'Your changes have been saved successfully',
        read: false,
        persistent: false,
      });
    } catch (error) {
      addNotification({
        type: 'error',
        title: 'Failed to Save',
        message:
          error instanceof Error ? error.message : 'Unknown error occurred',
        read: false,
        persistent: false,
      });
    }
  };

  const handleExportArticle = (format: 'markdown' | 'html' | 'pdf') => {
    if (!article) return;

    // This would typically call an export service
    addNotification({
      type: 'info',
      title: 'Export Started',
      message: `Exporting article as ${format.toUpperCase()}...`,
      read: false,
      persistent: false,
    });
  };

  const handleShareArticle = () => {
    if (!article) return;

    // Copy article URL to clipboard
    const url = window.location.href;
    navigator.clipboard.writeText(url).then(() => {
      addNotification({
        type: 'success',
        title: 'Link Copied',
        message: 'Article link copied to clipboard',
        read: false,
        persistent: false,
      });
    });
  };

  const handlePrintArticle = () => {
    window.print();
  };

  if (loading) {
    return (
      <AnimatedPage>
        <ResponsiveContainer className="py-6">
          <div className="space-y-4">
            <div className="loading-skeleton h-8 w-64" />
            <div className="loading-skeleton h-4 w-96" />
            <div className="loading-skeleton h-96 w-full" />
          </div>
        </ResponsiveContainer>
      </AnimatedPage>
    );
  }

  if (!project) {
    return (
      <AnimatedPage>
        <ResponsiveContainer className="py-6">
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">Project Not Found</h3>
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

  if (!article) {
    return (
      <AnimatedPage>
        <ResponsiveContainer className="py-6">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => router.push(`/projects/${projectId}`)}
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Project
              </Button>
              <Separator orientation="vertical" className="h-6" />
              <div>
                <h1 className="text-3xl font-bold tracking-tight">Article</h1>
                <p className="text-muted-foreground">{project.title}</p>
              </div>
            </div>
          </div>

          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
              <h3 className="mb-2 text-lg font-semibold">
                No Article Available
              </h3>
              <p className="mb-4 text-center text-muted-foreground">
                The article hasn't been generated yet. Run the STORM pipeline to
                create the article.
              </p>
              <Button onClick={() => router.push(`/projects/${projectId}`)}>
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Project
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
            <Button
              variant="ghost"
              size="sm"
              onClick={() => router.push(`/projects/${projectId}`)}
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Project
            </Button>
            <Separator orientation="vertical" className="h-6" />
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {article.title}
              </h1>
              <p className="text-muted-foreground">{project.title}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* View Mode Toggle */}
            <Button
              variant={isEditing ? 'outline' : 'default'}
              size="sm"
              onClick={() => setIsEditing(!isEditing)}
            >
              {isEditing ? (
                <>
                  <Eye className="mr-2 h-4 w-4" />
                  Preview
                </>
              ) : (
                <>
                  <Edit3 className="mr-2 h-4 w-4" />
                  Edit
                </>
              )}
            </Button>

            {/* More Actions */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleShareArticle}>
                  <Share2 className="mr-2 h-4 w-4" />
                  Share Article
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handlePrintArticle}>
                  <Printer className="mr-2 h-4 w-4" />
                  Print
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => handleExportArticle('markdown')}
                >
                  <Download className="mr-2 h-4 w-4" />
                  Export as Markdown
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportArticle('html')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export as HTML
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => handleExportArticle('pdf')}>
                  <Download className="mr-2 h-4 w-4" />
                  Export as PDF
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Article Metadata */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-6">
                <div className="flex items-center space-x-2">
                  <Hash className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {article.wordCount} words
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <BookOpen className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {article.sections.length} sections
                  </span>
                </div>
                <div className="flex items-center space-x-2">
                  <Quote className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm font-medium">
                    {article.citations.length} citations
                  </span>
                </div>
              </div>
              <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  Last modified{' '}
                  {new Date(article.lastModified).toLocaleDateString()}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Main Content */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Article Content */}
          <div
            className={cn(
              'space-y-4',
              showOutline ? 'lg:col-span-3' : 'lg:col-span-4'
            )}
          >
            <Tabs
              value={activeTab}
              onValueChange={setActiveTab}
              className="space-y-4"
            >
              <TabsList>
                <TabsTrigger value="article">Article</TabsTrigger>
                <TabsTrigger value="summary">Summary</TabsTrigger>
                <TabsTrigger value="citations">Citations</TabsTrigger>
              </TabsList>

              <TabsContent value="article" className="space-y-4">
                <Card>
                  <CardContent className="p-0">
                    <ArticleEditor
                      article={article}
                      onChange={handleSaveArticle}
                      onSave={() => handleSaveArticle(article)}
                      readOnly={!isEditing}
                      showOutline={showOutline}
                      className="min-h-[600px]"
                    />
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="summary" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>Article Summary</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {article.summary ? (
                      <div className="prose prose-sm max-w-none">
                        <p>{article.summary}</p>
                      </div>
                    ) : (
                      <p className="italic text-muted-foreground">
                        No summary available for this article.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="citations" className="space-y-4">
                <Card>
                  <CardHeader>
                    <CardTitle>
                      Citations ({article.citations.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {article.citations.length > 0 ? (
                      <div className="space-y-3">
                        {article.citations.map((citation, index) => (
                          <div
                            key={citation.id}
                            className="rounded-lg border p-3"
                          >
                            <div className="flex items-start justify-between">
                              <div className="flex-1">
                                <p className="text-sm font-medium">
                                  [{index + 1}] {citation.text}
                                </p>
                                <div className="mt-2 flex items-center space-x-2">
                                  <Badge variant="outline" className="text-xs">
                                    {citation.url}
                                  </Badge>
                                  {citation.page && (
                                    <Badge
                                      variant="secondary"
                                      className="text-xs"
                                    >
                                      Page {citation.page}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  window.open(citation.url, '_blank')
                                }
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="italic text-muted-foreground">
                        No citations found for this article.
                      </p>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>
          </div>

          {/* Outline Sidebar */}
          {showOutline && (
            <div className="lg:col-span-1">
              <Card className="sticky top-6">
                <CardHeader className="pb-3">
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-sm">Table of Contents</CardTitle>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowOutline(false)}
                    >
                      <ArrowLeft className="h-4 w-4" />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent className="space-y-2">
                  {article.sections.map(section => (
                    <div
                      key={section.id}
                      className={cn(
                        'cursor-pointer rounded px-2 py-1 text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
                        `ml-${Math.min(section.level - 1, 4) * 2}`
                      )}
                      onClick={() => {
                        // Scroll to section
                        const element = document.getElementById(
                          `section-${section.id}`
                        );
                        if (element) {
                          element.scrollIntoView({ behavior: 'smooth' });
                        }
                      }}
                    >
                      <div className="flex items-center">
                        <span className="flex-1 truncate">{section.title}</span>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>
            </div>
          )}
        </div>

        {/* Floating Action Button for Outline Toggle (when hidden) */}
        {!showOutline && (
          <Button
            className="fixed bottom-6 right-6 rounded-full shadow-lg"
            size="sm"
            onClick={() => setShowOutline(true)}
          >
            <BookOpen className="mr-2 h-4 w-4" />
            Outline
          </Button>
        )}
      </ResponsiveContainer>
    </AnimatedPage>
  );
}
