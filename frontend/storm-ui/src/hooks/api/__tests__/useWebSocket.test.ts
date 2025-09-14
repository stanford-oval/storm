import { renderHook, act, waitFor } from '@/test/utils';
import { useWebSocket } from '../useWebSocket';
import WS from 'jest-websocket-mock';
import { mockWebSocketServer } from '@/test/utils';

const TEST_WS_URL = 'ws://localhost:8080';

describe('useWebSocket', () => {
  let server: WS;

  beforeEach(() => {
    server = new WS(TEST_WS_URL);
  });

  afterEach(() => {
    WS.clean();
  });

  describe('connection management', () => {
    it('connects to WebSocket server', async () => {
      const { result } = renderHook(() => useWebSocket(TEST_WS_URL));

      act(() => {
        result.current.connect();
      });

      await server.connected;

      expect(result.current.readyState).toBe(WebSocket.OPEN);
      expect(result.current.isConnected).toBe(true);
    });

    it('disconnects from WebSocket server', async () => {
      const { result } = renderHook(() => useWebSocket(TEST_WS_URL));

      act(() => {
        result.current.connect();
      });

      await server.connected;

      act(() => {
        result.current.disconnect();
      });

      expect(result.current.readyState).toBe(WebSocket.CLOSED);
      expect(result.current.isConnected).toBe(false);
    });

    it('auto-connects when autoConnect is true', async () => {
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { autoConnect: true  }));
      await server.connected;

      expect(result.current.isConnected).toBe(true);
    });

    it('does not auto-connect when autoConnect is false', async () => {
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { autoConnect: false  }));
      // Wait a bit to ensure no connection attempt
      await act(async () => {
        await new Promise(resolve => setTimeout(resolve, 100));
      });

      expect(result.current.isConnected).toBe(false);
    });

  describe('message handling', () => {
    it('sends messages successfully', async () => {
      const { result } = renderHook(() => useWebSocket(TEST_WS_URL));

      act(() => {
        result.current.connect();
      });

      await server.connected;

      const message = { type: 'test', payload: 'hello' };

      act(() => {
        result.current.sendMessage(message);
      });

      await expect(server).toReceiveMessage(JSON.stringify(message));
    });

    it('receives messages successfully', async () => {
      const onMessage = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { onMessage  }));
      act(() => {
        result.current.connect();
      });

      await server.connected;

      const message = { type: 'response', payload: 'world' };

      act(() => {
        server.send(JSON.stringify(message);
      });

      expect(onMessage).toHaveBeenCalledWith(message);
      expect(result.current.lastMessage).toEqual(message);
    });

    it('handles message history', async () => {
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { saveMessageHistory: true  }));
      act(() => {
        result.current.connect();
      });

      await server.connected;

      const messages = [
        { type: 'msg1', payload: 'first' },
        { type: 'msg2', payload: 'second' },
        { type: 'msg3', payload: 'third' },
      ];

      for (const message of messages) {
        act(() => {
          server.send(JSON.stringify(message);
        });
      }

      expect(result.current.messageHistory).toEqual(messages);
    });

    it('limits message history size', async () => {
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { saveMessageHistory: true,
          maxHistorySize: 2,
         }));
      act(() => {
        result.current.connect();
      });

      await server.connected;

      const messages = [
        { type: 'msg1', payload: 'first' },
        { type: 'msg2', payload: 'second' },
        { type: 'msg3', payload: 'third' },
      ];

      for (const message of messages) {
        act(() => {
          server.send(JSON.stringify(message);
        });
      }

      // Should only keep the last 2 messages
      expect(result.current.messageHistory).toEqual([messages[1], messages[2]]);
    });

    it('filters messages by type', async () => {
      const onPipelineMessage = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { messageFilter: (msg: any) => msg.type === 'pipeline_update',
          onMessage: onPipelineMessage,
         }));
      act(() => {
        result.current.connect();
      });

      await server.connected;

      const pipelineMessage = { type: 'pipeline_update', data: {} };
      const otherMessage = { type: 'other', data: {} };

      act(() => {
        server.send(JSON.stringify(pipelineMessage);
        server.send(JSON.stringify(otherMessage);
      });

      expect(onPipelineMessage).toHaveBeenCalledTimes(1);
      expect(onPipelineMessage).toHaveBeenCalledWith(pipelineMessage);
    });

  describe('reconnection logic', () => {
    it('attempts reconnection on connection loss', async () => {
      const onReconnectAttempt = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { shouldReconnect: true,
          reconnectAttempts: 3,
          reconnectInterval: 100,
          onReconnectAttempt,
         }));
      act(() => {
        result.current.connect();
      });

      await server.connected;

      // Simulate connection loss
      act(() => {
        server.close();
      });

      expect(result.current.isConnected).toBe(false);

      // Wait for reconnection attempt
      await waitFor(() => {
        expect(onReconnectAttempt).toHaveBeenCalled();
      });

    it('stops reconnecting after max attempts', async () => {
      const onReconnectFailed = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { shouldReconnect: true,
          reconnectAttempts: 2,
          reconnectInterval: 50,
          onReconnectFailed,
         }));
      act(() => {
        result.current.connect();
      });

      await server.connected;

      // Close server to prevent reconnection
      server.close();

      act(() => {
        result.current.connect();
      });

      await waitFor(() => {
        expect(onReconnectFailed).toHaveBeenCalled();
      });

    it('exponentially backs off reconnection attempts', async () => {
      const onReconnectAttempt = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { shouldReconnect: true,
          reconnectAttempts: 3,
          reconnectInterval: 100,
          exponentialBackoff: true,
          onReconnectAttempt,
         }));
      act(() => {
        result.current.connect();
      });

      await server.connected;

      const startTime = Date.now();

      // Simulate connection loss
      act(() => {
        server.close();
      });

      // Wait for multiple reconnection attempts
      await waitFor(
        () => {
          expect(onReconnectAttempt).toHaveBeenCalledTimes(3);
        },
        { timeout: 5000 }
      );

      const endTime = Date.now();
      const elapsed = endTime - startTime;

      // With exponential backoff: 100ms + 200ms + 400ms = 700ms minimum
      expect(elapsed).toBeGreaterThan(600);
    });

  describe('subscription management', () => {
    it('subscribes to specific message types', async () => {
      const pipelineHandler = jest.fn();
      const researchHandler = jest.fn();

      const { result } = renderHook(() => useWebSocket(TEST_WS_URL));

      act(() => {
        result.current.connect();
      });

      await server.connected;

      act(() => {
        result.current.subscribe('pipeline_update', pipelineHandler);
        result.current.subscribe('research_update', researchHandler);
      });

      const pipelineMessage = {
        type: 'pipeline_update',
        data: { stage: 'research' },
      };
      const researchMessage = {
        type: 'research_update',
        data: { progress: 50 },
      };

      act(() => {
        server.send(JSON.stringify(pipelineMessage);
        server.send(JSON.stringify(researchMessage);
      });

      expect(pipelineHandler).toHaveBeenCalledWith(pipelineMessage);
      expect(researchHandler).toHaveBeenCalledWith(researchMessage);
    });

    it('unsubscribes from message types', async () => {
      const handler = jest.fn();
      const { result } = renderHook(() => useWebSocket(TEST_WS_URL));

      act(() => {
        result.current.connect();
      });

      await server.connected;

      act(() => {
        result.current.subscribe('test_message', handler);
      });

      const message = { type: 'test_message', data: {} };

      act(() => {
        server.send(JSON.stringify(message);
      });

      expect(handler).toHaveBeenCalledTimes(1);

      act(() => {
        result.current.unsubscribe('test_message', handler);
      });

      act(() => {
        server.send(JSON.stringify(message);
      });

      // Should not be called again after unsubscribing
      expect(handler).toHaveBeenCalledTimes(1);
    });

    it('supports multiple handlers for same message type', async () => {
      const handler1 = jest.fn();
      const handler2 = jest.fn();

      const { result } = renderHook(() => useWebSocket(TEST_WS_URL));

      act(() => {
        result.current.connect();
      });

      await server.connected;

      act(() => {
        result.current.subscribe('test_message', handler1);
        result.current.subscribe('test_message', handler2);
      });

      const message = { type: 'test_message', data: {} };

      act(() => {
        server.send(JSON.stringify(message);
      });

      expect(handler1).toHaveBeenCalledWith(message);
      expect(handler2).toHaveBeenCalledWith(message);
    });

  describe('error handling', () => {
    it('handles connection errors', async () => {
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket('ws://invalid-url:9999', { onError });
      act(() => {
        result.current.connect();
      });

      await waitFor(() => {
        expect(onError).toHaveBeenCalled();
      });

      expect(result.current.lastError).toBeTruthy();
    });

    it('handles malformed message errors', async () => {
      const onError = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { onError  }));
      act(() => {
        result.current.connect();
      });

      await server.connected;

      act(() => {
        server.send('invalid json message');
      });

      expect(onError).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'parse_error',
        });

    it('retries failed send operations', async () => {
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { retryFailedSends: true,
          maxSendRetries: 3,
         }));
      act(() => {
        result.current.connect();
      });

      await server.connected;

      // Disconnect to make send fail
      act(() => {
        server.close();
      });

      act(() => {
        result.current.sendMessage({ type: 'test' });

      // Reconnect server
      server = new WS(TEST_WS_URL);

      act(() => {
        result.current.connect();
      });

      await server.connected;

      // Should retry and succeed
      await expect(server).toReceiveMessage(JSON.stringify({ type: 'test' });

  describe('heartbeat/ping-pong', () => {
    it('sends periodic ping messages', async () => {
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, {
          heartbeatInterval: 100,
          pingMessage: { type: 'ping' },
        });
      act(() => {
        result.current.connect();
      });

      await server.connected;

      // Should receive ping message within interval
      await expect(server).toReceiveMessage(JSON.stringify({ type: 'ping' });

    it('handles pong responses', async () => {
      const onPong = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, {
          heartbeatInterval: 100,
          pingMessage: { type: 'ping' },
          pongMessage: { type: 'pong' },
          onPong,
        });
      act(() => {
        result.current.connect();
      });

      await server.connected;

      // Wait for ping
      await expect(server).toReceiveMessage(JSON.stringify({ type: 'ping' });

      // Send pong response
      act(() => {
        server.send(JSON.stringify({ type: 'pong' });

      expect(onPong).toHaveBeenCalled();
    });

    it('detects connection timeout', async () => {
      const onConnectionTimeout = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, {
          heartbeatInterval: 50,
          heartbeatTimeout: 100,
          pingMessage: { type: 'ping' },
          pongMessage: { type: 'pong' },
          onConnectionTimeout,
        });
      act(() => {
        result.current.connect();
      });

      await server.connected;

      // Wait for ping
      await expect(server).toReceiveMessage(JSON.stringify({ type: 'ping' });

      // Don't send pong response to simulate timeout
      await waitFor(
        () => {
          expect(onConnectionTimeout).toHaveBeenCalled();
        },
        { timeout: 200 }
      );
    });

  describe('binary data handling', () => {
    it('sends binary data', async () => {
      const { result } = renderHook(() => useWebSocket(TEST_WS_URL));

      act(() => {
        result.current.connect();
      });

      await server.connected;

      const binaryData = new Uint8Array([1, 2, 3, 4]);

      act(() => {
        result.current.sendBinaryData(binaryData);
      });

      // Note: jest-websocket-mock might not fully support binary data
      // In a real test, you'd verify the binary data was sent correctly
      expect(server).toHaveReceivedMessages([binaryData]);
    });

    it('receives binary data', async () => {
      const onBinaryMessage = jest.fn();
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { onBinaryMessage  }));
      act(() => {
        result.current.connect();
      });

      await server.connected;

      const binaryData = new Uint8Array([5, 6, 7, 8]);

      act(() => {
        server.send(binaryData);
      });

      expect(onBinaryMessage).toHaveBeenCalledWith(binaryData);
    });

  describe('cleanup', () => {
    it('cleans up on unmount', async () => {
      const { result, unmount } = renderHook(() => useWebSocket(TEST_WS_URL, { status: 200  }));

      act(() => {
        result.current.connect();
      });

      await server.connected;

      unmount();
      // Connection should be closed
      expect(server.server.clients().size).toBe(0);
    });

    it('clears subscriptions on unmount', async () => {
      const handler = jest.fn();
      const { result, unmount } = renderHook(() => useWebSocket(TEST_WS_URL, { status: 200  }));

      act(() => {
        result.current.connect();
        result.current.subscribe('test_message', handler);
      });

      await server.connected;

      unmount();
      // Create new connection
      const { result: result2 } = renderHook(() => useWebSocket(TEST_WS_URL, { status: 200  }));

      act(() => {
        result2.current.connect();
      });

      await server.connected;

      act(() => {
        server.send(JSON.stringify({ type: 'test_message', data: {} });

      // Handler from unmounted component should not be called
      expect(handler).not.toHaveBeenCalled();
    });

  describe('advanced features', () => {
    it('supports custom protocols', async () => {
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { protocols: ['storm-protocol', 'v1'],
         }));
      act(() => {
        result.current.connect();
      });

      await server.connected;

      // In a real test, you'd verify the protocol was negotiated
      expect(result.current.protocol).toBeTruthy();
    });

    it('handles buffered sends when disconnected', async () => {
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { bufferWhenDisconnected: true  }));
      const message1 = { type: 'test1', data: {} };
      const message2 = { type: 'test2', data: {} };

      // Send messages while disconnected
      act(() => {
        result.current.sendMessage(message1);
        result.current.sendMessage(message2);
      });

      expect(result.current.bufferedMessages).toHaveLength(2);

      // Connect and flush buffer
      act(() => {
        result.current.connect();
      });

      await server.connected;

      await expect(server).toReceiveMessage(JSON.stringify(message1);
      await expect(server).toReceiveMessage(JSON.stringify(message2);

      expect(result.current.bufferedMessages).toHaveLength(0);
    });

    it('supports message compression', async () => {
      const { result } = renderHook(() =>
        useWebSocket(TEST_WS_URL, { compress: true,
          compressionThreshold: 100,
         }));
      act(() => {
        result.current.connect();
      });

      await server.connected;

      // Large message that should be compressed
      const largeMessage = {
        type: 'large_data',
        data: 'x'.repeat(1000),
      };

      act(() => {
        result.current.sendMessage(largeMessage);
      });

      // In a real implementation, you'd verify compression was applied
      await expect(server).toReceiveMessage(expect.any(String, { status: 200 });
});
