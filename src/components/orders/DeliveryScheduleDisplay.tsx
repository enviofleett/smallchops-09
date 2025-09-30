import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Calendar, Clock, MapPin, FileText, Truck, Package, CheckCircle, AlertTriangle, Info, XCircle, Calendar as CalendarIcon } from 'lucide-react';
import { format, isToday, isTomorrow, isPast, parseISO, setHours, setMinutes } from 'date-fns';
import { DeliverySchedule } from '@/api/deliveryScheduleApi';
import { OrderStatus } from '@/types/orders';
import { useEnhancedDeliverySchedule, ScheduleWarning } from '@/hooks/useEnhancedDeliverySchedule';

interface DeliveryScheduleDisplayProps {
  schedule: DeliverySchedule;
  orderType?: 'delivery' | 'pickup';
  orderStatus?: OrderStatus;
  className?: string;
}

export const DeliveryScheduleDisplay: React.FC<DeliveryScheduleDisplayProps> = ({ 
  schedule, 
  orderType = 'delivery',
  orderStatus = 'pending',
  className = "" 
}) => {
  // Validate schedule data
  const isValidSchedule = (schedule: any) => {
    return schedule && 
           schedule.delivery_date && 
           schedule.delivery_time_start && 
           schedule.delivery_time_end;
  };

  if (!schedule || !isValidSchedule(schedule)) {
    return (
      <div className="text-gray-500 p-4 border border-gray-200 rounded-lg">
        No delivery schedule available
      </div>
    );
  }
  const { validation, loading } = useEnhancedDeliverySchedule(schedule);
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    try {
      // Handle both "HH:mm" and "HH:mm:ss" formats
      const [hours, minutes] = timeString.split(':');
      const time = new Date();
      time.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      return format(time, 'h:mm a');
    } catch {
      return timeString;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      const date = parseISO(dateString);
      if (isToday(date)) return 'Today';
      if (isTomorrow(date)) return 'Tomorrow';
      return format(date, 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateLong = (dateString: string) => {
    if (!dateString) return '';
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

  const getWarningIcon = (warning: ScheduleWarning) => {
    switch (warning.severity) {
      case 'error': return XCircle;
      case 'warning': return AlertTriangle;
      case 'info': return Info;
      default: return Info;
    }
  };

  const getWarningColor = (warning: ScheduleWarning) => {
    switch (warning.severity) {
      case 'error': return 'destructive';
      case 'warning': return 'warning';
      case 'info': return 'secondary';
      default: return 'secondary';
    }
  };

  return (
    <Card className={`border-blue-200 bg-blue-50/50 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-blue-800 flex items-center gap-2 text-lg">
          <Calendar className="w-5 h-5" />
          {orderType === 'delivery' ? 'Delivery' : 'Pickup'} Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          {/* Fulfillment Channel */}
          <div className="flex items-center gap-2">
            {orderType === 'delivery' ? (
              <Truck className="w-4 h-4 text-blue-600" />
            ) : (
              <Package className="w-4 h-4 text-blue-600" />
            )}
            <div>
              <p className="text-sm font-medium text-gray-700">Fulfillment Channel</p>
              <p className="text-sm text-blue-800 font-semibold">
                {getFulfillmentChannel(orderType)}
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

          {/* Delivery Date */}
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-700">
                {orderType === 'delivery' ? 'Delivery' : 'Pickup'} Date
              </p>
              <p className="text-sm text-blue-800 font-semibold">
                {formatDate(schedule.delivery_date)}
              </p>
              <p className="text-xs text-gray-600">
                {formatDateLong(schedule.delivery_date)}
              </p>
            </div>
          </div>

          {/* Delivery Window */}
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-blue-600" />
            <div>
              <p className="text-sm font-medium text-gray-700">
                {orderType === 'delivery' ? 'Delivery' : 'Pickup'} Time Window
              </p>
              <p className="text-sm text-blue-800 font-semibold">
                {formatTime(schedule.delivery_time_start)} – {formatTime(schedule.delivery_time_end)}
              </p>
              {(() => {
                // Show delivery status based on current time vs delivery window
                if (!schedule.delivery_date || !schedule.delivery_time_start) {
                  return <p className="text-xs text-blue-600 mt-1">1-hour window</p>;
                }
                
                try {
                  const scheduleDate = parseISO(schedule.delivery_date);
                  const [startHours, startMinutes] = schedule.delivery_time_start.split(':').map(Number);
                  const [endHours, endMinutes] = schedule.delivery_time_end?.split(':').map(Number) || [startHours + 1, startMinutes];
                  
                  const deliveryStart = setMinutes(setHours(scheduleDate, startHours), startMinutes);
                  const deliveryEnd = setMinutes(setHours(scheduleDate, endHours), endMinutes);
                  const now = new Date();
                  
                  if (now >= deliveryStart && now <= deliveryEnd) {
                    return <p className="text-xs text-green-600 mt-1 font-medium">🟢 Active delivery window</p>;
                  } else if (now < deliveryStart) {
                    return <p className="text-xs text-blue-600 mt-1">⏰ Upcoming window</p>;
                  } else {
                    return <p className="text-xs text-gray-500 mt-1">⏳ Window closed</p>;
                  }
                } catch {
                  return <p className="text-xs text-blue-600 mt-1">1-hour window</p>;
                }
              })()}
            </div>
          </div>
        </div>

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
              <p className="text-sm font-medium text-gray-700">Delivery Instructions</p>
            </div>
            <p className="text-sm text-gray-600 bg-white/70 p-2 rounded border">
              {schedule.special_instructions}
            </p>
          </div>
        )}

        {/* Business Context & Validation */}
        {validation && (
          <div className="space-y-2">
            {/* Business Day Indicator */}
            <div className="flex items-center gap-2 flex-wrap">
              {validation.businessContext.isHoliday && (
                <Badge variant="outline" className="border-orange-500 text-orange-700 bg-orange-50">
                  <CalendarIcon className="w-3 h-3 mr-1" />
                  Holiday: {validation.businessContext.holidayName}
                </Badge>
              )}
              
              {validation.businessContext.isBusinessDay ? (
                <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                  <CheckCircle className="w-3 h-3 mr-1" />
                  Business Day
                </Badge>
              ) : (
                <Badge variant="outline" className="border-red-500 text-red-700 bg-red-50">
                  <XCircle className="w-3 h-3 mr-1" />
                  Non-Business Day
                </Badge>
              )}

              {validation.businessContext.slotAvailability && (
                <Badge 
                  variant="outline" 
                  className={`${
                    validation.businessContext.slotAvailability.available
                      ? 'border-green-500 text-green-700 bg-green-50'
                      : 'border-red-500 text-red-700 bg-red-50'
                  }`}
                >
                  <Clock className="w-3 h-3 mr-1" />
                  {validation.businessContext.slotAvailability.available ? 'Available' : 'Unavailable'}
                  {validation.businessContext.slotAvailability.capacity && validation.businessContext.slotAvailability.bookedCount && (
                    <span className="ml-1">
                      ({validation.businessContext.slotAvailability.bookedCount}/{validation.businessContext.slotAvailability.capacity})
                    </span>
                  )}
                </Badge>
              )}
            </div>

            {/* Warnings and Alerts */}
            {validation.warnings.length > 0 && (
              <div className="space-y-2">
                {validation.warnings.map((warning, index) => {
                  const WarningIcon = getWarningIcon(warning);
                  return (
                    <Alert key={index} variant={getWarningColor(warning) as any} className="py-2">
                      <WarningIcon className="h-4 w-4" />
                      <AlertDescription className="text-sm">
                        <div className="font-medium">{warning.message}</div>
                        {warning.recommendation && (
                          <div className="text-xs mt-1 opacity-80">
                            Recommendation: {warning.recommendation}
                          </div>
                        )}
                      </AlertDescription>
                    </Alert>
                  );
                })}
              </div>
            )}

            {/* Overall Schedule Status */}
            {!validation.isValid && (
              <Alert variant="destructive" className="py-2">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription className="text-sm">
                  <div className="font-medium">Schedule requires attention</div>
                  <div className="text-xs mt-1">This delivery schedule has validation issues that need to be resolved.</div>
                </AlertDescription>
              </Alert>
            )}
          </div>
        )}

        {loading && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
            Validating schedule...
          </div>
        )}

        {/* Requested Date */}
        {schedule.requested_at && (
          <div className="text-xs text-gray-500 border-t pt-2 mt-3">
            Scheduled on {(() => {
              try {
                const date = new Date(schedule.requested_at);
                if (isNaN(date.getTime())) return 'Invalid date';
                return format(date, 'MMM d, yyyy \'at\' h:mm a');
              } catch {
                return 'Invalid date';
              }
            })()}
          </div>
        )}
      </CardContent>
    </Card>
  );
};