
import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Package, MapPin, User, Clock, AlertTriangle, CheckCircle, Truck } from 'lucide-react';
import { OrderWithItems } from '@/api/orders';
import { format } from 'date-fns';
import { MiniCountdownTimer } from '@/components/orders/MiniCountdownTimer';
import { isOrderOverdue } from '@/utils/scheduleTime';
import { AdminOrderStatusBadge } from './AdminOrderStatusBadge';

interface AdminOrderCardProps {
  order: OrderWithItems;
  deliverySchedule?: any;
}

export const AdminOrderCard = ({ order, deliverySchedule }: AdminOrderCardProps) => {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle className="w-4 h-4" />;
      case 'out_for_delivery': return <Truck className="w-4 h-4" />;
      case 'preparing': return <Clock className="w-4 h-4" />;
      case 'confirmed': return <Package className="w-4 h-4" />;
      default: return <Package className="w-4 h-4" />;
    }
  };

  const isOverdue = deliverySchedule && 
    isOrderOverdue(deliverySchedule.delivery_date, deliverySchedule.delivery_time_end);

  return (
    <Card className={`transition-all duration-200 hover:shadow-md ${isOverdue ? 'border-l-4 border-l-destructive' : ''}`}>
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              {getStatusIcon(order.status)}
              <h3 className="font-semibold text-lg">#{order.order_number}</h3>
              {isOverdue && (
                <div className="flex items-center bg-red-100 text-red-800 border border-red-200 rounded-md px-2 py-1 text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Overdue
                </div>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
            </p>
          </div>
          <div className="flex flex-col gap-2 items-end">
            <AdminOrderStatusBadge status={order.status} />
            <AdminOrderStatusBadge 
              status={order.order_type} 
              className={order.order_type === 'delivery' ? 'bg-blue-100 text-blue-800 border-blue-200' : 'bg-gray-100 text-gray-800 border-gray-200'}
            />
            <AdminOrderStatusBadge 
              status={order.payment_status} 
              className={order.payment_status === 'paid' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-yellow-100 text-yellow-800 border-yellow-200'}
            />
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Customer Information */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              Customer
            </h4>
            <div className="space-y-1">
              <p className="font-medium">{order.customer_name}</p>
              <p className="text-sm text-muted-foreground">{order.customer_email}</p>
              {order.customer_phone && (
                <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <Package className="w-4 h-4" />
              Order Details
            </h4>
            <div className="space-y-1">
              <p className="text-sm">Items: {order.order_items?.length || 0}</p>
              <p className="font-bold text-lg">₦{order.total_amount.toLocaleString()}</p>
              {order.delivery_fee && order.delivery_fee > 0 && (
                <p className="text-sm text-muted-foreground">
                  Delivery: ₦{order.delivery_fee.toLocaleString()}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Delivery Schedule and Countdown */}
        {deliverySchedule && (
          <div className="bg-muted/30 rounded-lg p-4 space-y-3">
            <h4 className="font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Delivery Schedule
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <p className="text-sm text-muted-foreground">Date</p>
                <p className="font-medium">
                  {format(new Date(deliverySchedule.delivery_date), 'MMM dd, yyyy')}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Time Window</p>
                <p className="font-medium">
                  {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}
                </p>
              </div>
            </div>
            
            {deliverySchedule.delivery_time_start && deliverySchedule.delivery_time_end && (
              <div className="flex items-center gap-2">
                <span className="text-sm text-muted-foreground">Countdown:</span>
                <MiniCountdownTimer
                  deliveryDate={deliverySchedule.delivery_date}
                  deliveryTimeStart={deliverySchedule.delivery_time_start}
                  deliveryTimeEnd={deliverySchedule.delivery_time_end}
                  orderStatus={order.status}
                />
              </div>
            )}

            {deliverySchedule.special_instructions && (
              <div>
                <p className="text-sm text-muted-foreground">Special Instructions</p>
                <p className="text-sm bg-background rounded px-2 py-1">
                  {deliverySchedule.special_instructions}
                </p>
              </div>
            )}
          </div>
        )}

        {/* Delivery Address */}
        {order.order_type === 'delivery' && order.delivery_address && (
          <div className="space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <MapPin className="w-4 h-4" />
              Delivery Address
            </h4>
            <div className="bg-muted/30 rounded-lg p-3">
              <p className="text-sm">
                {typeof order.delivery_address === 'object' && !Array.isArray(order.delivery_address)
                  ? `${(order.delivery_address as any).address_line_1 || ''}, ${(order.delivery_address as any).city || ''}`.trim()
                  : typeof order.delivery_address === 'string' 
                    ? order.delivery_address
                    : 'Address available'
                }
              </p>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap gap-2 pt-2 border-t">
          <Button variant="outline" size="sm">
            View Details
          </Button>
          {order.status === 'pending' && (
            <Button size="sm">
              Confirm Order
            </Button>
          )}
          {order.status === 'confirmed' && (
            <Button size="sm">
              Start Preparing
            </Button>
          )}
          {order.status === 'preparing' && (
            <Button size="sm">
              Mark Ready
            </Button>
          )}
          {order.status === 'ready' && order.order_type === 'delivery' && (
            <Button size="sm">
              Assign Driver
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
