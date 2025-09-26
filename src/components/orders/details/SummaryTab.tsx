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
    pickup_time?: string;
  };
  deliverySchedule?: {
    window?: string;
    date?: string;
    delivery_date?: string;
    delivery_time_start?: string;
    delivery_time_end?: string;
  };
  detailedOrderData?: {
    fulfillment_info?: {
      pickup_time?: string;
      delivery_date?: string;
      delivery_hours?: {
        start?: string;
        end?: string;
      };
      address?: string;
      business_hours?: any;
    };
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
export const SummaryTab: React.FC<SummaryTabProps> = ({ order, deliverySchedule, detailedOrderData }) => {
  // Extract fulfillment data for display
  const fulfillmentInfo = detailedOrderData?.fulfillment_info;
  
  // Format pickup time for display
  const formatPickupTime = () => {
    if (order.order_type === 'pickup') {
      if (fulfillmentInfo?.pickup_time) {
        const pickupDate = new Date(fulfillmentInfo.pickup_time);
        return {
          date: pickupDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
          time: pickupDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        };
      }
      if (order.pickup_time) {
        const pickupDate = new Date(order.pickup_time);
        return {
          date: pickupDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
          time: pickupDate.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })
        };
      }
    }
    return null;
  };

  // Format delivery time for display
  const formatDeliveryTime = () => {
    if (order.order_type === 'delivery') {
      if (fulfillmentInfo?.delivery_date && fulfillmentInfo?.delivery_hours) {
        const deliveryDate = new Date(fulfillmentInfo.delivery_date);
        const startTime = fulfillmentInfo.delivery_hours.start;
        const endTime = fulfillmentInfo.delivery_hours.end;
        return {
          date: deliveryDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
          time: startTime && endTime ? `${startTime} - ${endTime}` : 'Time TBD'
        };
      }
      if (deliverySchedule?.delivery_date && (deliverySchedule?.delivery_time_start || deliverySchedule?.window)) {
        const deliveryDate = new Date(deliverySchedule.delivery_date);
        return {
          date: deliveryDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' }),
          time: deliverySchedule.window || `${deliverySchedule.delivery_time_start} - ${deliverySchedule.delivery_time_end}`
        };
      }
    }
    return null;
  };

  const pickupInfo = formatPickupTime();
  const deliveryInfo = formatDeliveryTime();
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
          <div className="mb-2 font-medium">Fulfillment Schedule</div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {order.order_type === 'pickup' ? (
                <><Building2 className="inline w-4 h-4" /> Pickup</>
              ) : (
                <><Truck className="inline w-4 h-4" /> Delivery</>
              )}
            </div>
            
            {order.order_type === 'pickup' && pickupInfo && (
              <div className="text-sm">
                <div className="font-medium">{pickupInfo.date}</div>
                <div className="text-muted-foreground">{pickupInfo.time}</div>
              </div>
            )}
            
            {order.order_type === 'delivery' && deliveryInfo && (
              <div className="text-sm">
                <div className="font-medium">{deliveryInfo.date}</div>
                <div className="text-muted-foreground">{deliveryInfo.time}</div>
              </div>
            )}
            
            {!pickupInfo && !deliveryInfo && (
              <div className="text-sm text-muted-foreground">Schedule not yet confirmed</div>
            )}
            
            {fulfillmentInfo?.address && (
              <div className="text-sm">
                <div className="font-medium">Location:</div>
                <div className="text-muted-foreground">{fulfillmentInfo.address}</div>
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};