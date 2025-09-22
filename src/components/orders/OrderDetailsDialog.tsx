import React, { useState, useEffect, useRef } from 'react';
import { OrderWithItems, manuallyQueueCommunicationEvent } from '@/api/orders';
import { useEnhancedOrderStatusUpdate } from '@/hooks/useEnhancedOrderStatusUpdate';
import { getDispatchRiders, DispatchRider } from '@/api/users';
import { Button } from '@/components/ui/button';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { X, FileText, Download, Printer, ExternalLink, Clock, Receipt } from 'lucide-react';
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
import { useOrderReceiptPrint } from '@/hooks/useOrderReceiptPrint';
import { cn } from '@/lib/utils';
import { useAuth } from '@/contexts/AuthContext';

// Import our new components
import { StatCard } from './details/StatCard';
import { CustomerInfoCard } from './details/CustomerInfoCard';
import { OrderInfoCard } from './details/OrderInfoCard';
import { ActionsPanel } from './details/ActionsPanel';
import { ItemsList } from './details/ItemsList';
import { SpecialInstructions } from './details/SpecialInstructions';
import { PaymentDetailsCard } from './PaymentDetailsCard';
import { PrintPreviewDialog } from './PrintPreviewDialog';

import { exportOrderToPDF, exportOrderToCSV } from '@/utils/exportOrder';
interface OrderDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderWithItems | null; // Allow null for safety
}
const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({
  isOpen,
  onClose,
  order
}) => {
  // Critical safety check for production
  if (!order) {
    console.warn('OrderDetailsDialog: order is null, closing dialog');
    if (isOpen) {
      onClose();
    }
    return null;
  }

  const navigate = useNavigate();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(order.status);
  const [assignedRider, setAssignedRider] = useState<string | null>(order.assigned_rider_id);
  const [manualStatus, setManualStatus] = useState<OrderStatus | ''>('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<'idle' | 'success' | 'failed' | 'pending'>('idle');

  // Print preview states
  const [showPrintPreview, setShowPrintPreview] = useState(false);
  const [printPreviewType, setPrintPreviewType] = useState<'job-order' | 'receipt'>('job-order');

  // Print ref for react-to-print
  const printRef = useRef<HTMLDivElement>(null);

  // Print hooks for unified system
  const { printJobOrder } = useJobOrderPrint();
  const { printOrderReceipt } = useOrderReceiptPrint();
  const { user } = useAuth();

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
  // Use enhanced order status update hook with bypass functionality
  const {
    updateOrderStatus,
    bypassCacheAndUpdate,
    isUpdating,
    isBypassing,
    show409Error,
    clearBypassError
  } = useEnhancedOrderStatusUpdate();

  const updateMutation = useMutation({
    mutationFn: async (updates: {
      status?: OrderStatus;
      assigned_rider_id?: string | null;
    }) => {
      // If status is being updated, use the enhanced hook
      if (updates.status) {
        await updateOrderStatus(order.id, updates.status);
      }
      
      // TODO: Handle rider assignment separately if needed
      // For now, just handle status updates through enhanced hook
      return { success: true };
    },
    onSuccess: () => {
      const statusChanged = selectedStatus !== order.status;
      toast({
        title: 'Success',
        description: statusChanged 
          ? 'Order updated successfully. Status change notification will be sent to customer.'
          : 'Order updated successfully.'
      });
      queryClient.invalidateQueries({
        queryKey: ['orders-new']
      });
      queryClient.invalidateQueries({
        queryKey: ['order-details', order.id]
      });
      onClose();
    },
    onError: error => {
      // Enhanced hook already handles error messages, so we can skip duplicate toasts
      console.error('Update failed:', error);
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

  // Enhanced job order print handler with preview
  const handleJobOrderPrint = () => {
    console.log('🖨️ Job Order print preview requested for:', order.order_number);
    
    toast({
      title: 'Opening Print Preview',
      description: 'Review the job order details before sending to printer'
    });
    
    setPrintPreviewType('job-order');
    setShowPrintPreview(true);
  };

  // Enhanced receipt print handler with preview  
  const handlePrintReceipt = () => {
    console.log('🧾 Receipt print preview requested for:', order.order_number);
    
    toast({
      title: 'Opening Print Preview',
      description: 'Review the receipt details before sending to printer'
    });
    
    setPrintPreviewType('receipt');
    setShowPrintPreview(true);
  };

  // Actual print execution handlers
  const executeJobOrderPrint = () => {
    // Validate order data before printing
    if (!order || !order.order_number) {
      toast({
        title: 'Print Error',
        description: 'Order data is incomplete. Cannot generate print.',
        variant: 'destructive'
      });
      return;
    }

    const items = detailedOrderData?.items || enrichedItems || order.order_items || [];
    const schedule = detailedOrderData?.delivery_schedule || deliverySchedule;
    
    console.log('🖨️ Executing job order print:', {
      order: order.order_number,
      itemsCount: items.length,
      hasSchedule: !!schedule,
      hasPickupPoint: !!pickupPoint,
      adminName: user?.name
    });
    
    printJobOrder(order, items, schedule, pickupPoint, user?.name || 'Admin User');
    
    toast({
      title: 'Job Order Printing',
      description: 'Job order has been sent to printer with professional formatting.'
    });
  };

  const executeReceiptPrint = () => {
    // Validate order data before printing
    if (!order || !order.order_number) {
      toast({
        title: 'Print Error',
        description: 'Order data is incomplete. Cannot generate receipt.',
        variant: 'destructive'
      });
      return;
    }

    // Business information for the receipt
    const businessInfo = {
      name: 'Starters Small Chops & Catering',
      address: '2B Close Off 11Crescent Kado Estate, Kado',
      phone: '0807 301 1100',
      email: 'store@startersmallchops.com',
    };

    const items = enrichedItems || order.order_items || [];
    const schedule = detailedOrderData?.delivery_schedule || deliverySchedule;
    
    console.log('📄 Executing receipt print:', {
      orderNumber: order.order_number,
      itemCount: items.length,
      hasSchedule: !!schedule,
      hasPickupPoint: !!pickupPoint,
      hasBusinessInfo: !!businessInfo
    });
    
    printOrderReceipt(order, items, schedule, pickupPoint, businessInfo);

    toast({
      title: 'Receipt Printing',
      description: 'Receipt has been sent to printer with professional formatting.'
    });
  };

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
            
            
            <Button onClick={handleJobOrderPrint} variant="outline" size="sm" className="gap-2" aria-label="Preview and print job order">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print Job Order</span>
            </Button>
            
            <Button onClick={handlePrintReceipt} variant="outline" size="sm" className="gap-2" aria-label="Preview and print professional receipt">
              <Receipt className="h-4 w-4" />
              <span className="hidden sm:inline">Print Receipt</span>
            </Button>
            
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
              <OrderInfoCard orderNumber={safeFallback(order.order_number)} orderTime={order.order_time} orderType={order.order_type as 'delivery' | 'pickup'} status={order.status} paymentStatus={order.payment_status} paymentReference={safeFallback(order.payment_reference)} totalAmount={order.total_amount} deliverySchedule={detailedOrderData?.delivery_schedule || deliverySchedule} isLoadingSchedule={isLoadingDetails || isLoadingSchedule} onRecoveryAttempt={() => attemptScheduleRecovery(order.id)} recoveryPending={isRecovering} recoveryError={!!detailsError} recoveryStatus={recoveryStatus} />
            </section>


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
                isUpdating={updateMutation.isPending || isUpdating} 
                isSendingManual={manualSendMutation.isPending} 
                isVerifying={verifying} 
                verifyState={verifyState} 
                verifyMessage={verifyMessage}
                orderId={order.id}
                customerEmail={order.customer_email}
                orderNumber={order.order_number}
                // Enhanced bypass functionality
                show409Error={show409Error === order.id}
                onBypassCacheAndUpdate={() => bypassCacheAndUpdate(order.id, selectedStatus)}
                isBypassing={isBypassing}
                clearBypassError={clearBypassError}
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

      {/* Print Preview Dialog */}
      <PrintPreviewDialog
        isOpen={showPrintPreview}
        onClose={() => setShowPrintPreview(false)}
        onPrint={printPreviewType === 'job-order' ? executeJobOrderPrint : executeReceiptPrint}
        order={order}
        items={detailedOrderData?.items || enrichedItems || order.order_items || []}
        deliverySchedule={detailedOrderData?.delivery_schedule || deliverySchedule}
        pickupPoint={pickupPoint}
        businessInfo={printPreviewType === 'receipt' ? {
          name: 'Starters Small Chops & Catering',
          address: '2B Close Off 11Crescent Kado Estate, Kado',
          phone: '0807 301 1100',
          email: 'store@startersmallchops.com',
        } : undefined}
        printType={printPreviewType}
        adminName={user?.name || 'Admin User'}
      />
    </AdaptiveDialog>;
};
export default OrderDetailsDialog;