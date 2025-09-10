import { useEffect, useRef, useCallback, useState } from 'react';
import {
  WebSocketMessage,
  PipelineUpdateMessage,
  SessionUpdateMessage,
  NotificationMessage,
} from '../../types/api';

export interface UseWebSocketOptions {
  url: string;
  protocols?: string | string[];
  onOpen?: () => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectAttempts?: number;
  reconnectInterval?: number;
  heartbeat?: boolean;
  heartbeatInterval?: number;
}

export interface UseWebSocketResult {
  socket: WebSocket | null;
  isConnected: boolean;
  isConnecting: boolean;
  error: string | null;
  send: (data: any) => boolean;
  sendMessage: <T>(type: string, data: T) => boolean;
  close: () => void;
  reconnect: () => void;
}

export function useWebSocket<T = any>(
  options: UseWebSocketOptions,
  onMessage?: (message: WebSocketMessage<T>) => void
): UseWebSocketResult {
  const [socket, setSocket] = useState<WebSocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const reconnectAttemptsRef = useRef(0);
  const maxReconnectAttempts = options.reconnectAttempts || 5;
  const reconnectInterval = options.reconnectInterval || 3000;

  const cleanup = useCallback(() => {
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }
  }, []);

  const startHeartbeat = useCallback(() => {
    if (options.heartbeat && socket) {
      const interval = options.heartbeatInterval || 30000;
      heartbeatIntervalRef.current = setInterval(() => {
        if (socket.readyState === WebSocket.OPEN) {
          socket.send(JSON.stringify({ type: 'ping', timestamp: new Date() }));
        }
      }, interval);
    }
  }, [options.heartbeat, options.heartbeatInterval, socket]);

  const connect = useCallback(() => {
    if (isConnecting || (socket && socket.readyState === WebSocket.OPEN)) {
      return;
    }

    setIsConnecting(true);
    setError(null);

    try {
      const ws = new WebSocket(options.url, options.protocols);

      ws.onopen = () => {
        setSocket(ws);
        setIsConnected(true);
        setIsConnecting(false);
        setError(null);
        reconnectAttemptsRef.current = 0;

        startHeartbeat();
        options.onOpen?.();
      };

      ws.onclose = event => {
        setIsConnected(false);
        setIsConnecting(false);
        cleanup();

        options.onClose?.(event);

        // Attempt to reconnect if enabled and not a clean close
        if (options.reconnect !== false && !event.wasClean) {
          if (reconnectAttemptsRef.current < maxReconnectAttempts) {
            reconnectAttemptsRef.current++;
            setError(
              `Connection lost. Reconnecting... (${reconnectAttemptsRef.current}/${maxReconnectAttempts})`
            );

            reconnectTimeoutRef.current = setTimeout(() => {
              connect();
            }, reconnectInterval);
          } else {
            setError('Maximum reconnection attempts reached');
          }
        }
      };

      ws.onerror = error => {
        setError('WebSocket connection error');
        setIsConnecting(false);
        options.onError?.(error);
      };

      ws.onmessage = event => {
        try {
          const message = JSON.parse(event.data) as WebSocketMessage<T>;

          // Handle heartbeat responses
          if (message.type === 'pong') {
            return;
          }

          onMessage?.(message);
        } catch (err) {
          console.error('Failed to parse WebSocket message:', err);
        }
      };

      setSocket(ws);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect');
      setIsConnecting(false);
    }
  }, [
    options,
    onMessage,
    isConnecting,
    socket,
    startHeartbeat,
    cleanup,
    maxReconnectAttempts,
    reconnectInterval,
  ]);

  const send = useCallback(
    (data: any): boolean => {
      if (!socket || socket.readyState !== WebSocket.OPEN) {
        return false;
      }

      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        socket.send(message);
        return true;
      } catch (err) {
        console.error('Failed to send WebSocket message:', err);
        return false;
      }
    },
    [socket]
  );

  const sendMessage = useCallback(
    <T>(type: string, data: T): boolean => {
      return send({
        type,
        data,
        timestamp: new Date(),
      });
    },
    [send]
  );

  const close = useCallback(() => {
    cleanup();
    if (socket) {
      socket.close(1000, 'Client closing connection');
      setSocket(null);
      setIsConnected(false);
    }
  }, [socket, cleanup]);

  const reconnectManually = useCallback(() => {
    close();
    reconnectAttemptsRef.current = 0;
    setTimeout(connect, 100);
  }, [close, connect]);

  // Connect on mount
  useEffect(() => {
    connect();
    return () => {
      cleanup();
      if (socket) {
        socket.close();
      }
    };
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      cleanup();
      if (socket) {
        socket.close();
      }
    };
  }, [socket, cleanup]);

  return {
    socket,
    isConnected,
    isConnecting,
    error,
    send,
    sendMessage,
    close,
    reconnect: reconnectManually,
  };
}

