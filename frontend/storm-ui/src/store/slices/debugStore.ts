// Debug logging store for in-app console
import { create } from 'zustand';
import { devtools } from '../middleware/devtools';
import { immer } from '../middleware/immer';

export interface LogEntry {
  id: string;
  timestamp: Date;
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  data?: any;
  source?: string;
}

interface DebugState {
  logs: LogEntry[];
  isVisible: boolean;
  maxLogs: number;
  filter: {
    level: ('log' | 'warn' | 'error' | 'info' | 'debug')[];
    searchQuery: string;
  };
}

interface DebugActions {
  addLog: (
    level: LogEntry['level'],
    message: string,
    data?: any,
    source?: string
  ) => void;
  clearLogs: () => void;
  toggleVisibility: () => void;
  setVisibility: (visible: boolean) => void;
  setFilter: (filter: Partial<DebugState['filter']>) => void;
  exportLogs: () => string;
}

export type DebugStore = DebugState & DebugActions;

const initialState: DebugState = {
  logs: [],
  isVisible: false,
  maxLogs: 500,
  filter: {
    level: ['log', 'warn', 'error', 'info', 'debug'],
    searchQuery: '',
  },
};

export const useDebugStore = create<DebugStore>()(
  devtools(
    immer<DebugStore>((set, get) => ({
      ...initialState,

      addLog: (level, message, data, source) => {
        set(draft => {
          const logEntry: LogEntry = {
            id: `${Date.now()}-${Math.random()}`,
            timestamp: new Date(),
            level,
            message,
            data,
            source,
          };

          draft.logs.unshift(logEntry);

          // Keep only maxLogs entries
          if (draft.logs.length > draft.maxLogs) {
            draft.logs = draft.logs.slice(0, draft.maxLogs);
          }
        });
      },

      clearLogs: () => {
        set(draft => {
          draft.logs = [];
        });
      },

      toggleVisibility: () => {
        set(draft => {
          draft.isVisible = !draft.isVisible;
        });
      },

      setVisibility: visible => {
        set(draft => {
          draft.isVisible = visible;
        });
      },

      setFilter: filter => {
        set(draft => {
          Object.assign(draft.filter, filter);
        });
      },

      exportLogs: () => {
        const { logs } = get();
        const exportData = logs.map(log => ({
          timestamp: log.timestamp.toISOString(),
          level: log.level,
          message: log.message,
          data: log.data,
          source: log.source,
        }));
        return JSON.stringify(exportData, null, 2);
      },
    })),
    { name: 'DebugStore' }
  )
);

// Helper hook to get filtered logs
export const useFilteredLogs = () => {
  const { logs, filter } = useDebugStore();

  return logs.filter(log => {
    // Filter by level
    if (!filter.level.includes(log.level)) {
      return false;
    }

    // Filter by search query
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      const searchableText =
        `${log.message} ${JSON.stringify(log.data || '')}`.toLowerCase();
      if (!searchableText.includes(query)) {
        return false;
      }
    }

    return true;
  });
};

// Override console methods to capture logs
if (typeof window !== 'undefined' && !(window as any).__CONSOLE_CAPTURED__) {
  // Mark that console has been captured to prevent duplicate wrapping
  (window as any).__CONSOLE_CAPTURED__ = true;

  const originalConsole = {
    log: console.log,
    warn: console.warn,
    error: console.error,
    info: console.info,
    debug: console.debug,
  };

  // Expose debug store to window for easy access
  (window as any).__DEBUG__ = {
    show: () => useDebugStore.getState().setVisibility(true),
    hide: () => useDebugStore.getState().setVisibility(false),
    toggle: () => useDebugStore.getState().toggleVisibility(),
    clear: () => useDebugStore.getState().clearLogs(),
    logs: () => useDebugStore.getState().logs,
  };

  const captureLog = (level: LogEntry['level'], args: any[]) => {
    // Call original console method
    originalConsole[level](...args);

    // Capture to debug store
    const message = args
      .map(arg => {
        if (typeof arg === 'object') {
          try {
            return JSON.stringify(arg, null, 2);
          } catch {
            return String(arg);
          }
        }
        return String(arg);
      })
      .join(' ');

    // Extract source from stack trace if possible
    const stack = new Error().stack;
    const source = stack?.split('\n')[3]?.trim() || undefined;

    useDebugStore
      .getState()
      .addLog(
        level,
        message,
        args.length > 1 ? args.slice(1) : undefined,
        source
      );
  };

  console.log = (...args: any[]) => captureLog('log', args);
  console.warn = (...args: any[]) => captureLog('warn', args);
  console.error = (...args: any[]) => captureLog('error', args);
  console.info = (...args: any[]) => captureLog('info', args);
  console.debug = (...args: any[]) => captureLog('debug', args);
}
