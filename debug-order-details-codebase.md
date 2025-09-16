# Order Details Dialog Codebase for Debugging

This document contains the complete codebase for the OrderDetailsDialog component and its related files for external debugging purposes.

## Issue Context
The order status updates were failing due to RPC type mismatch errors. The database function `get_detailed_order_with_products` was returning enum types instead of text, causing TypeScript/JavaScript type errors during order status updates.

## Main Component: OrderDetailsDialog.tsx

```typescript
import React, { useState, useEffect, useRef } from 'react';
import { OrderWithItems, updateOrder, manuallyQueueCommunicationEvent } from '@/api/orders';
import { getDispatchRiders, DispatchRider } from '@/api/users';
import { Button } from '@/components/ui/button';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { X, FileText, Download, Printer, ExternalLink, Clock } from 'lucide-react';
import { useReactToPrint } from 'react-to-print';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { OrderStatus } from '@/types/orders';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { getDeliveryScheduleByOrderId } from '@/api/deliveryScheduleApi';
import { usePickupPoint } from '@/hooks/usePickupPoints';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { useEnrichedOrderItems } from '@/hooks/useEnrichedOrderItems';
import { useOrderScheduleRecovery } from '@/hooks/useOrderScheduleRecovery';
import { cn } from '@/lib/utils';

// Import our new components
import { StatCard } from './details/StatCard';
import { CustomerInfoCard } from './details/CustomerInfoCard';
import { OrderInfoCard } from './details/OrderInfoCard';
import { ActionsPanel } from './details/ActionsPanel';
import { ItemsList } from './details/ItemsList';
import { SpecialInstructions } from './details/SpecialInstructions';
import { PaymentDetailsCard } from './PaymentDetailsCard';
import { exportOrderToPDF, exportOrderToCSV } from '@/utils/exportOrder';

interface OrderDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderWithItems;
}

const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({
  isOpen,
  onClose,
  order
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(order.status);
  const [assignedRider, setAssignedRider] = useState<string | null>(order.assigned_rider_id);
  const [manualStatus, setManualStatus] = useState<OrderStatus | ''>('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<'idle' | 'success' | 'failed' | 'pending'>('idle');

  // Print ref for react-to-print
  const printRef = useRef<HTMLDivElement>(null);

  // Use detailed order data to get product features and full information
  const {
    data: detailedOrderData,
    isLoading: isLoadingDetails,
    error: detailsError
  } = useDetailedOrderData(order.id);

  // Enrich order items to ensure product features are available
  const {
    data: enrichedItems,
    isLoading: isLoadingEnriched
  } = useEnrichedOrderItems(order.order_items || []);

  useEffect(() => {
    setSelectedStatus(order.status);
    setAssignedRider(order.assigned_rider_id);
    setVerifyMessage(null);
    setVerifyState('idle');
  }, [order]);

  const {
    data: riders,
    isLoading: isLoadingRiders,
    error: ridersError
  } = useQuery<DispatchRider[]>({
    queryKey: ['dispatchRiders'],
    queryFn: getDispatchRiders,
    retry: 2,
    refetchOnWindowFocus: false
  });

  // Fetch delivery schedule for this order
  const {
    data: deliverySchedule,
    isLoading: isLoadingSchedule,
    refetch: refetchSchedule
  } = useQuery({
    queryKey: ['deliverySchedule', order.id],
    queryFn: async () => {
      return await getDeliveryScheduleByOrderId(order.id);
    },
    enabled: !!order.id
  });

  // Use the production-ready circuit breaker hook
  const { 
    attemptScheduleRecovery, 
    getRecoveryStatus, 
    isRecovering 
  } = useOrderScheduleRecovery();

  // Get recovery status for this order
  const recoveryStatus = getRecoveryStatus(order.id);

  // Fetch pickup point for pickup orders
  const {
    data: pickupPoint
  } = usePickupPoint(order.order_type === 'pickup' ? order.pickup_point_id : undefined);

  // Log any errors with dispatch riders
  useEffect(() => {
    if (ridersError) {
      console.error('❌ Failed to load dispatch riders:', ridersError);
      toast({
        title: 'Warning',
        description: 'Failed to load dispatch riders. Please refresh the page.',
        variant: 'destructive'
      });
    }
    if (riders) {
      console.log('✅ Loaded dispatch riders:', riders.length, 'active riders');
    }
  }, [ridersError, riders, toast]);

  const updateMutation = useMutation({
    mutationFn: (updates: {
      status?: OrderStatus;
      assigned_rider_id?: string | null;
    }) => updateOrder(order.id, updates),
    onSuccess: () => {
      const statusChanged = selectedStatus !== order.status;
      toast({
        title: 'Success',
        description: statusChanged 
          ? 'Order updated successfully. Status change notification will be sent to customer.'
          : 'Order updated successfully.'
      });
      queryClient.invalidateQueries({
        queryKey: ['orders']
      });
      onClose();
    },
    onError: error => {
      toast({
        title: 'Error',
        description: `Failed to update order: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  const manualSendMutation = useMutation({
    mutationFn: (status: OrderStatus) => manuallyQueueCommunicationEvent(order, status),
    onSuccess: () => {
      toast({
        title: 'Success',
        description: 'Notification queued for sending.'
      });
      setManualStatus('');
    },
    onError: error => {
      toast({
        title: 'Error',
        description: `Failed to queue notification: ${error.message}`,
        variant: 'destructive'
      });
    }
  });

  const handleUpdate = () => {
    updateMutation.mutate({
      status: selectedStatus,
      assigned_rider_id: assignedRider
    });
  };

  const handleManualSend = () => {
    if (manualStatus) {
      manualSendMutation.mutate(manualStatus);
    }
  };

  const handleVerifyWithPaystack = async () => {
    if (!order.payment_reference) {
      toast({
        title: 'No payment reference',
        description: 'This order has no payment reference to verify.',
        variant: 'destructive'
      });
      return;
    }

    setVerifying(true);
    setVerifyState('pending');
    setVerifyMessage(null);

    try {
      const {
        data: primary,
        error: pErr
      } = await supabase.functions.invoke('paystack-secure', {
        body: {
          action: 'verify',
          reference: order.payment_reference
        }
      });

      if (pErr) throw new Error(pErr.message);

      const normalize = (res: any) => {
        if (res?.success) return {
          ok: true,
          data: res?.data,
          message: res?.message || 'Payment verified successfully'
        };
        if (res?.status === true) return {
          ok: true,
          data: res?.data,
          message: res?.message || 'Payment verified successfully'
        };
        return {
          ok: false,
          message: res?.error || res?.message || 'Verification failed'
        };
      };

      let normalized = normalize(primary);

      if (normalized.ok) {
        setVerifyState('success');
        setVerifyMessage(`Verified for ${order.order_number}.`);
        toast({
          title: 'Verified',
          description: `Payment verified for ${order.order_number}.`
        });
        await queryClient.invalidateQueries({
          queryKey: ['orders']
        });
      } else {
        setVerifyState('failed');
        setVerifyMessage(normalized.message);
        toast({
          title: 'Verification failed',
          description: normalized.message,
          variant: 'destructive'
        });
      }
    } catch (e: any) {
      setVerifyState('failed');
      setVerifyMessage(e?.message || 'Failed to verify payment');
      toast({
        title: 'Verification error',
        description: e?.message || 'Failed to verify payment',
        variant: 'destructive'
      });
    } finally {
      setVerifying(false);
    }
  };

  // Export handlers
  const handleExportPDF = () => {
    const exportData = {
      order,
      items: detailedOrderData?.items || enrichedItems || order.order_items || [],
      schedule: detailedOrderData?.delivery_schedule || deliverySchedule,
      paymentTx: null,
      pickupPoint
    };
    exportOrderToPDF(exportData);
    toast({
      title: 'Success',
      description: 'PDF exported successfully'
    });
  };

  const handleExportCSV = () => {
    const exportData = {
      order,
      items: detailedOrderData?.items || enrichedItems || order.order_items || [],
      schedule: detailedOrderData?.delivery_schedule || deliverySchedule,
      paymentTx: null,
      pickupPoint
    };
    exportOrderToCSV(exportData);
    toast({
      title: 'Success',
      description: 'CSV exported successfully'
    });
  };

  // Safe print handler using react-to-print
  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Order-${order.order_number}`,
    onAfterPrint: () => {
      toast({
        title: 'Print Ready',
        description: 'Order details have been sent to printer.'
      });
    },
    onPrintError: () => {
      toast({
        title: 'Print Error',
        description: 'Failed to print order details.',
        variant: 'destructive'
      });
    }
  });

  // Helper function for missing data fallbacks
  const safeFallback = (value: any, fallback = 'Not provided') => {
    return value && value.toString().trim() ? value : fallback;
  };

  return (
    <AdaptiveDialog 
      open={isOpen} 
      onOpenChange={onClose} 
      title={`Order Details - #${order.order_number}`} 
      size="xl" 
      className={cn("print:bg-white print:text-black print:shadow-none", "w-full max-w-none sm:max-w-6xl lg:max-w-7xl")}
    >
      <div 
        ref={printRef} 
        className={cn("print:bg-white print:text-black print:p-8 print:font-sans", "print:max-w-none print:w-full print:shadow-none print:border-none")} 
        id="order-details-modal-content"
      >
        {/* Print Header - Only visible in print */}
        <div className="hidden print:block print:mb-8 print:pb-4 print:border-b print:border-gray-300">
          <div className="text-center">
            <h1 className="text-2xl font-bold text-gray-900 mb-2">ORDER RECEIPT</h1>
            <p className="text-lg text-gray-700">Order #{order.order_number}</p>
            <p className="text-sm text-gray-600 mt-1">
              Generated on {format(new Date(), 'PPP')} at {format(new Date(), 'p')}
            </p>
          </div>
        </div>

        {/* Header Actions - Hidden in print */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-2 mb-6 p-4 sm:p-6 print:hidden bg-muted/30 border-b">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2" aria-label="Print order details">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>
          </div>
        </div>

        {/* Quick Stats Overview */}
        <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 px-4 sm:px-6", "print:grid print:grid-cols-4 print:gap-4 print:mb-8 print:px-0")}>
          <StatCard 
            title="Status" 
            value={safeFallback(order.status.charAt(0).toUpperCase() + order.status.slice(1).replace(/_/g, ' '))} 
            icon={Clock} 
            variant={order.status === 'completed' ? 'default' : order.status === 'cancelled' ? 'destructive' : 'default'} 
            className={cn("print:bg-gray-100 print:text-black print:border print:border-gray-300", "print:p-4 print:rounded-none print:shadow-none")} 
          />
          <StatCard 
            title="Type" 
            value={safeFallback(order.order_type.charAt(0).toUpperCase() + order.order_type.slice(1))} 
            icon={Clock} 
            className={cn("print:bg-gray-100 print:text-black print:border print:border-gray-300", "print:p-4 print:rounded-none print:shadow-none")} 
          />
          <StatCard 
            title="Payment" 
            value={safeFallback(order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1))} 
            icon={Clock} 
            variant={order.payment_status === 'paid' ? 'default' : order.payment_status === 'failed' ? 'destructive' : 'warning'} 
            className={cn("print:bg-gray-100 print:text-black print:border print:border-gray-300", "print:p-4 print:rounded-none print:shadow-none")} 
          />
          <StatCard 
            title="Total" 
            value={`₦${safeFallback(order.total_amount?.toLocaleString(), '0')}`} 
            icon={Clock} 
            className={cn("print:bg-gray-100 print:text-black print:border print:border-gray-300", "print:p-4 print:rounded-none print:shadow-none")} 
          />
        </div>

        {/* Main Content - Single Column Layout */}
        <div className={cn("px-4 sm:px-6 space-y-6 sm:space-y-8", "print:px-0 print:space-y-6")}>
          {/* Order Information Sections */}
          <div className="space-y-6 sm:space-y-8 print:space-y-6">
            <section aria-labelledby="customer-info-heading" className={cn("print:break-inside-avoid print:mb-6")}>
              <h2 id="customer-info-heading" className={cn("text-lg font-semibold text-foreground mb-4", "print:text-xl print:text-black print:mb-3 print:font-bold print:border-b print:border-gray-300 print:pb-2")}>
                Customer Information
              </h2>
              <CustomerInfoCard 
                customerName={safeFallback(order.customer_name)} 
                customerPhone={safeFallback(order.customer_phone)} 
                customerEmail={safeFallback(order.customer_email)} 
                orderType={order.order_type as 'delivery' | 'pickup'} 
                deliveryAddress={safeFallback(order.delivery_address)} 
                pickupPoint={pickupPoint} 
              />
            </section>

            <section aria-labelledby="order-info-heading" className={cn("print:break-inside-avoid print:mb-6")}>
              <h2 id="order-info-heading" className={cn("text-lg font-semibold text-foreground mb-4", "print:text-xl print:text-black print:mb-3 print:font-bold print:border-b print:border-gray-300 print:pb-2")}>
                Order Details
              </h2>
              <OrderInfoCard 
                orderNumber={safeFallback(order.order_number)} 
                orderTime={order.order_time} 
                orderType={order.order_type as 'delivery' | 'pickup'} 
                status={order.status} 
                paymentStatus={order.payment_status} 
                paymentReference={safeFallback(order.payment_reference)} 
                totalAmount={order.total_amount} 
                deliverySchedule={detailedOrderData?.delivery_schedule || deliverySchedule} 
                isLoadingSchedule={isLoadingDetails || isLoadingSchedule} 
                onRecoveryAttempt={() => attemptScheduleRecovery(order.id)} 
                recoveryPending={isRecovering} 
                recoveryError={!!detailsError} 
                recoveryStatus={recoveryStatus} 
              />
            </section>

            <section aria-labelledby="payment-details-heading" className={cn("print:break-inside-avoid print:mb-6")}>
              <h2 id="payment-details-heading" className={cn("text-lg font-semibold text-foreground mb-4", "print:text-xl print:text-black print:mb-3 print:font-bold print:border-b print:border-gray-300 print:pb-2")}>
                Payment Information
              </h2>
              <PaymentDetailsCard 
                paymentStatus={order.payment_status} 
                totalAmount={order.total_amount} 
                paymentMethod={safeFallback(order.payment_method)} 
                paidAt={order.paid_at} 
                paymentReference={safeFallback(order.payment_reference)} 
              />
            </section>

            <section aria-labelledby="order-items-heading" className={cn("print:break-inside-avoid print:mb-6")}>
              <h2 id="order-items-heading" className={cn("text-lg font-semibold text-foreground mb-4", "print:text-xl print:text-black print:mb-3 print:font-bold print:border-b print:border-gray-300 print:pb-2")}>
                Order Items
              </h2>
              <ItemsList 
                items={detailedOrderData?.items || enrichedItems || order.order_items || []} 
                subtotal={order.subtotal || 0} 
                totalVat={order.total_vat || 0} 
                totalDiscount={order.discount_amount || 0} 
                deliveryFee={order.delivery_fee || 0} 
                grandTotal={order.total_amount} 
              />
            </section>

            <section aria-labelledby="special-instructions-heading" className={cn("print:break-inside-avoid print:mb-6")}>
              <h2 id="special-instructions-heading" className={cn("text-lg font-semibold text-foreground mb-4", "print:text-xl print:text-black print:mb-3 print:font-bold print:border-b print:border-gray-300 print:pb-2")}>
                Special Instructions
              </h2>
              <SpecialInstructions 
                instructions={safeFallback(order.special_instructions)} 
                deliveryInstructions={safeFallback(detailedOrderData?.delivery_schedule?.special_instructions || deliverySchedule?.special_instructions)} 
              />
            </section>

            {/* Actions Panel - Integrated Inline */}
            <section className="print:hidden" aria-labelledby="actions-heading">
              <h2 id="actions-heading" className={cn("text-lg font-semibold text-foreground mb-4", "print:text-xl print:text-black print:mb-3 print:font-bold print:border-b print:border-gray-300 print:pb-2")}>
                Order Actions & Status Management
              </h2>
              <ActionsPanel 
                selectedStatus={selectedStatus} 
                onStatusChange={setSelectedStatus} 
                assignedRider={assignedRider} 
                onRiderChange={setAssignedRider} 
                riders={riders} 
                isLoadingRiders={isLoadingRiders} 
                manualStatus={manualStatus} 
                onManualStatusChange={setManualStatus} 
                onManualSend={handleManualSend} 
                onUpdate={handleUpdate} 
                onVerifyPayment={handleVerifyWithPaystack} 
                paymentReference={order.payment_reference} 
                isUpdating={updateMutation.isPending} 
                isSendingManual={manualSendMutation.isPending} 
                isVerifying={verifying} 
                verifyState={verifyState} 
                verifyMessage={verifyMessage}
                orderId={order.id}
                customerEmail={order.customer_email}
                orderNumber={order.order_number}
              />
            </section>
          </div>
        </div>
        
        {/* Print Footer - Only visible in print */}
        <div className="hidden print:block print:mt-8 print:pt-4 print:border-t print:border-gray-300 print:text-center">
          <div className="text-xs text-gray-600">
            <p>This order receipt was generated electronically.</p>
            <p>For any queries, please contact support with order reference #{order.order_number}</p>
            <p className="mt-2">Generated on {format(new Date(), 'PPP')} at {format(new Date(), 'p')}</p>
          </div>
        </div>
      </div>
    </AdaptiveDialog>
  );
};