// Hook for pipeline updates
export function usePipelineWebSocket(
  projectId: string,
  onUpdate?: (update: PipelineUpdateMessage) => void
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  const wsUrl = baseUrl.replace(/^http/, 'ws') + `/pipeline/${projectId}/ws`;

  return useWebSocket<PipelineUpdateMessage>(
    {
      url: wsUrl,
      reconnect: true,
      heartbeat: true,
    },
    message => {
      if (message.type === 'pipeline_update' && onUpdate) {
        onUpdate(message.data);
      }
    }
  );
}

// Hook for session updates
export function useSessionWebSocket(
  sessionId: string,
  onUpdate?: (update: SessionUpdateMessage) => void
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  const wsUrl = baseUrl.replace(/^http/, 'ws') + `/sessions/${sessionId}/ws`;

  return useWebSocket<SessionUpdateMessage>(
    {
      url: wsUrl,
      reconnect: true,
      heartbeat: true,
    },
    message => {
      if (message.type === 'session_update' && onUpdate) {
        onUpdate(message.data);
      }
    }
  );
}

// Hook for notifications
export function useNotificationWebSocket(
  onNotification?: (notification: NotificationMessage) => void
) {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/notifications/ws';

  return useWebSocket<NotificationMessage>(
    {
      url: wsUrl,
      reconnect: true,
      heartbeat: true,
    },
    message => {
      if (message.type === 'notification' && onNotification) {
        onNotification(message.data);
      }
    }
  );
}

// Hook for real-time analytics
export function useAnalyticsWebSocket(onUpdate?: (data: any) => void) {
  const baseUrl =
    process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/api';
  const wsUrl = baseUrl.replace(/^http/, 'ws') + '/analytics/realtime/ws';

  return useWebSocket(
    {
      url: wsUrl,
      reconnect: true,
      heartbeat: true,
    },
    message => {
      if (message.type === 'analytics_update' && onUpdate) {
        onUpdate(message.data);
      }
    }
  );
}

// Generic event-based WebSocket hook
export interface WebSocketEventHandlers {
  [eventType: string]: (data: any) => void;
}

export function useEventWebSocket(
  url: string,
  eventHandlers: WebSocketEventHandlers,
  options?: Partial<UseWebSocketOptions>
) {
  return useWebSocket(
    {
      url,
      reconnect: true,
      heartbeat: true,
      ...options,
    },
    message => {
      const handler = eventHandlers[message.type];
      if (handler) {
        handler(message.data);
      }
    }
  );
}

// Hook for managing multiple WebSocket connections
export function useMultiWebSocket() {
  const connections = useRef<Map<string, WebSocket>>(new Map());
  const [connectionStates, setConnectionStates] = useState<
    Map<string, boolean>
  >(new Map());

  const addConnection = useCallback(
    (
      key: string,
      options: UseWebSocketOptions,
      onMessage?: (message: any) => void
    ) => {
      // Close existing connection if any
      const existingConnection = connections.current.get(key);
      if (existingConnection) {
        existingConnection.close();
      }

      try {
        const ws = new WebSocket(options.url, options.protocols);

        ws.onopen = () => {
          setConnectionStates(prev => new Map(prev.set(key, true)));
          options.onOpen?.();
        };

        ws.onclose = event => {
          setConnectionStates(prev => new Map(prev.set(key, false)));
          connections.current.delete(key);
          options.onClose?.(event);
        };

        ws.onerror = options.onError || null;

        ws.onmessage = event => {
          try {
            const message = JSON.parse(event.data);
            onMessage?.(message);
          } catch (err) {
            console.error('Failed to parse WebSocket message:', err);
          }
        };

        connections.current.set(key, ws);
        return ws;
      } catch (err) {
        console.error('Failed to create WebSocket connection:', err);
        return null;
      }
    },
    []
  );

  const removeConnection = useCallback((key: string) => {
    const connection = connections.current.get(key);
    if (connection) {
      connection.close();
      connections.current.delete(key);
      setConnectionStates(prev => {
        const newState = new Map(prev);
        newState.delete(key);
        return newState;
      });
    }
  }, []);

  const sendToConnection = useCallback((key: string, data: any): boolean => {
    const connection = connections.current.get(key);
    if (connection && connection.readyState === WebSocket.OPEN) {
      try {
        const message = typeof data === 'string' ? data : JSON.stringify(data);
        connection.send(message);
        return true;
      } catch (err) {
        console.error('Failed to send message:', err);
        return false;
      }
    }
    return false;
  }, []);

  const closeAll = useCallback(() => {
    connections.current.forEach(connection => {
      connection.close();
    });
    connections.current.clear();
    setConnectionStates(new Map());
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      closeAll();
    };
  }, [closeAll]);

  return {
    addConnection,
    removeConnection,
    sendToConnection,
    closeAll,
    connectionStates,
    isConnected: (key: string) => connectionStates.get(key) || false,
  };
}
