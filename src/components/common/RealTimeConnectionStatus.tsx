import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  Wifi, 
  WifiOff, 
  Loader2, 
  RefreshCw,
  Clock
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface RealTimeConnectionStatusProps {
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  lastUpdated?: Date | null;
  onReconnect?: () => void;
  className?: string;
  showLastUpdated?: boolean;
  compact?: boolean;
}

/**
 * Component to display real-time connection status
 * Shows connection state and provides reconnect functionality
 */
export const RealTimeConnectionStatus: React.FC<RealTimeConnectionStatusProps> = ({
  connectionStatus,
  lastUpdated,
  onReconnect,
  className,
  showLastUpdated = true,
  compact = false
}) => {
  const getStatusConfig = () => {
    switch (connectionStatus) {
      case 'connected':
        return {
          variant: 'default' as const,
          icon: Wifi,
          text: compact ? 'Live' : 'Live Updates',
          color: 'text-green-600'
        };
      case 'connecting':
        return {
          variant: 'secondary' as const,
          icon: Loader2,
          text: compact ? 'Connecting' : 'Connecting...',
          color: 'text-yellow-600'
        };
      case 'disconnected':
        return {
          variant: 'destructive' as const,
          icon: WifiOff,
          text: compact ? 'Offline' : 'Disconnected',
          color: 'text-red-600'
        };
    }
  };

  const { variant, icon: Icon, text, color } = getStatusConfig();

  const formatLastUpdated = (date: Date) => {
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) {
      return 'Just now';
    } else if (diffInSeconds < 3600) {
      const minutes = Math.floor(diffInSeconds / 60);
      return `${minutes}m ago`;
    } else {
      const hours = Math.floor(diffInSeconds / 3600);
      return `${hours}h ago`;
    }
  };

  if (compact) {
    return (
      <div className={cn('flex items-center gap-2', className)}>
        <Badge variant={variant} className="flex items-center gap-1">
          <Icon className={cn('h-3 w-3', connectionStatus === 'connecting' && 'animate-spin')} />
          {text}
        </Badge>
        {connectionStatus === 'disconnected' && onReconnect && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onReconnect}
            className="h-6 px-2"
          >
            <RefreshCw className="h-3 w-3" />
          </Button>
        )}
      </div>
    );
  }

  return (
    <div className={cn('flex items-center justify-between p-3 rounded-lg border bg-card', className)}>
      <div className="flex items-center gap-3">
        <div className={cn('p-2 rounded-full', {
          'bg-green-100': connectionStatus === 'connected',
          'bg-yellow-100': connectionStatus === 'connecting',
          'bg-red-100': connectionStatus === 'disconnected'
        })}>
          <Icon className={cn(
            'h-4 w-4',
            color,
            connectionStatus === 'connecting' && 'animate-spin'
          )} />
        </div>
        
        <div>
          <p className="font-medium">{text}</p>
          {showLastUpdated && lastUpdated && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              Last updated: {formatLastUpdated(lastUpdated)}
            </div>
          )}
        </div>
      </div>

      {connectionStatus === 'disconnected' && onReconnect && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReconnect}
          className="flex items-center gap-2"
        >
          <RefreshCw className="h-4 w-4" />
          Reconnect
        </Button>
      )}
    </div>
  );
};