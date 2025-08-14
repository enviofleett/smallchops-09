import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  Package,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  CheckCircle
} from 'lucide-react';
import { format, isToday, isTomorrow, parseISO } from 'date-fns';
import { OrderWithDeliverySchedule } from '@/api/deliveryScheduleApi';
import { PriceDisplay } from '@/components/ui/price-display';

interface DeliveryCardProps {
  order: OrderWithDeliverySchedule;
  onStatusUpdate?: (orderId: string, status: string) => void;
}

export function DeliveryCard({ order, onStatusUpdate }: DeliveryCardProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'pending':
      case 'confirmed':
        return 'secondary';
      case 'preparing':
      case 'ready':
        return 'outline';
      case 'out_for_delivery':
        return 'default';
      case 'delivered':
      case 'completed':
        return 'default';
      default:
        return 'secondary';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return <CheckCircle className="w-3 h-3" />;
      case 'out_for_delivery':
        return <Package className="w-3 h-3" />;
      default:
        return <Clock className="w-3 h-3" />;
    }
  };

  const isUrgent = () => {
    if (!order.delivery_schedule) return false;
    const deliveryTime = new Date(`${order.delivery_schedule.delivery_date} ${order.delivery_schedule.delivery_time_start}`);
    const now = new Date();
    const timeDiff = deliveryTime.getTime() - now.getTime();
    return timeDiff > 0 && timeDiff <= 2 * 60 * 60 * 1000; // Next 2 hours
  };

  const getDeliveryDateLabel = () => {
    if (!order.delivery_schedule) return 'No delivery date';
    const deliveryDate = parseISO(order.delivery_schedule.delivery_date);
    
    if (isToday(deliveryDate)) return 'Today';
    if (isTomorrow(deliveryDate)) return 'Tomorrow';
    return format(deliveryDate, 'MMM dd, yyyy');
  };

  const formatAddress = (address: any) => {
    if (!address) return 'No address provided';
    if (typeof address === 'string') return address;
    
    const parts = [
      address.street,
      address.city,
      address.state
    ].filter(Boolean);
    
    return parts.join(', ') || 'Address not formatted';
  };

  return (
    <Card className={`transition-all duration-200 ${isUrgent() ? 'ring-2 ring-orange-200 bg-orange-50/50' : ''}`}>
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-muted/50 transition-colors">
            <div className="space-y-3">
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div>
                    <h3 className="font-semibold text-sm sm:text-base">#{order.order_number}</h3>
                    <p className="text-xs sm:text-sm text-muted-foreground">{order.customer_name}</p>
                  </div>
                  {isUrgent() && (
                    <div className="flex items-center gap-1 text-orange-600 bg-orange-100 px-2 py-1 rounded-full">
                      <AlertCircle className="w-3 h-3" />
                      <span className="text-xs font-medium">Urgent</span>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={getStatusVariant(order.status)} className="text-xs">
                    {getStatusIcon(order.status)}
                    <span className="ml-1 capitalize">{order.status.replace('_', ' ')}</span>
                  </Badge>
                  {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
              </div>

              {/* Delivery Info */}
              {order.delivery_schedule && (
                <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-xs sm:text-sm">
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <Clock className="w-3 h-3" />
                    <span>{getDeliveryDateLabel()}</span>
                    <span className="hidden sm:inline">•</span>
                  </div>
                  <div className="flex items-center gap-1 text-muted-foreground">
                    <span>{order.delivery_schedule.delivery_time_start} - {order.delivery_schedule.delivery_time_end}</span>
                  </div>
                  {order.delivery_schedule.is_flexible && (
                    <Badge variant="outline" className="text-xs">Flexible</Badge>
                  )}
                </div>
              )}

              {/* Amount */}
              <div className="flex items-center justify-between">
                <PriceDisplay 
                  originalPrice={order.total_amount} 
                  size="sm"
                  className="text-primary font-semibold"
                />
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <MapPin className="w-3 h-3" />
                  <span className="truncate max-w-[150px]">
                    {formatAddress(order.delivery_address)}
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <CardContent className="pt-0 px-4 pb-4">
            <div className="space-y-4 border-t pt-4">
              {/* Customer Details */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Customer Details</h4>
                  <div className="space-y-1 text-sm">
                    <div className="flex items-center gap-2">
                      <User className="w-3 h-3 text-muted-foreground" />
                      <span>{order.customer_name}</span>
                    </div>
                    {order.customer_email && (
                      <div className="flex items-center gap-2">
                        <Mail className="w-3 h-3 text-muted-foreground" />
                        <span className="truncate">{order.customer_email}</span>
                      </div>
                    )}
                    {order.customer_phone && (
                      <div className="flex items-center gap-2">
                        <Phone className="w-3 h-3 text-muted-foreground" />
                        <span>{order.customer_phone}</span>
                      </div>
                    )}
                  </div>
                </div>

                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Delivery Address</h4>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="w-3 h-3 text-muted-foreground mt-0.5 flex-shrink-0" />
                    <span className="text-muted-foreground">{formatAddress(order.delivery_address)}</span>
                  </div>
                </div>
              </div>

              {/* Special Instructions */}
              {order.delivery_schedule?.special_instructions && (
                <div className="space-y-2">
                  <h4 className="text-sm font-medium">Special Instructions</h4>
                  <p className="text-sm text-muted-foreground bg-muted p-3 rounded-lg">
                    {order.delivery_schedule.special_instructions}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              {onStatusUpdate && (
                <div className="flex flex-wrap gap-2 pt-2">
                  {order.status === 'confirmed' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusUpdate(order.id, 'preparing');
                      }}
                    >
                      Mark Preparing
                    </Button>
                  )}
                  {order.status === 'preparing' && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusUpdate(order.id, 'ready');
                      }}
                    >
                      Mark Ready
                    </Button>
                  )}
                  {order.status === 'ready' && (
                    <Button 
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusUpdate(order.id, 'out_for_delivery');
                      }}
                    >
                      Out for Delivery
                    </Button>
                  )}
                  {order.status === 'out_for_delivery' && (
                    <Button 
                      size="sm" 
                      className="bg-green-600 hover:bg-green-700 text-white"
                      onClick={(e) => {
                        e.stopPropagation();
                        onStatusUpdate(order.id, 'delivered');
                      }}
                    >
                      Mark Delivered
                    </Button>
                  )}
                </div>
              )}
            </div>
          </CardContent>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}