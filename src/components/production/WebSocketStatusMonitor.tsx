import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Wifi, WifiOff, AlertTriangle, RefreshCw } from 'lucide-react';
import { useWebSocketMonitor } from '@/hooks/useWebSocketMonitor';

export const WebSocketStatusMonitor: React.FC = () => {
  // Skip WebSocket monitoring in development
  const isProduction = !window.location.hostname.includes('localhost');
  const wsUrl = isProduction ? `wss://${window.location.host}/ws` : undefined;
  
  const { status, connect, disconnect } = useWebSocketMonitor(wsUrl);

  if (!isProduction) {
    return (
      <Card className="w-full">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Wifi className="w-5 h-5" />
            WebSocket Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Development Mode</Badge>
              <span className="text-sm text-muted-foreground">
                WebSocket monitoring disabled in development
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = () => {
    if (status.isConnected) {
      return <Wifi className="w-5 h-5 text-green-500" />;
    } else if (status.isRetrying) {
      return <RefreshCw className="w-5 h-5 text-yellow-500 animate-spin" />;
    } else {
      return <WifiOff className="w-5 h-5 text-red-500" />;
    }
  };

  const getStatusBadge = () => {
    if (status.isConnected) {
      return <Badge variant="default">Connected</Badge>;
    } else if (status.isRetrying) {
      return <Badge variant="secondary">Reconnecting...</Badge>;
    } else {
      return <Badge variant="destructive">Disconnected</Badge>;
    }
  };

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          {getStatusIcon()}
          WebSocket Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                {getStatusBadge()}
                {status.lastError && (
                  <AlertTriangle className="w-4 h-4 text-yellow-500" />
                )}
              </div>
              {status.lastError && (
                <p className="text-sm text-muted-foreground">
                  Last error: {status.lastError}
                </p>
              )}
            </div>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={connect}
                disabled={status.isConnected || status.isRetrying}
              >
                Connect
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnect}
                disabled={!status.isConnected && !status.isRetrying}
              >
                Disconnect
              </Button>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="font-medium">Connection Attempts:</span>
              <span className="ml-2">{status.connectionAttempts}</span>
            </div>
            <div>
              <span className="font-medium">Retry Count:</span>
              <span className="ml-2">{status.retryCount}/3</span>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};