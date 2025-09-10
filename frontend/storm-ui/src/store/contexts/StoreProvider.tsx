'use client';

// Main store provider that orchestrates all contexts and stores
import React, { ReactNode, useEffect } from 'react';
import { ThemeProvider } from './ThemeContext';
import { ConfigProvider } from './ConfigContext';
import { WebSocketProvider } from './WebSocketContext';
import { globalHydrationManager, HydrationProgress } from '../utils/hydration';
import { storeDebugUtils } from '../utils/debug';

// Store provider props
export interface StoreProviderProps {
  children: ReactNode;

  // Theme configuration
  themeConfig?: {
    defaultTheme?: 'light' | 'dark' | 'system';
    customLightTheme?: any;
    customDarkTheme?: any;
  };

  // Configuration
  configConfig?: {
    configUrl?: string;
    fallbackConfig?: any;
    enableRemoteConfig?: boolean;
    enableConfigValidation?: boolean;
  };

  // WebSocket configuration
  websocketConfig?: {
    config?: any;
    autoConnect?: boolean;
    enableGlobalEvents?: boolean;
  };

  // Development options
  development?: {
    enableDebugMode?: boolean;
    showHydrationProgress?: boolean;
    enablePerformanceMonitoring?: boolean;
  };

  // Loading and error fallbacks
  fallbacks?: {
    loading?: React.ComponentType;
    error?: React.ComponentType<{ error: Error; retry: () => void }>;
    hydration?: React.ComponentType;
  };
}

// Default loading component
const DefaultLoadingFallback: React.FC = () => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#f9fafb',
      fontFamily: 'system-ui, sans-serif',
    }}
  >
    <div
      style={{
        width: '40px',
        height: '40px',
        border: '3px solid #e5e7eb',
        borderTop: '3px solid #3b82f6',
        borderRadius: '50%',
        animation: 'spin 1s linear infinite',
        marginBottom: '16px',
      }}
    />
    <div style={{ color: '#6b7280', fontSize: '14px' }}>
      Loading STORM UI...
    </div>
    <style>{`
      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }
    `}</style>
  </div>
);

// Default error fallback
const DefaultErrorFallback: React.FC<{ error: Error; retry: () => void }> = ({
  error,
  retry,
}) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100vh',
      backgroundColor: '#fef2f2',
      fontFamily: 'system-ui, sans-serif',
      padding: '32px',
      textAlign: 'center',
    }}
  >
    <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
    <h2 style={{ color: '#dc2626', margin: '0 0 8px 0' }}>
      Something went wrong
    </h2>
    <p style={{ color: '#991b1b', marginBottom: '24px', maxWidth: '400px' }}>
      {error.message ||
        'An unexpected error occurred while loading the application.'}
    </p>
    <button
      onClick={retry}
      style={{
        backgroundColor: '#dc2626',
        color: 'white',
        border: 'none',
        borderRadius: '6px',
        padding: '12px 24px',
        fontSize: '14px',
        cursor: 'pointer',
        fontWeight: '500',
      }}
    >
      Try Again
    </button>
  </div>
);

// Error boundary component
class StoreErrorBoundary extends React.Component<
  {
    fallback: React.ComponentType<{ error: Error; retry: () => void }>;
    children: ReactNode;
  },
  { hasError: boolean; error: Error | null }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Store Provider Error:', error, errorInfo);
  }

  retry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (this.state.hasError && this.state.error) {
      const Fallback = this.props.fallback;
      return <Fallback error={this.state.error} retry={this.retry} />;
    }

    return this.props.children;
  }
}

