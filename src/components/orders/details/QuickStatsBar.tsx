import React from 'react';
import { OrderWithItems } from '@/api/orders';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Package, Truck, CreditCard, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';

interface QuickStatsBarProps {
  order: OrderWithItems;
  className?: string;
}

export const QuickStatsBar: React.FC<QuickStatsBarProps> = ({ order, className }) => {
  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return 'default';
      case 'cancelled':
      case 'failed':
        return 'destructive';
      case 'pending':
        return 'secondary';
      default:
        return 'outline';
    }
  };

  const getPaymentVariant = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid':
        return 'default';
      case 'failed':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { 
      style: 'currency', 
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0
    }).format(amount);
  };

  return (
    <Card className={cn("p-4", className)}>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {/* Order Status */}
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-primary/10">
            <Clock className="h-4 w-4 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge variant={getStatusVariant(order.status)} className="text-xs">
              {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Order Type */}
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-secondary/10">
            {order.order_type === 'delivery' ? (
              <Truck className="h-4 w-4 text-secondary" />
            ) : (
              <Package className="h-4 w-4 text-secondary" />
            )}
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium text-sm capitalize">{order.order_type}</p>
          </div>
        </div>

        {/* Payment Status */}
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-accent/10">
            <CreditCard className="h-4 w-4 text-accent-foreground" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Payment</p>
            <Badge variant={getPaymentVariant(order.payment_status)} className="text-xs">
              {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Total Amount */}
        <div className="flex items-center gap-2">
          <div className="p-2 rounded-lg bg-success/10">
            <Package className="h-4 w-4 text-success" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="font-bold text-sm">{formatCurrency(order.total_amount)}</p>
          </div>
        </div>
      </div>
    </Card>
  );
};