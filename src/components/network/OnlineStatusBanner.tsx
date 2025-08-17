import React from 'react';
import { Wifi, WifiOff, Signal } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNetwork } from './NetworkProvider';

export const OnlineStatusBanner: React.FC = () => {
  const { isOnline, wasOffline, connectionQuality } = useNetwork();
  
  // Don't show anything if always been online
  if (isOnline && !wasOffline) {
    return null;
  }

  // Show connection restored message
  if (isOnline && wasOffline) {
    return (
      <Alert className="mx-4 my-2 border-green-500 bg-green-50 text-green-800">
        <Wifi className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <span>Connection restored! You're back online.</span>
          {connectionQuality !== 'unknown' && (
            <div className="flex items-center space-x-1 text-xs">
              <Signal className="h-3 w-3" />
              <span className="capitalize">{connectionQuality}</span>
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Show offline message
  if (!isOnline) {
    return (
      <Alert className="mx-4 my-2 border-red-500 bg-red-50 text-red-800">
        <WifiOff className="h-4 w-4" />
        <AlertDescription>
          You're currently offline. Some features may not work properly.
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};