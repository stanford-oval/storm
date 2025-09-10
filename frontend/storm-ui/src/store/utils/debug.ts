// Debug utilities for stores
export interface StoreDebugInfo {
  storeName: string;
  stateSize: number;
  lastActions: string[];
  subscriptionCount: number;
  performance: {
    averageUpdateTime: number;
    totalUpdates: number;
    lastUpdateTime: number;
  };
}

// Store performance monitor
export class StorePerformanceMonitor {
  private updateTimes: number[] = [];
  private maxHistorySize = 100;

  recordUpdate(duration: number) {
    this.updateTimes.push(duration);

    if (this.updateTimes.length > this.maxHistorySize) {
      this.updateTimes.shift();
    }
  }

  getAverageUpdateTime(): number {
    if (this.updateTimes.length === 0) return 0;

    const sum = this.updateTimes.reduce((acc, time) => acc + time, 0);
    return sum / this.updateTimes.length;
  }

  getTotalUpdates(): number {
    return this.updateTimes.length;
  }

  getLastUpdateTime(): number {
    return this.updateTimes[this.updateTimes.length - 1] || 0;
  }

  reset() {
    this.updateTimes = [];
  }
}

// Debug middleware
export const debugMiddleware = <T>(
  config: any,
  options: {
    name: string;
    enabled?: boolean;
    logActions?: boolean;
    logStateChanges?: boolean;
    performanceTracking?: boolean;
  }
) => {
  const {
    name,
    enabled = true,
    logActions = true,
    logStateChanges = false,
    performanceTracking = true,
  } = options;

  if (!enabled) return config;

  const performanceMonitor = new StorePerformanceMonitor();
  const actionHistory: string[] = [];
  let lastState: T;

  return (set: any, get: any, api: any) => {
    const store = config(
      (args: any, replace?: boolean, actionName?: string) => {
        const startTime = performance.now();

        // Log action if enabled
        if (logActions && actionName) {
          console.log(`🎬 [${name}] Action: ${actionName}`);

          // Track action history
          actionHistory.unshift(actionName);
          if (actionHistory.length > 50) {
            actionHistory.pop();
          }
        }

        // Get state before update for comparison
        const previousState = get();

        // Execute the update
        set(args, replace, actionName);

        // Calculate performance metrics
        const endTime = performance.now();
        const duration = endTime - startTime;

        if (performanceTracking) {
          performanceMonitor.recordUpdate(duration);
        }

        // Log state changes if enabled
        if (logStateChanges && actionName) {
          const newState = get();
          const changes = getStateChanges(previousState, newState);

          if (changes.length > 0) {
            console.log(`📊 [${name}] State changes:`, changes);
          }
        }

        // Warn about slow updates
        if (duration > 16) {
          // More than one frame at 60fps
          console.warn(
            `⚠️ [${name}] Slow update detected: ${duration.toFixed(2)}ms for action "${actionName}"`
          );
        }

        lastState = get();
      },
      get,
      api
    );

    // Add debug methods to store
    (store as any).__debug = {
      getInfo: (): StoreDebugInfo => ({
        storeName: name,
        stateSize: JSON.stringify(get()).length,
        lastActions: [...actionHistory],
        subscriptionCount: api.subscriptions?.getSubscriptionCount() || 0,
        performance: {
          averageUpdateTime: performanceMonitor.getAverageUpdateTime(),
          totalUpdates: performanceMonitor.getTotalUpdates(),
          lastUpdateTime: performanceMonitor.getLastUpdateTime(),
        },
      }),

      logState: () => {
        console.log(`🏪 [${name}] Current state:`, get());
      },

      logActions: () => {
        console.log(`📜 [${name}] Action history:`, actionHistory);
      },

      resetPerformance: () => {
        performanceMonitor.reset();
      },

      subscribe: (callback: (state: T) => void) => {
        let previousState = get();

        return (
          api.subscriptions?.subscribe(
            (state: T) => state,
            (currentState: T) => {
              callback(currentState);
              previousState = currentState;
            }
          ) || (() => {})
        );
      },
    };

    return store;
  };
};

// Get differences between two states
function getStateChanges<T>(
  oldState: T,
  newState: T,
  path: string = ''
): Array<{ path: string; oldValue: any; newValue: any }> {
  const changes: Array<{ path: string; oldValue: any; newValue: any }> = [];

  if (oldState === newState) {
    return changes;
  }

  if (
    typeof oldState !== 'object' ||
    typeof newState !== 'object' ||
    oldState === null ||
    newState === null
  ) {
    return [{ path: path || 'root', oldValue: oldState, newValue: newState }];
  }

  const allKeys = new Set([
    ...Object.keys(oldState as any),
    ...Object.keys(newState as any),
  ]);

  for (const key of Array.from(allKeys)) {
    const oldValue = (oldState as any)[key];
    const newValue = (newState as any)[key];
    const currentPath = path ? `${path}.${key}` : key;

    if (oldValue !== newValue) {
      if (
        typeof oldValue === 'object' &&
        typeof newValue === 'object' &&
        oldValue !== null &&
        newValue !== null
      ) {
        changes.push(...getStateChanges(oldValue, newValue, currentPath));
      } else {
        changes.push({ path: currentPath, oldValue, newValue });
      }
    }
  }

  return changes;
}

