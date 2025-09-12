'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ProjectCard } from '@/components/storm/ProjectCard';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
// import { Badge } from '@/components/ui/badge'; // Removed unused import
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import { useProjectStore, useUIStore, usePipelineStore } from '@/store';
import { StormProject, ProjectStatus } from '@/types/storm';
import { AnimatedPage } from '@/utils/animations/AnimatedPage';
import { ResponsiveContainer } from '@/components/ux/ResponsiveContainer';
import { RecentActivity } from '@/components/storm/RecentActivity';
import { PaginationControls } from '@/components/ui/pagination-controls';
import {
  Plus,
  Search,
  Filter,
  FileText,
  CheckCircle,
  AlertCircle,
  TrendingUp,
  Activity,
} from 'lucide-react';
import { cn } from '@/lib/utils';

// Filter and sort options
const STATUS_FILTERS: {
  value: ProjectStatus | 'all';
  label: string;
  color: string;
}[] = [
  { value: 'all', label: 'All Projects', color: 'bg-slate-100' },
  { value: 'draft', label: 'Draft', color: 'bg-gray-100' },
  { value: 'researching', label: 'Researching', color: 'bg-blue-100' },
  { value: 'generating_outline', label: 'Outlining', color: 'bg-purple-100' },
  { value: 'writing_article', label: 'Writing', color: 'bg-orange-100' },
  { value: 'polishing', label: 'Polishing', color: 'bg-yellow-100' },
  { value: 'completed', label: 'Completed', color: 'bg-green-100' },
  { value: 'failed', label: 'Failed', color: 'bg-red-100' },
];

const SORT_OPTIONS = [
  { value: 'updatedAt', label: 'Last Updated' },
  { value: 'createdAt', label: 'Created Date' },
  { value: 'title', label: 'Title' },
  { value: 'status', label: 'Status' },
];

