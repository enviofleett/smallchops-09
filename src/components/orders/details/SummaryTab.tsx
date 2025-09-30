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
    <div className="space-y-6">
      {/* Customer Info */}
      <Card className="rounded-lg border shadow-sm">
        <div className="p-6 space-y-4">
          <h3 className="text-base font-semibold">Customer Information</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div>
                <span className="text-xs font-medium text-muted-foreground">Name</span>
                <p className="text-sm">{order?.customer?.name || 'N/A'}</p>
              </div>
              <div>
                <span className="text-xs font-medium text-muted-foreground">Phone</span>
                <p className="text-sm">{order?.customer?.phone || 'N/A'}</p>
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Address</span>
              <p className="text-sm">{order?.customer?.address || 'N/A'}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Payment Info */}
      <Card className="rounded-lg border shadow-sm">
        <div className="p-6 space-y-4">
          <h3 className="text-base font-semibold">Payment Details</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <span className="text-xs font-medium text-muted-foreground">Status</span>
              <div className="mt-1">
                <Badge variant={order?.payment_status === 'paid' ? 'default' : 'secondary'}>
                  {order?.payment_status}
                </Badge>
              </div>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Method</span>
              <p className="text-sm mt-1 capitalize">{order?.payment_method || 'N/A'}</p>
            </div>
            <div>
              <span className="text-xs font-medium text-muted-foreground">Reference</span>
              <p className="text-sm mt-1 font-mono text-xs break-all">{order?.payment_reference || 'N/A'}</p>
            </div>
          </div>
        </div>
      </Card>

      {/* Order Items */}
      <Card className="rounded-lg border shadow-sm">
        <div className="p-6 space-y-4">
          <h3 className="text-base font-semibold">Order Items</h3>
          <OrderItemsTable items={order?.items || []} />
        </div>
      </Card>

      {/* Schedule Info */}
      <Card className="rounded-lg border shadow-sm">
        <div className="p-6 space-y-4">
          <h3 className="text-base font-semibold">
            {order?.order_type === 'pickup' ? 'Pickup Schedule' : 'Delivery Schedule'}
          </h3>
          {order?.order_type === 'pickup' && order?.pickup_time ? (
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="text-xs font-medium text-muted-foreground mb-1">Scheduled Pickup Time</div>
              <div className="text-sm">
                {new Date(order.pickup_time).toLocaleDateString('en-US', { 
                  month: 'short', 
                  day: 'numeric',
                  year: 'numeric'
                })} at {new Date(order.pickup_time).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit'
                })}
              </div>
            </div>
          ) : order?.order_type === 'delivery' && deliverySchedule ? (
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="text-xs font-medium text-muted-foreground mb-1">Scheduled Delivery</div>
              <div className="text-sm">
                {deliverySchedule?.delivery_date ? new Date(deliverySchedule.delivery_date).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric'
                }) : deliverySchedule?.date}
                {deliverySchedule?.delivery_time_start && deliverySchedule?.delivery_time_end ? (
                  <> from {deliverySchedule.delivery_time_start} to {deliverySchedule.delivery_time_end}</>
                ) : deliverySchedule?.window ? (
                  <> at {deliverySchedule.window}</>
                ) : null}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No schedule information available</p>
          )}
        </div>
      </Card>
    </div>
  );
};