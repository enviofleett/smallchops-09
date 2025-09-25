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

        {/* Comprehensive Fulfillment Information - Production Ready */}
        <div>
          <SectionHeading 
            title="Complete Fulfillment Information"
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
            <div className="space-y-4">
              
              {/* 1. Fulfillment Type - Always Available */}
              <div className="bg-secondary/20 rounded-lg p-3">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-muted-foreground font-medium">Fulfillment Type:</span>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {orderType === 'delivery' ? <Truck className="w-3 h-3 mr-1" /> : <Package className="w-3 h-3 mr-1" />}
                      Available
                    </Badge>
                    <span className="font-semibold capitalize text-primary">
                      {orderType}
                    </span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1">
                  <Badge variant="secondary" className="text-xs">
                    <Database className="w-3 h-3 mr-1" />
                    orders.order_type
                  </Badge>
                </div>
              </div>

              {/* 2. Location Information - Conditional Display */}
              {orderType === 'pickup' ? (
                <div className="bg-secondary/20 rounded-lg p-3">
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-muted-foreground font-medium">Pickup Location:</span>
                    <div className="flex items-start gap-2 text-right">
                      <Badge variant={pickupPointData ? "outline" : "destructive"} className="text-xs">
                        <MapPin className="w-3 h-3 mr-1" />
                        {pickupPointData ? 'Available' : 'Missing'}
                      </Badge>
                    </div>
                  </div>
                  
                  {pickupPointData ? (
                    <div className="space-y-2 text-sm">
                      <div>
                        <span className="font-medium text-primary">{pickupPointData.name}</span>
                        <p className="text-xs text-muted-foreground">{pickupPointData.address}</p>
                        {pickupPointData.contact_phone && (
                          <p className="text-xs text-muted-foreground">📞 {pickupPointData.contact_phone}</p>
                        )}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-destructive">Pickup location not assigned</p>
                  )}
                  
                  <div className="flex flex-wrap gap-1 mt-2">
                    <Badge variant="secondary" className="text-xs">
                      <Database className="w-3 h-3 mr-1" />
                      pickup_points table via orders.pickup_point_id
                    </Badge>
                  </div>
                </div>
              ) : (
                <>
                  {/* Delivery Address */}
                  <div className="bg-secondary/20 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-muted-foreground font-medium">Delivery Address:</span>
                      <div className="flex items-start gap-2 text-right">
                        <Badge variant={deliveryAddress ? "outline" : "destructive"} className="text-xs">
                          <MapPin className="w-3 h-3 mr-1" />
                          {deliveryAddress ? 'Available' : 'Missing'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium break-words">
                        {formatAddress(deliveryAddress) || 'Delivery address not provided'}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        <Database className="w-3 h-3 mr-1" />
                        orders.delivery_address
                      </Badge>
                    </div>
                  </div>

                  {/* Delivery Zone */}
                  <div className="bg-secondary/20 rounded-lg p-3">
                    <div className="flex justify-between items-start mb-2">
                      <span className="text-muted-foreground font-medium">Delivery Zone:</span>
                      <div className="flex items-start gap-2 text-right">
                        <Badge variant={deliveryZoneData ? "outline" : "destructive"} className="text-xs">
                          <Navigation className="w-3 h-3 mr-1" />
                          {deliveryZoneData ? 'Available' : 'Missing'}
                        </Badge>
                      </div>
                    </div>
                    <div className="text-sm">
                      <span className="font-medium">
                        {deliveryZoneData?.name || 'Zone not assigned'}
                      </span>
                      {deliveryZoneData && (
                        <p className="text-xs text-muted-foreground mt-1">
                          Status: {deliveryZoneData.is_active ? 'Active' : 'Inactive'}
                        </p>
                      )}
                    </div>
                    <div className="flex flex-wrap gap-1 mt-2">
                      <Badge variant="secondary" className="text-xs">
                        <Database className="w-3 h-3 mr-1" />
                        delivery_zones table via orders.delivery_zone_id
                      </Badge>
                    </div>
                  </div>
                </>
              )}

              {/* 3. Schedule Information */}
              <div className="bg-secondary/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-muted-foreground font-medium">{orderType === 'delivery' ? 'Delivery' : 'Pickup'} Schedule:</span>
                  <Badge variant={deliverySchedule?.delivery_date ? "outline" : "destructive"} className="text-xs">
                    <Clock className="w-3 h-3 mr-1" />
                    {deliverySchedule?.delivery_date ? "Scheduled" : "Pending"}
                  </Badge>
                </div>
                
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="font-medium text-muted-foreground">Date:</span>
                    <p className="font-semibold">
                      {deliverySchedule?.delivery_date 
                        ? format(new Date(deliverySchedule.delivery_date), 'MMM d, yyyy')
                        : order?.pickup_time
                        ? format(new Date(order.pickup_time), 'MMM d, yyyy')
                        : 'Not scheduled'
                      }
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Time Window:</span>
                    <p className="font-semibold">
                      {deliverySchedule?.delivery_time_start && deliverySchedule?.delivery_time_end 
                        ? `${deliverySchedule.delivery_time_start.substring(0, 5)} - ${deliverySchedule.delivery_time_end.substring(0, 5)}`
                        : order?.pickup_time
                        ? format(new Date(order.pickup_time), 'HH:mm')
                        : 'TBD'
                      }
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Flexibility:</span>
                    <p className="font-semibold">
                      {deliverySchedule?.is_flexible !== undefined 
                        ? (deliverySchedule.is_flexible ? 'Flexible' : 'Fixed')
                        : 'Not specified'
                      }
                    </p>
                  </div>
                  <div>
                    <span className="font-medium text-muted-foreground">Requested:</span>
                    <p className="font-semibold">
                      {deliverySchedule?.requested_at 
                        ? format(new Date(deliverySchedule.requested_at), 'MMM d, HH:mm')
                        : 'N/A'
                      }
                    </p>
                  </div>
                </div>
                
                <div className="flex flex-wrap gap-1 mt-2">
                  <Badge variant="secondary" className="text-xs">
                    <Database className="w-3 h-3 mr-1" />
                    order_delivery_schedule table | orders.pickup_time
                  </Badge>
                </div>
              </div>

              {/* 4. Special Instructions - Comprehensive Display */}
              <div className="bg-secondary/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-muted-foreground font-medium">Special Instructions:</span>
                  <Badge variant="outline" className="text-xs">
                    {(specialInstructions || deliverySchedule?.special_instructions || order?.special_instructions) ? 'Available' : 'None'}
                  </Badge>
                </div>
                
                <div className="space-y-3">
                  {/* Order-Level Instructions */}
                  <div className="border border-muted rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground">ORDER INSTRUCTIONS:</span>
                      <Badge variant="secondary" className="text-xs">
                        <Database className="w-3 h-3 mr-1" />
                        orders.special_instructions
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground">
                      {specialInstructions || order?.special_instructions || 'No order-level instructions provided'}
                    </p>
                  </div>

                  {/* Schedule-Level Instructions */}
                  <div className="border border-muted rounded-lg p-2">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs font-medium text-muted-foreground">SCHEDULE INSTRUCTIONS:</span>
                      <Badge variant="secondary" className="text-xs">
                        <Database className="w-3 h-3 mr-1" />
                        order_delivery_schedule.special_instructions
                      </Badge>
                    </div>
                    <p className="text-xs text-foreground">
                      {deliverySchedule?.special_instructions || 'No schedule-specific instructions provided'}
                    </p>
                  </div>
                </div>
              </div>

              {/* 5. Production Data Summary */}
              <div className="bg-primary/5 border border-primary/20 rounded-lg p-3">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-primary" />
                  <span className="font-medium text-primary">Checkout Data Summary</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-1">
                    <p><span className="font-medium">Fulfillment Type:</span> {orderType}</p>
                    <p><span className="font-medium">Pickup Point ID:</span> {(order as any)?.pickup_point_id || 'N/A'}</p>
                    <p><span className="font-medium">Delivery Zone ID:</span> {(order as any)?.delivery_zone_id || 'N/A'}</p>
                  </div>
                  <div className="space-y-1">
                    <p><span className="font-medium">Schedule Date:</span> {deliverySchedule?.delivery_date || 'N/A'}</p>
                    <p><span className="font-medium">Time Start:</span> {deliverySchedule?.delivery_time_start || 'N/A'}</p>
                    <p><span className="font-medium">Time End:</span> {deliverySchedule?.delivery_time_end || 'N/A'}</p>
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