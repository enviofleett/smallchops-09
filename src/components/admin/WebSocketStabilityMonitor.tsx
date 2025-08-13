import React, { useEffect } from 'react';
import { useWebSocketMonitor } from '@/hooks/useWebSocketMonitor';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  CheckCircle, 
  XCircle, 
  AlertTriangle 
} from 'lucide-react';

export const WebSocketStabilityMonitor = () => {
  // Only connect in production or when explicitly needed
  const shouldConnect = process.env.NODE_ENV === 'production';
  const wsUrl = shouldConnect ? 'wss://your-production-websocket-url' : undefined;
  
  const { status, connect, disconnect } = useWebSocketMonitor(wsUrl);

  // Return null in development - completely hide WebSocket monitoring  
  if (process.env.NODE_ENV !== 'production') {
    return null;
  }

  const getStatusColor = () => {
    if (!shouldConnect) return 'bg-gray-100 text-gray-800';
    return status.isConnected 
      ? 'bg-green-100 text-green-800' 
      : status.isRetrying 
      ? 'bg-yellow-100 text-yellow-800'
      : 'bg-red-100 text-red-800';
  };

  const getStatusIcon = () => {
    if (!shouldConnect) return <AlertTriangle className="h-4 w-4 text-gray-600" />;
    if (status.isRetrying) return <RefreshCw className="h-4 w-4 text-yellow-600 animate-spin" />;
    return status.isConnected 
      ? <CheckCircle className="h-4 w-4 text-green-600" />
      : <XCircle className="h-4 w-4 text-red-600" />;
  };

  const getStatusText = () => {
    if (!shouldConnect) return 'Development Mode';
    if (status.isRetrying) return 'Reconnecting...';
    return status.isConnected ? 'Connected' : 'Disconnected';
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wifi className="h-5 w-5" />
          WebSocket Connection Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {getStatusIcon()}
              <span className="font-medium">Connection Status</span>
            </div>
            <Badge className={getStatusColor()}>
              {getStatusText()}
            </Badge>
          </div>

          {shouldConnect && (
            <>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-muted-foreground">Attempts:</span>
                  <span className="ml-2 font-medium">{status.connectionAttempts}</span>
                </div>
                <div>
                  <span className="text-muted-foreground">Retries:</span>
                  <span className="ml-2 font-medium">{status.retryCount}/3</span>
                </div>
              </div>

              {status.lastError && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center gap-2">
                    <XCircle className="h-4 w-4 text-red-600" />
                    <span className="font-medium text-red-800">Connection Error</span>
                  </div>
                  <p className="text-red-700 text-sm mt-1">{status.lastError}</p>
                </div>
              )}

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={connect}
                  disabled={status.isConnected || status.isRetrying}
                >
                  <Wifi className="h-4 w-4 mr-2" />
                  Connect
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={disconnect}
                  disabled={!status.isConnected && !status.isRetrying}
                >
                  <WifiOff className="h-4 w-4 mr-2" />
                  Disconnect
                </Button>
              </div>
            </>
          )}

          {!shouldConnect && (
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-blue-600" />
                <span className="font-medium text-blue-800">Development Mode</span>
              </div>
              <p className="text-blue-700 text-sm mt-1">
                WebSocket connections are disabled in development to prevent console errors.
                Connection will be enabled automatically in production.
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};