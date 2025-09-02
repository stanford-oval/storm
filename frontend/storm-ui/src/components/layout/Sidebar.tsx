'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Badge } from '@/components/ui/badge';
import { useUIStore, useProjectStore, usePipelineStore } from '@/store';
import { 
  FileText, 
  Plus, 
  Settings, 
  BarChart3, 
  Users, 
  BookOpen, 
  Zap,
  FolderOpen,
  History,
  HelpCircle,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';

const navigation = [
  {
    name: 'Projects',
    href: '/',
    icon: FolderOpen,
    description: 'Manage your STORM projects'
  },
  {
    name: 'Create Project',
    href: '/projects/new',
    icon: Plus,
    description: 'Start a new article generation'
  },
  {
    name: 'Co-STORM Sessions',
    href: '/sessions',
    icon: Users,
    description: 'Collaborative knowledge curation',
    disabled: true // Will be enabled in phase 3
  },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: BarChart3,
    description: 'Usage and performance metrics'
  },
  {
    name: 'Knowledge Base',
    href: '/knowledge-base',
    icon: BookOpen,
    description: 'Browse generated articles'
  }
];

const secondaryNavigation = [
  {
    name: 'Recent Activity',
    href: '/activity',
    icon: History,
    description: 'View recent actions'
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
    description: 'Configure API keys and preferences'
  },
  {
    name: 'Help & Docs',
    href: '/help',
    icon: HelpCircle,
    description: 'Documentation and tutorials'
  }
];

export function Sidebar() {
  const pathname = usePathname();
  const { sidebarCollapsed, toggleSidebar } = useUIStore();
  const { projects, loading: projectsLoading } = useProjectStore();
  const { runningPipelines } = usePipelineStore();

  const activeProjectsCount = projects?.filter(p => ['researching', 'generating_outline', 'writing_article', 'polishing'].includes(p.status)).length || 0;
  const runningPipelinesCount = Object.keys(runningPipelines).length;

  return (
    <div className={cn(
      "relative flex flex-col bg-card border-r transition-all duration-300",
      sidebarCollapsed ? "w-16" : "w-64"
    )}>
      {/* Header */}
      <div className="flex items-center h-16 px-4 border-b">
        {!sidebarCollapsed && (
          <div className="flex items-center space-x-2">
            <Zap className="h-8 w-8 text-primary" />
            <div>
              <h1 className="text-lg font-bold text-foreground">STORM</h1>
              <p className="text-xs text-muted-foreground">Knowledge Curation</p>
            </div>
          </div>
        )}
        
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className={cn(
            "h-8 w-8 p-0",
            sidebarCollapsed ? "mx-auto" : "ml-auto"
          )}
        >
          {sidebarCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {/* Main Navigation */}
      <nav className="flex-1 p-4 space-y-2">
        <div className="space-y-1">
          {navigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || (item.href !== '/' && pathname.startsWith(item.href));
            const isDisabled = item.disabled;
            
            return (
              <Link
                key={item.name}
                href={isDisabled ? '#' : item.href}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sidebarCollapsed ? "p-2 justify-center" : "p-3",
                  isActive && "bg-accent text-accent-foreground",
                  isDisabled && "opacity-50 cursor-not-allowed hover:bg-transparent"
                )}
                title={sidebarCollapsed ? item.description : undefined}
                onClick={isDisabled ? (e) => e.preventDefault() : undefined}
              >
                <Icon className={cn("h-4 w-4", !sidebarCollapsed && "mr-3")} />
                {!sidebarCollapsed && (
                  <>
                    <span className="flex-1">{item.name}</span>
                    {item.name === 'Projects' && activeProjectsCount > 0 && (
                      <Badge variant="secondary" className="ml-auto">
                        {activeProjectsCount}
                      </Badge>
                    )}
                    {isDisabled && (
                      <Badge variant="outline" className="ml-auto text-xs">
                        Soon
                      </Badge>
                    )}
                  </>
                )}
              </Link>
            );
          })}
        </div>

        {/* Running Pipelines Status */}
        {runningPipelinesCount > 0 && (
          <>
            <Separator className="my-4" />
            <div className={cn(
              "p-3 rounded-lg bg-primary/10 border",
              sidebarCollapsed && "p-2"
            )}>
              <div className="flex items-center">
                <div className="h-2 w-2 bg-primary rounded-full animate-pulse mr-2" />
                {!sidebarCollapsed && (
                  <div>
                    <p className="text-sm font-medium text-primary">
                      {runningPipelinesCount} Running
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Active pipelines
                    </p>
                  </div>
                )}
              </div>
            </div>
          </>
        )}

        <Separator className="my-4" />

        {/* Secondary Navigation */}
        <div className="space-y-1">
          {secondaryNavigation.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href;
            
            return (
              <Link
                key={item.name}
                href={item.href}
                className={cn(
                  "flex items-center rounded-lg text-sm font-medium transition-colors",
                  "hover:bg-accent hover:text-accent-foreground",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  sidebarCollapsed ? "p-2 justify-center" : "p-3",
                  isActive && "bg-accent text-accent-foreground"
                )}
                title={sidebarCollapsed ? item.description : undefined}
              >
                <Icon className={cn("h-4 w-4", !sidebarCollapsed && "mr-3")} />
                {!sidebarCollapsed && <span>{item.name}</span>}
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Footer */}
      <div className="p-4 border-t">
        {!sidebarCollapsed && (
          <div className="space-y-2 text-xs text-muted-foreground">
            <div className="flex justify-between">
              <span>Projects:</span>
              <span>{projectsLoading ? '...' : projects?.length || 0}</span>
            </div>
            <div className="flex justify-between">
              <span>Version:</span>
              <span>1.0.0</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}