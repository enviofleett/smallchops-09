import React from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Package, Printer, CreditCard, Truck, Building2, Send } from 'lucide-react';

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
  isPrinting?: boolean;
  onSendEmail?: () => void;
  customerEmail?: string;
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
  onPrint,
  isPrinting = false,
  onSendEmail,
  customerEmail
}) => {
  return (
    <div className="border-b px-6 py-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-1">
            <h2 className="text-xl font-semibold">#{order.order_number}</h2>
            <Badge
              variant={order.status === 'delivered' ? 'default' : 'secondary'}
              className="capitalize"
            >
              {order.status.replace(/_/g, ' ')}
            </Badge>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              {order.order_type === 'pickup' ? (
                <><Building2 className="w-4 h-4" /> Pickup</>
              ) : (
                <><Truck className="w-4 h-4" /> Delivery</>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            Updated {new Date(order.updated_at || order.created_at).toLocaleDateString('en-US', { 
              month: 'short', 
              day: 'numeric', 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Total</p>
            <p className="text-lg font-semibold">₦{order.total_amount?.toLocaleString()}</p>
          </div>
          
          {onSendEmail && customerEmail && (
            <Button 
              variant="outline" 
              size="sm" 
              onClick={onSendEmail}
              className="flex items-center gap-2"
            >
              <Send className="w-4 h-4" />
              Send Email
            </Button>
          )}
          
          <Button 
            variant="outline" 
            size="sm" 
            onClick={onPrint}
            disabled={isPrinting}
            className="flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            {isPrinting ? 'Printing...' : 'Print'}
          </Button>
        </div>
      </div>
    </div>
  );
};