// Main store provider component
export const StoreProvider: React.FC<StoreProviderProps> = ({
  children,
  themeConfig = {},
  configConfig = {},
  websocketConfig = {},
  development = {},
  fallbacks = {},
}) => {
  // Development settings
  const {
    enableDebugMode = process.env.NODE_ENV === 'development',
    showHydrationProgress = true,
    enablePerformanceMonitoring = process.env.NODE_ENV === 'development',
  } = development;

  // Fallback components
  const LoadingFallback = fallbacks.loading || DefaultLoadingFallback;
  const ErrorFallback = fallbacks.error || DefaultErrorFallback;
  const handleHydrationComplete = React.useCallback(() => {
    // Use a flag to prevent duplicate logging
    if (!(window as any).__HYDRATION_LOGGED__) {
      (window as any).__HYDRATION_LOGGED__ = true;
      console.log('🎉 All stores hydrated successfully');
    }
  }, []);

  const HydrationFallback =
    fallbacks.hydration ||
    (() => (
      <div style={{ padding: '20px' }}>
        <HydrationProgress
          showProgress={showHydrationProgress}
          showErrors={enableDebugMode}
          onComplete={handleHydrationComplete}
        />
      </div>
    ));

  // Performance monitoring setup
  useEffect(() => {
    if (enablePerformanceMonitoring) {
      // Check if already monitoring to prevent duplicate intervals in StrictMode
      if ((window as any).__PERF_MONITORING__) {
        return;
      }
      (window as any).__PERF_MONITORING__ = true;

      // Log performance metrics periodically
      const interval = setInterval(() => {
        if (enableDebugMode) {
          storeDebugUtils.logPerformanceSummary();
          storeDebugUtils.logMemoryUsage();
        }
      }, 30000); // Every 30 seconds

      return () => {
        clearInterval(interval);
        (window as any).__PERF_MONITORING__ = false;
      };
    }
  }, [enablePerformanceMonitoring, enableDebugMode]);

  // Global error handling
  useEffect(() => {
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      console.error('Unhandled promise rejection in store:', event.reason);

      if (enableDebugMode) {
        // Show detailed error information
        console.group('🚨 Unhandled Promise Rejection Details');
        console.error('Reason:', event.reason);
        console.error('Promise:', event.promise);
        console.trace('Stack trace');
        console.groupEnd();
      }
    };

    const handleError = (event: ErrorEvent) => {
      console.error('Global error in store context:', event.error);

      if (enableDebugMode) {
        console.group('🚨 Global Error Details');
        console.error('Message:', event.message);
        console.error('Filename:', event.filename);
        console.error('Line:', event.lineno, 'Column:', event.colno);
        console.error('Error:', event.error);
        console.groupEnd();
      }
    };

    window.addEventListener('unhandledrejection', handleUnhandledRejection);
    window.addEventListener('error', handleError);

    return () => {
      window.removeEventListener(
        'unhandledrejection',
        handleUnhandledRejection
      );
      window.removeEventListener('error', handleError);
    };
  }, [enableDebugMode]);

  // Development console utilities
  useEffect(() => {
    if (enableDebugMode && typeof window !== 'undefined') {
      // Check if already initialized to prevent duplicate setup in StrictMode
      if ((window as any).__STORM_DEBUG__) {
        return; // Already initialized
      }

      // Expose debug utilities to window for console access
      (window as any).__STORM_DEBUG__ = {
        stores: storeDebugUtils,
        hydration: globalHydrationManager,

        // Helper functions
        logAllStoresState: () => {
          console.group('🏪 All Stores State');
          // This would iterate through all registered stores and log their state
          // Implementation would depend on store registration system
          console.log('Store state logging not fully implemented yet');
          console.groupEnd();
        },

        clearAllStores: () => {
          if (
            confirm(
              'Are you sure you want to reset all stores? This will clear all data.'
            )
          ) {
            // This would call reset on all stores
            console.log('Store reset not fully implemented yet');
          }
        },

        simulateNetworkError: () => {
          window.dispatchEvent(new CustomEvent('simulate:network-error'));
        },

        simulateSlowNetwork: (delay = 2000) => {
          window.dispatchEvent(
            new CustomEvent('simulate:slow-network', { detail: { delay } })
          );
        },
      };

      console.log(
        '%c🌪️ STORM UI Debug Mode Enabled\n' +
          '%cType __STORM_DEBUG__ in console for debugging utilities',
        'color: #3b82f6; font-size: 16px; font-weight: bold;',
        'color: #6b7280; font-size: 12px;'
      );
    }
  }, [enableDebugMode]);

  return (
    <StoreErrorBoundary fallback={ErrorFallback}>
      <ConfigProvider {...configConfig}>
        <ThemeProvider {...themeConfig}>
          <WebSocketProvider {...websocketConfig}>
            <React.Suspense fallback={<LoadingFallback />}>
              <HydrationWrapper fallback={HydrationFallback}>
                {children}
              </HydrationWrapper>
            </React.Suspense>
          </WebSocketProvider>
        </ThemeProvider>
      </ConfigProvider>
    </StoreErrorBoundary>
  );
};

