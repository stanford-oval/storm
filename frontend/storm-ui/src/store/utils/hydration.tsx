// Store hydration utilities
export interface HydrationConfig {
  timeout?: number; // Timeout for hydration in ms
  retryCount?: number; // Number of retry attempts
  retryDelay?: number; // Delay between retries in ms
  onSuccess?: () => void; // Callback on successful hydration
  onError?: (error: Error) => void; // Callback on hydration error
  onTimeout?: () => void; // Callback on hydration timeout
}

export interface HydrationState {
  isHydrated: boolean;
  isHydrating: boolean;
  error: Error | null;
  retryCount: number;
}

// Hydration manager for coordinating multiple stores
export class HydrationManager {
  private stores = new Map<string, HydrationState>();
  private subscribers = new Set<(state: GlobalHydrationState) => void>();
  private config: Required<HydrationConfig>;

  constructor(config: HydrationConfig = {}) {
    this.config = {
      timeout: config.timeout || 5000,
      retryCount: config.retryCount || 3,
      retryDelay: config.retryDelay || 1000,
      onSuccess: config.onSuccess || (() => {}),
      onError: config.onError || (() => {}),
      onTimeout: config.onTimeout || (() => {}),
    };
  }

  // Register a store for hydration tracking
  registerStore(storeName: string): void {
    this.stores.set(storeName, {
      isHydrated: false,
      isHydrating: false,
      error: null,
      retryCount: 0,
    });

    this.notifySubscribers();
  }

  // Mark store as starting hydration
  startHydration(storeName: string): void {
    const state = this.stores.get(storeName);
    if (state) {
      state.isHydrating = true;
      state.error = null;
      this.stores.set(storeName, state);
      this.notifySubscribers();
    }
  }

  // Mark store as successfully hydrated
  completeHydration(storeName: string): void {
    const state = this.stores.get(storeName);
    if (state) {
      state.isHydrated = true;
      state.isHydrating = false;
      state.error = null;
      this.stores.set(storeName, state);
      this.notifySubscribers();

      // Check if all stores are hydrated
      if (this.areAllStoresHydrated()) {
        this.config.onSuccess();
      }
    }
  }

  // Mark store as failed to hydrate
  failHydration(storeName: string, error: Error): void {
    const state = this.stores.get(storeName);
    if (state) {
      state.isHydrating = false;
      state.error = error;
      state.retryCount++;
      this.stores.set(storeName, state);
      this.notifySubscribers();

      // Retry if under retry limit
      if (state.retryCount < this.config.retryCount) {
        setTimeout(() => {
          this.retryHydration(storeName);
        }, this.config.retryDelay);
      } else {
        this.config.onError(error);
      }
    }
  }

  // Retry hydration for a store
  private retryHydration(storeName: string): void {
    // This would trigger a re-hydration attempt
    // The actual retry logic would be handled by the individual stores
    window.dispatchEvent(
      new CustomEvent('store:retry-hydration', {
        detail: { storeName },
      })
    );
  }

  // Check if all registered stores are hydrated
  areAllStoresHydrated(): boolean {
    return Array.from(this.stores.values()).every(state => state.isHydrated);
  }

  // Check if any stores are currently hydrating
  areAnyStoresHydrating(): boolean {
    return Array.from(this.stores.values()).some(state => state.isHydrating);
  }

  // Get global hydration state
  getGlobalState(): GlobalHydrationState {
    const states = Array.from(this.stores.entries()).map(([name, state]) => ({
      storeName: name,
      ...state,
    }));

    return {
      stores: states,
      allHydrated: this.areAllStoresHydrated(),
      anyHydrating: this.areAnyStoresHydrating(),
      totalStores: this.stores.size,
      hydratedCount: states.filter(s => s.isHydrated).length,
      failedCount: states.filter(s => s.error !== null).length,
    };
  }

  // Subscribe to hydration state changes
  subscribe(callback: (state: GlobalHydrationState) => void): () => void {
    this.subscribers.add(callback);

    // Send initial state
    callback(this.getGlobalState());

    return () => {
      this.subscribers.delete(callback);
    };
  }

  // Notify all subscribers of state changes
  private notifySubscribers(): void {
    const state = this.getGlobalState();
    this.subscribers.forEach(callback => callback(state));
  }

  // Reset all stores (for testing or cleanup)
  reset(): void {
    this.stores.clear();
    this.subscribers.clear();
  }
}

// Global hydration state interface
export interface GlobalHydrationState {
  stores: Array<{
    storeName: string;
    isHydrated: boolean;
    isHydrating: boolean;
    error: Error | null;
    retryCount: number;
  }>;
  allHydrated: boolean;
  anyHydrating: boolean;
  totalStores: number;
  hydratedCount: number;
  failedCount: number;
}

