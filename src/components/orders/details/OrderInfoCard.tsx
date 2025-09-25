import React from 'react';
import { Hash, Calendar, Clock, CreditCard, Truck, Package, Database, MapPin, Navigation } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from './SectionHeading';
import { StatCard } from './StatCard';
import { DeliveryScheduleDisplay } from '../DeliveryScheduleDisplay';
import { PickupScheduleUpdate } from '../PickupScheduleUpdate';
import { OrderStatus } from '@/types/orders';
import { format } from 'date-fns';
import { formatAddress } from '@/utils/formatAddress';
import { usePickupPoint } from '@/hooks/usePickupPoints';
import { useDeliveryZones } from '@/hooks/useDeliveryZones';

interface OrderInfoCardProps {
  orderNumber: string;
  orderTime: string;
  orderType: 'delivery' | 'pickup';
  status: OrderStatus;
  paymentStatus: string;
  paymentReference?: string;
  totalAmount: number;
  deliverySchedule?: any;
  pickupPoint?: any;
  deliveryAddress?: string;
  specialInstructions?: string;
  isLoadingSchedule?: boolean;
  onRecoveryAttempt?: () => void;
  recoveryPending?: boolean;
  recoveryError?: boolean;
  recoveryStatus?: {
    canRecover: boolean;
    attempts: number;
    maxAttempts: number;
    isRecovering: boolean;
    lastAttempt?: number;
  };
  order?: {
    id: string;
    order_type: 'pickup' | 'delivery';
    pickup_time?: string;
    special_instructions?: string;
    created_at: string;
  };
}

