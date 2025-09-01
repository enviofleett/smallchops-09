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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(order.status);
  const [assignedRider, setAssignedRider] = useState<string | null>(order.assigned_rider_id);
  const [manualStatus, setManualStatus] = useState<OrderStatus | ''>('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<'idle'|'success'|'failed'|'pending'>('idle');
  
  // Print ref for react-to-print
  const printRef = useRef<HTMLDivElement>(null);

  // Use detailed order data to get product features and full information
  const { data: detailedOrderData, isLoading: isLoadingDetails, error: detailsError } = useDetailedOrderData(order.id);
  
  // Enrich order items to ensure product features are available
  const { data: enrichedItems, isLoading: isLoadingEnriched } = useEnrichedOrderItems(order.order_items || []);

  useEffect(() => {
    setSelectedStatus(order.status);
    setAssignedRider(order.assigned_rider_id);
    setVerifyMessage(null);
    setVerifyState('idle');
  }, [order]);

  const { data: riders, isLoading: isLoadingRiders, error: ridersError } = useQuery<DispatchRider[]>({
    queryKey: ['dispatchRiders'],
    queryFn: getDispatchRiders,
    retry: 2,
    refetchOnWindowFocus: false,
  });

  // Fetch delivery schedule for this order with recovery mechanism
  const { data: deliverySchedule, isLoading: isLoadingSchedule, refetch: refetchSchedule } = useQuery({
    queryKey: ['deliverySchedule', order.id],
    queryFn: async () => {
      return await getDeliveryScheduleByOrderId(order.id);
    },
    enabled: !!order.id
  });

  // Auto-recovery mutation for missing schedules
  const recoveryMutation = useMutation({
    mutationFn: async (orderId: string) => {
      console.log(`🔄 Attempting to recover delivery schedule for order: ${orderId}`);
      const { data, error } = await supabase.functions.invoke('recover-order-schedule', {
        body: { order_id: orderId }
      });
      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      if (data.recovered) {
        console.log('✅ Schedule recovered successfully');
        toast({ 
          title: 'Schedule Recovered', 
          description: 'Missing delivery schedule has been recovered from order logs.' 
        });
        refetchSchedule();
      }
    },
    onError: (error) => {
      console.error('❌ Schedule recovery failed:', error);
    },
  });

  // Attempt auto-recovery when no schedule is found
  useEffect(() => {
    if (!isLoadingSchedule && !deliverySchedule && order.id && !recoveryMutation.isPending) {
      console.log(`⚠️ No delivery schedule found for order ${order.id}, attempting recovery...`);
      recoveryMutation.mutate(order.id);
    }
  }, [deliverySchedule, isLoadingSchedule, order.id, recoveryMutation]);

  // Fetch pickup point for pickup orders
  const { data: pickupPoint } = usePickupPoint(
    order.order_type === 'pickup' ? order.pickup_point_id : undefined
  );

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
    mutationFn: (updates: { status?: OrderStatus; assigned_rider_id?: string | null }) => updateOrder(order.id, updates),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Order updated successfully.' });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      onClose();
    },
    onError: (error) => {
      toast({ title: 'Error', description: `Failed to update order: ${error.message}`, variant: 'destructive' });
    },
  });

  const manualSendMutation = useMutation({
    mutationFn: (status: OrderStatus) => manuallyQueueCommunicationEvent(order, status),
    onSuccess: () => {
      toast({ title: 'Success', description: 'Notification queued for sending.' });
      setManualStatus('');
    },
    onError: (error) => {
      toast({ title: 'Error', description: `Failed to queue notification: ${error.message}`, variant: 'destructive' });
    },
  });

  const handleUpdate = () => {
    updateMutation.mutate({ status: selectedStatus, assigned_rider_id: assignedRider });
  };
  
  const handleManualSend = () => {
    if (manualStatus) {
      manualSendMutation.mutate(manualStatus);
    }
  };

  const handleVerifyWithPaystack = async () => {
    if (!order.payment_reference) {
      toast({ title: 'No payment reference', description: 'This order has no payment reference to verify.', variant: 'destructive' });
      return;
    }
    setVerifying(true);
    setVerifyState('pending');
    setVerifyMessage(null);
    try {
      const { data: primary, error: pErr } = await supabase.functions.invoke('paystack-secure', {
        body: { action: 'verify', reference: order.payment_reference }
      });
      if (pErr) throw new Error(pErr.message);

      const normalize = (res: any) => {
        if (res?.success) return { ok: true, data: res?.data, message: res?.message || 'Payment verified successfully' };
        if (res?.status === true) return { ok: true, data: res?.data, message: res?.message || 'Payment verified successfully' };
        return { ok: false, message: res?.error || res?.message || 'Verification failed' };
      };

      let normalized = normalize(primary);

      if (normalized.ok) {
        setVerifyState('success');
        setVerifyMessage(`Verified for ${order.order_number}.`);
        toast({ title: 'Verified', description: `Payment verified for ${order.order_number}.` });
        await queryClient.invalidateQueries({ queryKey: ['orders'] });
      } else {
        setVerifyState('failed');
        setVerifyMessage(normalized.message);
        toast({ title: 'Verification failed', description: normalized.message, variant: 'destructive' });
      }
    } catch (e: any) {
      setVerifyState('failed');
      setVerifyMessage(e?.message || 'Failed to verify payment');
      toast({ title: 'Verification error', description: e?.message || 'Failed to verify payment', variant: 'destructive' });
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
      paymentTx: null, // TODO: Add payment transaction data when available
      pickupPoint
    };
    exportOrderToPDF(exportData);
    toast({ title: 'Success', description: 'PDF exported successfully' });
  };

  const handleExportCSV = () => {
    const exportData = {
      order,
      items: detailedOrderData?.items || enrichedItems || order.order_items || [],
      schedule: detailedOrderData?.delivery_schedule || deliverySchedule,
      paymentTx: null, // TODO: Add payment transaction data when available
      pickupPoint
    };
    exportOrderToCSV(exportData);
    toast({ title: 'Success', description: 'CSV exported successfully' });
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
      className={cn(
        "print:bg-white print:text-black print:shadow-none",
        "w-full max-w-none sm:max-w-6xl lg:max-w-7xl"
      )}
    >
      <div 
        ref={printRef}
        className="print:bg-white print:text-black"
        id="order-details-modal-content"
      >
        {/* Header Actions */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 sm:gap-2 mb-6 p-4 sm:p-6 print:hidden bg-muted/30 border-b">
          <div className="flex flex-wrap items-center gap-2">
            <Button 
              onClick={handleExportPDF} 
              variant="outline" 
              size="sm"
              className="gap-2"
              aria-label="Export order details as PDF"
            >
              <FileText className="h-4 w-4" />
              <span className="hidden sm:inline">PDF</span>
            </Button>
            <Button 
              onClick={handleExportCSV} 
              variant="outline" 
              size="sm"
              className="gap-2"
              aria-label="Export order details as CSV"
            >
              <Download className="h-4 w-4" />
              <span className="hidden sm:inline">CSV</span>
            </Button>
            <Button 
              onClick={handlePrint} 
              variant="outline" 
              size="sm"
              className="gap-2"
              aria-label="Print order details"
            >
              <Printer className="h-4 w-4" />
              <span className="hidden sm:inline">Print</span>
            </Button>
            <Button 
              onClick={() => {
                navigate(`/admin/orders/${order.id}`);
                onClose();
              }}
              variant="outline" 
              size="sm"
              className="gap-2"
              aria-label="Open order in full page view"
            >
              <ExternalLink className="h-4 w-4" />
              <span className="hidden sm:inline">Full Page</span>
            </Button>
          </div>
        </div>

        {/* Quick Stats Overview */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4 mb-6 sm:mb-8 px-4 sm:px-6 print:grid print:grid-cols-4 print:mb-6 print:px-0">
          <StatCard
            title="Status"
            value={safeFallback(order.status.charAt(0).toUpperCase() + order.status.slice(1).replace(/_/g, ' '))}
            icon={Clock}
            variant={order.status === 'completed' ? 'default' : order.status === 'cancelled' ? 'destructive' : 'default'}
            className="print:bg-gray-50 print:text-black"
          />
          <StatCard
            title="Type"
            value={safeFallback(order.order_type.charAt(0).toUpperCase() + order.order_type.slice(1))}
            icon={Clock}
            className="print:bg-gray-50 print:text-black"
          />
          <StatCard
            title="Payment"
            value={safeFallback(order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1))}
            icon={Clock}
            variant={order.payment_status === 'paid' ? 'default' : order.payment_status === 'failed' ? 'destructive' : 'warning'}
            className="print:bg-gray-50 print:text-black"
          />
          <StatCard
            title="Total"
            value={`₦${safeFallback(order.total_amount?.toLocaleString(), '0')}`}
            icon={Clock}
            className="print:bg-gray-50 print:text-black"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6 lg:gap-8 px-4 sm:px-6 print:grid-cols-1 print:px-0">
          {/* Left Column - Order Information */}
          <div className="lg:col-span-2 print:col-span-1 space-y-6 sm:space-y-8">
            <section aria-labelledby="customer-info-heading">
              <h2 id="customer-info-heading" className="text-lg font-semibold text-foreground mb-4 print:text-black">
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

            <section aria-labelledby="order-info-heading">

              <h2 id="order-info-heading" className="text-lg font-semibold text-foreground mb-4 print:text-black">
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
                onRecoveryAttempt={() => recoveryMutation.mutate(order.id)}
                recoveryPending={recoveryMutation.isPending}
                recoveryError={!!detailsError || recoveryMutation.isError}
              />
            </section>

            <section aria-labelledby="payment-details-heading">

              <h2 id="payment-details-heading" className="text-lg font-semibold text-foreground mb-4 print:text-black">
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

            <section aria-labelledby="order-items-heading">

              <h2 id="order-items-heading" className="text-lg font-semibold text-foreground mb-4 print:text-black">
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

            <section aria-labelledby="special-instructions-heading">

              <h2 id="special-instructions-heading" className="text-lg font-semibold text-foreground mb-4 print:text-black">
                Special Instructions
              </h2>
              <SpecialInstructions
                instructions={safeFallback(order.special_instructions)}
                deliveryInstructions={safeFallback(detailedOrderData?.delivery_schedule?.special_instructions || deliverySchedule?.special_instructions)}
              />
            </section>
          </div>

          {/* Right Column - Actions Panel */}
          <aside className="space-y-4 sm:space-y-6 print:hidden lg:sticky lg:top-4 lg:self-start" aria-labelledby="actions-heading">
            <h2 id="actions-heading" className="text-lg font-semibold text-foreground mb-4 px-1">
              Actions & Status
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
            />
          </aside>
        </div>

        {/* Print-friendly footer (hidden on screen) */}
        <div className="hidden print:block print:mt-8 print:pt-4 print:border-t print:border-gray-300 print:text-center print:text-xs print:text-gray-500">
          <p>Generated on {format(new Date(), 'PPP')} • Order #{order.order_number}</p>
        </div>
        
        {/* Bottom padding for mobile */}
        <div className="h-4 sm:h-6 print:hidden"></div>
      </div>
    </AdaptiveDialog>
  );
};

export default OrderDetailsDialog;