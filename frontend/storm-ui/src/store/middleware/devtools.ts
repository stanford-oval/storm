// Redux DevTools middleware for Zustand
import { StateCreator } from 'zustand';
import { DevtoolsOptions } from '../types';

// DevTools extension interface
interface DevtoolsExtension {
  connect: (options?: any) => DevtoolsConnection;
  disconnect?: () => void;
}

interface DevtoolsConnection {
  init: (state: any) => void;
  send: (action: any, state: any) => void;
  subscribe: (listener: (message: any) => void) => () => void;
  unsubscribe: () => void;
}

// Check if devtools extension is available
const getDevtoolsExtension = (): DevtoolsExtension | null => {
  if (typeof window === 'undefined') return null;

  // Check for Redux DevTools Extension
  return (
    (window as any).__REDUX_DEVTOOLS_EXTENSION__ ||
    (window as any).devToolsExtension
  );
};

// Default options
const defaultOptions: DevtoolsOptions = {
  enabled: process.env.NODE_ENV === 'development',
  name: 'Store',
  serialize: true,
};

// DevTools middleware
export const devtools = <T>(
  config: StateCreator<T>,
  options: Partial<DevtoolsOptions> = {}
) => {
  const opts = { ...defaultOptions, ...options };

  // Skip if devtools disabled or not available
  if (!opts.enabled) {
    return config;
  }

  const extension = getDevtoolsExtension();
  if (!extension) {
    return config;
  }

  return (set: any, get: any, api: any) => {
    let isRecording = true;
    let connection: DevtoolsConnection;

    const store = config(
      (args: any, replace?: boolean, actionName?: string) => {
        const nextState = typeof args === 'function' ? args(get()) : args;

        if (!isRecording) {
          set(nextState, replace);
          return;
        }

        // Determine action name
        const action = { type: actionName || 'setState' };

        if (typeof args === 'function') {
          // Try to extract function name
          const functionName = args.name || 'anonymous';
          action.type =
            functionName !== 'anonymous' ? functionName : 'updateState';
        }

        // Apply sanitizers
        const sanitizedAction = opts.actionSanitizer
          ? opts.actionSanitizer(action)
          : action;

        const currentState = get();
        set(nextState, replace);
        const newState = get();

        // Send to devtools
        if (connection) {
          const sanitizedState = opts.stateSanitizer
            ? opts.stateSanitizer(newState)
            : newState;

          connection.send(sanitizedAction, sanitizedState);
        }
      },
      get,
      api
    );

    // Initialize connection
    try {
      connection = extension.connect({
        name: opts.name,
        serialize: opts.serialize,
        actionSanitizer: opts.actionSanitizer,
        stateSanitizer: opts.stateSanitizer,
      });

      // Initialize devtools with current state
      const initialState = opts.stateSanitizer
        ? opts.stateSanitizer(store)
        : store;

      connection.init(initialState);

      // Subscribe to devtools messages
      const unsubscribe = connection.subscribe((message: any) => {
        if (message.type === 'DISPATCH') {
          switch (message.payload.type) {
            case 'RESET':
              // Reset to initial state
              isRecording = false;
              set(store, true);
              isRecording = true;
              break;

            case 'COMMIT':
              // Commit current state as new initial state
              connection.init(get());
              break;

            case 'ROLLBACK':
              // Rollback to last committed state
              isRecording = false;
              set(store, true);
              isRecording = true;
              break;

            case 'JUMP_TO_STATE':
            case 'JUMP_TO_ACTION':
              // Time travel to specific state
              if (message.state) {
                isRecording = false;
                set(JSON.parse(message.state), true);
                isRecording = true;
              }
              break;

            case 'IMPORT_STATE':
              // Import state from JSON
              if (message.payload.nextLiftedState) {
                const { computedStates } = message.payload.nextLiftedState;
                const lastComputedState =
                  computedStates[computedStates.length - 1];

                isRecording = false;
                set(lastComputedState.state, true);
                isRecording = true;
              }
              break;
          }
        }
      });

      // Add devtools methods to store
      (store as any).devtools = {
        send: (action: any, state?: any) => {
          if (connection) {
            connection.send(action, state || get());
          }
        },
        disconnect: () => {
          if (unsubscribe) unsubscribe();
          if (connection && connection.unsubscribe) {
            connection.unsubscribe();
          }
        },
        connect: () => {
          // Reconnect if needed
          if (!connection) {
            connection = extension.connect({ name: opts.name });
            connection.init(get());
          }
        },
      };
    } catch (error) {
      console.warn('Failed to connect to Redux DevTools:', error);
    }

    return store;
  };
};

// Utility to create action creators with devtools integration
export const createActions = <
  T,
  A extends Record<string, (...args: any[]) => void>,
>(
  actions: (
    set: (fn: (state: T) => void, actionName?: string) => void,
    get: () => T
  ) => A
) => {
  return (set: any, get: any) => {
    const wrappedSet = (fn: (state: T) => void, actionName?: string) => {
      // Wrap the function to capture its name for devtools
      const namedFunction = function namedUpdate(state: T) {
        return fn(state);
      };

      // Set the function name for better devtools display
      Object.defineProperty(namedFunction, 'name', {
        value: actionName || fn.name || 'update',
        configurable: true,
      });

      return set(namedFunction, false, actionName || fn.name);
    };

    return actions(wrappedSet, get);
  };
};

// Utility for action logging
export const logActions = <T>(
  config: StateCreator<T>,
  enabled: boolean = process.env.NODE_ENV === 'development'
) => {
  if (!enabled) return config;

  return (set: any, get: any, api: any) => {
    const store = config(
      (args: any, replace?: boolean, actionName?: string) => {
        const prevState = get();
        set(args, replace, actionName);
        const nextState = get();

        // Log the action
        console.group(
          `%c Action: ${actionName || 'setState'}`,
          'color: #03A9F4; font-weight: bold'
        );
        console.log('%c Previous State:', 'color: #9E9E9E', prevState);
        console.log('%c Action:', 'color: #00BCD4', args);
        console.log('%c Next State:', 'color: #4CAF50', nextState);
        console.groupEnd();
      },
      get,
      api
    );

    return store;
  };
};
