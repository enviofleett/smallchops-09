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
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';

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
  orderId?: string;
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
  order,
  orderId
}) => {
  // Fetch detailed order data for fulfillment information
  const { data: detailedOrderData, isLoading: isLoadingDetailedOrder } = useDetailedOrderData(orderId || orderNumber);
  
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
              {isLoadingDetailedOrder ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
                    <p className="text-sm text-muted-foreground">Loading fulfillment details...</p>
                  </div>
                </div>
              ) : !detailedOrderData ? (
                <div className="flex items-center justify-center py-8">
                  <div className="flex flex-col items-center space-y-2">
                    <div className="text-destructive">⚠</div>
                    <p className="text-sm text-muted-foreground">Unable to load fulfillment details</p>
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Fulfillment Type */}
                  <div className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                    <div className="flex items-center gap-3">
                      {(detailedOrderData.order.fulfillment_type || orderType) === 'delivery' ? 
                        <Truck className="w-5 h-5 text-primary" /> : 
                        <Package className="w-5 h-5 text-primary" />
                      }
                      <div>
                        <p className="text-xs text-muted-foreground uppercase tracking-wider">Fulfillment Type</p>
                        <p className="font-semibold capitalize text-foreground">
                          {detailedOrderData.order.fulfillment_type || orderType || "Not specified"}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Conditional sections based on fulfillment type */}
                  {(detailedOrderData.order.fulfillment_type || orderType) === "pickup" && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Pickup Location
                      </h4>
                      <div className="pl-6">
                        <p className="font-semibold text-foreground">
                          {detailedOrderData.order.pickup_point_id || "Location ID not assigned"}
                        </p>
                      </div>
                    </div>
                  )}

                  {(detailedOrderData.order.fulfillment_type || orderType) === "delivery" && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <MapPin className="w-4 h-4" />
                        Delivery Address
                      </h4>
                      <div className="pl-6">
                        <p className="text-sm text-foreground break-words">
                          {(() => {
                            const address = detailedOrderData.order.delivery_address || deliveryAddress;
                            if (!address) return "Address not provided";
                            
                            if (typeof address === "string") return address;
                            
                            return [
                              address.address_line_1,
                              address.address_line_2,
                              address.city,
                              address.state,
                              address.postal_code,
                              address.landmark,
                            ].filter(Boolean).join(", ");
                          })()}
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Schedule Information */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Date */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Calendar className="w-4 h-4" />
                        {(detailedOrderData.order.fulfillment_type || orderType) === 'delivery' ? 'Delivery' : 'Pickup'} Date
                      </h4>
                      <div className="pl-6">
                        {detailedOrderData.delivery_schedule?.delivery_date ? (
                          <p className="font-semibold text-foreground">
                            {format(new Date(detailedOrderData.delivery_schedule.delivery_date), 'EEEE, MMM d, yyyy')}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Not scheduled</p>
                        )}
                      </div>
                    </div>

                    {/* Time Window */}
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                        <Clock className="w-4 h-4" />
                        Time Window
                      </h4>
                      <div className="pl-6">
                        {detailedOrderData.delivery_schedule?.delivery_time_start && detailedOrderData.delivery_schedule?.delivery_time_end ? (
                          <p className="font-semibold text-foreground">
                            {detailedOrderData.delivery_schedule.delivery_time_start.substring(0, 5)} – {detailedOrderData.delivery_schedule.delivery_time_end.substring(0, 5)}
                          </p>
                        ) : (
                          <p className="text-sm text-muted-foreground">Not specified</p>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Special Instructions */}
                  {(detailedOrderData.delivery_schedule?.special_instructions || specialInstructions) && (
                    <div className="space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Special Instructions</h4>
                      <div className="bg-muted/50 rounded-lg p-3">
                        <p className="text-sm text-foreground">
                          {detailedOrderData.delivery_schedule?.special_instructions || specialInstructions}
                        </p>
                      </div>
                    </div>
                  )}

                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};