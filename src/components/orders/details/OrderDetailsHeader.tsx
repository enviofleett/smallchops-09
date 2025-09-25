import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Printer, CreditCard, Truck } from 'lucide-react';

interface OrderDetailsHeaderProps {
  order: {
    order_number: string;
    status: string;
    total_amount: number;
    order_type: string;
    updated_at?: string;
    created_at: string;
  };
  onPrint: () => void;
}

/**
 * OrderDetailsHeader component displays order number, status, metadata and print button
 * 
 * @param order - Order object with number, status, amount, type, and timestamps
 * @param onPrint - Function to handle printing order details
 * 
 * @example
 * ```tsx
 * const order = {
 *   order_number: "ORD-2025-001",
 *   status: "confirmed",
 *   total_amount: 25500,
 *   order_type: "delivery",
 *   updated_at: "2025-09-25T18:30:00Z",
 *   created_at: "2025-09-25T15:30:00Z"
 * };
 * 
 * <OrderDetailsHeader order={order} onPrint={handlePrint} />
 * ```
 */
export const OrderDetailsHeader: React.FC<OrderDetailsHeaderProps> = ({ 
  order, 
  onPrint 
}) => {
  return (
    <div className="flex-shrink-0 border-b-2 bg-gradient-to-r from-primary/5 via-background to-accent/5 px-6 py-5">
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
              <Package className="w-7 h-7 text-primary" />
              Order #{order.order_number}
            </h1>
            <Badge
              variant={order.status === 'delivered' ? 'default' : 'secondary'}
              className="text-sm px-3 py-1 font-medium capitalize"
            >
              {order.status?.replace('_', ' ')}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Complete order fulfillment details • Last updated {new Date(order.updated_at || order.created_at).toLocaleDateString()}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
            <span className="flex items-center gap-1">
              <CreditCard className="w-4 h-4" />
              ₦{order.total_amount?.toLocaleString()}
            </span>
            <span className="flex items-center gap-1">
              <Truck className="w-4 h-4" />
              {order.order_type}
            </span>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={onPrint}
            className="print:hidden border-primary/20 hover:border-primary/40"
            aria-label={`Print order ${order.order_number} details`}
          >
            <Printer className="w-4 h-4 mr-2" />
            <span className="hidden sm:inline">Print Details</span>
            <span className="sm:hidden">Print</span>
          </Button>
        </div>
      </div>
    </div>
  );
};