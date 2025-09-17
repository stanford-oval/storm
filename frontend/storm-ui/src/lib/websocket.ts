export interface WebSocketConfig {
  url: string;
  protocols?: string[];
  reconnectDelay?: number;
  maxRetryAttempts?: number;
  heartbeatInterval?: number;
  debug?: boolean;
}

export interface WebSocketMessage<T = any> {
  type: string;
  data?: T;
  timestamp: number;
  id?: string;
}

export interface WebSocketEventHandlers {
  onOpen?: (event: Event) => void;
  onMessage?: <T>(message: WebSocketMessage<T>) => void;
  onError?: (event: Event) => void;
  onClose?: (event: CloseEvent) => void;
  onReconnect?: (attempt: number) => void;
  onReconnectFailed?: () => void;
}

export type WebSocketState =
  | 'connecting'
  | 'connected'
  | 'disconnected'
  | 'error'
  | 'reconnecting';

export class WebSocketManager {
  private ws: WebSocket | null = null;
  private config: Required<WebSocketConfig>;
  private handlers: WebSocketEventHandlers = {};
  private reconnectAttempt = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private messageQueue: WebSocketMessage[] = [];
  private state: WebSocketState = 'disconnected';
  private messageHandlers: Map<string, Set<(data: any) => void>> = new Map();

  constructor(config: WebSocketConfig) {
    this.config = {
      protocols: [],
      reconnectDelay: parseInt(
        process.env.NEXT_PUBLIC_WS_RECONNECT_DELAY || '5000'
      ),
      maxRetryAttempts: parseInt(
        process.env.NEXT_PUBLIC_WS_MAX_RETRY_ATTEMPTS || '5'
      ),
      heartbeatInterval: 30000,
      debug: process.env.NEXT_PUBLIC_API_DEBUG === 'true',
      ...config,
    };
  }

  /**
   * Connect to WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setState('connecting');

      try {
        this.ws = new WebSocket(this.config.url, this.config.protocols);

        this.ws.onopen = event => {
          this.setState('connected');
          this.reconnectAttempt = 0;
          this.startHeartbeat();
          this.flushMessageQueue();

          if (this.config.debug) {
            console.log('🔌 WebSocket connected:', this.config.url);
          }

          this.handlers.onOpen?.(event);
          resolve();
        };

        this.ws.onmessage = event => {
          try {
            const message: WebSocketMessage = JSON.parse(event.data);

            if (this.config.debug) {
              console.log('📨 WebSocket message:', message);
            }

            // Handle heartbeat/pong messages
            if (message.type === 'pong') {
              return;
            }

            // Call general message handler
            this.handlers.onMessage?.(message);

            // Call specific message type handlers
            const typeHandlers = this.messageHandlers.get(message.type);
            if (typeHandlers) {
              typeHandlers.forEach(handler => handler(message.data));
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        this.ws.onerror = event => {
          this.setState('error');

          if (this.config.debug) {
            console.error('❌ WebSocket error:', event);
          }

          this.handlers.onError?.(event);
          reject(new Error('WebSocket connection failed'));
        };

        this.ws.onclose = event => {
          this.setState('disconnected');
          this.stopHeartbeat();

          if (this.config.debug) {
            console.log('🔌 WebSocket closed:', event.code, event.reason);
          }

          this.handlers.onClose?.(event);

          // Attempt reconnection if not closed intentionally
          if (
            !event.wasClean &&
            this.reconnectAttempt < this.config.maxRetryAttempts
          ) {
            this.scheduleReconnect();
          } else if (this.reconnectAttempt >= this.config.maxRetryAttempts) {
            this.handlers.onReconnectFailed?.();
          }
        };
      } catch (error) {
        this.setState('error');
        reject(error);
      }
    });
  }

  /**
   * Disconnect from WebSocket server
   */
  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    this.stopHeartbeat();

    if (this.ws) {
      this.ws.close(1000, 'Client disconnect');
      this.ws = null;
    }

