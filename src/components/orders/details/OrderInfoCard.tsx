import React from 'react';
import { Hash, Calendar, Clock, CreditCard, Truck, Package, Database } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { SectionHeading } from './SectionHeading';
import { StatCard } from './StatCard';
import { DeliveryScheduleDisplay } from '../DeliveryScheduleDisplay';
import { PickupScheduleUpdate } from '../PickupScheduleUpdate';
import { OrderStatus } from '@/types/orders';
import { format } from 'date-fns';
import { formatAddress } from '@/utils/formatAddress';

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
            <div className="space-y-3">
              {/* Import the PickupScheduleUpdate component */}
              {orderType === 'pickup' ? (
                <PickupScheduleUpdate 
                  orderId={orderNumber} 
                  currentSchedule={deliverySchedule}
                  order={order}
                  onUpdate={onRecoveryAttempt}
                />
              ) : (
                  // Complete Fulfillment Information for Delivery Orders
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      <Truck className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-primary mb-4">
                        Complete Fulfillment Information
                      </h4>
                      
                      <div className="space-y-4 text-sm">
                        {/* 1. Fulfillment Type */}
                        <div className="bg-secondary/20 rounded-lg p-3">
                          <div className="flex justify-between items-center mb-2">
                            <span className="text-muted-foreground font-medium">Fulfillment Type:</span>
                            <div className="flex items-center gap-2">
                              <Badge variant="outline" className="text-xs">Available</Badge>
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

                        {/* 2. Address Information (Conditional) */}
                        <div className="bg-secondary/20 rounded-lg p-3">
                          <div className="flex justify-between items-start mb-2">
                            <span className="text-muted-foreground font-medium">
                              Delivery Address:
                            </span>
                            <div className="flex items-start gap-2 text-right">
                              <Badge variant="outline" className="text-xs">
                                {deliveryAddress ? 'Available' : 'Missing'}
                              </Badge>
                              <span className="font-semibold max-w-48 text-sm break-words">
                                {formatAddress(deliveryAddress) || 'Delivery Address Not Set'}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-1">
                            <Badge variant="secondary" className="text-xs">
                              <Database className="w-3 h-3 mr-1" />
                              orders.delivery_address
                            </Badge>
                          </div>
                        </div>

                        {/* 3. Special Instructions (Two-Level System) */}
                        <div className="bg-secondary/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-muted-foreground font-medium">Special Instructions:</span>
                            <Badge variant="outline" className="text-xs">
                              {(specialInstructions || deliverySchedule?.special_instructions) ? 'Available' : 'None'}
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
                                {specialInstructions || 'No order-level instructions provided'}
                              </p>
                            </div>

                            {/* Delivery Schedule Instructions */}
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

                        {/* 4. Delivery Schedule Data */}
                        <div className="bg-secondary/20 rounded-lg p-3">
                          <div className="flex items-center gap-2 mb-3">
                            <span className="text-muted-foreground font-medium">Delivery Schedule:</span>
                            <Badge variant={deliverySchedule?.delivery_date ? "outline" : "destructive"} className="text-xs">
                              {deliverySchedule?.delivery_date ? "Scheduled" : "Pending"}
                            </Badge>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <span className="font-medium text-muted-foreground">Date:</span>
                              <p className="font-semibold">
                                {deliverySchedule?.delivery_date 
                                  ? format(new Date(deliverySchedule.delivery_date), 'MMM d, yyyy')
                                  : 'Not scheduled'
                                }
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">Time Window:</span>
                              <p className="font-semibold">
                                {deliverySchedule?.delivery_time_start && deliverySchedule?.delivery_time_end 
                                  ? `${deliverySchedule.delivery_time_start.substring(0, 5)} - ${deliverySchedule.delivery_time_end.substring(0, 5)}`
                                  : deliverySchedule?.delivery_time_start?.substring(0, 5) || 'TBD'
                                }
                              </p>
                            </div>
                            <div>
                              <span className="font-medium text-muted-foreground">Flexibility:</span>
                              <p className="font-semibold">
                                {deliverySchedule?.is_flexible ? 'Flexible' : 'Fixed'}
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
                              order_delivery_schedule table
                            </Badge>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
            </div>
          ) : (
              // Fallback: Schedule creation required  
              <div className="space-y-3">
                {/* Schedule Creation Card */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 dark:bg-blue-950 dark:border-blue-800">
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 mt-0.5">
                      {orderType === 'delivery' ? (
                        <Truck className="w-4 h-4 text-blue-600" />
                      ) : (
                        <Package className="w-4 h-4 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <h4 className="text-sm font-medium text-blue-800 dark:text-blue-200 mb-2">
                        {orderType === 'delivery' ? 'Delivery' : 'Pickup'} Schedule Required
                      </h4>
                      
                      {/* Expected fulfillment data display */}
                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-4 text-blue-700 dark:text-blue-300">
                          <div>
                            <span className="font-medium">Date:</span>
                            <span className="ml-1 text-muted-foreground">To be scheduled</span>
                          </div>
                          <div>
                            <span className="font-medium">Time:</span>
                            <span className="ml-1 text-muted-foreground">To be confirmed</span>
                          </div>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4 text-blue-700 dark:text-blue-300">
                          <div>
                            <span className="font-medium">Channel:</span>
                            <span className="ml-1 capitalize">{orderType}</span>
                          </div>
                          <div>
                            <span className="font-medium">Status:</span>
                            <span className="ml-1 capitalize">{status.replace(/_/g, ' ')}</span>
                          </div>
                        </div>
                        
                        {/* Instructions placeholder */}
                        <div className="pt-2 border-t border-blue-200 dark:border-blue-700">
                          <span className="font-medium text-blue-700 dark:text-blue-300">Instructions:</span>
                          <p className="text-xs text-blue-600 dark:text-blue-400 mt-1">
                            {orderType === 'delivery' 
                              ? 'Delivery details will be confirmed once scheduled'
                              : 'Pickup instructions will be provided upon confirmation'
                            }
                          </p>
                        </div>
                      </div>
                      
                      {/* Enhanced Status Info */}
                      <div className="bg-amber-100 dark:bg-amber-900 rounded p-2 mb-2">
                        <p className="text-xs text-amber-800 dark:text-amber-200 font-medium mb-1">
                          Order Status: {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                        </p>
                        {(status === 'confirmed' || status === 'preparing' || status === 'ready') && (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            ✅ Your order is being processed and {orderType} details will be confirmed soon.
                          </p>
                        )}
                        {status === 'delivered' && orderType === 'delivery' && (
                          <p className="text-xs text-amber-700 dark:text-amber-300">
                            📦 Order marked as delivered despite missing schedule data.
                          </p>
                        )}
                      </div>
                      
                      {/* Recovery Status Info */}
                      {recoveryStatus && (
                        <div className="bg-amber-100 dark:bg-amber-900 rounded p-2 mb-2">
                          <p className="text-xs text-amber-800 dark:text-amber-200 font-medium mb-1">
                            Auto-Recovery Status
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
                              Recovery limit reached ({recoveryStatus.maxAttempts} attempts) - Manual intervention required
                            </p>
                          )}
                        </div>
                      )}
                      
                      {/* Action Instructions */}
                      <div className="space-y-1">
                        {orderType === 'delivery' && (
                          <>
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              🚚 Delivery will be coordinated manually based on your address and order details.
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              📞 You'll receive SMS/WhatsApp updates about delivery timing.
                            </p>
                          </>
                        )}
                        
                        {orderType === 'pickup' && (
                          <>
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              📍 Pickup location and timing will be communicated via SMS/email.
                            </p>
                            <p className="text-xs text-amber-600 dark:text-amber-400">
                              🕒 Typical pickup hours: 9 AM - 7 PM daily.
                            </p>
                          </>
                        )}
                        
                        <p className="text-xs text-amber-600 dark:text-amber-400">
                          {recoveryError ? (
                            <>❌ Automatic schedule recovery failed - Order will be handled manually.</>
                          ) : (
                            <>⏳ Schedule auto-recovery in progress or order will be processed manually.</>
                          )}
                        </p>
                      </div>
                      
                      {/* Manual Recovery Button */}
                      {onRecoveryAttempt && recoveryStatus?.canRecover && (
                        <button 
                          onClick={onRecoveryAttempt}
                          className="mt-3 inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-amber-700 bg-amber-100 hover:bg-amber-200 dark:text-amber-200 dark:bg-amber-900 dark:hover:bg-amber-800 rounded border border-amber-300 dark:border-amber-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                          disabled={recoveryPending || !recoveryStatus.canRecover}
                        >
                          {recoveryPending ? (
                            <>🔄 Recovering...</>
                          ) : (
                            <>🔄 Try Schedule Recovery</>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Enhanced Info Card for Different Order States */}
                {(status === 'confirmed' || status === 'preparing' || status === 'ready') && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 dark:bg-blue-950 dark:border-blue-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Clock className="w-4 h-4 text-blue-600" />
                      <p className="text-xs font-medium text-blue-800 dark:text-blue-200">
                        Processing Update
                      </p>
                    </div>
                    <p className="text-xs text-blue-700 dark:text-blue-300">
                      Your order is being prepared. The {orderType} schedule will be finalized and you'll receive detailed timing information via SMS/WhatsApp.
                    </p>
                  </div>
                )}
                
                {status === 'delivered' && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 dark:bg-green-950 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-1">
                      <Package className="w-4 h-4 text-green-600" />
                      <p className="text-xs font-medium text-green-800 dark:text-green-200">
                        Order Completed
                      </p>
                    </div>
                    <p className="text-xs text-green-700 dark:text-green-300">
                      Your order has been successfully {orderType === 'delivery' ? 'delivered' : 'picked up'}, even though schedule data is not available in the system.
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