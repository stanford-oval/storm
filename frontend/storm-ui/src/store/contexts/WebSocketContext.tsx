'use client';

// WebSocket context provider for real-time connections
import React, {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  ReactNode,
} from 'react';
import { useConfig } from './ConfigContext';
import { useAuthStore } from '../slices/authStore';
import { useNotificationStore } from '../slices/notificationStore';
import {
  getConnectionStatusColor,
  getConnectionStatusText,
} from '@/utils/status';
import type { WebSocketMessage } from '../types';

// WebSocket connection states
export type WebSocketState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'reconnecting'
  | 'error';

// WebSocket event handlers
export interface WebSocketEventHandlers {
  onConnect?: () => void;
  onDisconnect?: (code: number, reason: string) => void;
  onError?: (error: Event) => void;
  onMessage?: (message: WebSocketMessage) => void;
  onReconnect?: (attempt: number) => void;
}

// WebSocket configuration
export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnect: boolean;
  reconnectInterval: number;
  maxReconnectAttempts: number;
  reconnectBackoff: boolean;
  heartbeatInterval: number;
  heartbeatTimeout: number;
  enableCompression: boolean;
  enableEncryption: boolean;
}

// WebSocket context type
interface WebSocketContextType {
  // Connection state
  state: WebSocketState;
  isConnected: boolean;
  lastError: string | null;
  reconnectAttempt: number;
  connectionId: string | null;

  // Connection management
  connect: (config?: Partial<WebSocketConfig>) => void;
  disconnect: () => void;
  reconnect: () => void;

  // Message handling
  send: (type: string, payload: any, options?: MessageOptions) => boolean;
  subscribe: (type: string, handler: (payload: any) => void) => () => void;
  unsubscribe: (type: string, handler?: (payload: any) => void) => void;

  // Status
  getConnectionInfo: () => ConnectionInfo;
  getMessageStats: () => MessageStats;

  // Event handlers
  setEventHandlers: (handlers: Partial<WebSocketEventHandlers>) => void;
}

// Message options
export interface MessageOptions {
  priority?: 'low' | 'normal' | 'high';
  timeout?: number;
  retry?: boolean;
  expectResponse?: boolean;
  responseTimeout?: number;
}

// Connection info
export interface ConnectionInfo {
  state: WebSocketState;
  url: string;
  connectedAt: Date | null;
  reconnectAttempts: number;
  lastPingTime: Date | null;
  latency: number | null;
  protocol: string | null;
  extensions: string[];
}

// Message statistics
export interface MessageStats {
  sent: number;
  received: number;
  errors: number;
  averageLatency: number;
  messageTypes: Record<string, number>;
}

// WebSocket context
const WebSocketContext = createContext<WebSocketContextType | undefined>(
  undefined
);

// Default configuration
const defaultConfig: WebSocketConfig = {
  url: '',
  protocols: [],
  reconnect: true,
  reconnectInterval: 1000,
  maxReconnectAttempts: 5,
  reconnectBackoff: true,
  heartbeatInterval: 30000, // 30 seconds
  heartbeatTimeout: 5000, // 5 seconds
  enableCompression: true,
  enableEncryption: true,
};

// WebSocket provider props
export interface WebSocketProviderProps {
  children: ReactNode;
  config?: Partial<WebSocketConfig>;
  autoConnect?: boolean;
  enableGlobalEvents?: boolean;
}

