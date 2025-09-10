// Import hooks for internal use in composite functions
import { useProject } from './useProjects';
import { usePipeline } from './usePipeline';
import { useResearch } from './useResearch';
import { usePipelineWebSocket } from './useWebSocket';

// API hooks exports
export {
  useProjects,
  useProject,
  useProjectTemplates,
  type UseProjectsOptions,
  type UseProjectsResult,
  type UseProjectOptions,
  type UseProjectResult,
} from './useProjects';

export {
  usePipeline,
  usePipelineLogs,
  usePipelineTemplates,
  usePipelineMetrics,
  type UsePipelineOptions,
  type UsePipelineResult,
  type UsePipelineLogsOptions,
} from './usePipeline';

export {
  useResearch,
  useConversations,
  useSources,
  useResearchAnalytics,
  type UseResearchOptions,
  type UseResearchResult,
  type UseConversationsOptions,
  type UseSourcesOptions,
} from './useResearch';

export {
  useWebSocket,
  usePipelineWebSocket,
  useSessionWebSocket,
  useNotificationWebSocket,
  useAnalyticsWebSocket,
  useEventWebSocket,
  useMultiWebSocket,
  type UseWebSocketOptions,
  type UseWebSocketResult,
  type WebSocketEventHandlers,
} from './useWebSocket';

// Additional hooks that would be implemented
export { useConfig } from './useConfig';
export { useSession } from './useSession';
export { useExport } from './useExport';
export { useAnalytics } from './useAnalytics';
export { useApiKeys } from './useApiKeys';

// Composite hooks for common patterns
export function useProjectWithPipeline(projectId: string) {
  const project = useProject({ projectId });
  const pipeline = usePipeline({ projectId });

  return {
    ...project,
    pipeline: pipeline.status,
    isRunning: pipeline.isRunning,
    progress: pipeline.progress,
    startPipeline: pipeline.startPipeline,
    stopPipeline: pipeline.stopPipeline,
    pausePipeline: pipeline.pausePipeline,
    resumePipeline: pipeline.resumePipeline,
  };
}

export function useProjectWithResearch(projectId: string) {
  const project = useProject({ projectId });
  const research = useResearch({ projectId });

  return {
    ...project,
    research: research.research,
    searchResults: research.search,
    addSource: research.addCustomSource,
    updateSource: research.updateSource,
    deleteSource: research.deleteSource,
    rateSource: research.rateSource,
  };
}

// Hook for managing multiple projects
// Note: This hook is commented out as it violates React Hook rules
// (hooks cannot be called inside loops/callbacks)
// TODO: Refactor to use a different pattern if needed
/*
export function useMultipleProjects(projectIds: string[]) {
  // This pattern violates React Hook rules - hooks must be called unconditionally
  // Consider using a single hook with multiple IDs or a different state management approach
  const projects = projectIds.map(id => useProject({ projectId: id }));
  
  const loading = projects.some(p => p.loading);
  const errors = projects.map(p => p.error).filter(Boolean);
  const allProjects = projects.map(p => p.project).filter(Boolean);
  
  return {
    projects: allProjects,
    loading,
    errors,
    hasErrors: errors.length > 0,
    refetchAll: () => Promise.all(projects.map(p => p.refetch())),
  };
}
*/

// Hook for real-time project updates
export function useRealTimeProject(projectId: string) {
  const project = useProject({ projectId });
  const pipeline = usePipelineWebSocket(projectId, update => {
    // Handle pipeline updates
    console.log('Pipeline update:', update);
  });

  return {
    ...project,
    isConnected: pipeline.isConnected,
    connectionError: pipeline.error,
  };
}

// Hook for project collaboration
export function useProjectCollaboration(projectId: string) {
  const project = useProject({ projectId });
  // This would integrate with session management for collaborative features

  return {
    ...project,
    // Add collaboration-specific methods here
  };
}