// Create a global hydration manager instance
export const globalHydrationManager = new HydrationManager();

// Hydration middleware for Zustand stores
export const hydrationMiddleware =
  <T,>(
    config: any,
    options: {
      storeName: string;
      onHydrate?: (state: T) => void;
      onError?: (error: Error) => void;
      timeout?: number;
    }
  ) =>
  (set: any, get: any, api: any) => {
    const { storeName, onHydrate, onError, timeout = 5000 } = options;

    // Register with global hydration manager
    globalHydrationManager.registerStore(storeName);

    const store = config(set, get, api);

    // Add hydration methods to store
    (store as any).hydration = {
      isHydrated: false,
      isHydrating: false,
      error: null,

      // Manual hydration trigger
      hydrate: async () => {
        if (store.hydration.isHydrated || store.hydration.isHydrating) {
          return;
        }

        store.hydration.isHydrating = true;
        globalHydrationManager.startHydration(storeName);

        try {
          // Hydration timeout
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(
              () => reject(new Error(`Hydration timeout for ${storeName}`)),
              timeout
            );
          });

          // Actual hydration logic (this would be implemented by each store)
          const hydrationPromise = new Promise<void>(resolve => {
            // Check if persist middleware has rehydrated
            if (api.persist?.hasHydrated?.()) {
              resolve();
            } else if (api.persist?.rehydrate) {
              api.persist.rehydrate();
              // Wait for rehydration to complete
              const checkHydration = () => {
                if (api.persist.hasHydrated()) {
                  resolve();
                } else {
                  setTimeout(checkHydration, 50);
                }
              };
              checkHydration();
            } else {
              // No persistence, consider immediately hydrated
              resolve();
            }
          });

          await Promise.race([hydrationPromise, timeoutPromise]);

          store.hydration.isHydrated = true;
          store.hydration.isHydrating = false;
          store.hydration.error = null;

          globalHydrationManager.completeHydration(storeName);

          if (onHydrate) {
            onHydrate(get());
          }
        } catch (error) {
          const hydrationError =
            error instanceof Error ? error : new Error(String(error));

          store.hydration.isHydrating = false;
          store.hydration.error = hydrationError;

          globalHydrationManager.failHydration(storeName, hydrationError);

          if (onError) {
            onError(hydrationError);
          }

          throw hydrationError;
        }
      },

      // Check if store has been hydrated
      hasHydrated: () => store.hydration.isHydrated,

      // Get hydration state
      getHydrationState: () => ({
        isHydrated: store.hydration.isHydrated,
        isHydrating: store.hydration.isHydrating,
        error: store.hydration.error,
      }),
    };

    // Listen for retry events
    window.addEventListener('store:retry-hydration', (event: any) => {
      if (event.detail.storeName === storeName) {
        store.hydration.hydrate().catch(console.error);
      }
    });

    // Auto-hydrate on store creation
    setTimeout(() => {
      store.hydration.hydrate().catch(console.error);
    }, 0);

    return store;
  };

// React hook for hydration state
export const useHydration = (storeName?: string) => {
  const [state, setState] = React.useState<
    GlobalHydrationState | HydrationState
  >(() => {
    if (storeName) {
      return (
        globalHydrationManager
          .getGlobalState()
          .stores.find(s => s.storeName === storeName) || {
          isHydrated: false,
          isHydrating: false,
          error: null,
          retryCount: 0,
        }
      );
    }
    return globalHydrationManager.getGlobalState();
  });

  React.useEffect(() => {
    const unsubscribe = globalHydrationManager.subscribe(globalState => {
      if (storeName) {
        const storeState = globalState.stores.find(
          s => s.storeName === storeName
        );
        if (storeState) {
          setState(storeState);
        }
      } else {
        setState(globalState);
      }
    });

    return unsubscribe;
  }, [storeName]);

  return state;
};

// Higher-order component for hydration handling
export function withHydration<P extends object>(
  Component: React.ComponentType<P>,
  options: {
    fallback?: React.ComponentType;
    errorFallback?: React.ComponentType<{ error: Error; retry: () => void }>;
    storeNames?: string[];
  } = {}
) {
  const {
    fallback: Fallback,
    errorFallback: ErrorFallback,
    storeNames,
  } = options;

  return React.forwardRef<any, P>((props, ref) => {
    const hydrationState = useHydration();

    // Filter to specific stores if specified
    const relevantStores =
      'stores' in hydrationState
        ? storeNames
          ? hydrationState.stores.filter(s => storeNames.includes(s.storeName))
          : hydrationState.stores
        : [hydrationState];

    const isHydrated = relevantStores.every(s => s.isHydrated);
    const isHydrating = relevantStores.some(s => s.isHydrating);
    const hasErrors = relevantStores.some(s => s.error !== null);
    const errors = relevantStores
      .filter(s => s.error !== null)
      .map(s => s.error!);

    // Show error fallback if there are errors
    if (hasErrors && ErrorFallback) {
      return (
        <ErrorFallback
          error={errors[0]}
          retry={() => {
            if ('stores' in hydrationState) {
              relevantStores.forEach(store => {
                if (store.error && 'storeName' in store) {
                  window.dispatchEvent(
                    new CustomEvent('store:retry-hydration', {
                      detail: { storeName: store.storeName },
                    })
                  );
                }
              });
            } else {
              // Single store mode - retry without storeName
              window.dispatchEvent(
                new CustomEvent('store:retry-hydration', {
                  detail: {},
                })
              );
            }
          }}
        />
      );
    }

    // Show loading fallback while hydrating
    if (!isHydrated && (isHydrating || Fallback)) {
      return Fallback ? <Fallback /> : null;
    }

    // Render component if hydrated
    return <Component {...(props as P)} ref={ref} />;
  });
}

