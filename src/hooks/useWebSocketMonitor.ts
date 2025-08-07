import { useState, useEffect, useRef } from 'react';

export interface WebSocketStatus {
  isConnected: boolean;
  connectionAttempts: number;
  lastError: string | null;
  retryCount: number;
  isRetrying: boolean;
}

export const useWebSocketMonitor = (url?: string) => {
  const [status, setStatus] = useState<WebSocketStatus>({
    isConnected: false,
    connectionAttempts: 0,
    lastError: null,
    retryCount: 0,
    isRetrying: false
  });

  const websocketRef = useRef<WebSocket | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const maxRetries = 3;
  const baseRetryDelay = 2000; // 2 seconds

  const connect = () => {
    // Skip WebSocket connection in development or production without proper WebSocket server
    if (!url || url.includes('localhost:8098') || window.location.hostname === 'startersmallchops.com') {
      console.log('Skipping WebSocket connection - no WebSocket server available');
      setStatus(prev => ({ 
        ...prev, 
        isConnected: false, 
        lastError: 'WebSocket disabled - no server available',
        isRetrying: false 
      }));
      return;
    }

    setStatus(prev => ({ 
      ...prev, 
      connectionAttempts: prev.connectionAttempts + 1,
      isRetrying: true 
    }));

    try {
      const ws = new WebSocket(url);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('WebSocket connected');
        setStatus(prev => ({
          ...prev,
          isConnected: true,
          lastError: null,
          retryCount: 0,
          isRetrying: false
        }));
      };

      ws.onclose = (event) => {
        console.log('WebSocket disconnected:', event.code, event.reason);
        setStatus(prev => ({
          ...prev,
          isConnected: false,
          lastError: `Connection closed: ${event.reason || 'Unknown reason'}`,
          isRetrying: false
        }));

        // Only retry if it wasn't a manual close and we haven't exceeded max retries
        if (event.code !== 1000 && status.retryCount < maxRetries) {
          scheduleReconnect();
        }
      };

      ws.onerror = (error) => {
        console.log('WebSocket error (handled gracefully):', error);
        setStatus(prev => ({
          ...prev,
          isConnected: false,
          lastError: 'Connection error',
          isRetrying: false
        }));
      };

    } catch (error) {
      console.log('WebSocket connection failed (handled gracefully):', error);
      setStatus(prev => ({
        ...prev,
        isConnected: false,
        lastError: error instanceof Error ? error.message : 'Connection failed',
        isRetrying: false
      }));
    }
  };

  const scheduleReconnect = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
    }

    const delay = baseRetryDelay * Math.pow(2, status.retryCount); // Exponential backoff
    
    retryTimeoutRef.current = setTimeout(() => {
      setStatus(prev => ({ ...prev, retryCount: prev.retryCount + 1 }));
      connect();
    }, delay);

    console.log(`WebSocket will retry in ${delay}ms (attempt ${status.retryCount + 1}/${maxRetries})`);
  };

  const disconnect = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }

    if (websocketRef.current) {
      websocketRef.current.close(1000, 'Manual disconnect');
      websocketRef.current = null;
    }

    setStatus({
      isConnected: false,
      connectionAttempts: 0,
      lastError: null,
      retryCount: 0,
      isRetrying: false
    });
  };

  useEffect(() => {
    if (url) {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [url]);

  return {
    status,
    connect,
    disconnect,
    sendMessage: (message: string) => {
      if (websocketRef.current?.readyState === WebSocket.OPEN) {
        websocketRef.current.send(message);
        return true;
      }
      return false;
    }
  };
};