export default function ProjectsPage() {
  const router = useRouter();
  const {
    projects,
    loading,
    error,
    loadProjects,
    deleteProject,
    duplicateProject,
    selectedProjects,
    toggleProjectSelection: _toggleProjectSelection,
    clearSelection,
  } = useProjectStore();

  const { theme: _theme } = useUIStore();
  const { runningPipelines: _runningPipelines } = usePipelineStore();

  // Local state for filtering and search
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'all'>(
    'all'
  );
  const [sortBy, setSortBy] = useState<string>('updatedAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(20); // Show 20 projects per page

  // Handle items per page change
  const handleItemsPerPageChange = (newItemsPerPage: number) => {
    setItemsPerPage(newItemsPerPage);
    setCurrentPage(1); // Reset to first page when changing items per page
  };

  // Load projects on mount
  useEffect(() => {
    loadProjects();
  }, [loadProjects]);

  // Filter and sort projects
  const filteredAndSortedProjects = React.useMemo(() => {
    if (!projects) return [];

    const filtered = projects.filter(project => {
      const matchesSearch =
        searchQuery === '' ||
        project.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        project.topic.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (project.description
          ?.toLowerCase()
          .includes(searchQuery.toLowerCase()) ??
          false);

      const matchesStatus =
        statusFilter === 'all' || project.status === statusFilter;

      return matchesSearch && matchesStatus;
    });

    // Sort projects
    filtered.sort((a, b) => {
      let comparison = 0;

      switch (sortBy) {
        case 'title':
          comparison = a.title.localeCompare(b.title);
          break;
        case 'status':
          comparison = a.status.localeCompare(b.status);
          break;
        case 'createdAt':
          comparison =
            new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
          break;
        case 'updatedAt':
        default:
          comparison =
            new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
          break;
      }

      return sortOrder === 'desc' ? -comparison : comparison;
    });

    return filtered;
  }, [projects, searchQuery, statusFilter, sortBy, sortOrder]);

  // Paginate projects
  const paginatedProjects = React.useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedProjects.slice(startIndex, endIndex);
  }, [filteredAndSortedProjects, currentPage, itemsPerPage]);

  // Calculate pagination info
  const totalPages = Math.ceil(filteredAndSortedProjects.length / itemsPerPage);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, statusFilter, sortBy, sortOrder]);

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!projects) return { total: 0, active: 0, completed: 0, failed: 0 };

    return {
      total: projects.length,
      active: projects.filter(p =>
        [
          'researching',
          'generating_outline',
          'writing_article',
          'polishing',
        ].includes(p.status)
      ).length,
      completed: projects.filter(p => p.status === 'completed').length,
      failed: projects.filter(p => p.status === 'failed').length,
    };
  }, [projects]);

  // Handle project actions
  const handleSelectProject = (project: StormProject) => {
    router.push(`/projects/${project.id}`);
  };

  const handleDeleteProject = async (projectId: string) => {
    if (
      confirm(
        'Are you sure you want to delete this project? This action cannot be undone.'
      )
    ) {
      await deleteProject(projectId);
    }
  };

  const handleDuplicateProject = async (project: StormProject) => {
    await duplicateProject(project);
  };

  const handleCreateProject = () => {
    router.push('/projects/new');
  };

  if (error) {
    return (
      <AnimatedPage>
        <ResponsiveContainer>
          <div className="flex h-96 items-center justify-center">
            <Card className="w-full max-w-md">
              <CardHeader>
                <CardTitle className="flex items-center text-destructive">
                  <AlertCircle className="mr-2 h-5 w-5" />
                  Error Loading Projects
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="mb-4 text-muted-foreground">{error}</p>
                <Button onClick={() => loadProjects()}>Try Again</Button>
              </CardContent>
            </Card>
          </div>
        </ResponsiveContainer>
      </AnimatedPage>
    );
  }

  return (
    <AnimatedPage>
      <ResponsiveContainer className="space-y-6 py-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground">
              Manage your STORM knowledge curation projects
            </p>
          </div>
          <Button onClick={handleCreateProject} className="btn-primary">
            <Plus className="mr-2 h-4 w-4" />
            New Project
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                Total Projects
              </CardTitle>
              <FileText className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.total}</div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active</CardTitle>
              <Activity className="h-4 w-4 text-blue-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-blue-600">
                {stats.active}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Completed</CardTitle>
              <CheckCircle className="h-4 w-4 text-green-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-green-600">
                {stats.completed}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Failed</CardTitle>
              <AlertCircle className="h-4 w-4 text-red-600" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-red-600">
                {stats.failed}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters, Search and Pagination - All in one row */}
        <div className="flex flex-col items-start justify-between gap-4 xl:flex-row xl:items-center">
          {/* Left side: Search */}
          <div className="flex min-w-0 flex-1 items-center space-x-2">
            <div className="relative max-w-sm flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input
                placeholder="Search projects..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>

          {/* Middle: Pagination Controls */}
          {filteredAndSortedProjects.length > 0 && (
            <div className="flex items-center">
              <PaginationControls
                currentPage={currentPage}
                totalPages={totalPages}
                totalItems={filteredAndSortedProjects.length}
                itemsPerPage={itemsPerPage}
                onPageChange={setCurrentPage}
                onItemsPerPageChange={handleItemsPerPageChange}
                showItemsPerPage={true}
              />
            </div>
          )}

          {/* Right side: Filters and Sort */}
          <div className="flex items-center space-x-2">
            <Select
              value={statusFilter}
              onValueChange={value =>
                setStatusFilter(value as ProjectStatus | 'all')
              }
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="mr-2 h-4 w-4" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                {STATUS_FILTERS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center">
                      <div
                        className={cn(
                          'mr-2 h-2 w-2 rounded-full',
                          option.color
                        )}
                      />
                      {option.label}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                {SORT_OPTIONS.map(option => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
            >
              <TrendingUp
                className={cn('h-4 w-4', sortOrder === 'asc' && 'rotate-180')}
              />
            </Button>
          </div>
        </div>

        <Separator />

        {/* Main Content with Recent Activity */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Projects Grid */}
          <div className="space-y-4 lg:col-span-2">
            {loading ? (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Card key={i}>
                    <CardHeader>
                      <Skeleton className="h-6 w-3/4" />
                      <Skeleton className="mt-2 h-4 w-1/2" />
                    </CardHeader>
                    <CardContent>
                      <Skeleton className="mb-2 h-4 w-full" />
                      <Skeleton className="mb-2 h-4 w-full" />
                      <Skeleton className="h-4 w-2/3" />
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : paginatedProjects.length === 0 &&
              filteredAndSortedProjects.length === 0 ? (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
                  <h3 className="mb-2 text-lg font-semibold">
                    No projects found
                  </h3>
                  <p className="mb-4 text-center text-muted-foreground">
                    {searchQuery || statusFilter !== 'all'
                      ? 'Try adjusting your search or filters'
                      : 'Get started by creating your first STORM project'}
                  </p>
                  {!searchQuery && statusFilter === 'all' && (
                    <Button onClick={handleCreateProject}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Project
                    </Button>
                  )}
                </CardContent>
              </Card>
            ) : (
              <>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {paginatedProjects.map(project => (
                    <ProjectCard
                      key={project.id}
                      project={project}
                      onSelect={handleSelectProject}
                      onDelete={handleDeleteProject}
                      onDuplicate={handleDuplicateProject}
                      className="animate-fade-in"
                    />
                  ))}
                </div>

                {/* Bottom Pagination Controls */}
                {filteredAndSortedProjects.length > 0 && (
                  <div className="mt-6">
                    <PaginationControls
                      currentPage={currentPage}
                      totalPages={totalPages}
                      totalItems={filteredAndSortedProjects.length}
                      itemsPerPage={itemsPerPage}
                      onPageChange={setCurrentPage}
                      onItemsPerPageChange={handleItemsPerPageChange}
                      showItemsPerPage={false}
                      className="justify-center"
                    />
                  </div>
                )}
              </>
            )}
          </div>

          {/* Recent Activity Sidebar */}
          <div className="lg:col-span-1">
            <RecentActivity maxItems={8} />
          </div>
        </div>

        {/* Bulk Actions */}
        {selectedProjects.length > 0 && (
          <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 transform">
            <Card className="px-4 py-2 shadow-lg">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium">
                  {selectedProjects.length} selected
                </span>
                <Button size="sm" variant="outline" onClick={clearSelection}>
                  Clear
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    if (
                      confirm(
                        `Delete ${selectedProjects.length} selected projects?`
                      )
                    ) {
                      selectedProjects.forEach(id => deleteProject(id));
                      clearSelection();
                    }
                  }}
                >
                  Delete Selected
                </Button>
              </div>
            </Card>
          </div>
        )}
      </ResponsiveContainer>
    </AnimatedPage>
  );
}