// WebSocket provider component
export const WebSocketProvider: React.FC<WebSocketProviderProps> = ({
  children,
  config: configOverride,
  autoConnect = false,
  enableGlobalEvents = true,
}) => {
  // Refs for stable references
  const wsRef = useRef<WebSocket | null>(null);
  const configRef = useRef<WebSocketConfig>({
    ...defaultConfig,
    ...configOverride,
  });
  const eventHandlersRef = useRef<WebSocketEventHandlers>({});
  const subscribersRef = useRef<Map<string, Set<(payload: any) => void>>>(
    new Map()
  );
  const messageQueueRef = useRef<
    Array<{ type: string; payload: any; options?: MessageOptions }>
  >([]);
  const reconnectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const heartbeatTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // State
  const [state, setState] = useState<WebSocketState>('disconnected');
  const [lastError, setLastError] = useState<string | null>(null);
  const [reconnectAttempt, setReconnectAttempt] = useState(0);
  const [connectionId, setConnectionId] = useState<string | null>(null);
  const [connectionInfo, setConnectionInfo] = useState<ConnectionInfo>({
    state: 'disconnected',
    url: '',
    connectedAt: null,
    reconnectAttempts: 0,
    lastPingTime: null,
    latency: null,
    protocol: null,
    extensions: [],
  });
  const [messageStats, setMessageStats] = useState<MessageStats>({
    sent: 0,
    received: 0,
    errors: 0,
    averageLatency: 0,
    messageTypes: {},
  });

  // External dependencies
  const { config: appConfig } = useConfig();
  const { token, isAuthenticated } = useAuthStore();
  const { showError, showInfo } = useNotificationStore();

  // Build WebSocket URL
  const buildWebSocketUrl = (baseUrl?: string): string => {
    const apiUrl = baseUrl || appConfig.api.baseUrl;
    const wsUrl = apiUrl.replace(/^http/, 'ws');
    const url = new URL('/ws', wsUrl);

    if (isAuthenticated && token) {
      url.searchParams.set('token', token);
    }

    return url.toString();
  };

  // Connect to WebSocket
  const connect = (configOverrides?: Partial<WebSocketConfig>) => {
    if (
      wsRef.current?.readyState === WebSocket.CONNECTING ||
      wsRef.current?.readyState === WebSocket.OPEN
    ) {
      return;
    }

    // Update configuration
    if (configOverrides) {
      configRef.current = { ...configRef.current, ...configOverrides };
    }

    const config = configRef.current;
    const url = config.url || buildWebSocketUrl();

    setState('connecting');
    setLastError(null);

    try {
      wsRef.current = new WebSocket(url, config.protocols);

      // Connection opened
      wsRef.current.onopen = event => {
        setState('connected');
        setReconnectAttempt(0);
        setConnectionId(
          `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        );

        const now = new Date();
        setConnectionInfo(prev => ({
          ...prev,
          state: 'connected',
          url,
          connectedAt: now,
          reconnectAttempts: 0,
          protocol: wsRef.current?.protocol || null,
          extensions: wsRef.current?.extensions
            ? wsRef.current.extensions.split(', ')
            : [],
        }));

        // Process queued messages
        processMessageQueue();

        // Start heartbeat
        startHeartbeat();

        // Call event handler
        eventHandlersRef.current.onConnect?.();

        // Global event
        if (enableGlobalEvents) {
          window.dispatchEvent(
            new CustomEvent('websocket:connected', {
              detail: { url, connectionId },
            })
          );
        }

        // Show notification
        showInfo('Connected', 'Real-time connection established');
      };

      // Message received
      wsRef.current.onmessage = event => {
        try {
          const message: WebSocketMessage = JSON.parse(event.data);

          // Update stats
          setMessageStats(prev => ({
            ...prev,
            received: prev.received + 1,
            messageTypes: {
              ...prev.messageTypes,
              [message.type]: (prev.messageTypes[message.type] || 0) + 1,
            },
          }));

          // Handle heartbeat response
          if (message.type === 'pong') {
            handlePongMessage(message);
            return;
          }

          // Notify subscribers
          const subscribers = subscribersRef.current.get(message.type);
          if (subscribers) {
            subscribers.forEach(handler => {
              try {
                handler(message.payload);
              } catch (error) {
                console.error(
                  `Error in WebSocket message handler for type ${message.type}:`,
                  error
                );
              }
            });
          }

          // Call global message handler
          eventHandlersRef.current.onMessage?.(message);

          // Global event
          if (enableGlobalEvents) {
            window.dispatchEvent(
              new CustomEvent('websocket:message', { detail: message })
            );
          }
        } catch (error) {
          console.error('Error parsing WebSocket message:', error);
          setMessageStats(prev => ({ ...prev, errors: prev.errors + 1 }));
        }
      };

      // Connection error
      wsRef.current.onerror = event => {
        setState('error');
        setLastError('WebSocket connection error');

        setConnectionInfo(prev => ({ ...prev, state: 'error' }));

        // Call event handler
        eventHandlersRef.current.onError?.(event);

        // Global event
        if (enableGlobalEvents) {
          window.dispatchEvent(
            new CustomEvent('websocket:error', { detail: event })
          );
        }
      };

      // Connection closed
      wsRef.current.onclose = event => {
        setState('disconnected');
        setConnectionId(null);

        setConnectionInfo(prev => ({
          ...prev,
          state: 'disconnected',
          connectedAt: null,
        }));

        // Stop heartbeat
        stopHeartbeat();

        // Call event handler
        eventHandlersRef.current.onDisconnect?.(event.code, event.reason);

        // Global event
        if (enableGlobalEvents) {
          window.dispatchEvent(
            new CustomEvent('websocket:disconnected', {
              detail: { code: event.code, reason: event.reason },
            })
          );
        }

        // Handle reconnection
        if (
          config.reconnect &&
          reconnectAttempt < config.maxReconnectAttempts &&
          !event.wasClean
        ) {
          scheduleReconnect();
        } else if (reconnectAttempt >= config.maxReconnectAttempts) {
          showError(
            'Connection Failed',
            'Maximum reconnection attempts reached'
          );
        }
      };
    } catch (error) {
      setState('error');
      setLastError(
        error instanceof Error
          ? error.message
          : 'Failed to create WebSocket connection'
      );
      console.error('WebSocket connection error:', error);
    }
  };

  // Disconnect from WebSocket
  const disconnect = () => {
    // Clear reconnect timeout
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    // Stop heartbeat
    stopHeartbeat();

    // Close connection
    if (wsRef.current) {
      wsRef.current.close(1000, 'Normal closure');
      wsRef.current = null;
    }

    setState('disconnected');
    setConnectionId(null);
    setReconnectAttempt(0);
  };

  // Reconnect to WebSocket
  const reconnect = () => {
    disconnect();
    setTimeout(() => connect(), 100);
  };

  // Schedule reconnection with backoff
  const scheduleReconnect = () => {
    const config = configRef.current;
    const attempt = reconnectAttempt + 1;
    setReconnectAttempt(attempt);
    setState('reconnecting');

    let delay = config.reconnectInterval;
    if (config.reconnectBackoff) {
      delay = Math.min(delay * Math.pow(2, attempt - 1), 30000); // Max 30 seconds
    }

    reconnectTimeoutRef.current = setTimeout(() => {
      eventHandlersRef.current.onReconnect?.(attempt);
      connect();
    }, delay);
  };

  // Send message
  const send = (
    type: string,
    payload: any,
    options: MessageOptions = {}
  ): boolean => {
    const message: WebSocketMessage = {
      type,
      payload,
      id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    // Queue message if not connected
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      if (options.priority === 'high' || options.retry !== false) {
        messageQueueRef.current.push({ type, payload, options });
      }
      return false;
    }

    try {
      wsRef.current.send(JSON.stringify(message));

      // Update stats
      setMessageStats(prev => ({
        ...prev,
        sent: prev.sent + 1,
        messageTypes: {
          ...prev.messageTypes,
          [type]: (prev.messageTypes[type] || 0) + 1,
        },
      }));

      return true;
    } catch (error) {
      console.error('Error sending WebSocket message:', error);
      setMessageStats(prev => ({ ...prev, errors: prev.errors + 1 }));

      // Queue for retry if enabled
      if (options.retry !== false) {
        messageQueueRef.current.push({ type, payload, options });
      }

      return false;
    }
  };

  // Process queued messages
  const processMessageQueue = () => {
    const queue = messageQueueRef.current;
    messageQueueRef.current = [];

    queue.forEach(({ type, payload, options }) => {
      send(type, payload, options);
    });
  };

  // Subscribe to message type
  const subscribe = (
    type: string,
    handler: (payload: any) => void
  ): (() => void) => {
    if (!subscribersRef.current.has(type)) {
      subscribersRef.current.set(type, new Set());
    }

    subscribersRef.current.get(type)!.add(handler);

    return () => {
      const subscribers = subscribersRef.current.get(type);
      if (subscribers) {
        subscribers.delete(handler);
        if (subscribers.size === 0) {
          subscribersRef.current.delete(type);
        }
      }
    };
  };

  // Unsubscribe from message type
  const unsubscribe = (type: string, handler?: (payload: any) => void) => {
    const subscribers = subscribersRef.current.get(type);
    if (subscribers) {
      if (handler) {
        subscribers.delete(handler);
      } else {
        subscribers.clear();
      }

      if (subscribers.size === 0) {
        subscribersRef.current.delete(type);
      }
    }
  };

  // Start heartbeat
  const startHeartbeat = () => {
    const config = configRef.current;

    heartbeatIntervalRef.current = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        const pingTime = Date.now();
        send('ping', { timestamp: pingTime });

        setConnectionInfo(prev => ({
          ...prev,
          lastPingTime: new Date(pingTime),
        }));

        // Set timeout for pong response
        heartbeatTimeoutRef.current = setTimeout(() => {
          console.warn('WebSocket heartbeat timeout, reconnecting...');
          reconnect();
        }, config.heartbeatTimeout);
      }
    }, config.heartbeatInterval);
  };

  // Stop heartbeat
  const stopHeartbeat = () => {
    if (heartbeatIntervalRef.current) {
      clearInterval(heartbeatIntervalRef.current);
      heartbeatIntervalRef.current = null;
    }

    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }
  };

  // Handle pong message
  const handlePongMessage = (message: WebSocketMessage) => {
    if (heartbeatTimeoutRef.current) {
      clearTimeout(heartbeatTimeoutRef.current);
      heartbeatTimeoutRef.current = null;
    }

    if (message.payload?.timestamp) {
      const latency = Date.now() - message.payload.timestamp;
      setConnectionInfo(prev => ({ ...prev, latency }));

      // Update average latency
      setMessageStats(prev => ({
        ...prev,
        averageLatency:
          prev.averageLatency === 0
            ? latency
            : (prev.averageLatency + latency) / 2,
      }));
    }
  };

  // Set event handlers
  const setEventHandlers = (handlers: Partial<WebSocketEventHandlers>) => {
    eventHandlersRef.current = { ...eventHandlersRef.current, ...handlers };
  };

  // Auto-connect on mount if enabled
  useEffect(() => {
    if (autoConnect && isAuthenticated) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [autoConnect, isAuthenticated]);

  // Reconnect when authentication changes
  useEffect(() => {
    if (isAuthenticated && state === 'connected') {
      // Update URL with new token
      const newUrl = buildWebSocketUrl();
      if (newUrl !== connectionInfo.url) {
        reconnect();
      }
    } else if (!isAuthenticated && state === 'connected') {
      disconnect();
    }
  }, [isAuthenticated, token]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, []);

  const contextValue: WebSocketContextType = {
    // Connection state
    state,
    isConnected: state === 'connected',
    lastError,
    reconnectAttempt,
    connectionId,

    // Connection management
    connect,
    disconnect,
    reconnect,

    // Message handling
    send,
    subscribe,
    unsubscribe,

    // Status
    getConnectionInfo: () => connectionInfo,
    getMessageStats: () => messageStats,

    // Event handlers
    setEventHandlers,
  };

  return (
    <WebSocketContext.Provider value={contextValue}>
      {children}
    </WebSocketContext.Provider>
  );
};

// Hook to use WebSocket context
export const useWebSocket = (): WebSocketContextType => {
  const context = useContext(WebSocketContext);
  if (context === undefined) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
};

// Hook for specific message type subscription
export const useWebSocketSubscription = (
  messageType: string,
  handler: (payload: any) => void,
  deps: React.DependencyList = []
) => {
  const { subscribe } = useWebSocket();

  useEffect(() => {
    const unsubscribe = subscribe(messageType, handler);
    return unsubscribe;
  }, [messageType, subscribe, ...deps]);
};

// Hook for sending messages
export const useWebSocketSender = () => {
  const { send, isConnected } = useWebSocket();

  return {
    send,
    isConnected,
    sendMessage: (type: string, payload: any, options?: MessageOptions) => {
      if (!isConnected) {
        console.warn(
          `Cannot send message of type ${type}: WebSocket not connected`
        );
        return false;
      }
      return send(type, payload, options);
    },
  };
};

// Higher-order component for WebSocket integration
export const withWebSocket = <P extends object>(
  Component: React.ComponentType<P & { websocket: WebSocketContextType }>
) => {
  return React.forwardRef<any, P>((props, ref) => {
    const websocket = useWebSocket();
    return <Component {...(props as P)} websocket={websocket} ref={ref} />;
  });
};

// WebSocket status indicator component
export const WebSocketStatus: React.FC<{
  showDetails?: boolean;
  className?: string;
}> = ({ showDetails = false, className }) => {
  const { state, isConnected, lastError, reconnectAttempt } = useWebSocket();

  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
    >
      <div
        style={{
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          backgroundColor: getConnectionStatusColor(state as any),
        }}
        title={`WebSocket ${getConnectionStatusText(state as any, reconnectAttempt)}`}
      />

      {showDetails && (
        <div style={{ fontSize: '12px', color: '#6b7280' }}>
          <span>{getConnectionStatusText(state as any, reconnectAttempt)}</span>
          {lastError && state === 'error' && (
            <div style={{ color: '#ef4444', marginTop: '2px' }}>
              {lastError}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