// Hydration wrapper component
const HydrationWrapper: React.FC<{
  children: ReactNode;
  fallback: React.ComponentType;
}> = ({ children, fallback: Fallback }) => {
  const [isHydrated, setIsHydrated] = React.useState(false);
  const [hydrationError, setHydrationError] = React.useState<Error | null>(
    null
  );

  useEffect(() => {
    // Subscribe to global hydration state
    const unsubscribe = globalHydrationManager.subscribe(state => {
      if (state.allHydrated) {
        setIsHydrated(true);
      }
    });

    // Check if already hydrated
    if (globalHydrationManager.areAllStoresHydrated()) {
      setIsHydrated(true);
    }

    return unsubscribe;
  }, []);

  // Handle hydration timeout
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (!isHydrated && !hydrationError) {
        const error = new Error('Store hydration timed out after 10 seconds');
        setHydrationError(error);
        console.error('Store hydration timeout:', error);
      }
    }, 10000);

    return () => clearTimeout(timeout);
  }, [isHydrated, hydrationError]);

  if (hydrationError) {
    throw hydrationError;
  }

  if (!isHydrated) {
    return <Fallback />;
  }

  return <>{children}</>;
};

// Hook to access store provider context
export const useStoreProvider = () => {
  return {
    // Debug utilities (only in development)
    debug:
      process.env.NODE_ENV === 'development'
        ? {
            logPerformance: storeDebugUtils.logPerformanceSummary,
            logMemory: storeDebugUtils.logMemoryUsage,
            getDebugData: storeDebugUtils.getDebugPanelData,
          }
        : undefined,

    // Hydration utilities
    hydration: {
      isHydrated: globalHydrationManager.areAllStoresHydrated(),
      isHydrating: globalHydrationManager.areAnyStoresHydrating(),
      getState: () => globalHydrationManager.getGlobalState(),
    },
  };
};

// Debug panel component (development only)
export const StoreDebugPanel: React.FC<{
  position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right';
}> = ({ position = 'bottom-right' }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const [debugData, setDebugData] = React.useState<any>(null);

  useEffect(() => {
    if (isOpen) {
      const interval = setInterval(() => {
        setDebugData(storeDebugUtils.getDebugPanelData());
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [isOpen]);

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const positionStyles = {
    'top-left': { top: '10px', left: '10px' },
    'top-right': { top: '10px', right: '10px' },
    'bottom-left': { bottom: '10px', left: '10px' },
    'bottom-right': { bottom: '10px', right: '10px' },
  };

  return (
    <div
      style={{
        position: 'fixed',
        ...positionStyles[position],
        backgroundColor: '#1f2937',
        color: '#f9fafb',
        borderRadius: '8px',
        boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.25)',
        zIndex: 10000,
        minWidth: isOpen ? '300px' : 'auto',
        maxHeight: isOpen ? '400px' : 'auto',
        overflow: isOpen ? 'auto' : 'hidden',
      }}
    >
      <div
        style={{
          padding: '8px 12px',
          cursor: 'pointer',
          borderBottom: isOpen ? '1px solid #374151' : 'none',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          fontWeight: '500',
          fontSize: '14px',
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span>🌪️ STORM Debug</span>
        <span>{isOpen ? '▼' : '▲'}</span>
      </div>

      {isOpen && debugData && (
        <div style={{ padding: '12px', fontSize: '12px' }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Hydration Status:</strong> {debugData.stores.length} stores
          </div>

          {debugData.stores.map((store: any, index: number) => (
            <div
              key={store.name}
              style={{
                marginBottom: '4px',
                padding: '4px 8px',
                backgroundColor:
                  store.healthStatus === 'healthy'
                    ? '#065f46'
                    : store.healthStatus === 'warning'
                      ? '#92400e'
                      : '#991b1b',
                borderRadius: '4px',
                display: 'flex',
                justifyContent: 'space-between',
              }}
            >
              <span>{store.name}</span>
              <span>{store.performance.averageUpdateTime.toFixed(1)}ms</span>
            </div>
          ))}

          {debugData.memoryInfo && (
            <div
              style={{
                marginTop: '8px',
                paddingTop: '8px',
                borderTop: '1px solid #374151',
              }}
            >
              <div>
                <strong>Memory:</strong>
              </div>
              <div>
                Used:{' '}
                {(debugData.memoryInfo.usedJSHeapSize / 1024 / 1024).toFixed(1)}
                MB
              </div>
              <div>
                Total:{' '}
                {(debugData.memoryInfo.totalJSHeapSize / 1024 / 1024).toFixed(
                  1
                )}
                MB
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
