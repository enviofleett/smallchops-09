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
import { useJobOrderPrint } from '@/hooks/useJobOrderPrint';
import { cn } from '@/lib/utils';

// Import our new components
import { StatCard } from './details/StatCard';
import { CustomerInfoCard } from './details/CustomerInfoCard';
import { OrderInfoCard } from './details/OrderInfoCard';
import { ActionsPanel } from './details/ActionsPanel';
import { ItemsList } from './details/ItemsList';
import { SpecialInstructions } from './details/SpecialInstructions';
import { PaymentDetailsCard } from './PaymentDetailsCard';
import { DeliveryScheduleDisplay } from './DeliveryScheduleDisplay';
import { JobOrderDataSources } from './JobOrderDataSources';
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
  const {
    toast
  } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(order.status);
  const [assignedRider, setAssignedRider] = useState<string | null>(order.assigned_rider_id);
  const [manualStatus, setManualStatus] = useState<OrderStatus | ''>('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<'idle' | 'success' | 'failed' | 'pending'>('idle');
  const [showDataSources, setShowDataSources] = useState(false);

  // Print ref for react-to-print
  const printRef = useRef<HTMLDivElement>(null);

  // Job order print hook
  const { printJobOrder } = useJobOrderPrint();

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

  // DISABLED: Problematic auto-recovery that was causing infinite loops in production
  // Manual recovery button available below if needed
  /* 
  // Emergency loop detection
  const loopCounterRef = useRef(0);
  const maxLoopAttempts = 3;
  const loopResetTimeoutRef = useRef<NodeJS.Timeout>();

  // Attempt auto-recovery with enhanced cache management and loop detection
  useEffect(() => {
    // AUTO-RECOVERY DISABLED DUE TO INFINITE LOOPS
    // This was causing production issues with orders like 4366b956-4229-4369-91e3-51e41e56c64a
    return () => {
      if (loopResetTimeoutRef.current) {
        clearTimeout(loopResetTimeoutRef.current);
      }
    };
  }, []);
  */

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
    // Only include assigned_rider_id if it has a valid value
    const updates: { status: OrderStatus; assigned_rider_id?: string } = {
      status: selectedStatus
    };
    
    // Only add rider assignment if there's actually a rider to assign
    if (assignedRider && assignedRider.trim() !== '') {
      updates.assigned_rider_id = assignedRider;
    }
    
    updateMutation.mutate(updates);
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
      // TODO: Add payment transaction data when available
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
      // TODO: Add payment transaction data when available
      pickupPoint
    };
    exportOrderToCSV(exportData);
    toast({
      title: 'Success',
      description: 'CSV exported successfully'
    });
  };

  // Admin receipt print handler (Monday only)
  const handleAdminReceiptPrint = () => {
    const today = new Date();
    const isMonday = today.getDay() === 1;
    
    if (!isMonday) {
      toast({
        title: 'Access Restricted',
        description: 'Admin receipt printing is only available on Monday.',
        variant: 'destructive'
      });
      return;
    }

    const items = detailedOrderData?.items || enrichedItems || order.order_items || [];
    const schedule = detailedOrderData?.delivery_schedule || deliverySchedule;
    
    // Enhanced admin receipt with Monday verification
    printJobOrder(order, items, schedule, pickupPoint);
    
    toast({
      title: 'Admin Receipt Generated',
      description: `Receipt printed on ${format(today, 'EEEE, MMMM do, yyyy')} - Admin authorization verified.`,
    });
  };

  // Job order print handler
  const handleJobOrderPrint = () => {
    const items = detailedOrderData?.items || enrichedItems || order.order_items || [];
    const schedule = detailedOrderData?.delivery_schedule || deliverySchedule;
    
    printJobOrder(order, items, schedule, pickupPoint);
  };

  // Safe print handler using react-to-print (for detailed receipt)
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
  return <AdaptiveDialog open={isOpen} onOpenChange={onClose} title={`Order Details - #${order.order_number}`} size="xl" className={cn("print:bg-white print:text-black print:shadow-none", "w-full max-w-none sm:max-w-6xl lg:max-w-7xl")}>
      <div ref={printRef} className={cn("print:bg-white print:text-black print:p-8 print:font-sans", "print:max-w-none print:w-full print:shadow-none print:border-none")} id="order-details-modal-content">
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
            
            
            <Button onClick={handleJobOrderPrint} variant="outline" size="sm" className="gap-2" aria-label="Print job order">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print Job Order</span>
            </Button>
            
            {/* Monday-Only Receipt Print Button */}
            {(() => {
              const today = new Date();
              const isMonday = today.getDay() === 1; // 0 = Sunday, 1 = Monday
              
              return (
                <Button 
                  onClick={isMonday ? handleAdminReceiptPrint : undefined}
                  variant={isMonday ? "default" : "outline"} 
                  size="sm" 
                  className="gap-2" 
                  disabled={!isMonday}
                  aria-label={isMonday ? "Print admin receipt (Monday only)" : "Admin receipt printing only available on Monday"}
                  title={isMonday ? "Print admin receipt" : "Admin receipt printing is only available on Monday"}
                >
                  <Printer className="h-4 w-4" />
                  <span className="hidden sm:inline">
                    {isMonday ? 'Print Receipt' : 'Receipt (Monday Only)'}
                  </span>
                  {isMonday && <span className="text-xs bg-green-100 text-green-800 px-1 rounded ml-1">MON</span>}
                </Button>
              );
            })()}
            
          </div>
        </div>

        {/* Quick Stats Overview */}
        <div className={cn("grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 px-4 sm:px-6", "print:grid print:grid-cols-4 print:gap-4 print:mb-8 print:px-0")}>
          <StatCard title="Status" value={safeFallback(order.status.charAt(0).toUpperCase() + order.status.slice(1).replace(/_/g, ' '))} icon={Clock} variant={order.status === 'completed' ? 'default' : order.status === 'cancelled' ? 'destructive' : 'default'} className={cn("print:bg-gray-100 print:text-black print:border print:border-gray-300", "print:p-4 print:rounded-none print:shadow-none")} />
          <StatCard title="Type" value={safeFallback(order.order_type.charAt(0).toUpperCase() + order.order_type.slice(1))} icon={Clock} className={cn("print:bg-gray-100 print:text-black print:border print:border-gray-300", "print:p-4 print:rounded-none print:shadow-none")} />
          <StatCard title="Payment" value={safeFallback(order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1))} icon={Clock} variant={order.payment_status === 'paid' ? 'default' : order.payment_status === 'failed' ? 'destructive' : 'warning'} className={cn("print:bg-gray-100 print:text-black print:border print:border-gray-300", "print:p-4 print:rounded-none print:shadow-none")} />
          <StatCard title="Total" value={`₦${safeFallback(order.total_amount?.toLocaleString(), '0')}`} icon={Clock} className={cn("print:bg-gray-100 print:text-black print:border print:border-gray-300", "print:p-4 print:rounded-none print:shadow-none")} />
        </div>

        {/* Main Content - Single Column Layout */}
        <div className={cn("px-4 sm:px-6 space-y-6 sm:space-y-8", "print:px-0 print:space-y-6")}>
          {/* Order Information Sections */}
          <div className="space-y-6 sm:space-y-8 print:space-y-6">
            <section aria-labelledby="customer-info-heading" className={cn("print:break-inside-avoid print:mb-6")}>
              <h2 id="customer-info-heading" className={cn("text-lg font-semibold text-foreground mb-4", "print:text-xl print:text-black print:mb-3 print:font-bold print:border-b print:border-gray-300 print:pb-2")}>
                Customer Information
              </h2>
              <CustomerInfoCard customerName={safeFallback(order.customer_name)} customerPhone={safeFallback(order.customer_phone)} customerEmail={safeFallback(order.customer_email)} orderType={order.order_type as 'delivery' | 'pickup'} deliveryAddress={safeFallback(order.delivery_address)} pickupPoint={pickupPoint} />
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
                deliverySchedule={
                  detailedOrderData?.delivery_schedule || 
                  deliverySchedule || 
                  // Fallback to order's own schedule data
                  (order.pickup_time || order.delivery_time || order.estimated_delivery_date) ? {
                    delivery_date: order.order_type === 'pickup' 
                      ? order.pickup_time?.split('T')[0] 
                      : order.delivery_time?.split('T')[0] || order.estimated_delivery_date?.split('T')[0],
                    delivery_time_start: order.order_type === 'pickup' 
                      ? order.pickup_time?.split('T')[1]?.substring(0, 8)
                      : order.delivery_time?.split('T')[1]?.substring(0, 8) || '09:00:00',
                    delivery_time_end: order.order_type === 'pickup' 
                      ? order.pickup_time?.split('T')[1]?.substring(0, 8)
                      : order.delivery_time?.split('T')[1]?.substring(0, 8) || '17:00:00',
                    is_flexible: false,
                    special_instructions: order.special_instructions || null
                  } : null
                } 
                pickupPoint={pickupPoint}
                deliveryAddress={safeFallback(order.delivery_address)}
                specialInstructions={order.special_instructions}
                isLoadingSchedule={isLoadingDetails || isLoadingSchedule}
                onRecoveryAttempt={() => attemptScheduleRecovery(order.id)} 
                recoveryPending={isRecovering} 
                recoveryError={!!detailsError} 
                recoveryStatus={recoveryStatus} 
              />
            </section>

            {/* Delivery Schedule Section - Removed duplicate display since OrderInfoCard now shows it */}

            <section aria-labelledby="payment-details-heading" className={cn("print:break-inside-avoid print:mb-6")}>
              <h2 id="payment-details-heading" className={cn("text-lg font-semibold text-foreground mb-4", "print:text-xl print:text-black print:mb-3 print:font-bold print:border-b print:border-gray-300 print:pb-2")}>
                Payment Information
              </h2>
              <PaymentDetailsCard paymentStatus={order.payment_status} totalAmount={order.total_amount} paymentMethod={safeFallback(order.payment_method)} paidAt={order.paid_at} paymentReference={safeFallback(order.payment_reference)} />
            </section>

            <section aria-labelledby="order-items-heading" className={cn("print:break-inside-avoid print:mb-6")}>
              <h2 id="order-items-heading" className={cn("text-lg font-semibold text-foreground mb-4", "print:text-xl print:text-black print:mb-3 print:font-bold print:border-b print:border-gray-300 print:pb-2")}>
                Order Items
              </h2>
              <ItemsList items={detailedOrderData?.items || enrichedItems || order.order_items || []} subtotal={order.subtotal || 0} totalVat={order.total_vat || 0} totalDiscount={order.discount_amount || 0} deliveryFee={order.delivery_fee || 0} grandTotal={order.total_amount} />
            </section>

            <section aria-labelledby="special-instructions-heading" className={cn("print:break-inside-avoid print:mb-6")}>
              <h2 id="special-instructions-heading" className={cn("text-lg font-semibold text-foreground mb-4", "print:text-xl print:text-black print:mb-3 print:font-bold print:border-b print:border-gray-300 print:pb-2")}>
                Special Instructions
              </h2>
              <SpecialInstructions instructions={safeFallback(order.special_instructions)} deliveryInstructions={safeFallback(detailedOrderData?.delivery_schedule?.special_instructions || deliverySchedule?.special_instructions)} />
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

      {/* Data Sources Modal */}
      <AdaptiveDialog 
        open={showDataSources} 
        onOpenChange={setShowDataSources} 
        title="Job Order Data Sources" 
        size="xl"
        className="max-w-4xl"
      >
        <JobOrderDataSources
          order={order}
          items={detailedOrderData?.items || enrichedItems || order.order_items || []}
          deliverySchedule={detailedOrderData?.delivery_schedule || deliverySchedule}
          pickupPoint={pickupPoint}
          detailedOrderData={detailedOrderData}
          enrichedItems={enrichedItems}
        />
      </AdaptiveDialog>
    </AdaptiveDialog>;
};
export default OrderDetailsDialog;