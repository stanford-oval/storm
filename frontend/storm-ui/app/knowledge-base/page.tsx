'use client';

import { logger } from '@/utils/logger';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  FileText,
  Tag,
  Download,
  Eye,
  BookOpen,
  Clock,
  ChevronRight,
  Grid,
  List,
  CheckCircle,
} from 'lucide-react';
import { useProjectStore } from '@/store';
// import { cn } from '@/lib/utils'; // Removed unused import

type ViewMode = 'grid' | 'list';
type SortBy = 'date' | 'title' | 'words' | 'status';

export default function KnowledgeBasePage() {
  const router = useRouter();
  const { projects, loadProjects } = useProjectStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [selectedStatus, setSelectedStatus] = useState<string>('all');
  const [sortBy, setSortBy] = useState<SortBy>('date');
  const [viewMode, setViewMode] = useState<ViewMode>('grid');

  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Extract unique tags from all projects
  const allTags = React.useMemo(() => {
    const tagSet = new Set<string>();
    projects?.forEach(project => {
      if (project.topic) {
        // Extract potential tags from topic (simple word extraction)
        const words = project.topic.toLowerCase().split(/\s+/);
        words.forEach((word: string) => {
          if (word.length > 3) tagSet.add(word);
        });
      }
    });
    return Array.from(tagSet).sort();
  }, [projects]);

  // Filter and sort projects
  const filteredProjects = React.useMemo(() => {
    let filtered = projects || [];

    // Filter by search query
    if (searchQuery) {
      filtered = filtered.filter(
        project =>
          project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.topic?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          project.content?.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }

    // Filter by status
    if (selectedStatus !== 'all') {
      filtered = filtered.filter(project => project.status === selectedStatus);
    }

    // Filter by tags
    if (selectedTags.length > 0) {
      filtered = filtered.filter(project => {
        const projectText =
          `${project.title} ${project.topic || ''}`.toLowerCase();
        return selectedTags.some(tag => projectText.includes(tag));
      });
    }

    // Sort
    filtered = [...filtered].sort((a, b) => {
      switch (sortBy) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'words':
          return (b.word_count || 0) - (a.word_count || 0);
        case 'status':
          return a.status.localeCompare(b.status);
        case 'date':
        default:
          return (
            new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          );
      }
    });

    return filtered;
  }, [projects, searchQuery, selectedStatus, selectedTags, sortBy]);

  const completedProjects = filteredProjects.filter(
    p => p.status === 'completed'
  );
  const inProgressProjects = filteredProjects.filter(p =>
    [
      'researching',
      'generating_outline',
      'writing_article',
      'polishing',
    ].includes(p.status)
  );

  const toggleTag = (tag: string) => {
    setSelectedTags(prev =>
      prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]
    );
  };

  const exportProject = (projectId: string, format: 'md' | 'html' | 'pdf') => {
    // TODO: Implement export functionality
    logger.log(`Exporting project ${projectId} as ${format}`);
  };

  const ProjectCard = ({ project }: { project: any }) => (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-lg"
      onClick={() => router.push(`/projects/${project.id}`)}
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div>
            <CardTitle className="line-clamp-1 text-lg">
              {project.title}
            </CardTitle>
            <CardDescription className="mt-1">
              {new Date(project.createdAt).toLocaleDateString()}
            </CardDescription>
          </div>
          <Badge
            variant={project.status === 'completed' ? 'default' : 'secondary'}
          >
            {project.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <p className="mb-3 line-clamp-3 text-sm text-muted-foreground">
          {project.content?.substring(0, 200) ||
            project.config?.topic ||
            'No content available'}
        </p>
        <div className="flex items-center justify-between text-sm">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <FileText className="h-3 w-3" />
              {project.word_count?.toLocaleString() || 0} words
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {project.sections?.length || 0} sections
            </span>
          </div>
          <div className="flex gap-1">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={e => {
                e.stopPropagation();
                router.push(`/projects/${project.id}`);
              }}
            >
              <Eye className="h-3 w-3" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={e => {
                e.stopPropagation();
                exportProject(project.id, 'md');
              }}
            >
              <Download className="h-3 w-3" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );

  const ProjectListItem = ({ project }: { project: any }) => (
    <Card
      className="cursor-pointer transition-shadow hover:shadow-md"
      onClick={() => router.push(`/projects/${project.id}`)}
    >
      <CardContent className="flex items-center justify-between p-4">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-muted-foreground" />
            <div className="flex-1">
              <h3 className="font-semibold">{project.title}</h3>
              <p className="text-sm text-muted-foreground">
                {new Date(project.createdAt).toLocaleDateString()} •{' '}
                {project.word_count?.toLocaleString() || 0} words
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge
            variant={project.status === 'completed' ? 'default' : 'secondary'}
          >
            {project.status}
          </Badge>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardContent>
    </Card>
  );

  return (
    <div className="container mx-auto space-y-6 py-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Knowledge Base</h1>
          <p className="text-muted-foreground">
            Browse and search all your generated articles
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('grid')}
          >
            <Grid className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="icon"
            onClick={() => setViewMode('list')}
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col gap-4">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
                <Input
                  placeholder="Search articles..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
              <Select value={selectedStatus} onValueChange={setSelectedStatus}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="All Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="researching">Researching</SelectItem>
                  <SelectItem value="generating_outline">
                    Generating Outline
                  </SelectItem>
                  <SelectItem value="writing_article">
                    Writing Article
                  </SelectItem>
                  <SelectItem value="polishing">Polishing</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
              <Select
                value={sortBy}
                onValueChange={v => setSortBy(v as SortBy)}
              >
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="Sort by" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="date">Date</SelectItem>
                  <SelectItem value="title">Title</SelectItem>
                  <SelectItem value="words">Word Count</SelectItem>
                  <SelectItem value="status">Status</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {allTags.length > 0 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-sm text-muted-foreground">
                  <Tag className="h-3 w-3" />
                  Tags:
                </span>
                {allTags.slice(0, 10).map(tag => (
                  <Badge
                    key={tag}
                    variant={selectedTags.includes(tag) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleTag(tag)}
                  >
                    {tag}
                  </Badge>
                ))}
                {allTags.length > 10 && (
                  <span className="text-sm text-muted-foreground">
                    +{allTags.length - 10} more
                  </span>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Articles</p>
                <p className="text-2xl font-bold">{filteredProjects.length}</p>
              </div>
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Completed</p>
                <p className="text-2xl font-bold">{completedProjects.length}</p>
              </div>
              <CheckCircle className="h-8 w-8 text-green-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">In Progress</p>
                <p className="text-2xl font-bold">
                  {inProgressProjects.length}
                </p>
              </div>
              <Clock className="h-8 w-8 text-blue-500" />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Words</p>
                <p className="text-2xl font-bold">
                  {filteredProjects
                    .reduce((sum, p) => sum + (p.word_count || 0), 0)
                    .toLocaleString()}
                </p>
              </div>
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Content Tabs */}
      <Tabs defaultValue="all" className="space-y-4">
        <TabsList>
          <TabsTrigger value="all">
            All Articles ({filteredProjects.length})
          </TabsTrigger>
          <TabsTrigger value="completed">
            Completed ({completedProjects.length})
          </TabsTrigger>
          <TabsTrigger value="in-progress">
            In Progress ({inProgressProjects.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {filteredProjects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProjects.map(project => (
                <ProjectListItem key={project.id} project={project} />
              ))}
            </div>
          )}
          {filteredProjects.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-1 text-lg font-medium">No articles found</p>
                <p className="text-sm text-muted-foreground">
                  Try adjusting your search or filters
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="completed">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {completedProjects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {completedProjects.map(project => (
                <ProjectListItem key={project.id} project={project} />
              ))}
            </div>
          )}
          {completedProjects.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <CheckCircle className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-1 text-lg font-medium">
                  No completed articles
                </p>
                <p className="text-sm text-muted-foreground">
                  Complete some articles to see them here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="in-progress">
          {viewMode === 'grid' ? (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {inProgressProjects.map(project => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          ) : (
            <div className="space-y-2">
              {inProgressProjects.map(project => (
                <ProjectListItem key={project.id} project={project} />
              ))}
            </div>
          )}
          {inProgressProjects.length === 0 && (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Clock className="mb-4 h-12 w-12 text-muted-foreground" />
                <p className="mb-1 text-lg font-medium">
                  No articles in progress
                </p>
                <p className="text-sm text-muted-foreground">
                  Start generating an article to see progress here
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
