import React from 'react';
import { User, Phone, MapPin, Package, Calendar, Clock, Shield, Truck } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from './SectionHeading';
import { formatAddressMultiline } from '@/utils/formatAddress';
import { format } from 'date-fns';

interface CustomerInfoCardProps {
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  orderType: 'delivery' | 'pickup';
  deliveryAddress?: any;
  pickupPoint?: {
    name: string;
    address: string;
    contact_phone?: string;
  };
  order?: {
    status: string;
    payment_status: string;
    order_time: string;
    order_number: string;
  };
  deliverySchedule?: {
    scheduled_date?: string;
    delivery_time_start?: string;
    delivery_time_end?: string;
    special_instructions?: string;
  };
}

export const CustomerInfoCard: React.FC<CustomerInfoCardProps> = ({
  customerName,
  customerPhone,
  customerEmail,
  orderType,
  deliveryAddress,
  pickupPoint,
  order,
  deliverySchedule
}) => {
  const formatCurrency = (amount: number) => {
    return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
  };

  const getDeliveryInfo = () => {
    if (orderType === 'pickup' && pickupPoint) {
      return {
        type: 'Pickup',
        address: pickupPoint.address || 'Pickup Point',
        time: deliverySchedule?.scheduled_date ? 
          format(new Date(deliverySchedule.scheduled_date), 'PPP p') : 
          'Not scheduled'
      };
    } else if (orderType === 'delivery') {
      const formattedAddress = deliveryAddress ? formatAddressMultiline(deliveryAddress) : 'Not provided';
      return {
        type: 'Delivery',
        address: formattedAddress,
        time: deliverySchedule?.scheduled_date ? 
          format(new Date(deliverySchedule.scheduled_date), 'PPP p') : 
          'Not scheduled'
      };
    }
    return { type: 'Unknown', address: 'Not provided', time: 'Not scheduled' };
  };

  const formatTimeWindow = () => {
    if (!deliverySchedule?.scheduled_date) return '4:00 PM – 5:00 PM';
    
    const startTime = deliverySchedule.delivery_time_start ? 
      deliverySchedule.delivery_time_start : 
      format(new Date(deliverySchedule.scheduled_date), 'p');
    
    const endTime = deliverySchedule.delivery_time_end ? 
      deliverySchedule.delivery_time_end : 
      format(new Date(new Date(deliverySchedule.scheduled_date).getTime() + 60*60*1000), 'p');
    
    return `${startTime} – ${endTime}`;
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case 'paid':
      case 'delivered':
      case 'completed':
        return 'default';
      case 'pending':
      case 'confirmed':
        return 'secondary';
      case 'cancelled':
      case 'failed':
        return 'destructive';
      default:
        return 'outline';
    }
  };

  const deliveryInfo = getDeliveryInfo();
  return (
    <Card>
      <CardContent className="p-4 sm:p-6">
        <SectionHeading 
          title="Customer Information" 
          icon={User} 
        />
        
        <div className="space-y-6">
          {/* Customer Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <span className="text-sm font-medium break-words">{customerName}</span>
            </div>
            
            {customerPhone && (
              <div className="flex items-center gap-3">
                <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm break-words">{customerPhone}</span>
              </div>
            )}
            
            {customerEmail && (
              <div className="flex items-center gap-3">
                <User className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm break-words">{customerEmail}</span>
              </div>
            )}
          </div>

          {/* Order Status Information */}
          {order && (
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Order Status
                </span>
              </div>
              <div className="ml-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Status:</span>
                  <Badge variant={getStatusBadgeVariant(order.status)}>
                    {order.status.replace(/_/g, ' ').toUpperCase()}
                  </Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Payment:</span>
                  <Badge variant={getStatusBadgeVariant(order.payment_status)}>
                    {order.payment_status.toUpperCase()}
                  </Badge>
                </div>
              </div>
            </div>
          )}

          {/* Fulfillment Information */}
          <div className="pt-3 border-t border-border space-y-3">
            <div className="flex items-center gap-2">
              <Truck className="h-4 w-4 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                {deliveryInfo.type} Information
              </span>
            </div>
            <div className="ml-6 space-y-2">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <div className="space-y-1">
                  {deliveryInfo.address.split('\n').map((line, index) => (
                    <div key={index} className="text-sm text-foreground">
                      {line}
                    </div>
                  ))}
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="text-sm text-foreground">{deliveryInfo.time}</span>
              </div>
            </div>
          </div>

          {/* Schedule Fulfillment (for pickup orders) */}
          {orderType === 'pickup' && (
            <div className="pt-3 border-t border-border space-y-3">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Pickup Schedule Fulfillment
                </span>
              </div>
              <div className="ml-6 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Channel:</span>
                  <Badge variant="outline">Pickup</Badge>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Date:</span>
                  <span className="text-sm text-foreground">
                    {deliverySchedule?.scheduled_date ? 
                      format(new Date(deliverySchedule.scheduled_date), 'PPP') : 
                      'Today'
                    }
                  </span>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Time Window:</span>
                  <div className="text-right">
                    <div className="text-sm text-foreground">{formatTimeWindow()}</div>
                    <div className="text-xs text-muted-foreground">⏰ Upcoming window</div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">Business Day:</span>
                  <span className="text-sm text-foreground">
                    {deliverySchedule?.scheduled_date ? 
                      format(new Date(deliverySchedule.scheduled_date), 'EEEE') : 
                      format(new Date(), 'EEEE')
                    }
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Special Instructions */}
          {deliverySchedule?.special_instructions && (
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-muted-foreground" />
                <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                  Special Instructions
                </span>
              </div>
              <div className="ml-6">
                <p className="text-sm text-foreground bg-muted/50 p-3 rounded-md">
                  {deliverySchedule.special_instructions}
                </p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};