// Global debug utilities
export const storeDebugUtils = {
  // Get all store debug info
  getAllStoreInfo: (): Record<string, StoreDebugInfo> => {
    const info: Record<string, StoreDebugInfo> = {};

    // This would need to be populated by each store that uses the debug middleware
    // In a real implementation, stores would register themselves here

    return info;
  },

  // Log performance summary for all stores
  logPerformanceSummary: () => {
    const allInfo = storeDebugUtils.getAllStoreInfo();

    console.table(
      Object.entries(allInfo).map(([name, info]) => ({
        Store: name,
        'Avg Update Time (ms)': info.performance.averageUpdateTime.toFixed(2),
        'Total Updates': info.performance.totalUpdates,
        'State Size (bytes)': info.stateSize,
        Subscriptions: info.subscriptionCount,
      }))
    );
  },

  // Monitor memory usage
  logMemoryUsage: () => {
    if ('memory' in performance) {
      const memory = (performance as any).memory;
      console.log('🧠 Memory Usage:', {
        'Used JS Heap Size': `${(memory.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        'Total JS Heap Size': `${(memory.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB`,
        'JS Heap Size Limit': `${(memory.jsHeapSizeLimit / 1024 / 1024).toFixed(2)} MB`,
      });
    } else {
      console.log('🧠 Memory usage information not available');
    }
  },

  // Create a debug panel component data
  getDebugPanelData: () => {
    const allInfo = storeDebugUtils.getAllStoreInfo();

    return {
      stores: Object.entries(allInfo).map(([name, info]) => ({
        name,
        ...info,
        healthStatus: getStoreHealthStatus(info),
      })),
      memoryInfo: 'memory' in performance ? (performance as any).memory : null,
      timestamp: new Date().toISOString(),
    };
  },
};

// Determine store health status
function getStoreHealthStatus(
  info: StoreDebugInfo
): 'healthy' | 'warning' | 'critical' {
  const avgUpdateTime = info.performance.averageUpdateTime;
  const stateSize = info.stateSize;
  const subscriptionCount = info.subscriptionCount;

  // Critical conditions
  if (
    avgUpdateTime > 50 ||
    stateSize > 1024 * 1024 ||
    subscriptionCount > 100
  ) {
    return 'critical';
  }

  // Warning conditions
  if (avgUpdateTime > 16 || stateSize > 512 * 1024 || subscriptionCount > 50) {
    return 'warning';
  }

  return 'healthy';
}

// Store action logger
export const createActionLogger = (storeName: string) => {
  const actionTimes = new Map<string, number[]>();

  return {
    logAction: (actionName: string, duration: number, payload?: any) => {
      const times = actionTimes.get(actionName) || [];
      times.push(duration);

      // Keep only last 20 executions
      if (times.length > 20) {
        times.shift();
      }

      actionTimes.set(actionName, times);

      // Log if action is slow
      if (duration > 10) {
        console.warn(
          `🐌 [${storeName}] Slow action "${actionName}": ${duration.toFixed(2)}ms`
        );
        if (payload) {
          console.log('Payload:', payload);
        }
      }
    },

    getActionStats: (actionName?: string) => {
      if (actionName) {
        const times = actionTimes.get(actionName) || [];
        return {
          actionName,
          executionCount: times.length,
          averageTime:
            times.length > 0
              ? times.reduce((sum, time) => sum + time, 0) / times.length
              : 0,
          maxTime: times.length > 0 ? Math.max(...times) : 0,
          minTime: times.length > 0 ? Math.min(...times) : 0,
        };
      }

      return Array.from(actionTimes.entries()).map(([name, times]) => ({
        actionName: name,
        executionCount: times.length,
        averageTime: times.reduce((sum, time) => sum + time, 0) / times.length,
        maxTime: Math.max(...times),
        minTime: Math.min(...times),
      }));
    },

    reset: () => {
      actionTimes.clear();
    },
  };
};

// React DevTools integration
export const connectToReactDevTools = (storeName: string, store: any) => {
  if (
    typeof window !== 'undefined' &&
    (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__
  ) {
    const devTools = (window as any).__REACT_DEVTOOLS_GLOBAL_HOOK__;

    // Register the store as a React component
    const fiberNode = {
      stateNode: store,
      type: { name: storeName },
      return: null,
      child: null,
      sibling: null,
      memoizedState: store,
    };

    devTools.onCommitFiberRoot(null, fiberNode, null, true);
  }
};