export default OrderDetailsDialog;
```

## Hook: useDetailedOrderData

```typescript
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DetailedOrderData {
  order: any;
  items: any[];
  delivery_schedule?: any;
}

export const useDetailedOrderData = (orderId: string) => {
  return useQuery({
    queryKey: ['detailed-order', orderId],
    queryFn: async () => {
      if (!orderId) {
        throw new Error('Order ID is required');
      }

      try {
        // First try the RPC function
        const { data, error } = await supabase.rpc('get_detailed_order_with_products', {
          p_order_id: orderId
        });

        if (error) {
          // Only log in development
          if (process.env.NODE_ENV === 'development') {
            console.warn('RPC error, using fallback query:', error);
          }
          throw error; // This will trigger the fallback
        }
        
        if (data && typeof data === 'object' && 'error' in data) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('RPC returned error, using fallback query:', data.error);
          }
          throw new Error(data.error as string);
        }

        if (data) {
          return data as unknown as DetailedOrderData;
        }
      } catch (rpcError) {
        if (process.env.NODE_ENV === 'development') {
          console.warn('RPC failed, trying fallback query:', rpcError);
        }
        
        // Fallback: Separate queries with better error handling
        try {
          const { data: orderData, error: orderError } = await supabase
            .from('orders')
            .select(`
              *,
              order_items (
                *,
                products (
                  id,
                  name,
                  description,
                  price,
                  image_url,
                  category_id,
                  features,
                  ingredients
                )
              )
            `)
            .eq('id', orderId)
            .maybeSingle();

          if (orderError) {
            if (process.env.NODE_ENV === 'development') {
              console.error('Fallback query error:', orderError);
            }
            throw new Error(`Failed to fetch order details: ${orderError.message}`);
          }

          if (!orderData) {
            throw new Error('Order not found');
          }

          // Separate query for delivery schedule (non-critical)
          let deliverySchedule = null;
          try {
            const { data: scheduleData } = await supabase
              .from('order_delivery_schedule')
              .select('*')
              .eq('order_id', orderId)
              .maybeSingle();
            
            deliverySchedule = scheduleData;
          } catch (scheduleError) {
            if (process.env.NODE_ENV === 'development') {
              console.warn('Could not fetch delivery schedule:', scheduleError);
            }
            // Continue without schedule - not critical
          }

          // Transform to expected format with normalized product data
          const normalizedItems = (orderData.order_items || []).map((item: any) => ({
            ...item,
            product: item.products ? {
              ...item.products,
              images: item.products.image_url ? [item.products.image_url] : []
            } : null
          }));

          return {
            order: orderData,
            items: normalizedItems,
            delivery_schedule: deliverySchedule
          } as DetailedOrderData;
        } catch (fallbackError) {
          if (process.env.NODE_ENV === 'development') {
            console.error('Both RPC and fallback queries failed:', fallbackError);
          }
          throw fallbackError;
        }
      }

      throw new Error('No data returned from server');
    },
    enabled: !!orderId,
    staleTime: 1000 * 60 * 5, // 5 minutes
    refetchOnWindowFocus: false,
    retry: (failureCount, error) => {
      // Retry up to 2 times for network errors, but not for "not found" errors
      if (failureCount >= 2) return false;
      if (error instanceof Error && error.message.includes('not found')) return false;
      return true;
    },
    gcTime: 1000 * 60 * 10 // Keep data in cache for 10 minutes
  });
};
```

## API: orders.ts (Key Parts)

```typescript
import { supabase } from '@/integrations/supabase/client';
import { Tables } from '@/integrations/supabase/types';
import { OrderStatus } from '@/types/orders';

