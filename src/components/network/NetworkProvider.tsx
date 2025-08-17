import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface NetworkContextType {
  isOnline: boolean;
  wasOffline: boolean;
  lastOnlineAt: Date | null;
  connectionQuality: 'poor' | 'good' | 'excellent' | 'unknown';
}

const NetworkContext = createContext<NetworkContextType>({
  isOnline: true,
  wasOffline: false,
  lastOnlineAt: null,
  connectionQuality: 'unknown'
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

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setLastOnlineAt(new Date());
      if (wasOffline) {
        console.log('🟢 Network connection restored');
      }
    };

    const handleOffline = () => {
      setIsOnline(false);
      setWasOffline(true);
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
      }
    };

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
      connectionQuality
    }}>
      {children}
    </NetworkContext.Provider>
  );
};