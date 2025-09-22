import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Cloud, Database, Wifi, WifiOff } from 'lucide-react';

interface DataSourceIndicatorProps {
  source?: string;
  isLoading?: boolean;
  error?: any;
  ordersCount?: number;
}

export const DataSourceIndicator: React.FC<DataSourceIndicatorProps> = ({
  source,
  isLoading,
  error,
  ordersCount = 0
}) => {
  if (isLoading) {
    return (
      <Badge variant="secondary" className="flex items-center gap-1">
        <Wifi className="w-3 h-3 animate-pulse" />
        Loading orders...
      </Badge>
    );
  }

  if (error) {
    return (
      <Badge variant="destructive" className="flex items-center gap-1">
        <WifiOff className="w-3 h-3" />
        Connection error
      </Badge>
    );
  }

  const getSourceInfo = () => {
    switch (source) {
      case 'edge-function':
        return {
          icon: <Cloud className="w-3 h-3" />,
          label: 'Edge Function',
          variant: 'default' as const,
          description: 'Using optimized edge function'
        };
      case 'fallback':
        return {
          icon: <Database className="w-3 h-3" />,
          label: 'Direct Database',
          variant: 'secondary' as const,
          description: 'Fallback to direct database query'
        };
      default:
        return {
          icon: <Wifi className="w-3 h-3" />,
          label: 'Connected',
          variant: 'outline' as const,
          description: 'System operational'
        };
    }
  };

  const sourceInfo = getSourceInfo();

  return (
    <div className="flex items-center gap-2">
      <Badge variant={sourceInfo.variant} className="flex items-center gap-1" title={sourceInfo.description}>
        {sourceInfo.icon}
        {sourceInfo.label}
      </Badge>
      {ordersCount > 0 && (
        <Badge variant="outline" className="text-xs">
          {ordersCount} orders
        </Badge>
      )}
    </div>
  );
};