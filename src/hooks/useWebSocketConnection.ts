import { useEffect, useRef, useState } from 'react';

interface WebSocketConfig {
  url: string;
  maxRetries?: number;
  retryDelay?: number;
  onMessage?: (event: MessageEvent) => void;
  onError?: (error: Event) => void;
  onOpen?: () => void;
  onClose?: () => void;
}

export const useWebSocketConnection = (config: WebSocketConfig) => {
  const [isConnected, setIsConnected] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isRetrying, setIsRetrying] = useState(false);
  const websocketRef = useRef<WebSocket | null>(null);
  const retryTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const {
    url,
    maxRetries = 3,
    retryDelay = 2000,
    onMessage,
    onError,
    onOpen,
    onClose
  } = config;

  const cleanup = () => {
    if (retryTimeoutRef.current) {
      clearTimeout(retryTimeoutRef.current);
      retryTimeoutRef.current = null;
    }
    
    if (websocketRef.current) {
      websocketRef.current.removeEventListener('open', handleOpen);
      websocketRef.current.removeEventListener('message', handleMessage);
      websocketRef.current.removeEventListener('error', handleError);
      websocketRef.current.removeEventListener('close', handleClose);
      
      if (websocketRef.current.readyState === WebSocket.OPEN) {
        websocketRef.current.close();
      }
      
      websocketRef.current = null;
    }
  };

  const handleOpen = () => {
    setIsConnected(true);
    setRetryCount(0);
    setIsRetrying(false);
    onOpen?.();
  };

  const handleMessage = (event: MessageEvent) => {
    onMessage?.(event);
  };

  const handleError = (error: Event) => {
    // Only log WebSocket errors if they're not development connection issues
    if (!url.includes('localhost:8098') && !url.includes('127.0.0.1:8098')) {
      console.warn(`WebSocket connection error for ${url}:`, error);
    }
    setIsConnected(false);
    onError?.(error);
  };

  const handleClose = () => {
    setIsConnected(false);
    onClose?.();
    
    // Only retry if we haven't exceeded max retries and we're not already retrying
    if (retryCount < maxRetries && !isRetrying) {
      setIsRetrying(true);
      const delay = retryDelay * Math.pow(2, retryCount); // Exponential backoff
      
      retryTimeoutRef.current = setTimeout(() => {
        setRetryCount(prev => prev + 1);
        connect();
      }, delay);
    } else if (retryCount >= maxRetries) {
      // Only log retry failures for non-development URLs
      if (!url.includes('localhost:8098') && !url.includes('127.0.0.1:8098')) {
        console.warn(`WebSocket connection failed after ${maxRetries} retries for ${url}`);
      }
    }
  };

  const connect = () => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    cleanup();

    try {
      websocketRef.current = new WebSocket(url);
      
      websocketRef.current.addEventListener('open', handleOpen);
      websocketRef.current.addEventListener('message', handleMessage);
      websocketRef.current.addEventListener('error', handleError);
      websocketRef.current.addEventListener('close', handleClose);
    } catch (error) {
      // Only log connection creation errors for non-development URLs
      if (!url.includes('localhost:8098') && !url.includes('127.0.0.1:8098')) {
        console.warn(`Failed to create WebSocket connection to ${url}:`, error);
      }
      handleClose();
    }
  };

  const disconnect = () => {
    cleanup();
    setIsConnected(false);
    setRetryCount(0);
    setIsRetrying(false);
  };

  const sendMessage = (message: string | ArrayBuffer | Blob) => {
    if (websocketRef.current?.readyState === WebSocket.OPEN) {
      websocketRef.current.send(message);
      return true;
    }
    return false;
  };

  useEffect(() => {
    // Only connect in development mode and if URL is provided
    if (process.env.NODE_ENV === 'development' && url) {
      connect();
    }

    return cleanup;
  }, [url]);

  useEffect(() => {
    return cleanup;
  }, []);

  return {
    isConnected,
    isRetrying,
    retryCount,
    connect,
    disconnect,
    sendMessage
  };
};