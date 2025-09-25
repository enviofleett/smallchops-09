import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Truck } from 'lucide-react';
import { OrderItemsTable } from './OrderItemsTable';

interface SummaryTabProps {
  order: {
    customer?: {
      name?: string;
      phone?: string;
      address?: string;
    };
    payment_status?: string;
    payment_method?: string;
    payment_reference?: string;
    items?: any[];
    order_type: string;
  };
  deliverySchedule?: {
    window?: string;
    date?: string;
  };
}

/**
 * SummaryTab component displays customer information, payment details, order items and delivery info
 * 
 * @param order - Order object containing customer, payment and item information
 * @param deliverySchedule - Delivery schedule with time window and date
 * 
 * @example
 * ```tsx
 * const order = {
 *   customer: { 
 *     name: "John Doe", 
 *     phone: "08012345678", 
 *     address: "123 Main St, Lagos" 
 *   },
 *   payment_status: "paid",
 *   payment_method: "card", 
 *   payment_reference: "TXN123456",
 *   items: [
 *     { name: "Meat Pie", quantity: 2, price: 400 },
 *     { name: "Chicken Roll", quantity: 1, price: 350 }
 *   ],
 *   order_type: "delivery"
 * };
 * 
 * const deliverySchedule = {
 *   window: "2pm-4pm",
 *   date: "2025-09-26"
 * };
 * 
 * <SummaryTab order={order} deliverySchedule={deliverySchedule} />
 * ```
 */
export const SummaryTab: React.FC<SummaryTabProps> = ({ order, deliverySchedule }) => {
  return (
    <Card className="rounded-xl border shadow-sm mb-6">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-2">Customer & Order Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-2 font-medium">Customer</div>
            <div>Name: {order.customer?.name || 'N/A'}</div>
            <div>Phone: {order.customer?.phone || 'N/A'}</div>
            <div>Address: {order.customer?.address || 'N/A'}</div>
          </div>
          <div>
            <div className="mb-2 font-medium">Payment</div>
            <div>Status: <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>{order.payment_status}</Badge></div>
            <div>Method: {order.payment_method || 'N/A'}</div>
            <div>Reference: {order.payment_reference || 'N/A'}</div>
          </div>
        </div>
        <div className="mt-6">
          <div className="mb-2 font-medium">Items</div>
          <OrderItemsTable items={order.items || []} />
        </div>
        <div className="mt-6">
          <div className="mb-2 font-medium">Delivery</div>
          <div>
            {order.order_type === 'pickup' ? (
              <><Building2 className="inline w-4 h-4" /> Pickup</>
            ) : (
              <><Truck className="inline w-4 h-4" /> Delivery</>
            )}
            {deliverySchedule ? (
              <span className="ml-2 text-muted-foreground">
                {deliverySchedule.window} on {deliverySchedule.date}
              </span>
            ) : null}
          </div>
        </div>
      </div>
    </Card>
  );
};