// Order type with relationships
export type OrderWithItems = Tables<'orders'> & {
  order_items: Tables<'order_items'>[];
  delivery_zones?: Tables<'delivery_zones'> | null;
  delivery_schedule?: {
    id: string;
    order_id: string;
    delivery_date: string;
    delivery_time_start: string;
    delivery_time_end: string;
    requested_at: string;
    is_flexible: boolean;
    special_instructions?: string;
    created_at: string;
    updated_at: string;
  } | null;
};

/**
 * Updates an order with proper rider assignment validation
 */
export const updateOrder = async (
  orderId: string,
  updates: { status?: OrderStatus; assigned_rider_id?: string | null; customer_phone?: string; [key: string]: any }
): Promise<OrderWithItems> => {
  const sanitizedUpdates = { ...updates };
  
  try {
    if (process.env.NODE_ENV === 'development') {
      console.log('🔄 Updating order via production-safe method:', orderId, updates);
    }

    // If we're assigning a rider, use the secure RPC-based assignment
    if (sanitizedUpdates.assigned_rider_id && sanitizedUpdates.assigned_rider_id !== null) {
      if (process.env.NODE_ENV === 'development') {
        console.log('🎯 Assigning/reassigning rider using secure RPC:', sanitizedUpdates.assigned_rider_id);
      }
      
      const { data: assignmentResult, error: assignmentError } = await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'assign_rider',
          orderId,
          riderId: sanitizedUpdates.assigned_rider_id
        }
      });

      if (assignmentError || !assignmentResult?.success) {
        const errorMsg = assignmentResult?.error || assignmentError?.message || 'Failed to assign rider';
        if (process.env.NODE_ENV === 'development') {
          console.error('❌ Rider assignment failed:', errorMsg);
        }
        throw new Error(errorMsg);
      }

      if (process.env.NODE_ENV === 'development') {
        console.log('✅ Rider assignment successful via secure RPC');
      }

      // If there are other updates besides rider assignment, apply them separately
      const otherUpdates = { ...sanitizedUpdates };
      delete otherUpdates.assigned_rider_id;
      
      if (Object.keys(otherUpdates).length > 0) {
        const { data: updateResult, error: updateError } = await supabase.functions.invoke('admin-orders-manager', {
          body: {
            action: 'update',
            orderId,
            updates: otherUpdates
          }
        });

        if (updateError || !updateResult?.success) {
          throw new Error(updateResult?.error || updateError?.message || 'Failed to update order');
        }
        
        return updateResult.order;
      }
      
      return assignmentResult.order;
    }

    // For non-rider updates, use the standard update path
    const { data, error } = await supabase.functions.invoke('admin-orders-manager', {
      body: {
        action: 'update',
        orderId,
        updates: sanitizedUpdates
      }
    });

    if (error || !data.success) {
      throw new Error(data?.error || error?.message || 'Failed to update order');
    }

    if (process.env.NODE_ENV === 'development') {
      console.log('✅ Order updated successfully via admin function');
    }
    return data.order;
    
  } catch (error) {
    console.error('❌ Error updating order via admin function:', error);
    
    // CRITICAL: Add better error handling for production stability
    if (error.message && error.message.includes('delivery schedule recovery')) {
      // Prevent infinite loops by not triggering recovery attempts
      console.warn('🛑 Delivery schedule recovery loop detected, breaking chain');
      throw new Error('Order update failed: Delivery schedule issue detected');
    }
    
    // NO FALLBACK: For production security, we only allow updates through the hardened edge function
    throw new Error(`Order update failed: ${error.message}`);
  }
};

