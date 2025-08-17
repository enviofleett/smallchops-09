import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, MapPin, FileText, Truck, Package, CheckCircle } from 'lucide-react';
import { format } from 'date-fns';
import { DeliverySchedule } from '@/api/deliveryScheduleApi';

interface DeliveryScheduleDisplayProps {
  schedule: DeliverySchedule;
  orderType?: string;
  orderStatus?: string;
  className?: string;
}

export const DeliveryScheduleDisplay: React.FC<DeliveryScheduleDisplayProps> = ({ 
  schedule, 
  orderType,
  orderStatus,
  className = "" 
}) => {
  const formatTime = (timeString: string) => {
    const [hours, minutes] = timeString.split(':');
    const time = new Date();
    time.setHours(parseInt(hours), parseInt(minutes));
    return format(time, 'h:mm a');
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'EEEE, MMM d, yyyy');
  };

  const getFulfillmentChannel = () => {
    if (orderType === 'delivery') return 'Home Delivery';
    if (orderType === 'pickup') return 'Pickup';
    return 'Unknown';
  };

  const getStatusConfig = (status?: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return { 
          label: 'Delivered', 
          variant: 'default' as const,
          icon: CheckCircle,
          color: 'text-green-600'
        };
      case 'out_for_delivery':
        return { 
          label: 'Out for Delivery', 
          variant: 'default' as const,
          icon: Truck,
          color: 'text-blue-600'
        };
      case 'preparing':
        return { 
          label: 'Being Prepared', 
          variant: 'secondary' as const,
          icon: Package,
          color: 'text-orange-600'
        };
      case 'ready':
        return { 
          label: 'Ready for Pickup/Delivery', 
          variant: 'secondary' as const,
          icon: CheckCircle,
          color: 'text-green-600'
        };
      case 'confirmed':
        return { 
          label: 'Order Confirmed', 
          variant: 'secondary' as const,
          icon: CheckCircle,
          color: 'text-blue-600'
        };
      case 'pending':
        return { 
          label: 'Processing Order', 
          variant: 'outline' as const,
          icon: Clock,
          color: 'text-yellow-600'
        };
      default:
        return { 
          label: 'Order Status Unknown', 
          variant: 'outline' as const,
          icon: Clock,
          color: 'text-gray-600'
        };
    }
  };

  const statusConfig = getStatusConfig(orderStatus);

  return (
    <Card className={`border-blue-200 bg-blue-50/50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-blue-800 flex items-center gap-2 text-lg">
          <Calendar className="w-5 h-5" />
          Delivery Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Fulfillment Channel & Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="flex items-center gap-2">
            {orderType === 'delivery' ? (
              <Truck className="w-4 h-4 text-blue-600" />
            ) : (
              <MapPin className="w-4 h-4 text-blue-600" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-700">Fulfillment</p>
              <p className="text-sm text-blue-800 font-semibold">{getFulfillmentChannel()}</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <statusConfig.icon className={`w-4 h-4 ${statusConfig.color}`} />
            <div>
              <p className="text-sm font-medium text-gray-700">Status</p>
              <Badge variant={statusConfig.variant} className="text-xs">
                {statusConfig.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Delivery Schedule - only show if delivery type and schedule exists */}
        {orderType === 'delivery' && schedule && (
          <div className="border-t pt-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Delivery Date */}
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Delivery Date</p>
                  <p className="text-sm text-blue-800 font-semibold">
                    {formatDate(schedule.delivery_date)}
                  </p>
                </div>
              </div>

              {/* Time Window */}
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <div>
                  <p className="text-sm font-medium text-gray-700">Time Window</p>
                  <p className="text-sm text-blue-800 font-semibold">
                    {formatTime(schedule.delivery_time_start)} - {formatTime(schedule.delivery_time_end)}
                  </p>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Additional Delivery Details - only show if delivery type and schedule exists */}
        {orderType === 'delivery' && schedule && (
          <>
            {/* Flexibility Badge */}
            {schedule.is_flexible && (
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                  <MapPin className="w-3 h-3 mr-1" />
                  Flexible delivery time
                </Badge>
              </div>
            )}

            {/* Special Instructions */}
            {schedule.special_instructions && (
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <FileText className="w-4 h-4 text-blue-600" />
                  <p className="text-sm font-medium text-gray-700">Special Instructions</p>
                </div>
                <p className="text-sm text-gray-600 bg-white/70 p-2 rounded border">
                  {schedule.special_instructions}
                </p>
              </div>
            )}

            {/* Scheduled Date */}
            <div className="text-xs text-gray-500 border-t pt-2">
              Delivery scheduled on {format(new Date(schedule.requested_at), 'MMM d, yyyy \'at\' h:mm a')}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
};