// Hydration utilities
export const hydrationUtils = {
  // Wait for all stores to be hydrated
  waitForHydration: (timeout: number = 10000): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Hydration timeout'));
      }, timeout);

      const unsubscribe = globalHydrationManager.subscribe(state => {
        if (state.allHydrated) {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve();
        }
      });

      // Check if already hydrated
      if (globalHydrationManager.areAllStoresHydrated()) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve();
      }
    });
  },

  // Wait for specific stores to be hydrated
  waitForStores: (
    storeNames: string[],
    timeout: number = 10000
  ): Promise<void> => {
    return new Promise((resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(
          new Error(`Hydration timeout for stores: ${storeNames.join(', ')}`)
        );
      }, timeout);

      const unsubscribe = globalHydrationManager.subscribe(state => {
        const targetStores = state.stores.filter(s =>
          storeNames.includes(s.storeName)
        );
        const allHydrated =
          targetStores.length === storeNames.length &&
          targetStores.every(s => s.isHydrated);

        if (allHydrated) {
          clearTimeout(timeoutId);
          unsubscribe();
          resolve();
        }
      });

      // Check if already hydrated
      const currentState = globalHydrationManager.getGlobalState();
      const targetStores = currentState.stores.filter(s =>
        storeNames.includes(s.storeName)
      );
      const allHydrated =
        targetStores.length === storeNames.length &&
        targetStores.every(s => s.isHydrated);

      if (allHydrated) {
        clearTimeout(timeoutId);
        unsubscribe();
        resolve();
      }
    });
  },

  // Get hydration progress
  getProgress: (): { completed: number; total: number; percentage: number } => {
    const state = globalHydrationManager.getGlobalState();
    return {
      completed: state.hydratedCount,
      total: state.totalStores,
      percentage:
        state.totalStores > 0
          ? (state.hydratedCount / state.totalStores) * 100
          : 100,
    };
  },
};

// React component for hydration progress
export const HydrationProgress: React.FC<{
  onComplete?: () => void;
  showProgress?: boolean;
  showErrors?: boolean;
}> = ({ onComplete, showProgress = true, showErrors = true }) => {
  const hydrationState = useHydration();

  React.useEffect(() => {
    if (
      'allHydrated' in hydrationState &&
      hydrationState.allHydrated &&
      onComplete
    ) {
      onComplete();
    }
  }, [
    'allHydrated' in hydrationState ? hydrationState.allHydrated : false,
    onComplete,
  ]);

  if ('allHydrated' in hydrationState && hydrationState.allHydrated) {
    return null;
  }

  return (
    <div className="hydration-progress">
      {showProgress && (
        <div className="progress-bar">
          <div className="progress-text">
            Loading application... (
            {'hydratedCount' in hydrationState
              ? hydrationState.hydratedCount
              : 0}
            /{'totalStores' in hydrationState ? hydrationState.totalStores : 1})
          </div>
          <div className="progress-track">
            <div
              className="progress-fill"
              style={{
                width: `${('hydratedCount' in hydrationState && 'totalStores' in hydrationState ? hydrationState.hydratedCount / hydrationState.totalStores : 0) * 100}%`,
              }}
            />
          </div>
        </div>
      )}

      {showErrors &&
        'failedCount' in hydrationState &&
        hydrationState.failedCount > 0 && (
          <div className="hydration-errors">
            <p>Some stores failed to load:</p>
            <ul>
              {'stores' in hydrationState &&
                hydrationState.stores
                  .filter(s => s.error)
                  .map(s => (
                    <li key={s.storeName}>
                      {s.storeName}: {s.error!.message}
                      {s.retryCount < 3 && <span> (retrying...)</span>}
                    </li>
                  ))}
            </ul>
          </div>
        )}
    </div>
  );
};

// Add React import for the components (this would normally be at the top)
import React from 'react';
