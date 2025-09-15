import React, { useState, useMemo, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderWithItems } from '@/api/orders';
import { OrderStatus } from '@/types/orders';
import { Clock, MapPin, Phone, Mail, User, Package, AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

// Utility function for formatting currency
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

interface OptimizedOrderTableProps {
  orders: OrderWithItems[];
  isLoading: boolean;
  onOrderUpdate: (orderId: string, updates: any) => Promise<void>;
  onOrderSelect?: (order: OrderWithItems) => void;
  processingOrders?: Set<string>;
  className?: string;
}

// Status configuration with optimized rendering
const getStatusConfig = (status: OrderStatus) => {
  const configs = {
    pending: {
      label: 'Pending',
      variant: 'secondary' as const,
      icon: Clock,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      priority: 1
    },
    confirmed: {
      label: 'Confirmed',
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
      priority: 2
    },
    preparing: {
      label: 'Preparing',
      variant: 'default' as const,
      icon: Package,
      className: 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400',
      priority: 3
    },
    ready: {
      label: 'Ready',
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      priority: 4
    },
    out_for_delivery: {
      label: 'Out for Delivery',
      variant: 'default' as const,
      icon: MapPin,
      className: 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400',
      priority: 5
    },
    delivered: {
      label: 'Delivered',
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      priority: 6
    },
    cancelled: {
      label: 'Cancelled',
      variant: 'destructive' as const,
      icon: XCircle,
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      priority: 0
    },
    refunded: {
      label: 'Refunded',
      variant: 'destructive' as const,
      icon: XCircle,
      className: 'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400',
      priority: 0
    },
    completed: {
      label: 'Completed',
      variant: 'default' as const,
      icon: CheckCircle2,
      className: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400',
      priority: 7
    },
    returned: {
      label: 'Returned',
      variant: 'destructive' as const,
      icon: XCircle,
      className: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
      priority: 0
    }
  };

  return configs[status] || configs.pending;
};

// Memoized order row component for performance
const OptimizedOrderRow = React.memo<{
  order: OrderWithItems;
  onOrderUpdate: (orderId: string, updates: any) => Promise<void>;
  onOrderSelect?: (order: OrderWithItems) => void;
  isProcessing?: boolean;
}>(({ order, onOrderUpdate, onOrderSelect, isProcessing }) => {
  const statusConfig = useMemo(() => getStatusConfig(order.status as OrderStatus), [order.status]);
  const StatusIcon = statusConfig.icon;

  const handleStatusChange = useCallback(async (newStatus: OrderStatus) => {
    if (isProcessing) return;
    
    try {
      await onOrderUpdate(order.id, { status: newStatus });
    } catch (error) {
      console.error('Status update failed:', error);
    }
  }, [order.id, onOrderUpdate, isProcessing]);

  const handleRowClick = useCallback(() => {
    if (onOrderSelect && !isProcessing) {
      onOrderSelect(order);
    }
  }, [order, onOrderSelect, isProcessing]);

  // Quick status actions based on current status
  const getQuickActions = useMemo(() => {
    const actions: Array<{ label: string; status: OrderStatus; variant?: any }> = [];
    
    switch (order.status) {
      case 'pending':
        actions.push({ label: 'Confirm', status: 'confirmed' as OrderStatus });
        actions.push({ label: 'Cancel', status: 'cancelled' as OrderStatus, variant: 'destructive' });
        break;
      case 'confirmed':
        actions.push({ label: 'Start Preparing', status: 'preparing' as OrderStatus });
        break;
      case 'preparing':
        actions.push({ label: 'Mark Ready', status: 'ready' as OrderStatus });
        break;
      case 'ready':
        if (order.order_type === 'delivery') {
          actions.push({ label: 'Out for Delivery', status: 'out_for_delivery' as OrderStatus });
        } else {
          actions.push({ label: 'Mark Picked Up', status: 'delivered' as OrderStatus });
        }
        break;
      case 'out_for_delivery':
        actions.push({ label: 'Mark Delivered', status: 'delivered' as OrderStatus });
        break;
    }
    
    return actions;
  }, [order.status, order.order_type]);

  return (
    <div 
      className={cn(
        "p-4 border rounded-lg bg-card hover:bg-muted/50 transition-colors",
        isProcessing && "opacity-60 pointer-events-none",
        onOrderSelect && "cursor-pointer"
      )}
      onClick={handleRowClick}
    >
      {/* Order Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="font-mono text-sm font-semibold">
            #{order.order_number}
          </div>
          <Badge className={cn("flex items-center gap-1", statusConfig.className)}>
            <StatusIcon className="h-3 w-3" />
            {statusConfig.label}
          </Badge>
          {isProcessing && (
            <div className="flex items-center gap-1 text-xs text-muted-foreground">
              <div className="h-2 w-2 bg-primary rounded-full animate-pulse" />
              Processing...
            </div>
          )}
        </div>
        <div className="text-sm text-muted-foreground">
          {formatCurrency(Number(order.total_amount) || 0)}
        </div>
      </div>

      {/* Customer Info */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mb-3 text-sm">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">{order.customer_name}</span>
        </div>
        {order.customer_phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{order.customer_phone}</span>
          </div>
        )}
        {order.customer_email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{order.customer_email}</span>
          </div>
        )}
      </div>

      {/* Order Details */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <div className="flex items-center gap-1">
            <Package className="h-3 w-3" />
            {order.order_items?.length || 0} items
          </div>
          <div className="flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {new Date(order.created_at).toLocaleString()}
          </div>
          {order.order_type === 'delivery' && order.delivery_address && (
            <div className="flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              <span className="truncate max-w-32">
                {typeof order.delivery_address === 'string' 
                  ? order.delivery_address 
                  : JSON.stringify(order.delivery_address)
                }
              </span>
            </div>
          )}
        </div>

        {/* Quick Actions */}
        {getQuickActions.length > 0 && (
          <div className="flex gap-2">
            {getQuickActions.map((action) => (
              <Button
                key={action.status}
                size="sm"
                variant={action.variant || "outline"}
                onClick={(e) => {
                  e.stopPropagation();
                  handleStatusChange(action.status);
                }}
                disabled={isProcessing}
                className="text-xs px-2 py-1 h-auto"
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
});

OptimizedOrderRow.displayName = 'OptimizedOrderRow';

export const OptimizedOrderTable: React.FC<OptimizedOrderTableProps> = ({
  orders,
  isLoading,
  onOrderUpdate,
  onOrderSelect,
  processingOrders = new Set(),
  className
}) => {
  const [sortBy, setSortBy] = useState<'created_at' | 'status' | 'total_amount'>('created_at');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Memoized sorted orders for performance
  const sortedOrders = useMemo(() => {
    if (!orders?.length) return [];

    return [...orders].sort((a, b) => {
      let comparison = 0;
      
      switch (sortBy) {
        case 'created_at':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'status':
          const aConfig = getStatusConfig(a.status as OrderStatus);
          const bConfig = getStatusConfig(b.status as OrderStatus);
          comparison = aConfig.priority - bConfig.priority;
          break;
        case 'total_amount':
          comparison = (a.total_amount || 0) - (b.total_amount || 0);
          break;
      }
      
      return sortOrder === 'desc' ? -comparison : comparison;
    });
  }, [orders, sortBy, sortOrder]);

  const handleSort = useCallback((field: typeof sortBy) => {
    if (sortBy === field) {
      setSortOrder(current => current === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(field);
      setSortOrder('desc');
    }
  }, [sortBy]);

  if (isLoading) {
    return (
      <div className={cn("space-y-4", className)}>
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="p-4 border rounded-lg bg-card">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-3">
                <Skeleton className="h-5 w-24" />
                <Skeleton className="h-6 w-20" />
              </div>
              <Skeleton className="h-5 w-16" />
            </div>
            <div className="grid grid-cols-3 gap-3 mb-3">
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
              <Skeleton className="h-4 w-full" />
            </div>
            <div className="flex justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-8 w-20" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (!orders?.length) {
    return (
      <div className={cn("text-center py-12", className)}>
        <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No orders found</h3>
        <p className="text-muted-foreground">
          Orders will appear here when customers place them.
        </p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-4", className)}>
      {/* Sort Controls */}
      <div className="flex items-center gap-2 text-sm">
        <span className="text-muted-foreground">Sort by:</span>
        <Button
          variant={sortBy === 'created_at' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleSort('created_at')}
          className="h-auto py-1 px-2"
        >
          Date {sortBy === 'created_at' && (sortOrder === 'desc' ? '↓' : '↑')}
        </Button>
        <Button
          variant={sortBy === 'status' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleSort('status')}
          className="h-auto py-1 px-2"
        >
          Status {sortBy === 'status' && (sortOrder === 'desc' ? '↓' : '↑')}
        </Button>
        <Button
          variant={sortBy === 'total_amount' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => handleSort('total_amount')}
          className="h-auto py-1 px-2"
        >
          Amount {sortBy === 'total_amount' && (sortOrder === 'desc' ? '↓' : '↑')}
        </Button>
      </div>

      {/* Orders List */}
      <div className="space-y-3">
        {sortedOrders.map((order) => (
          <OptimizedOrderRow
            key={order.id}
            order={order}
            onOrderUpdate={onOrderUpdate}
            onOrderSelect={onOrderSelect}
            isProcessing={processingOrders.has(order.id)}
          />
        ))}
      </div>
    </div>
  );
};