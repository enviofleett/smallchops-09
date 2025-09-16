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

  // Fetch delivery schedule for this order with recovery mechanism
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

  // Auto-recovery mutation for missing schedules with circuit breaker
  const [recoveryAttempts, setRecoveryAttempts] = useState(0);
  const maxRecoveryAttempts = 3;
  
  const recoveryMutation = useMutation({
    mutationFn: async (orderId: string) => {
      console.log(`🔄 Attempting to recover delivery schedule for order: ${orderId} (attempt ${recoveryAttempts + 1}/${maxRecoveryAttempts})`);
      const {
        data,
        error
      } = await supabase.functions.invoke('recover-order-schedule', {
        body: {
          order_id: orderId
        }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: data => {
      console.log('📋 Recovery response:', data);
      
      // CRITICAL FIX: Check for both 'found' (existing schedule) and 'recovered' (newly recovered)
      if (data?.found || data?.recovered || data?.success) {
        console.log('✅ Schedule available or recovered successfully');
        if (data.recovered) {
          toast({
            title: 'Schedule Recovered',
            description: 'Missing delivery schedule has been recovered from order logs.'
          });
        } else if (data.found) {
          console.log('✅ Schedule already exists, no recovery needed');
        }
        refetchSchedule();
        setRecoveryAttempts(0); // Reset attempts on success
      } else {
        console.log('⚠️ Recovery returned no schedule data');
        setRecoveryAttempts(prev => prev + 1);
      }
    },
    onError: error => {
      console.error('❌ Schedule recovery failed:', error);
      setRecoveryAttempts(prev => prev + 1);
      
      if (recoveryAttempts >= maxRecoveryAttempts - 1) {
        toast({
          title: 'Recovery Failed',
          description: 'Unable to recover delivery schedule after multiple attempts.',
          variant: 'destructive'
        });
      }
    }
  });

  // Attempt auto-recovery with circuit breaker
  useEffect(() => {
    if (!isLoadingSchedule && 
        !deliverySchedule && 
        order.id && 
        !recoveryMutation.isPending && 
        recoveryAttempts < maxRecoveryAttempts) {
      console.log(`⚠️ No delivery schedule found for order ${order.id}, attempting recovery... (${recoveryAttempts + 1}/${maxRecoveryAttempts})`);
      recoveryMutation.mutate(order.id);
    } else if (recoveryAttempts >= maxRecoveryAttempts) {
      console.log(`🛑 Recovery circuit breaker active for order ${order.id} - max attempts reached`);
    }
  }, [deliverySchedule, isLoadingSchedule, order.id, recoveryMutation, recoveryAttempts, maxRecoveryAttempts]);

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
            
            
            <Button onClick={handlePrint} variant="outline" size="sm" className="gap-2" aria-label="Print order details">
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
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
              <OrderInfoCard orderNumber={safeFallback(order.order_number)} orderTime={order.order_time} orderType={order.order_type as 'delivery' | 'pickup'} status={order.status} paymentStatus={order.payment_status} paymentReference={safeFallback(order.payment_reference)} totalAmount={order.total_amount} deliverySchedule={detailedOrderData?.delivery_schedule || deliverySchedule} isLoadingSchedule={isLoadingDetails || isLoadingSchedule} onRecoveryAttempt={() => recoveryMutation.mutate(order.id)} recoveryPending={recoveryMutation.isPending} recoveryError={!!detailsError || recoveryMutation.isError} />
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
    </AdaptiveDialog>;
};
export default OrderDetailsDialog;