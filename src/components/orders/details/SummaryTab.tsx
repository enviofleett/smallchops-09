import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Building2, Truck } from 'lucide-react';
import { OrderItemsTable } from './OrderItemsTable';

interface SummaryTabProps {
  order: any;
  deliverySchedule?: any;
}

export const SummaryTab: React.FC<SummaryTabProps> = ({ order, deliverySchedule }) => {
  return (
    <Card className="rounded-xl border shadow-sm mb-6">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-2">Customer & Order Info</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <div className="mb-2 font-medium">Customer</div>
            <div>Name: {order?.customer?.name || 'N/A'}</div>
            <div>Phone: {order?.customer?.phone || 'N/A'}</div>
            <div>Address: {order?.customer?.address || 'N/A'}</div>
          </div>
          <div>
            <div className="mb-2 font-medium">Payment</div>
            <div>Status: <Badge variant={order?.payment_status === 'paid' ? 'default' : 'secondary'}>{order?.payment_status}</Badge></div>
            <div>Method: {order?.payment_method || 'N/A'}</div>
            <div>Reference: {order?.payment_reference || 'N/A'}</div>
          </div>
        </div>
        <div className="mt-6">
          <div className="mb-2 font-medium">Items</div>
          <OrderItemsTable items={order?.items || []} />
        </div>
        <div className="mt-6">
          <div className="mb-2 font-medium">
            {order?.order_type === 'pickup' ? 'Pickup Schedule' : 'Delivery Schedule'}
          </div>
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              {order?.order_type === 'pickup' ? (
                <><Building2 className="inline w-4 h-4" /> Pickup</>
              ) : (
                <><Truck className="inline w-4 h-4" /> Delivery</>
              )}
            </div>
            
            {/* Live Schedule Data */}
            {order?.order_type === 'pickup' && order?.pickup_time ? (
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="font-medium text-sm">Scheduled Pickup Time</div>
                <div className="text-sm text-muted-foreground">
                  {new Date(order.pickup_time).toLocaleDateString()} at {new Date(order.pickup_time).toLocaleTimeString()}
                </div>
              </div>
            ) : order?.order_type === 'delivery' && deliverySchedule ? (
              <div className="bg-muted/50 p-3 rounded-lg">
                <div className="font-medium text-sm">Scheduled Delivery</div>
                <div className="text-sm text-muted-foreground">
                  {deliverySchedule?.delivery_date ? new Date(deliverySchedule.delivery_date).toLocaleDateString() : deliverySchedule?.date}
                  {deliverySchedule?.delivery_time_start && deliverySchedule?.delivery_time_end ? (
                    <> from {deliverySchedule.delivery_time_start} to {deliverySchedule.delivery_time_end}</>
                  ) : deliverySchedule?.window ? (
                    <> at {deliverySchedule.window}</>
                  ) : null}
                </div>
              </div>
            ) : (
              <div className="text-sm text-muted-foreground">
                No schedule information available
              </div>
            )}
          </div>
        </div>
      </div>
    </Card>
  );
};