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
    // Enhanced connection validation and fallback logic
    const hostname = window.location.hostname;
    const skipDomains = ['startersmallchops.com', 'vercel.app'];
    const shouldSkip = !url || url.includes('localhost:8098') || skipDomains.some(domain => hostname.includes(domain));
    
    if (shouldSkip) {
      console.log('⚠️ WebSocket connection skipped - using HTTP fallback mode');
      setStatus(prev => ({ 
        ...prev, 
        isConnected: false, 
        lastError: 'WebSocket disabled - using HTTP polling fallback',
        isRetrying: false 
      }));
      return;
    }

    // Connection timeout handling (30 seconds max)
    const connectionTimeout = setTimeout(() => {
      if (websocketRef.current && websocketRef.current.readyState === WebSocket.CONNECTING) {
        console.log('⏰ WebSocket connection timeout - closing connection');
        websocketRef.current.close();
        setStatus(prev => ({
          ...prev,
          isConnected: false,
          lastError: 'Connection timeout - server may be unavailable',
          isRetrying: false
        }));
      }
    }, 30000);

    setStatus(prev => ({ 
      ...prev, 
      connectionAttempts: prev.connectionAttempts + 1,
      isRetrying: true 
    }));

    try {
      const ws = new WebSocket(url);
      websocketRef.current = ws;

      ws.onopen = () => {
        console.log('✅ WebSocket connected successfully');
        clearTimeout(connectionTimeout);
        setStatus(prev => ({
          ...prev,
          isConnected: true,
          lastError: null,
          retryCount: 0,
          isRetrying: false
        }));
      };

      ws.onclose = (event) => {
        console.log('🔌 WebSocket disconnected:', event.code, event.reason);
        clearTimeout(connectionTimeout);
        setStatus(prev => ({
          ...prev,
          isConnected: false,
          lastError: `Connection closed: ${event.reason || 'Server disconnected'}`,
          isRetrying: false
        }));

        // Enhanced retry logic with exponential backoff
        if (event.code !== 1000 && status.retryCount < maxRetries) {
          console.log(`🔄 Scheduling reconnection attempt ${status.retryCount + 1}/${maxRetries}`);
          scheduleReconnect();
        } else if (status.retryCount >= maxRetries) {
          console.log('❌ Max reconnection attempts reached - falling back to HTTP mode');
          setStatus(prev => ({
            ...prev,
            lastError: 'Max reconnection attempts reached. Using HTTP fallback.',
            isRetrying: false
          }));
        }
      };

      ws.onerror = (error) => {
        console.log('⚠️ WebSocket error (handled gracefully):', error);
        clearTimeout(connectionTimeout);
        setStatus(prev => ({
          ...prev,
          isConnected: false,
          lastError: 'Network connectivity issue detected',
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