    this.setState('disconnected');
  }

  /**
   * Send a message to the WebSocket server
   */
  send<T>(type: string, data?: T, options?: { id?: string }): void {
    const message: WebSocketMessage<T> = {
      type,
      data,
      timestamp: Date.now(),
      id: options?.id || this.generateMessageId(),
    };

    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));

      if (this.config.debug) {
        console.log('📤 WebSocket send:', message);
      }
    } else {
      // Queue message for when connection is re-established
      this.messageQueue.push(message);

      if (this.config.debug) {
        console.log('📤 WebSocket queued:', message);
      }
    }
  }

  /**
   * Subscribe to specific message types
   */
  on<T>(messageType: string, handler: (data: T) => void): () => void {
    if (!this.messageHandlers.has(messageType)) {
      this.messageHandlers.set(messageType, new Set());
    }

    this.messageHandlers.get(messageType)!.add(handler);

    // Return unsubscribe function
    return () => {
      const handlers = this.messageHandlers.get(messageType);
      if (handlers) {
        handlers.delete(handler);
        if (handlers.size === 0) {
          this.messageHandlers.delete(messageType);
        }
      }
    };
  }

  /**
   * Set event handlers
   */
  setEventHandlers(handlers: WebSocketEventHandlers): void {
    this.handlers = { ...this.handlers, ...handlers };
  }

  /**
   * Get current connection state
   */
  getState(): WebSocketState {
    return this.state;
  }

  /**
   * Check if WebSocket is connected
   */
  isConnected(): boolean {
    return this.state === 'connected' && this.ws?.readyState === WebSocket.OPEN;
  }

  /**
   * Get connection info
   */
  getConnectionInfo() {
    return {
      state: this.state,
      url: this.config.url,
      reconnectAttempt: this.reconnectAttempt,
      queuedMessages: this.messageQueue.length,
      readyState: this.ws?.readyState,
    };
  }

  private setState(state: WebSocketState): void {
    this.state = state;
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) {
      return;
    }

    this.setState('reconnecting');
    this.reconnectAttempt++;

    const delay =
      this.config.reconnectDelay * Math.pow(2, this.reconnectAttempt - 1);

    if (this.config.debug) {
      console.log(
        `🔄 WebSocket reconnecting in ${delay}ms (attempt ${this.reconnectAttempt}/${this.config.maxRetryAttempts})`
      );
    }

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      this.handlers.onReconnect?.(this.reconnectAttempt);
      this.connect().catch(() => {
        // Reconnect will be scheduled by onclose handler
      });
    }, delay);
  }

  private startHeartbeat(): void {
    if (this.config.heartbeatInterval <= 0) {
      return;
    }

    this.stopHeartbeat();

    this.heartbeatTimer = setInterval(() => {
      if (this.isConnected()) {
        this.send('ping');
      }
    }, this.config.heartbeatInterval);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  private flushMessageQueue(): void {
    while (this.messageQueue.length > 0 && this.isConnected()) {
      const message = this.messageQueue.shift();
      if (message) {
        this.ws!.send(JSON.stringify(message));

        if (this.config.debug) {
          console.log('📤 WebSocket flushed:', message);
        }
      }
    }
  }

  private generateMessageId(): string {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }
}

// WebSocket connection manager singleton
class WebSocketConnectionManager {
  private connections: Map<string, WebSocketManager> = new Map();

  /**
   * Get or create a WebSocket connection
   */
  getConnection(key: string, config: WebSocketConfig): WebSocketManager {
    if (!this.connections.has(key)) {
      this.connections.set(key, new WebSocketManager(config));
    }
    return this.connections.get(key)!;
  }

  /**
   * Remove a WebSocket connection
   */
  removeConnection(key: string): void {
    const connection = this.connections.get(key);
    if (connection) {
      connection.disconnect();
      this.connections.delete(key);
    }
  }

  /**
   * Get all active connections
   */
  getAllConnections(): Map<string, WebSocketManager> {
    return new Map(this.connections);
  }

  /**
   * Close all connections
   */
  closeAllConnections(): void {
    this.connections.forEach(connection => connection.disconnect());
    this.connections.clear();
  }
}

// Export singleton instance
export const websocketManager = new WebSocketConnectionManager();

// Utility functions for creating WebSocket connections
export function createWebSocketConnection(
  endpoint: string,
  options: Partial<WebSocketConfig> = {}
): WebSocketManager {
  const baseUrl = process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws';
  const url = `${baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

  return new WebSocketManager({
    url,
    ...options,
  });
}

export function createProjectWebSocket(projectId: string): WebSocketManager {
  return websocketManager.getConnection(`project-${projectId}`, {
    url: `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'}/projects/${projectId}`,
  });
}

export function createPipelineWebSocket(projectId: string): WebSocketManager {
  return websocketManager.getConnection(`pipeline-${projectId}`, {
    url: `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'}/pipeline/${projectId}`,
  });
}

export function createSessionWebSocket(sessionId: string): WebSocketManager {
  return websocketManager.getConnection(`session-${sessionId}`, {
    url: `${process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:8000/ws'}/sessions/${sessionId}`,
  });
}
