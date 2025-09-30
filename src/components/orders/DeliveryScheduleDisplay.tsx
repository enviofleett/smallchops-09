import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Clock, MapPin, FileText, Truck, Package, CheckCircle, AlertTriangle, Info, XCircle, Calendar as CalendarIcon } from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO, setHours, setMinutes } from 'date-fns';
import { OrderStatus } from '@/types/orders';
import { useDeliveryWindowValidation } from '@/hooks/useDeliveryWindowValidation';
import { DeliveryWindowCriticalError } from './DeliveryWindowCriticalError';
import { calculateTimeWindow, formatTimeWindow, TimeWindow } from '@/utils/timeWindowUtils';

interface DeliveryScheduleDisplayProps {
  order: {
    id: string;
    order_type: 'delivery' | 'pickup' | 'dine_in';
    delivery_time?: string | null;
    pickup_time?: string | null;
    delivery_date?: string | null;
    special_instructions?: string | null;
  };
  orderStatus?: OrderStatus;
  className?: string;
  onRetry?: () => void;
}

export const DeliveryScheduleDisplay: React.FC<DeliveryScheduleDisplayProps> = ({ 
  order,
  orderStatus = 'pending',
  className = "",
  onRetry
}) => {
  // Get the appropriate time field based on order type
  const timeField = order.order_type === 'delivery' 
    ? order.delivery_time 
    : order.order_type === 'pickup' 
    ? order.pickup_time 
    : null;

  // CRITICAL: Validate time field for delivery/pickup orders (fail-fast)
  const windowValidation = useDeliveryWindowValidation(timeField, order.order_type, order.id);

  // Calculate 1-hour time window from the time field
  const timeWindow = calculateTimeWindow(timeField);

  // FAIL FAST: Show critical error for orders with missing time fields
  if (windowValidation.isCriticalError) {
    return (
      <DeliveryWindowCriticalError
        orderId={order.id}
        errorMessage={windowValidation.errorMessage}
        onRetry={onRetry}
        showContactSupport={true}
      />
    );
  }

  // For dine-in orders, don't show delivery schedule
  if (order.order_type === 'dine_in') {
    return null;
  }

  // If no time window can be calculated (shouldn't happen after validation)
  if (!timeWindow) {
    return null;
  }
  const formatDate = (dateString: string | null | undefined) => {
    if (!dateString) return 'Not specified';
    try {
      const date = parseISO(dateString);
      if (isToday(date)) return 'Today';
      if (isTomorrow(date)) return 'Tomorrow';
      return format(date, 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateLong = (dateString: string | null | undefined) => {
    if (!dateString) return 'Date not specified';
    try {
      const date = parseISO(dateString);
      if (isToday(date)) return 'Today';
      if (isTomorrow(date)) return 'Tomorrow';
      return format(date, 'EEEE, MMM d, yyyy');
    } catch {
      return dateString;
    }
  };

  const getFulfillmentChannel = (type: string) => {
    return type === 'delivery' ? 'Home Delivery' : 'Pickup';
  };

  const getStatusConfig = (status: OrderStatus) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return { 
          label: 'Delivered', 
          variant: 'default' as const,
          icon: CheckCircle,
          iconColor: 'text-green-600'
        };
      case 'out_for_delivery':
        return { 
          label: 'Out for Delivery', 
          variant: 'secondary' as const,
          icon: Truck,
          iconColor: 'text-blue-600'
        };
      case 'preparing':
        return { 
          label: 'Preparing', 
          variant: 'outline' as const,
          icon: Package,
          iconColor: 'text-yellow-600'
        };
      case 'ready':
        return { 
          label: 'Ready', 
          variant: 'secondary' as const,
          icon: CheckCircle,
          iconColor: 'text-green-600'
        };
      case 'confirmed':
        return { 
          label: 'Confirmed', 
          variant: 'secondary' as const,
          icon: CheckCircle,
          iconColor: 'text-blue-600'
        };
      case 'pending':
        return { 
          label: 'Processing', 
          variant: 'outline' as const,
          icon: Clock,
          iconColor: 'text-yellow-600'
        };
      default:
        return { 
          label: 'Processing', 
          variant: 'outline' as const,
          icon: Clock,
          iconColor: 'text-gray-600'
        };
    }
  };

  const statusConfig = getStatusConfig(orderStatus);
  const StatusIcon = statusConfig.icon;


  return (
    <Card className={`border-blue-200 bg-blue-50/50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-blue-800 flex items-center gap-2 text-lg">
          <Calendar className="w-5 h-5" />
          {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'} Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Fulfillment Channel */}
          <div className="flex items-center gap-2">
            {order.order_type === 'delivery' ? (
              <Truck className="w-4 h-4 text-blue-600" />
            ) : (
              <Package className="w-4 h-4 text-blue-600" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-700">Fulfillment Channel</p>
              <p className="text-sm text-blue-800 font-semibold">
                {getFulfillmentChannel(order.order_type)}
              </p>
            </div>
          </div>

          {/* Order Status */}
          <div className="flex items-center gap-2">
            <StatusIcon className={`w-4 h-4 ${statusConfig.iconColor}`} />
            <div>
              <p className="text-sm font-medium text-gray-700">Order Status</p>
              <Badge variant={statusConfig.variant} className="text-xs">
                {statusConfig.label}
              </Badge>
            </div>
          </div>

          {/* Delivery/Pickup Date */}
          {order.delivery_date && (
            <div className="flex items-center gap-2">
              <Calendar className="w-4 h-4 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-gray-700">
                  {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'} Date
                </p>
                <p className="text-sm text-blue-800 font-semibold">
                  {formatDate(order.delivery_date)}
                </p>
                <p className="text-xs text-gray-600">
                  {formatDateLong(order.delivery_date)}
                </p>
              </div>
            </div>
          )}

          {/* Time Window - Calculated from time field */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-700">
                {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'} Time Window
              </p>
              <p className="text-sm text-blue-800 font-semibold">
                {formatTimeWindow(timeWindow)}
              </p>
              <p className="text-xs text-blue-600 mt-1">Fixed 1-hour window</p>
            </div>
          </div>
        </div>

        {/* Special Instructions */}
        {order.special_instructions && (
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-blue-600" />
              <p className="text-sm font-medium text-gray-700">
                {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'} Instructions
              </p>
            </div>
            <p className="text-sm text-gray-600 bg-white/70 p-2 rounded border">
              {order.special_instructions}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};