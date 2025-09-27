import React from 'react';
import { X, Wifi, WifiOff, Clock } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Order } from '@/types/orderDetailsModal';
import { StatusBadge } from './StatusBadge';

interface OrderHeaderProps {
  order: Order;
  onClose: () => void;
  connectionStatus: 'connecting' | 'connected' | 'disconnected';
  lastUpdated: Date | null;
}

export const OrderHeader: React.FC<OrderHeaderProps> = ({
  order,
  onClose,
  connectionStatus,
  lastUpdated,
}) => {
  const formatLastUpdated = (date: Date | null) => {
    if (!date) return '';
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    return date.toLocaleDateString();
  };

  const getConnectionIcon = () => {
    switch (connectionStatus) {
      case 'connected':
        return <Wifi className="h-4 w-4 text-success" />;
      case 'disconnected':
        return <WifiOff className="h-4 w-4 text-destructive" />;
      default:
        return <Clock className="h-4 w-4 text-muted-foreground animate-spin" />;
    }
  };

  const getConnectionText = () => {
    switch (connectionStatus) {
      case 'connected':
        return 'Live updates';
      case 'disconnected':
        return 'Disconnected';
      default:
        return 'Connecting...';
    }
  };

  return (
    <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 mb-2">
          <h1 
            id="order-details-title"
            className="text-2xl font-bold text-foreground truncate"
          >
            Order #{order.order_number}
          </h1>
          <StatusBadge status={order.status} />
        </div>
        
        <div className="flex items-center gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-1">
            {getConnectionIcon()}
            <span>{getConnectionText()}</span>
          </div>
          
          {lastUpdated && (
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4" />
              <span>Updated {formatLastUpdated(lastUpdated)}</span>
            </div>
          )}
          
          <Badge variant="outline" className="capitalize">
            {order.order_type}
          </Badge>
        </div>
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={onClose}
        className="shrink-0"
        aria-label="Close order details"
      >
        <X className="h-5 w-5" />
      </Button>
    </header>
  );
};