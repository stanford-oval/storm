import { useEffect, useRef, useState, useCallback } from 'react';
import {
  WebSocketManager,
  WebSocketConfig,
  WebSocketState,
  WebSocketMessage,
  createWebSocketConnection,
  createProjectWebSocket,
  createPipelineWebSocket,
  createSessionWebSocket,
} from '../lib/websocket';

export interface UseWebSocketOptions extends Partial<WebSocketConfig> {
  autoConnect?: boolean;
  onOpen?: (event: Event) => void;
  onMessage?: <T>(message: WebSocketMessage<T>) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onReconnect?: (attempt: number) => void;
  onReconnectFailed?: () => void;
}

export interface UseWebSocketReturn {
  ws: WebSocketManager | null;
  state: WebSocketState;
  isConnected: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  send: <T>(type: string, data?: T, options?: { id?: string }) => void;
  subscribe: <T>(messageType: string, handler: (data: T) => void) => () => void;
  connectionInfo: ReturnType<WebSocketManager['getConnectionInfo']> | null;
}

/**
 * Generic WebSocket hook
 */
export function useWebSocket(
  endpoint: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const {
    autoConnect = true,
    onOpen,
    onMessage,
    onError,
    onClose,
    onReconnect,
    onReconnectFailed,
    ...wsConfig
  } = options;

  const [state, setState] = useState<WebSocketState>('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<ReturnType<
    WebSocketManager['getConnectionInfo']
  > | null>(null);

  const wsRef = useRef<WebSocketManager | null>(null);
  const endpointRef = useRef<string | null>(endpoint);

  // Update endpoint ref when it changes
  useEffect(() => {
    endpointRef.current = endpoint;
  }, [endpoint]);

  // Create WebSocket manager
  useEffect(() => {
    if (!endpoint) {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
      return;
    }

    if (!wsRef.current) {
      wsRef.current = createWebSocketConnection(endpoint, wsConfig);

      // Set up event handlers
      wsRef.current.setEventHandlers({
        onOpen: event => {
          setState('connected');
          setIsConnected(true);
          updateConnectionInfo();
          onOpen?.(event);
        },
        onMessage: message => {
          onMessage?.(message);
        },
        onError: event => {
          setState('error');
          setIsConnected(false);
          updateConnectionInfo();
          onError?.(event);
        },
        onClose: event => {
          setState('disconnected');
          setIsConnected(false);
          updateConnectionInfo();
          onClose?.(event);
        },
        onReconnect: attempt => {
          setState('reconnecting');
          setIsConnected(false);
          updateConnectionInfo();
          onReconnect?.(attempt);
        },
        onReconnectFailed: () => {
          setState('error');
          setIsConnected(false);
          updateConnectionInfo();
          onReconnectFailed?.();
        },
      });
    }

    const updateConnectionInfo = () => {
      if (wsRef.current) {
        setConnectionInfo(wsRef.current.getConnectionInfo());
      }
    };

    // Auto-connect if enabled
    if (autoConnect && wsRef.current) {
      setState('connecting');
      wsRef.current.connect().catch(() => {
        setState('error');
        setIsConnected(false);
      });
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
        setState('disconnected');
        setIsConnected(false);
        setConnectionInfo(null);
      }
    };
  }, [
    endpoint,
    autoConnect,
    onOpen,
    onMessage,
    onError,
    onClose,
    onReconnect,
    onReconnectFailed,
  ]);

  const connect = useCallback(async () => {
    if (wsRef.current) {
      setState('connecting');
      try {
        await wsRef.current.connect();
      } catch (error) {
        setState('error');
        setIsConnected(false);
        throw error;
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
    }
  }, []);

  const send = useCallback(
    <T>(type: string, data?: T, options?: { id?: string }) => {
      if (wsRef.current) {
        wsRef.current.send(type, data, options);
      }
    },
    []
  );

  const subscribe = useCallback(
    <T>(messageType: string, handler: (data: T) => void) => {
      if (wsRef.current) {
        return wsRef.current.on(messageType, handler);
      }
      return () => {};
    },
    []
  );

  return {
    ws: wsRef.current,
    state,
    isConnected,
    connect,
    disconnect,
    send,
    subscribe,
    connectionInfo,
  };
}

/**
 * Project-specific WebSocket hook
 */
export function useProjectWebSocket(
  projectId: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn {
  const [state, setState] = useState<WebSocketState>('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<ReturnType<
    WebSocketManager['getConnectionInfo']
  > | null>(null);

  const wsRef = useRef<WebSocketManager | null>(null);

  const {
    autoConnect = true,
    onOpen,
    onMessage,
    onError,
    onClose,
    onReconnect,
    onReconnectFailed,
  } = options;

  useEffect(() => {
    if (!projectId) {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
      return;
    }

    wsRef.current = createProjectWebSocket(projectId);

    const updateConnectionInfo = () => {
      if (wsRef.current) {
        setConnectionInfo(wsRef.current.getConnectionInfo());
      }
    };

    // Set up event handlers
    wsRef.current.setEventHandlers({
      onOpen: event => {
        setState('connected');
        setIsConnected(true);
        updateConnectionInfo();
        onOpen?.(event);
      },
      onMessage: message => {
        onMessage?.(message);
      },
      onError: event => {
        setState('error');
        setIsConnected(false);
        updateConnectionInfo();
        onError?.(event);
      },
      onClose: event => {
        setState('disconnected');
        setIsConnected(false);
        updateConnectionInfo();
        onClose?.(event);
      },
      onReconnect: attempt => {
        setState('reconnecting');
        setIsConnected(false);
        updateConnectionInfo();
        onReconnect?.(attempt);
      },
      onReconnectFailed: () => {
        setState('error');
        setIsConnected(false);
        updateConnectionInfo();
        onReconnectFailed?.();
      },
    });

    if (autoConnect) {
      setState('connecting');
      wsRef.current.connect().catch(() => {
        setState('error');
        setIsConnected(false);
      });
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
        setState('disconnected');
        setIsConnected(false);
        setConnectionInfo(null);
      }
    };
  }, [
    projectId,
    autoConnect,
    onOpen,
    onMessage,
    onError,
    onClose,
    onReconnect,
    onReconnectFailed,
  ]);

  const connect = useCallback(async () => {
    if (wsRef.current) {
      setState('connecting');
      try {
        await wsRef.current.connect();
      } catch (error) {
        setState('error');
        setIsConnected(false);
        throw error;
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
    }
  }, []);

  const send = useCallback(
    <T>(type: string, data?: T, options?: { id?: string }) => {
      if (wsRef.current) {
        wsRef.current.send(type, data, options);
      }
    },
    []
  );

  const subscribe = useCallback(
    <T>(messageType: string, handler: (data: T) => void) => {
      if (wsRef.current) {
        return wsRef.current.on(messageType, handler);
      }
      return () => {};
    },
    []
  );

  return {
    ws: wsRef.current,
    state,
    isConnected,
    connect,
    disconnect,
    send,
    subscribe,
    connectionInfo,
  };
}

/**
 * Pipeline-specific WebSocket hook for real-time pipeline updates
 */
export function usePipelineWebSocket(
  projectId: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn & {
  subscribeToProgress: (handler: (progress: any) => void) => () => void;
  subscribeToLogs: (handler: (log: any) => void) => () => void;
  subscribeToErrors: (handler: (error: any) => void) => () => void;
} {
  const webSocket = useProjectWebSocket(projectId, options);

  const subscribeToProgress = useCallback(
    (handler: (progress: any) => void) => {
      return webSocket.subscribe('pipeline_progress', handler);
    },
    [webSocket]
  );

  const subscribeToLogs = useCallback(
    (handler: (log: any) => void) => {
      return webSocket.subscribe('pipeline_log', handler);
    },
    [webSocket]
  );

  const subscribeToErrors = useCallback(
    (handler: (error: any) => void) => {
      return webSocket.subscribe('pipeline_error', handler);
    },
    [webSocket]
  );

  return {
    ...webSocket,
    subscribeToProgress,
    subscribeToLogs,
    subscribeToErrors,
  };
}

/**
 * Session-specific WebSocket hook for Co-STORM collaborative sessions
 */
export function useSessionWebSocket(
  sessionId: string | null,
  options: UseWebSocketOptions = {}
): UseWebSocketReturn & {
  subscribeToDiscourse: (handler: (message: any) => void) => () => void;
  subscribeToMindMapUpdate: (handler: (update: any) => void) => () => void;
  subscribeToParticipantUpdate: (handler: (update: any) => void) => () => void;
} {
  const [state, setState] = useState<WebSocketState>('disconnected');
  const [isConnected, setIsConnected] = useState(false);
  const [connectionInfo, setConnectionInfo] = useState<ReturnType<
    WebSocketManager['getConnectionInfo']
  > | null>(null);

  const wsRef = useRef<WebSocketManager | null>(null);

  const {
    autoConnect = true,
    onOpen,
    onMessage,
    onError,
    onClose,
    onReconnect,
    onReconnectFailed,
  } = options;

  useEffect(() => {
    if (!sessionId) {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
      }
      return;
    }

    wsRef.current = createSessionWebSocket(sessionId);

    const updateConnectionInfo = () => {
      if (wsRef.current) {
        setConnectionInfo(wsRef.current.getConnectionInfo());
      }
    };

    // Set up event handlers
    wsRef.current.setEventHandlers({
      onOpen: event => {
        setState('connected');
        setIsConnected(true);
        updateConnectionInfo();
        onOpen?.(event);
      },
      onMessage: message => {
        onMessage?.(message);
      },
      onError: event => {
        setState('error');
        setIsConnected(false);
        updateConnectionInfo();
        onError?.(event);
      },
      onClose: event => {
        setState('disconnected');
        setIsConnected(false);
        updateConnectionInfo();
        onClose?.(event);
      },
      onReconnect: attempt => {
        setState('reconnecting');
        setIsConnected(false);
        updateConnectionInfo();
        onReconnect?.(attempt);
      },
      onReconnectFailed: () => {
        setState('error');
        setIsConnected(false);
        updateConnectionInfo();
        onReconnectFailed?.();
      },
    });

    if (autoConnect) {
      setState('connecting');
      wsRef.current.connect().catch(() => {
        setState('error');
        setIsConnected(false);
      });
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.disconnect();
        wsRef.current = null;
        setState('disconnected');
        setIsConnected(false);
        setConnectionInfo(null);
      }
    };
  }, [
    sessionId,
    autoConnect,
    onOpen,
    onMessage,
    onError,
    onClose,
    onReconnect,
    onReconnectFailed,
  ]);

  const connect = useCallback(async () => {
    if (wsRef.current) {
      setState('connecting');
      try {
        await wsRef.current.connect();
      } catch (error) {
        setState('error');
        setIsConnected(false);
        throw error;
      }
    }
  }, []);

  const disconnect = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.disconnect();
    }
  }, []);

  const send = useCallback(
    <T>(type: string, data?: T, options?: { id?: string }) => {
      if (wsRef.current) {
        wsRef.current.send(type, data, options);
      }
    },
    []
  );

  const subscribe = useCallback(
    <T>(messageType: string, handler: (data: T) => void) => {
      if (wsRef.current) {
        return wsRef.current.on(messageType, handler);
      }
      return () => {};
    },
    []
  );

  const subscribeToDiscourse = useCallback(
    (handler: (message: any) => void) => {
      return subscribe('discourse_message', handler);
    },
    [subscribe]
  );

  const subscribeToMindMapUpdate = useCallback(
    (handler: (update: any) => void) => {
      return subscribe('mindmap_update', handler);
    },
    [subscribe]
  );

  const subscribeToParticipantUpdate = useCallback(
    (handler: (update: any) => void) => {
      return subscribe('participant_update', handler);
    },
    [subscribe]
  );

  return {
    ws: wsRef.current,
    state,
    isConnected,
    connect,
    disconnect,
    send,
    subscribe,
    connectionInfo,
    subscribeToDiscourse,
    subscribeToMindMapUpdate,
    subscribeToParticipantUpdate,
  };
}
