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
            <div></div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};