import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar, Clock, AlertCircle, CheckCircle, MapPin } from 'lucide-react';
import { format, isAfter, isBefore, parseISO } from 'date-fns';

interface BookingWindowDisplayProps {
  fulfillmentInfo?: {
    type: 'pickup' | 'delivery';
    booking_window?: string;
    delivery_hours?: {
      start: string;
      end: string;
      is_flexible: boolean;
    };
    address?: string;
    special_instructions?: string;
    requested_at?: string;
    business_hours?: any;
  };
  order: {
    order_type: 'pickup' | 'delivery';
    status: string;
  };
}

export const BookingWindowDisplay: React.FC<BookingWindowDisplayProps> = ({
  fulfillmentInfo,
  order
}) => {
  if (!fulfillmentInfo) return null;

  const getWindowStatus = () => {
    if (!fulfillmentInfo.booking_window) return 'pending';
    
    try {
      const windowDate = parseISO(fulfillmentInfo.booking_window);
      const now = new Date();
      
      if (isBefore(windowDate, now)) return 'expired';
      if (isAfter(windowDate, now)) return 'upcoming';
      return 'active';
    } catch {
      return 'pending';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'expired': return 'destructive';
      case 'active': return 'default';
      case 'upcoming': return 'secondary';
      default: return 'outline';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'expired': return <AlertCircle className="w-4 h-4" />;
      case 'active': return <CheckCircle className="w-4 h-4" />;
      case 'upcoming': return <Clock className="w-4 h-4" />;
      default: return <Calendar className="w-4 h-4" />;
    }
  };

  const windowStatus = getWindowStatus();

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-3">
        <CardTitle className="text-primary flex items-center gap-2 text-lg">
          <Calendar className="w-5 h-5" />
          Booking Window & Schedule
          <Badge variant={getStatusColor(windowStatus)} className="ml-auto">
            {getStatusIcon(windowStatus)}
            {windowStatus.charAt(0).toUpperCase() + windowStatus.slice(1)}
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Booking Window */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Calendar className="w-4 h-4" />
              Booking Window
            </div>
            <div className="bg-background/60 rounded-lg p-3 border">
              {fulfillmentInfo.booking_window ? (
                <div className="space-y-1">
                  <p className="font-semibold text-lg">
                    {format(parseISO(fulfillmentInfo.booking_window), 'PPP')}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {format(parseISO(fulfillmentInfo.booking_window), 'EEEE')}
                  </p>
                </div>
              ) : (
                <p className="text-muted-foreground">Not scheduled</p>
              )}
            </div>
          </div>

          {/* Delivery Hours */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <Clock className="w-4 h-4" />
              {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Hours
            </div>
            <div className="bg-background/60 rounded-lg p-3 border">
              {fulfillmentInfo.delivery_hours ? (
                <div className="space-y-1">
                  <p className="font-semibold text-lg">
                    {format(new Date(`2000-01-01T${fulfillmentInfo.delivery_hours.start}`), 'p')} – {format(new Date(`2000-01-01T${fulfillmentInfo.delivery_hours.end}`), 'p')}
                  </p>
                  {fulfillmentInfo.delivery_hours.is_flexible && (
                    <Badge variant="outline" className="text-xs">
                      Flexible Timing
                    </Badge>
                  )}
                </div>
              ) : (
                <p className="text-muted-foreground">Hours not specified</p>
              )}
            </div>
          </div>
        </div>

        {/* Address */}
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
            <MapPin className="w-4 h-4" />
            {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Address
          </div>
          <div className="bg-background/60 rounded-lg p-3 border">
            <p className="text-sm">
              {fulfillmentInfo.address || 'Address not available'}
            </p>
          </div>
        </div>

        {/* Special Instructions */}
        {fulfillmentInfo.special_instructions && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
              <AlertCircle className="w-4 h-4" />
              Special Instructions
            </div>
            <div className="bg-background/60 rounded-lg p-3 border">
              <p className="text-sm">
                {fulfillmentInfo.special_instructions}
              </p>
            </div>
          </div>
        )}

        {/* Request Timestamp */}
        {fulfillmentInfo.requested_at && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground">
              Requested on {format(parseISO(fulfillmentInfo.requested_at), 'PPp')}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};