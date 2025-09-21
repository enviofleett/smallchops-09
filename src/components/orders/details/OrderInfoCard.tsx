import React from 'react';
import { Hash, Calendar, Clock, CreditCard, Truck, Package } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { SectionHeading } from './SectionHeading';
import { StatCard } from './StatCard';
import { DeliveryScheduleDisplay } from '../DeliveryScheduleDisplay';
import { OrderStatus } from '@/types/orders';
import { safeFormatDate } from '@/utils/safeDateFormat';

interface OrderInfoCardProps {
  orderNumber: string;
  orderTime: string;
  orderType: 'delivery' | 'pickup';
  status: OrderStatus;
  paymentStatus: string;
  paymentReference?: string;
  totalAmount: number;
  deliverySchedule?: any;
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
  isLoadingSchedule,
  onRecoveryAttempt,
  recoveryPending,
  recoveryError,
  recoveryStatus
}) => {
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
              <span className="font-medium">{safeFormatDate(orderTime, 'MMM d, yyyy h:mm a')}</span>
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

        {/* Schedule Section - Production Ready for Both Delivery & Pickup */}
        <div>
          <SectionHeading 
            title={`${orderType === 'delivery' ? 'Delivery' : 'Pickup'} Schedule`}
            icon={orderType === 'delivery' ? Truck : Package}
          />
          
          {isLoadingSchedule || recoveryPending ? (
            <div className="bg-muted rounded-lg p-4 animate-pulse">
              <div className="h-4 bg-muted-foreground/20 rounded mb-2"></div>
              <div className="h-3 bg-muted-foreground/20 rounded w-2/3"></div>
              {recoveryPending && (
                <p className="text-xs text-primary mt-2">🔄 Attempting to recover schedule...</p>
              )}
            </div>
          ) : deliverySchedule ? (
            // Production Schedule Display - Works for both Delivery and Pickup
            <DeliveryScheduleDisplay 
              schedule={deliverySchedule}
              orderType={orderType}
              orderStatus={status}
              className="mb-0" 
            />
          ) : (
            // Production-Ready Fallback with Enhanced UX
            <div className="space-y-3">
              {/* Primary Warning Card */}
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 dark:bg-amber-950 dark:border-amber-800">
                <div className="flex items-start gap-3">
                  <div className="flex-shrink-0 mt-0.5">
                    {orderType === 'delivery' ? (
                      <Truck className="w-4 h-4 text-amber-600" />
                    ) : (
                      <Package className="w-4 h-4 text-amber-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-1">
                      {orderType === 'delivery' ? 'Delivery' : 'Pickup'} Schedule Not Available
                    </h4>
                    <p className="text-sm text-amber-700 dark:text-amber-300 mb-2">
                      {orderType === 'delivery' 
                        ? 'The delivery schedule for this order is currently being processed or needs to be recovered.'
                        : 'The pickup schedule for this order is currently being processed or needs to be recovered.'
                      }
                    </p>
                    
                    {/* Recovery Status Info */}
                    {recoveryStatus && (
                      <div className="bg-amber-100 dark:bg-amber-900 rounded p-2 mb-2">
                        <p className="text-xs text-amber-800 dark:text-amber-200 font-medium mb-1">
                          Recovery Status
                        </p>
                        {recoveryStatus.canRecover ? (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            Attempts: {recoveryStatus.attempts}/{recoveryStatus.maxAttempts} 
                            {recoveryStatus.lastAttempt && (
                              <span className="ml-2">
                                (Last: {new Date(recoveryStatus.lastAttempt).toLocaleTimeString()})
                              </span>
                            )}
                          </p>
                        ) : (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            Recovery limit reached ({recoveryStatus.maxAttempts} attempts)
                          </p>
                        )}
                      </div>
                    )}
                    
                    {/* Action Instructions */}
                    <div className="space-y-1">
                      <p className="text-xs text-amber-600 dark:text-amber-400">
                        {recoveryError ? (
                          <>❌ Schedule recovery failed. The {orderType} schedule will be confirmed manually.</>
                        ) : (
                          <>⏳ Schedule will be automatically confirmed after payment verification.</>
                        )}
                      </p>
                      
                      {orderType === 'pickup' && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          📍 Pickup location will be communicated via SMS/email once confirmed.
                        </p>
                      )}
                      
                      {orderType === 'delivery' && (
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          🚚 Delivery time slot will be assigned based on your location and availability.
                        </p>
                      )}
                    </div>
                    
                    {/* Manual Recovery Button */}
                    {onRecoveryAttempt && recoveryStatus?.canRecover && (
                      <button 
                        onClick={onRecoveryAttempt}
                        className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 dark:text-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800 rounded border border-amber-300 dark:border-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        disabled={recoveryPending || !recoveryStatus.canRecover}
                      >
                        {recoveryPending ? (
                          <>🔄 Retrying...</>
                        ) : (
                          <>🔄 Retry Schedule Recovery</>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>
              
              {/* Additional Info Card for Production Orders */}
              {(status === 'confirmed' || status === 'preparing' || status === 'ready') && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 dark:bg-blue-950 dark:border-blue-800">
                  <div className="flex items-center gap-2 mb-1">
                    <Clock className="w-4 h-4 text-blue-600" />
                    <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
                      Production Update
                    </p>
                  </div>
                  <p className="text-xs text-blue-700 dark:text-blue-300">
                    Your order is being prepared. The {orderType} schedule will be finalized shortly and you'll receive a notification with all details.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};