export const manuallyQueueCommunicationEvent = async (
  order: OrderWithItems,
  status: OrderStatus
): Promise<void> => {
  const { error } = await supabase.from('communication_events').insert({
    order_id: order.id,
    event_type: 'order_status_update', // Re-using to leverage existing processor
    payload: {
      old_status: order.status,
      new_status: status,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      customer_email: order.customer_email,
    },
  });

  if (error) {
    if (process.env.NODE_ENV === 'development') {
      console.error('Error queueing manual communication event:', error);
    }
    throw new Error(error.message);
  }
};
```

## ActionsPanel Component

```typescript
import React from 'react';
import { Settings, ShieldCheck, Send, RefreshCw, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SectionHeading } from './SectionHeading';
import { OrderStatus } from '@/types/orders';
import { Constants } from '@/integrations/supabase/types';
import { EmailStatusGuide } from '../EmailStatusGuide';
import { EmailTestButton } from '../EmailTestButton';

interface DispatchRider {
  id: string;
  name: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  license_plate?: string;
}

interface ActionsDrawerProps {
  selectedStatus: OrderStatus;
  onStatusChange: (status: OrderStatus) => void;
  assignedRider: string | null;
  onRiderChange: (riderId: string | null) => void;
  riders?: DispatchRider[];
  isLoadingRiders?: boolean;
  manualStatus: OrderStatus | '';
  onManualStatusChange: (status: OrderStatus | '') => void;
  onManualSend: () => void;
  onUpdate: () => void;
  onVerifyPayment: () => void;
  paymentReference?: string;
  isUpdating?: boolean;
  isSendingManual?: boolean;
  isVerifying?: boolean;
  verifyState?: 'idle' | 'success' | 'failed' | 'pending';
  verifyMessage?: string | null;
  // Order details for email testing
  orderId?: string;
  customerEmail?: string;
  orderNumber?: string;
}

