import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface NetworkContextType {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
  connectionQuality: 'poor' | 'good' | 'excellent' | 'unknown';
  apiAvailable: boolean;
  lastApiCheck: Date | null;
  networkLatency: number | null;
  checkApiHealth: () => Promise<boolean>;
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  wasOffline: false,
  lastOnlineAt: null,
  connectionQuality: 'unknown',
  apiAvailable: true,
  lastApiCheck: null,
  networkLatency: null,
  checkApiHealth: async () => true
});

export const useNetwork = () => useContext(NetworkContext);

interface NetworkProviderProps {
  children: ReactNode;
}

export const NetworkProvider: React.FC<NetworkProviderProps> = ({ children }) => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [wasOffline, setWasOffline] = useState(false);
  const [lastOnlineAt, setLastOnlineAt] = useState<Date | null>(new Date());
  const [connectionQuality, setConnectionQuality] = useState<'poor' | 'good' | 'excellent' | 'unknown'>('unknown');
  const [apiAvailable, setApiAvailable] = useState(true);
  const [lastApiCheck, setLastApiCheck] = useState<Date | null>(null);
  const [networkLatency, setNetworkLatency] = useState<number | null>(null);

  // Check API health by making a lightweight request
  const checkApiHealth = async (): Promise<boolean> => {
    try {
      const startTime = performance.now();
      
      // Use a lightweight health check endpoint or basic connectivity test
      const response = await fetch(window.location.origin + '/health', {
        method: 'HEAD',
        cache: 'no-cache',
        signal: AbortSignal.timeout(5000) // 5 second timeout
      }).catch(() => {
        // If health endpoint doesn't exist, try a basic connectivity test
        return fetch('https://www.google.com/favicon.ico', {
          method: 'HEAD',
          mode: 'no-cors',
          cache: 'no-cache',
          signal: AbortSignal.timeout(5000)
        });
      });
      
      const endTime = performance.now();
      const latency = endTime - startTime;
      
      setNetworkLatency(latency);
      setLastApiCheck(new Date());
      
      const isHealthy = response.ok || response.type === 'opaque'; // no-cors responses are opaque
      setApiAvailable(isHealthy);
      
      console.log(`🌐 API Health Check: ${isHealthy ? '✅' : '❌'} (${latency.toFixed(0)}ms)`);
      
      return isHealthy;
    } catch (error) {
      console.error('🚨 API health check failed:', error);
      setApiAvailable(false);
      setLastApiCheck(new Date());
      return false;
    }
  };

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
      if (wasOffline) {
        console.log('🟢 Network connection restored');
        // Check API health when coming back online
        checkApiHealth();
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
      setApiAvailable(false);
      console.log('🔴 Network connection lost');
    };

    // Monitor connection quality
    const checkConnectionQuality = () => {
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        const effectiveType = connection?.effectiveType;
        
        switch (effectiveType) {
          case 'slow-2g':
          case '2g':
            setConnectionQuality('poor');
            break;
          case '3g':
            setConnectionQuality('good');
            break;
          case '4g':
            setConnectionQuality('excellent');
            break;
          default:
            setConnectionQuality('unknown');
        }
        
        console.log(`📶 Connection quality: ${effectiveType || 'unknown'}`);
      }
    };

    // Initial API health check
    if (navigator.onLine) {
      checkApiHealth();
    }

    // Set up periodic API health checks (every 2 minutes)
    const apiHealthInterval = setInterval(() => {
      if (navigator.onLine) {
        checkApiHealth();
      }
    }, 2 * 60 * 1000);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    if ('connection' in navigator) {
      const connection = (navigator as any).connection;
      connection?.addEventListener('change', checkConnectionQuality);
      checkConnectionQuality();
    }

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(apiHealthInterval);
      
      if ('connection' in navigator) {
        const connection = (navigator as any).connection;
        connection?.removeEventListener('change', checkConnectionQuality);
      }
    };
  }, [wasOffline]);

  return (
    <NetworkContext.Provider value={{
      isOnline,
      wasOffline,
      lastOnlineAt,
      connectionQuality,
      apiAvailable,
      lastApiCheck,
      networkLatency,
      checkApiHealth
    }}>
      {children}
    </NetworkContext.Provider>
  );
};