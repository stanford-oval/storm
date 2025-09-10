// Main store exports - comprehensive state management for STORM UI
export * from './types';

// Store slices
export * from './slices/authStore';
export * from './slices/projectStore';
export * from './slices/pipelineStore';
export * from './slices/researchStore';
export * from './slices/sessionStore';
export * from './slices/uiStore';
export * from './slices/notificationStore';
export * from './slices/debugStore';

// Middleware
export * from './middleware/persist';
export * from './middleware/devtools';
export * from './middleware/immer';
export * from './middleware/subscriptions';

// Utilities
export * from './utils';

// Contexts
export * from './contexts';

// Re-export commonly used hooks for convenience
export {
  // Auth hooks
  useAuth,
  useAuthUser,
  useAuthStatus,
  useTheme as useAuthTheme,

  // Project hooks
  useProjects,
  useCurrentProject,
  useProjectsList,
  useSelectedProjects,

  // Pipeline hooks
  usePipeline,
  useRunningPipelines,
  useGlobalProgress,
  useCanCancelPipeline,

  // Research hooks
  useResearch,
  useCurrentResearch,
  useActiveConversations,
  useResearchSources,

  // Session hooks (Co-STORM)
  useSession,
  useCurrentSession,
  useActiveParticipants,
  useMindMap,

  // UI hooks
  useUI,
  useTheme,
  useEffectiveTheme,
  useSidebarCollapsed,

  // Notification hooks
  useNotifications,
  useUnreadCount,
  useSuccessNotifications,
  useErrorNotifications,
} from './slices';

// Re-export context hooks
export {
  useTheme as useThemeContext,
  useConfig,
  useWebSocket,
  useStoreProvider,
} from './contexts';

// Store configuration and setup utilities
import { useAuthStore } from './slices/authStore';
import { useProjectStore } from './slices/projectStore';
import { usePipelineStore } from './slices/pipelineStore';
import { useResearchStore } from './slices/researchStore';
import { useSessionStore } from './slices/sessionStore';
import { useUIStore } from './slices/uiStore';
import { useNotificationStore } from './slices/notificationStore';
import { useDebugStore } from './slices/debugStore';

// Store registry for debugging and management
export const storeRegistry = {
  auth: useAuthStore,
  project: useProjectStore,
  pipeline: usePipelineStore,
  research: useResearchStore,
  session: useSessionStore,
  ui: useUIStore,
  notification: useNotificationStore,
  debug: useDebugStore,
} as const;

// Store names for reference
export const STORE_NAMES = {
  AUTH: 'storm-auth-store',
  PROJECT: 'storm-project-store',
  PIPELINE: 'storm-pipeline-store',
  RESEARCH: 'storm-research-store',
  SESSION: 'storm-session-store',
  UI: 'storm-ui-store',
  NOTIFICATION: 'storm-notification-store',
} as const;

// Store versions for migration
export const STORE_VERSIONS = {
  AUTH: 1,
  PROJECT: 1,
  PIPELINE: 1,
  RESEARCH: 1,
  SESSION: 1,
  UI: 1,
  NOTIFICATION: 1,
} as const;

// Global store actions for cross-store operations
export const globalStoreActions = {
  // Reset all stores (useful for logout)
  resetAllStores: () => {
    Object.values(storeRegistry).forEach(useStore => {
      const store = useStore.getState();
      if ('reset' in store && typeof store.reset === 'function') {
        store.reset();
      }
    });
  },

  // Get all store states (for debugging)
  getAllStoreStates: () => {
    const states: Record<string, any> = {};
    Object.entries(storeRegistry).forEach(([name, useStore]) => {
      states[name] = useStore.getState();
    });
    return states;
  },

  // Check loading state across all stores
  getGlobalLoadingState: () => {
    return Object.values(storeRegistry).some(useStore => {
      const store = useStore.getState();
      return 'loading' in store && store.loading === true;
    });
  },

  // Get all errors across stores
  getAllErrors: () => {
    const errors: Array<{ store: string; error: string }> = [];
    Object.entries(storeRegistry).forEach(([name, useStore]) => {
      const store = useStore.getState();
      if ('error' in store && store.error) {
        errors.push({ store: name, error: store.error });
      }
    });
    return errors;
  },

  // Clear all errors across stores
  clearAllErrors: () => {
    Object.values(storeRegistry).forEach(useStore => {
      const store = useStore.getState();
      if ('clearError' in store && typeof store.clearError === 'function') {
        store.clearError();
      }
    });
  },
};

