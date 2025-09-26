import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  MessageSquare, 
  Package, 
  Truck,
  CheckCircle,
  AlertCircle,
  Phone,
  Building2,
  User,
  CreditCard,
  Hash,
  Timer
} from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';

interface ComprehensiveOrderFulfillmentProps {
  data: {
    order?: any;
    items?: any[];
    delivery_schedule?: any;
    pickup_point?: any;
    business_settings?: any;
    fulfillment_info?: {
      type: 'pickup' | 'delivery';
      booking_window?: string;
      pickup_time?: string;
      delivery_date?: string;
      delivery_hours?: {
        start: string;
        end: string;
        is_flexible: boolean;
      };
      address?: string;
      special_instructions?: string;
      delivery_instructions?: string;
      order_instructions?: string;
      schedule_instructions?: string;
      requested_at?: string;
      business_hours?: any;
      pickup_point_name?: string;
      pickup_point_phone?: string;
      pickup_point_hours?: any;
    };
  };
  isLoading?: boolean;
}

export const ComprehensiveOrderFulfillment: React.FC<ComprehensiveOrderFulfillmentProps> = ({
  data,
  isLoading
}) => {
  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map(i => (
          <Card key={i}>
            <CardContent className="p-6">
              <div className="animate-pulse space-y-3">
                <div className="h-4 bg-muted rounded w-1/4"></div>
                <div className="h-8 bg-muted rounded w-3/4"></div>
                <div className="h-4 bg-muted rounded w-1/2"></div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!data?.order) {
    return (
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          No order data available. Please refresh the page or contact support.
        </AlertDescription>
      </Alert>
    );
  }

  const { order, items, fulfillment_info, pickup_point, business_settings } = data;

  // Helper functions
  const formatDate = (dateString: string) => {
    if (!dateString) return 'Not specified';
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'EEEE, MMMM do, yyyy') : 'Invalid date';
    } catch {
      return 'Invalid date';
    }
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return 'Not specified';
    try {
      // Handle both full datetime strings and time-only strings
      if (timeString.includes('T') || timeString.includes(' ')) {
        const date = parseISO(timeString);
        return isValid(date) ? format(date, 'h:mm a') : 'Invalid time';
      } else {
        // Time only format like "14:30"
        const [hours, minutes] = timeString.split(':');
        const date = new Date();
        date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
        return format(date, 'h:mm a');
      }
    } catch {
      return 'Invalid time';
    }
  };

  const formatDateTime = (dateString: string) => {
    if (!dateString) return 'Not specified';
    try {
      const date = parseISO(dateString);
      return isValid(date) ? format(date, 'PPP p') : 'Invalid date';
    } catch {
      return 'Invalid date';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'default';
      case 'out_for_delivery': return 'default';
      case 'ready': return 'secondary';
      case 'preparing': return 'secondary';
      case 'confirmed': return 'secondary';
      case 'cancelled': return 'destructive';
      case 'pending': return 'outline';
      default: return 'outline';
    }
  };

  const aggregateInstructions = () => {
    const instructions = [];
    if (fulfillment_info?.order_instructions?.trim()) {
      instructions.push(`Order: ${fulfillment_info.order_instructions.trim()}`);
    }
    if (fulfillment_info?.delivery_instructions?.trim()) {
      instructions.push(`Delivery: ${fulfillment_info.delivery_instructions.trim()}`);
    }
    if (fulfillment_info?.schedule_instructions?.trim()) {
      instructions.push(`Schedule: ${fulfillment_info.schedule_instructions.trim()}`);
    }
    if (fulfillment_info?.special_instructions?.trim() && 
        fulfillment_info.special_instructions !== 'No special instructions') {
      instructions.push(fulfillment_info.special_instructions.trim());
    }
    return instructions.length > 0 ? instructions : ['No special instructions provided'];
  };

  return (
    <div className="space-y-6">
      {/* Order Overview Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-primary">
            <Hash className="h-5 w-5" />
            Order Overview
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <Hash className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Order Number</p>
                <p className="font-semibold">{order.order_number}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                {order.order_type === 'pickup' ? (
                  <Package className="h-4 w-4 text-primary" />
                ) : (
                  <Truck className="h-4 w-4 text-primary" />
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Order Type</p>
                <p className="font-semibold capitalize">{order.order_type}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <CheckCircle className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Status</p>
                <Badge variant={getStatusColor(order.status)}>
                  {order.status?.replace(/_/g, ' ').toUpperCase()}
                </Badge>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-full bg-primary/10">
                <CreditCard className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total Amount</p>
                <p className="font-semibold">₦{order.total_amount?.toLocaleString()}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Customer & Items Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="h-5 w-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-sm text-muted-foreground">Name</p>
              <p className="font-semibold">{order.customer_name || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Email</p>
              <p className="font-semibold">{order.customer_email || 'Not provided'}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Phone</p>
              <p className="font-semibold">{order.customer_phone || 'Not provided'}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Items ({items?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items?.length > 0 ? (
              <div className="space-y-2 max-h-40 overflow-y-auto">
                {items.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-2 bg-muted/30 rounded">
                    <div>
                      <p className="font-medium text-sm">{item.product?.name}</p>
                      <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                    </div>
                    <p className="font-semibold">₦{(item.unit_price * item.quantity)?.toLocaleString()}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No items found</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fulfillment Timeline Card */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-blue-800">
            <Calendar className="h-5 w-5" />
            Fulfillment Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <Calendar className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Date
                  </p>
                  <p className="font-semibold">
                    {order.order_type === 'pickup' && fulfillment_info?.pickup_time 
                      ? formatDate(fulfillment_info.pickup_time)
                      : fulfillment_info?.delivery_date 
                        ? formatDate(fulfillment_info.delivery_date)
                        : fulfillment_info?.booking_window
                          ? formatDate(fulfillment_info.booking_window)
                          : 'Not scheduled'
                    }
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <Clock className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">
                    {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Time
                  </p>
                  <p className="font-semibold">
                    {order.order_type === 'pickup' && fulfillment_info?.pickup_time 
                      ? formatDateTime(fulfillment_info.pickup_time)
                      : fulfillment_info?.delivery_hours
                        ? `${formatTime(fulfillment_info.delivery_hours.start)} - ${formatTime(fulfillment_info.delivery_hours.end)}${fulfillment_info.delivery_hours.is_flexible ? ' (Flexible)' : ''}`
                        : 'Not scheduled'
                    }
                  </p>
                </div>
              </div>
            </div>

            {fulfillment_info?.requested_at && (
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-full bg-blue-100">
                  <Timer className="h-4 w-4 text-blue-600" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Requested At</p>
                  <p className="font-semibold">{formatDateTime(fulfillment_info.requested_at)}</p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Location Details Card */}
      <Card className="border-green-200 bg-green-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-green-800">
            <MapPin className="h-5 w-5" />
            {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Location
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-muted-foreground mb-2">Address</p>
            <div className="bg-background/80 p-3 rounded-lg border">
              <p className="font-medium">{fulfillment_info?.address || 'Address not available'}</p>
            </div>
          </div>

          {order.order_type === 'pickup' && (pickup_point || fulfillment_info?.pickup_point_name) && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2 border-t">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Pickup Point</p>
                <div className="flex items-center gap-2">
                  <Building2 className="h-4 w-4 text-green-600" />
                  <p className="font-medium">
                    {fulfillment_info?.pickup_point_name || pickup_point?.name || 'Main Location'}
                  </p>
                </div>
              </div>
              
              {(fulfillment_info?.pickup_point_phone || pickup_point?.contact_phone) && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Contact</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-green-600" />
                    <p className="font-medium">
                      {fulfillment_info?.pickup_point_phone || pickup_point?.contact_phone}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Special Instructions Panel */}
      <Card className="border-orange-200 bg-orange-50/50">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-orange-800">
            <MessageSquare className="h-5 w-5" />
            Special Instructions
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {aggregateInstructions().map((instruction, index) => (
              <div key={index} className="bg-background/80 p-3 rounded-lg border">
                <p className="text-sm">{instruction}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Business Information Card */}
      {(fulfillment_info?.business_hours || fulfillment_info?.pickup_point_hours || business_settings) && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Information
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {order.order_type === 'pickup' && fulfillment_info?.pickup_point_hours && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Pickup Point Hours</p>
                  <div className="bg-muted/30 p-3 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(fulfillment_info.pickup_point_hours, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
              
              {fulfillment_info?.business_hours && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Business Hours</p>
                  <div className="bg-muted/30 p-3 rounded-lg">
                    <pre className="text-sm whitespace-pre-wrap">
                      {JSON.stringify(fulfillment_info.business_hours, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};