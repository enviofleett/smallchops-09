import React from 'react';
import { Wifi, WifiOff, Signal, AlertTriangle, CheckCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useNetwork } from './NetworkProvider';

export const OnlineStatusBanner: React.FC = () => {
  const { isOnline, wasOffline, connectionQuality, apiAvailable, networkLatency } = useNetwork();
  
  // Don't show anything if always been online and everything is working well
  if (isOnline && !wasOffline && apiAvailable && connectionQuality !== 'poor') {
    return null;
  }

  // Show connection restored message
  if (isOnline && wasOffline && apiAvailable) {
    return (
      <Alert className="mx-4 my-2 border-green-500 bg-green-50 text-green-800">
        <CheckCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div>
            <span className="font-medium">Connection restored!</span>
            <span className="ml-2">All services are working normally.</span>
          </div>
          {connectionQuality !== 'unknown' && networkLatency && (
            <div className="flex items-center space-x-2 text-xs">
              <Signal className="h-3 w-3" />
              <span className="capitalize">{connectionQuality}</span>
              <span>({Math.round(networkLatency)}ms)</span>
            </div>
          )}
        </AlertDescription>
      </Alert>
    );
  }

  // Show API issues warning (when online but API is not available)
  if (isOnline && !apiAvailable) {
    return (
      <Alert className="mx-4 my-2 border-orange-500 bg-orange-50 text-orange-800">
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          <div>
            <span className="font-medium">Service connectivity issues detected.</span>
            <span className="ml-2">Some features may not work properly. We're working to resolve this.</span>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  // Show poor connection warning
  if (isOnline && apiAvailable && connectionQuality === 'poor') {
    return (
      <Alert className="mx-4 my-2 border-yellow-500 bg-yellow-50 text-yellow-800">
        <Signal className="h-4 w-4" />
        <AlertDescription>
          <div className="flex items-center justify-between">
            <div>
              <span className="font-medium">Slow connection detected.</span>
              <span className="ml-2">Content may load slower than usual.</span>
            </div>
            {networkLatency && (
              <div className="text-xs">
                {Math.round(networkLatency)}ms latency
              </div>
            )}
          </div>
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
          <div>
            <span className="font-medium">You're currently offline.</span>
            <span className="ml-2">Some features may not work properly. Please check your internet connection.</span>
          </div>
        </AlertDescription>
      </Alert>
    );
  }

  return null;
};