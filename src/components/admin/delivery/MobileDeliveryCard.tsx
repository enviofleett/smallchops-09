import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CountdownTimer } from '@/components/orders/CountdownTimer';
import { 
  Clock, 
  Calendar, 
  MapPin, 
  Truck, 
  Package,
  User,
  CreditCard
} from 'lucide-react';
import { format } from 'date-fns';
import { OrderWithItems } from '@/api/orders';

interface MobileDeliveryCardProps {
  order: OrderWithItems;
  deliverySchedule?: any;
  isUrgent?: boolean;
  onCardClick: () => void;
  onStatusUpdate?: (orderId: string, status: string) => void;
}

export const MobileDeliveryCard: React.FC<MobileDeliveryCardProps> = ({
  order,
  deliverySchedule,
  isUrgent = false,
  onCardClick,
  onStatusUpdate
}) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'preparing':
        return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'confirmed':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'pending':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getNextActions = () => {
    switch (order.status) {
      case 'pending':
      case 'confirmed':
        return [{ label: 'Start Preparing', action: 'preparing', color: 'bg-orange-600' }];
      case 'preparing':
        return [{ label: 'Ready for Delivery', action: 'ready', color: 'bg-blue-600' }];
      case 'ready':
        return [{ label: 'Out for Delivery', action: 'out_for_delivery', color: 'bg-purple-600' }];
      case 'out_for_delivery':
        return [{ label: 'Mark Delivered', action: 'delivered', color: 'bg-green-600' }];
      default:
        return [];
    }
  };

  return (
    <Card 
      className={`relative overflow-hidden transition-all duration-200 active:scale-98 ${
        isUrgent ? 'ring-2 ring-orange-300 bg-orange-50/50' : ''
      }`}
      onClick={onCardClick}
    >
      {/* Urgent Banner */}
      {isUrgent && (
        <div className="absolute top-0 right-0 bg-gradient-to-l from-orange-500 to-red-500 text-white text-xs font-bold px-3 py-1 rounded-bl-lg">
          <Clock className="w-3 h-3 inline mr-1" />
          URGENT
        </div>
      )}

      <CardContent className="p-4 space-y-4">
        {/* Header */}
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            {order.order_type === 'delivery' ? (
              <Truck className="w-5 h-5 text-blue-600 flex-shrink-0" />
            ) : (
              <MapPin className="w-5 h-5 text-green-600 flex-shrink-0" />
            )}
            <div>
              <h3 className="font-semibold text-base leading-tight">
                #{order.order_number}
              </h3>
              <p className="text-xs text-muted-foreground">
                {format(new Date(order.order_time), 'MMM d, h:mm a')}
              </p>
            </div>
          </div>
          <Badge className={`text-xs ${getStatusColor(order.status)}`}>
            {order.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>

        {/* Customer Info */}
        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
          <User className="w-4 h-4 text-muted-foreground flex-shrink-0" />
          <div className="min-w-0 flex-1">
            <p className="font-medium text-sm truncate">
              {order.customer_name || 'N/A'}
            </p>
            <p className="text-xs text-muted-foreground truncate">
              {order.customer_email}
            </p>
          </div>
        </div>

        {/* Order Details */}
        <div className="grid grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Items</p>
              <p className="text-sm font-medium">{order.order_items?.length || 0}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-sm font-bold text-primary">
                {formatCurrency(order.total_amount)}
              </p>
            </div>
          </div>
        </div>

        {/* Delivery Schedule */}
        {deliverySchedule && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>Delivery Schedule</span>
            </div>
            
            {/* Date and Time */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm font-medium text-blue-900">
                {format(new Date(deliverySchedule.delivery_date), 'EEEE, MMM d')}
              </div>
              <div className="text-sm text-blue-700 mt-1">
                {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}
                {deliverySchedule.is_flexible && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Flexible
                  </Badge>
                )}
              </div>
            </div>

            {/* Countdown Timer */}
            <CountdownTimer
              deliveryDate={deliverySchedule.delivery_date}
              deliveryTimeStart={deliverySchedule.delivery_time_start}
              deliveryTimeEnd={deliverySchedule.delivery_time_end}
              isFlexible={deliverySchedule.is_flexible}
              className="text-sm"
            />
          </div>
        )}

        {/* Pickup Info */}
        {order.order_type === 'pickup' && (
          <div className="bg-green-50 border border-green-200 rounded-lg p-3">
            <div className="flex items-center gap-2 text-green-800">
              <MapPin className="w-4 h-4" />
              <span className="text-sm font-medium">Store Pickup</span>
            </div>
            <p className="text-xs text-green-700 mt-1">
              Ready for pickup at store location
            </p>
          </div>
        )}

        {/* Action Buttons */}
        {onStatusUpdate && getNextActions().length > 0 && (
          <div className="pt-3 border-t space-y-2">
            {getNextActions().map((action) => (
              <Button
                key={action.action}
                size="sm"
                className={`w-full text-white ${action.color} hover:opacity-90`}
                onClick={(e) => {
                  e.stopPropagation();
                  onStatusUpdate(order.id, action.action);
                }}
              >
                {action.label}
              </Button>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};