// Development utilities
if (process.env.NODE_ENV === 'development') {
  // Expose global store utilities to window
  if (typeof window !== 'undefined') {
    (window as any).__STORM_STORES__ = {
      registry: storeRegistry,
      actions: globalStoreActions,

      // Quick access methods
      auth: () => useAuthStore.getState(),
      projects: () => useProjectStore.getState(),
      pipeline: () => usePipelineStore.getState(),
      research: () => useResearchStore.getState(),
      session: () => useSessionStore.getState(),
      ui: () => useUIStore.getState(),
      notifications: () => useNotificationStore.getState(),

      // Debug helpers
      logAllStores: () => {
        console.group('🏪 All Store States');
        Object.entries(storeRegistry).forEach(([name, useStore]) => {
          console.log(`${name}:`, useStore.getState());
        });
        console.groupEnd();
      },

      resetAll: globalStoreActions.resetAllStores,
      clearErrors: globalStoreActions.clearAllErrors,
    };
  }
}

// Store initialization hook
export const useStoreInitialization = () => {
  const auth = useAuthStore();
  const ui = useUIStore();
  const notifications = useNotificationStore();

  React.useEffect(() => {
    // Initialize stores on app startup

    // Apply saved theme
    const effectiveTheme = ui.getEffectiveTheme();
    document.documentElement.classList.remove('light', 'dark');
    document.documentElement.classList.add(effectiveTheme);

    // Request browser notification permission if needed
    if (notifications.settings.enabled && 'Notification' in window) {
      notifications.requestBrowserPermission();
    }

    // Check for existing authentication session
    if (auth.token && !auth.isTokenExpired()) {
      // Validate existing session
      auth.refreshAuth().catch(() => {
        // If refresh fails, clear invalid session
        auth.logout();
      });
    }
  }, []);

  return {
    isInitialized: true, // Could be more sophisticated
    globalLoading: globalStoreActions.getGlobalLoadingState(),
    globalErrors: globalStoreActions.getAllErrors(),
  };
};

// Type helpers for store integration
export type StoreSlice<T> = T extends (...args: any[]) => infer R ? R : never;
export type AuthStoreType = StoreSlice<typeof useAuthStore>;
export type ProjectStoreType = StoreSlice<typeof useProjectStore>;
export type PipelineStoreType = StoreSlice<typeof usePipelineStore>;
export type ResearchStoreType = StoreSlice<typeof useResearchStore>;
export type SessionStoreType = StoreSlice<typeof useSessionStore>;
export type UIStoreType = StoreSlice<typeof useUIStore>;
export type NotificationStoreType = StoreSlice<typeof useNotificationStore>;

// Combined store type for cases where you need access to multiple stores
export interface CombinedStoreType {
  auth: AuthStoreType;
  project: ProjectStoreType;
  pipeline: PipelineStoreType;
  research: ResearchStoreType;
  session: SessionStoreType;
  ui: UIStoreType;
  notification: NotificationStoreType;
}

// Hook to get all stores at once (use sparingly)
export const useAllStores = (): CombinedStoreType => ({
  auth: useAuthStore(),
  project: useProjectStore(),
  pipeline: usePipelineStore(),
  research: useResearchStore(),
  session: useSessionStore(),
  ui: useUIStore(),
  notification: useNotificationStore(),
});

// Store event system for cross-store communication
export const storeEvents = {
  // Emit an event that can be heard by any store
  emit: (eventName: string, data?: any) => {
    window.dispatchEvent(
      new CustomEvent(`store:${eventName}`, { detail: data })
    );
  },

  // Listen for store events
  on: (eventName: string, handler: (data: any) => void) => {
    const listener = (event: CustomEvent) => handler(event.detail);
    window.addEventListener(`store:${eventName}`, listener as EventListener);

    return () => {
      window.removeEventListener(
        `store:${eventName}`,
        listener as EventListener
      );
    };
  },

  // Common events
  USER_LOGGED_OUT: 'user:logged-out',
  PROJECT_SELECTED: 'project:selected',
  PIPELINE_COMPLETED: 'pipeline:completed',
  THEME_CHANGED: 'theme:changed',
  ERROR_OCCURRED: 'error:occurred',
};

// Add React import for hooks
import React from 'react';
