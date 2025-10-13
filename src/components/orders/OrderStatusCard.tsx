import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/status-badge';
import { OrderStatus } from '@/types/orders';
import { Clock, Package, Truck, CheckCircle, XCircle, RotateCcw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface OrderStatusCardProps {
  status: OrderStatus;
  orderNumber?: string;
  timestamp?: string;
  className?: string;
}

const statusConfig: Record<OrderStatus, {
  icon: React.ReactNode;
  label: string;
  description: string;
  color: string;
}> = {
  pending: {
    icon: <Clock className="w-5 h-5" />,
    label: 'Pending',
    description: 'Order received and awaiting confirmation',
    color: 'text-yellow-600 dark:text-yellow-400'
  },
  confirmed: {
    icon: <CheckCircle className="w-5 h-5" />,
    label: 'Confirmed',
    description: 'Order confirmed and being prepared',
    color: 'text-blue-600 dark:text-blue-400'
  },
  preparing: {
    icon: <Package className="w-5 h-5" />,
    label: 'Preparing',
    description: 'Your order is being prepared',
    color: 'text-orange-600 dark:text-orange-400'
  },
  ready: {
    icon: <CheckCircle className="w-5 h-5" />,
    label: 'Ready',
    description: 'Order ready for pickup or delivery',
    color: 'text-green-600 dark:text-green-400'
  },
  out_for_delivery: {
    icon: <Truck className="w-5 h-5" />,
    label: 'Out for Delivery',
    description: 'Order is on the way to you',
    color: 'text-purple-600 dark:text-purple-400'
  },
  delivered: {
    icon: <CheckCircle className="w-5 h-5" />,
    label: 'Delivered',
    description: 'Order successfully delivered',
    color: 'text-emerald-600 dark:text-emerald-400'
  },
  completed: {
    icon: <CheckCircle className="w-5 h-5" />,
    label: 'Completed',
    description: 'Order completed successfully',
    color: 'text-emerald-600 dark:text-emerald-400'
  },
  cancelled: {
    icon: <XCircle className="w-5 h-5" />,
    label: 'Cancelled',
    description: 'Order has been cancelled',
    color: 'text-red-600 dark:text-red-400'
  },
  refunded: {
    icon: <RotateCcw className="w-5 h-5" />,
    label: 'Refunded',
    description: 'Order refunded successfully',
    color: 'text-gray-600 dark:text-gray-400'
  },
  returned: {
    icon: <RotateCcw className="w-5 h-5" />,
    label: 'Returned',
    description: 'Order has been returned',
    color: 'text-amber-600 dark:text-amber-400'
  }
};

export const OrderStatusCard: React.FC<OrderStatusCardProps> = ({
  status,
  orderNumber,
  timestamp,
  className
}) => {
  const config = statusConfig[status];

  return (
    <Card className={cn('w-full', className)}>
      <CardHeader className="pb-3">
        <CardTitle className="text-lg flex items-center justify-between">
          <span>Order Status</span>
          <StatusBadge variant={status} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-start gap-4">
          <div className={cn('flex-shrink-0 p-3 rounded-full bg-muted', config.color)}>
            {config.icon}
          </div>
          <div className="flex-1 space-y-1">
            <h3 className="font-semibold text-base">{config.label}</h3>
            <p className="text-sm text-muted-foreground">{config.description}</p>
            {timestamp && (
              <p className="text-xs text-muted-foreground pt-1">
                Last updated: {new Date(timestamp).toLocaleString()}
              </p>
            )}
          </div>
        </div>
        
        {orderNumber && (
          <div className="pt-3 border-t">
            <p className="text-sm text-muted-foreground">
              Order Number: <span className="font-mono font-semibold text-foreground">{orderNumber}</span>
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