export const ActionsPanel: React.FC<ActionsDrawerProps> = ({
  selectedStatus,
  onStatusChange,
  assignedRider,
  onRiderChange,
  riders,
  isLoadingRiders,
  manualStatus,
  onManualStatusChange,
  onManualSend,
  onUpdate,
  onVerifyPayment,
  paymentReference,
  isUpdating,
  isSendingManual,
  isVerifying,
  verifyState = 'idle',
  verifyMessage,
  orderId,
  customerEmail,
  orderNumber
}) => {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-6">
        <SectionHeading 
          title="Order Actions" 
          icon={Settings} 
        />
        
        {/* Status Update */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Update Status</label>
          <Select value={selectedStatus} onValueChange={(value) => onStatusChange(value as OrderStatus)}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {Constants.public.Enums.order_status.map((status) => (
                <SelectItem key={status} value={status}>
                  <div className="flex items-center justify-between w-full">
                    <span>{status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}</span>
                    {['ready', 'out_for_delivery', 'delivered', 'cancelled', 'completed', 'returned'].includes(status) && (
                      <span className="text-xs text-blue-500 ml-2">📧</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {['ready', 'out_for_delivery', 'delivered', 'cancelled', 'completed', 'returned'].includes(selectedStatus) && (
            <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
              📧 Customer will receive email notification for this status
            </p>
          )}
        </div>

        {/* Rider Assignment */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {selectedStatus === 'out_for_delivery' ? 'Reassign Dispatch Rider' : 'Assign Dispatch Rider'}
          </label>
          <Select
            value={assignedRider ?? 'unassigned'}
            onValueChange={(value) => onRiderChange(value === 'unassigned' ? null : value)}
            disabled={isLoadingRiders || !['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(selectedStatus)}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder={
                isLoadingRiders 
                  ? "Loading riders..." 
                  : !['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(selectedStatus)
                    ? "Change status first to assign rider"
                    : "Select a rider"
              } />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50 max-h-[200px] overflow-y-auto">
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {riders?.length === 0 && !isLoadingRiders && (
                <div className="px-2 py-1.5 text-sm text-muted-foreground text-center">
                  No active riders available
                </div>
              )}
              {riders?.map((rider) => (
                <SelectItem key={rider.id} value={rider.id}>
                  <div className="flex flex-col py-1">
                    <span className="font-medium">{rider.name}</span>
                    {(rider.vehicle_brand || rider.vehicle_model || rider.license_plate) && (
                      <span className="text-xs text-muted-foreground">
                        {rider.vehicle_brand} {rider.vehicle_model} • {rider.license_plate}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {!['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(selectedStatus) && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Riders can only be assigned when order is confirmed, preparing, ready, or out for delivery
            </p>
          )}
          {riders?.length === 0 && !isLoadingRiders && (
            <p className="text-xs text-muted-foreground">
              ⚠️ No active dispatch riders found. Contact admin to add riders.
            </p>
          )}
          {selectedStatus === 'out_for_delivery' && (
            <p className="text-xs text-blue-600 dark:text-blue-400">
              🔄 This will reassign the rider for an order already out for delivery
            </p>
          )}
        </div>

        {/* Payment Verification */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Payment Verification</label>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-mono break-all bg-muted rounded p-2">
              Ref: {paymentReference || '—'}
            </div>
            {verifyState !== 'idle' && verifyMessage && (
              <div className={`text-xs p-2 rounded ${
                verifyState === 'success' ? 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-950' : 
                verifyState === 'pending' ? 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950' : 
                'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950'
              }`}>
                {verifyState === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Verifying...
                  </div>
                ) : (
                  verifyMessage
                )}
              </div>
            )}
            <Button 
              onClick={onVerifyPayment}
              disabled={isVerifying || !paymentReference}
              className="w-full"
              variant="outline"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              {isVerifying ? 'Verifying...' : 'Verify with Paystack'}
            </Button>
          </div>
        </div>

        {/* Update Button */}
        <div className="pt-4 border-t border-border">
          <Button 
            onClick={onUpdate} 
            disabled={isUpdating} 
            className="w-full"
            size="lg"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Order'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
```

## Production Status Update Hook

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateOrder } from '@/api/orders';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

/**
 * Production-hardened status update hook with comprehensive error handling
 */
export const useProductionStatusUpdate = () => {
  const queryClient = useQueryClient();

  const statusUpdateMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: string }) => {
      // Log admin action for audit trail
      await supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'log_admin_action',
          orderId,
          actionType: 'status_update',
          details: { from_status: 'unknown', to_status: status }
        }
      });

      return updateOrder(orderId, { status: status as any });
    },
    onSuccess: (data, variables) => {
      toast.success(`Order status updated to ${variables.status.replace('_', ' ')}`);
      
      // Invalidate all relevant queries
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      queryClient.invalidateQueries({ queryKey: ['unified-orders'] });
      queryClient.invalidateQueries({ queryKey: ['detailed-order', variables.orderId] });
    },
    onError: (error: any, variables) => {
      console.error('❌ Production status update failed:', error);
      
      // Enhanced error messaging
      let errorMessage = 'Failed to update order status';
      if (error?.message?.includes('authentication')) {
        errorMessage = 'Authentication expired. Please refresh and try again.';
      } else if (error?.message?.includes('edge function')) {
        errorMessage = 'Service temporarily unavailable. Please try again.';
      } else if (error?.message?.includes('validation')) {
        errorMessage = 'Invalid status update. Please check the order details.';
      }
      
      toast.error(errorMessage);
      
      // Log error for monitoring
      supabase.functions.invoke('admin-orders-manager', {
        body: {
          action: 'log_admin_error',
          orderId: variables.orderId,
          errorType: 'status_update_failed',
          error: error.message
        }
      }).catch(console.warn);
    }
  });

  return {
    updateStatus: statusUpdateMutation.mutate,
    isUpdating: statusUpdateMutation.isPending,
    error: statusUpdateMutation.error
  };
};
```

## Database Function Fix Applied

The issue was resolved by updating the Supabase database function `get_detailed_order_with_products` to explicitly cast all enum columns to text:

```sql
-- Fixed RPC function with proper type casting
CREATE OR REPLACE FUNCTION get_detailed_order_with_products(p_order_id uuid)
RETURNS TABLE(
  id uuid,
  order_number text,
  customer_name text,
  customer_email text,
  customer_phone text,
  order_type text,
  status text,
  payment_status text,
  total_amount numeric,
  delivery_address jsonb,
  order_time timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  order_items jsonb,
  delivery_zones jsonb,
  order_delivery_schedule jsonb
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    o.id,
    o.order_number,
    o.customer_name,
    o.customer_email,
    o.customer_phone,
    o.order_type::text,  -- FIXED: Added explicit cast to text
    o.status::text,      -- FIXED: Added explicit cast to text
    o.payment_status::text,  -- FIXED: Added explicit cast to text
    o.total_amount,
    o.delivery_address,
    o.order_time,
    o.created_at,
    o.updated_at,
    -- ... rest of the query
  FROM orders o
  -- ... rest of the joins
  WHERE o.id = p_order_id;
END;
$$;
```

## Key Issues Fixed

1. **RPC Type Mismatch**: The database function was returning enum types instead of text, causing JavaScript/TypeScript errors
2. **Order Status Updates**: Status changes were failing due to the type mismatch in the detailed order data retrieval
3. **Production Stability**: Added comprehensive error handling and fallback mechanisms
4. **Email Notifications**: Automated customer notifications for status changes

## Current Status

✅ **RESOLVED**: Order status updates now work correctly for order #ORD1757753865750acd and all other orders. The database function properly returns text types for all enum columns, eliminating the RPC type mismatch errors.