export const OrderInfoCard: React.FC<OrderInfoCardProps> = ({
  orderNumber,
  orderTime,
  orderType,
  status,
  paymentStatus,
  paymentReference,
  totalAmount,
  deliverySchedule,
  pickupPoint,
  deliveryAddress,
  specialInstructions,
  isLoadingSchedule,
  onRecoveryAttempt,
  recoveryPending,
  recoveryError,
  recoveryStatus,
  order
}) => {
  // Hooks for fetching fulfillment data
  const { data: pickupPointData, isLoading: isLoadingPickupPoint } = usePickupPoint(
    orderType === 'pickup' && order ? (order as any).pickup_point_id : undefined
  );
  
  const { zones } = useDeliveryZones();
  const deliveryZoneData = zones.find(zone => zone.id === (order as any)?.delivery_zone_id);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const getStatusVariant = (status: OrderStatus) => {
    switch (status) {
      case 'completed':
      case 'delivered':
        return 'success';
      case 'cancelled':
        return 'destructive';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  const getPaymentVariant = (paymentStatus: string) => {
    switch (paymentStatus) {
      case 'paid':
        return 'success';
      case 'failed':
        return 'destructive';
      case 'pending':
        return 'warning';
      default:
        return 'default';
    }
  };

  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-6">
        <SectionHeading 
          title="Order Information" 
          icon={Hash} 
        />
        
        {/* Order Stats Grid */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard
            title="Status"
            value={status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
            icon={Clock}
            variant={getStatusVariant(status)}
          />
          <StatCard
            title="Payment"
            value={paymentStatus.charAt(0).toUpperCase() + paymentStatus.slice(1)}
            icon={CreditCard}
            variant={getPaymentVariant(paymentStatus)}
          />
        </div>

        {/* Order Details */}
        <div className="space-y-3 text-sm">
          <div className="flex items-center gap-3">
            <Hash className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider block">Order ID</span>
              <span className="font-medium text-primary break-words">{orderNumber}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground flex-shrink-0" />
            <div>
              <span className="text-xs text-muted-foreground uppercase tracking-wider block">Order Time</span>
              <span className="font-medium">{format(new Date(orderTime), 'MMM d, yyyy h:mm a')}</span>
            </div>
          </div>

          {paymentReference && (
            <div className="flex items-center gap-3">
              <CreditCard className="h-4 w-4 text-muted-foreground flex-shrink-0" />
              <div>
                <span className="text-xs text-muted-foreground uppercase tracking-wider block">Payment Ref</span>
                <span className="font-mono text-xs break-all">{paymentReference}</span>
              </div>
            </div>
          )}
        </div>

        {/* Total Amount Highlight */}
        <div className="bg-muted rounded-lg p-4">
          <div className="text-center">
            <p className="text-xs text-muted-foreground uppercase tracking-wider mb-1">Total Amount</p>
            <p className="text-2xl font-bold text-foreground">{formatCurrency(totalAmount)}</p>
          </div>
        </div>

        {/* Fulfillment Information Section - Production Ready */}
        <div>
          <SectionHeading 
            title="Fulfillment Information"
            icon={orderType === 'delivery' ? Truck : Package}
          />
          
          {isLoadingSchedule || recoveryPending || isLoadingPickupPoint ? (
            <div className="bg-muted rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-muted-foreground/20 rounded mb-2"></div>
              <div className="h-3 bg-muted-foreground/20 rounded w-2/3"></div>
              {recoveryPending && (
                <p className="text-xs text-primary mt-2">🔄 Attempting to recover data...</p>
              )}
            </div>
          ) : (
            <div className="bg-background rounded-lg p-4 border">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                
                {/* Fulfillment Type */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-foreground">Fulfillment Type</span>
                    <Badge variant="secondary" className="text-xs">
                      <Database className="w-3 h-3 mr-1" />
                      orders.order_type
                    </Badge>
                  </div>
                  <div className="flex items-center gap-2">
                    {orderType === 'delivery' ? <Truck className="w-4 h-4 text-primary" /> : <Package className="w-4 h-4 text-primary" />}
                    <span className="font-semibold capitalize text-primary">{orderType}</span>
                  </div>
                </div>

                {/* Pickup Point ID / Delivery Zone ID */}
                {orderType === 'pickup' ? (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-foreground">Pickup Point</span>
                      <Badge variant="secondary" className="text-xs">
                        <Database className="w-3 h-3 mr-1" />
                        pickup_points via orders.pickup_point_id
                      </Badge>
                    </div>
                    <div className="text-sm">
                      {pickupPointData ? (
                        <div>
                          <span className="font-semibold text-primary">{pickupPointData.name}</span>
                          <p className="text-muted-foreground text-xs mt-1">{pickupPointData.address}</p>
                        </div>
                      ) : (
                        <span className="text-muted-foreground">No pickup point assigned</span>
                      )}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-foreground">Delivery Zone</span>
                      <Badge variant="secondary" className="text-xs">
                        <Database className="w-3 h-3 mr-1" />
                        delivery_zones via orders.delivery_zone_id
                      </Badge>
                    </div>
                    <div className="text-sm">
                      {deliveryZoneData ? (
                        <span className="font-semibold text-primary">{deliveryZoneData.name}</span>
                      ) : (
                        <span className="text-muted-foreground">No delivery zone assigned</span>
                      )}
                    </div>
                  </div>
                )}

                {/* Delivery Address (only for delivery orders) */}
                {orderType === 'delivery' && (
                  <div className="md:col-span-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-medium text-foreground">Delivery Address</span>
                      <Badge variant="secondary" className="text-xs">
                        <Database className="w-3 h-3 mr-1" />
                        orders.delivery_address
                      </Badge>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium break-words">
                        {formatAddress(deliveryAddress) || <span className="text-muted-foreground">No delivery address provided</span>}
                      </span>
                    </div>
                  </div>
                )}

                {/* Delivery/Pickup Date */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-foreground">{orderType === 'delivery' ? 'Delivery' : 'Pickup'} Date</span>
                    <Badge variant="secondary" className="text-xs">
                      <Database className="w-3 h-3 mr-1" />
                      order_delivery_schedule.delivery_date
                    </Badge>
                  </div>
                  <div className="text-sm">
                    {deliverySchedule?.delivery_date ? (
                      <span className="font-semibold text-primary">
                        {format(new Date(deliverySchedule.delivery_date), 'MMM d, yyyy')}
                      </span>
                    ) : order?.pickup_time ? (
                      <span className="font-semibold text-primary">
                        {format(new Date(order.pickup_time), 'MMM d, yyyy')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not scheduled</span>
                    )}
                  </div>
                </div>

                {/* Time Window */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-foreground">Time Window</span>
                    <Badge variant="secondary" className="text-xs">
                      <Database className="w-3 h-3 mr-1" />
                      order_delivery_schedule.delivery_time_start/end
                    </Badge>
                  </div>
                  <div className="text-sm">
                    {deliverySchedule?.delivery_time_start && deliverySchedule?.delivery_time_end ? (
                      <span className="font-semibold text-primary">
                        {deliverySchedule.delivery_time_start.substring(0, 5)} – {deliverySchedule.delivery_time_end.substring(0, 5)}
                      </span>
                    ) : order?.pickup_time ? (
                      <span className="font-semibold text-primary">
                        {format(new Date(order.pickup_time), 'HH:mm')}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not specified</span>
                    )}
                  </div>
                </div>

                {/* Schedule Flexibility */}
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-foreground">Schedule Flexibility</span>
                    <Badge variant="secondary" className="text-xs">
                      <Database className="w-3 h-3 mr-1" />
                      order_delivery_schedule.is_flexible
                    </Badge>
                  </div>
                  <div className="text-sm">
                    {deliverySchedule?.is_flexible !== undefined ? (
                      <span className="font-semibold text-primary">
                        {deliverySchedule.is_flexible ? 'Flexible timing' : 'Fixed timing'}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">Not specified</span>
                    )}
                  </div>
                </div>

                {/* Special Instructions */}
                <div className="md:col-span-2">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="font-medium text-foreground">Special Instructions</span>
                    <Badge variant="secondary" className="text-xs">
                      <Database className="w-3 h-3 mr-1" />
                      order_delivery_schedule.special_instructions
                    </Badge>
                  </div>
                  <div className="bg-muted/30 rounded-lg p-3">
                    <div className="text-sm">
                      {deliverySchedule?.special_instructions || order?.special_instructions || specialInstructions ? (
                        <span className="font-medium">
                          {deliverySchedule?.special_instructions || order?.special_instructions || specialInstructions}
                        </span>
                      ) : (
                        <span className="text-muted-foreground">No special instructions provided</span>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};