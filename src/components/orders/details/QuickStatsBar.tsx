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
    <Card className={cn("p-3 sm:p-4", className)}>
      <div className="grid grid-cols-2 gap-3 sm:gap-4">
        {/* Order Status */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 flex-shrink-0">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Status</p>
          </div>
          <Badge variant={getStatusVariant(order.status)} className="text-xs font-medium w-fit">
            {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
          </Badge>
        </div>

        {/* Order Type */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-muted/50">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-accent/10 flex-shrink-0">
              {order.order_type === 'delivery' ? (
                <Truck className="h-3 w-3 sm:h-4 sm:w-4 text-accent-foreground" />
              ) : (
                <Package className="h-3 w-3 sm:h-4 sm:w-4 text-accent-foreground" />
              )}
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Type</p>
          </div>
          <p className="font-semibold text-sm text-foreground capitalize">{order.order_type}</p>
        </div>

        {/* Payment Status */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-muted/50 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-secondary/10 flex-shrink-0">
              <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 text-secondary-foreground" />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Payment</p>
          </div>
          <Badge variant={getPaymentVariant(order.payment_status)} className="text-xs font-medium w-fit">
            {order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
          </Badge>
        </div>

        {/* Total Amount */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 p-3 rounded-lg bg-muted/50 col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-primary/10 flex-shrink-0">
              <Package className="h-3 w-3 sm:h-4 sm:w-4 text-primary" />
            </div>
            <p className="text-xs text-muted-foreground font-medium uppercase tracking-wider">Total</p>
          </div>
          <p className="font-bold text-base text-foreground">{formatCurrency(order.total_amount)}</p>
        </div>
      </div>
    </Card>
  );
};