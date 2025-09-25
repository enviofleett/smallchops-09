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
import { useThermalPrint } from '@/hooks/useThermalPrint';
import { useAuth } from '@/contexts/AuthContext';
import { ThermalReceiptPreview } from './ThermalReceiptPreview';
import { JobOrderPreview } from './JobOrderPreview';
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
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(order.status);
  const [assignedRider, setAssignedRider] = useState<string | null>(order.assigned_rider_id);
  const [manualStatus, setManualStatus] = useState<OrderStatus | ''>('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<'idle' | 'success' | 'failed' | 'pending'>('idle');
  const [showDataSources, setShowDataSources] = useState(false);
  const [showJobOrderPreview, setShowJobOrderPreview] = useState(false);

  // Print ref for react-to-print
  const printRef = useRef<HTMLDivElement>(null);

  // Job order print hook
  const { printJobOrder } = useJobOrderPrint();
  
  // Thermal print hook
  const { printThermalReceipt, showPreview, isPreviewOpen, closePreview, printFromPreview, previewOrder, previewDeliverySchedule, previewBusinessInfo } = useThermalPrint();
  
  // Get current admin user
  const { user: adminUser } = useAuth();

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

  // Admin thermal receipt print handler
  const handleAdminReceiptPrint = async () => {
    const today = new Date();
    const schedule = detailedOrderData?.delivery_schedule || deliverySchedule;
    
    // Get admin name for receipt
    const adminName = (adminUser as any)?.user_metadata?.full_name || 
                     adminUser?.email?.split('@')[0] || 
                     'Admin User';
    
    // Enhanced business info with admin details for 80mm thermal printing
    const businessInfo = {
      name: 'STARTERS SMALL CHOPS',
      admin_notification_email: 'store@startersmallchops.com',
      whatsapp_support_number: '0807 301 1100',
      printed_by: adminName,
      printed_on: format(today, 'EEEE, MMMM do, yyyy \'at\' h:mm a'),
      printer_type: '80mm Thermal Printer',
      print_quality: 'High Resolution Bold'
    };
    
    try {
      // Print thermal receipt with enhanced 80mm formatting
      await printThermalReceipt(order, schedule, businessInfo);
      
      toast({
        title: '🖨️ 80mm Thermal Receipt Printed',
        description: `High-quality thermal receipt generated by ${adminName} - Optimized for 80mm POS printers`,
      });
    } catch (error) {
      console.error('80mm Thermal print failed:', error);
      toast({
        title: 'Print Error',
        description: 'Failed to print 80mm thermal receipt. Please check your printer connection.',
        variant: 'destructive'
      });
    }
  };

  // Enhanced preview handler for 80mm thermal receipt
  const handlePreviewThermalReceipt = async () => {
    const today = new Date();
    const schedule = detailedOrderData?.delivery_schedule || deliverySchedule;
    
    // Get admin name for receipt
    const adminName = (adminUser as any)?.user_metadata?.full_name || 
                     adminUser?.email?.split('@')[0] || 
                     'Admin User';
    
    // Enhanced business info with admin details for 80mm thermal printing
    const businessInfo = {
      name: 'STARTERS SMALL CHOPS',
      admin_notification_email: 'store@startersmallchops.com',
      whatsapp_support_number: '0807 301 1100',
      printed_by: adminName,
      printed_on: format(today, 'EEEE, MMMM do, yyyy \'at\' h:mm a'),
      printer_type: '80mm Thermal Printer',
      print_quality: 'High Resolution Bold'
    };
    
    try {
      // Show 80mm thermal receipt preview
      await showPreview(order, schedule, businessInfo);
      
      toast({
        title: '📄 80mm Thermal Preview Ready',
        description: 'Preview shows exactly how the receipt will look on 80mm thermal paper',
      });
    } catch (error) {
      console.error('80mm Thermal preview failed:', error);
      toast({
        title: 'Preview Error',
        description: 'Failed to generate 80mm thermal receipt preview.',
        variant: 'destructive'
      });
    }
  };

  // Job order preview handler
  const handleJobOrderPreview = () => {
    setShowJobOrderPreview(true);
  };

  // Close job order preview
  const closeJobOrderPreview = () => {
    setShowJobOrderPreview(false);
  };

  // Print from job order preview
  const printFromJobOrderPreview = () => {
    const items = detailedOrderData?.items || enrichedItems || order.order_items || [];
    const schedule = detailedOrderData?.delivery_schedule || deliverySchedule;
    
    printJobOrder(order, items, schedule, pickupPoint);
    setShowJobOrderPreview(false);
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

  return (
    <>
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

          {/* Header - Only visible on screen */}
          <div className="print:hidden flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <h2 className="text-2xl font-bold">Order #{order.order_number}</h2>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowDataSources(true)}
                  className="flex items-center gap-2"
                >
                  <ExternalLink className="w-4 h-4" />
                  Data Sources
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportPDF}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  PDF
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleExportCSV}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePrint}
                  className="flex items-center gap-2"
                >
                  <Printer className="w-4 h-4" />
                  Print
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handlePreviewThermalReceipt}
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Receipt Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleJobOrderPreview}
                  className="flex items-center gap-2"
                >
                  <FileText className="w-4 h-4" />
                  Job Order
                </Button>
              </div>
            </div>
          </div>

          {/* Main Content */}
          <div className="space-y-6">
            {/* Customer and Order Information */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <CustomerInfoCard 
                customerName={safeFallback(order.customer_name || (order.delivery_address as any)?.recipientName)}
                customerPhone={order.customer_phone}
                customerEmail={order.customer_email}
                orderType={order.order_type === 'dine_in' ? 'pickup' : order.order_type}
                deliveryAddress={order.delivery_address}
                pickupPoint={pickupPoint}
              />
              <OrderInfoCard 
                order={order}
                orderNumber={order.order_number}
                orderTime={order.created_at}
                orderType={order.order_type === 'dine_in' ? 'pickup' : order.order_type}
                status={order.status}
                totalAmount={order.total_amount}
                paymentStatus={order.payment_status}
              />
            </div>

            {/* Items List */}
            <ItemsList 
              items={detailedOrderData?.items || enrichedItems || order.order_items || []}
              subtotal={order.subtotal || 0}
              totalVat={order.total_vat || 0}
              totalDiscount={(order as any).total_discount || 0}
              deliveryFee={order.delivery_fee || 0}
              grandTotal={order.total_amount}
            />

            {/* Special Instructions */}
            <SpecialInstructions 
              instructions={order.special_instructions}
              deliveryInstructions={(order.delivery_address as any)?.delivery_instructions}
            />

            {/* Payment and Delivery Details */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <PaymentDetailsCard 
                paymentStatus={order.payment_status}
                paymentMethod={order.payment_method}
                paymentReference={order.payment_reference}
                paidAt={order.paid_at}
                totalAmount={order.total_amount}
              />
              <DeliveryScheduleDisplay 
                schedule={detailedOrderData?.delivery_schedule || deliverySchedule}
              />
            </div>

            {/* Actions Panel - Only visible on screen */}
            <div className="print:hidden">
              <ActionsPanel
                selectedStatus={selectedStatus}
                onStatusChange={setSelectedStatus}
                assignedRider={assignedRider}
                onRiderChange={setAssignedRider}
                riders={riders}
                isLoadingRiders={isLoadingRiders}
                onUpdate={handleUpdate}
                isUpdating={updateMutation.isPending}
                onVerifyPayment={handleVerifyWithPaystack}
                isVerifying={verifying}
                verifyState={verifyState}
                verifyMessage={verifyMessage}
                paymentReference={order.payment_reference}
                manualStatus={manualStatus}
                onManualStatusChange={setManualStatus}
                onManualSend={handleManualSend}
                isSendingManual={manualSendMutation.isPending}
                orderId={order.id}
                customerEmail={order.customer_email}
                orderNumber={order.order_number}
              />
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
          
      <ThermalReceiptPreview 
        isOpen={isPreviewOpen}
        onClose={closePreview}
        onPrint={printFromPreview}
        order={previewOrder}
        deliverySchedule={previewDeliverySchedule}
        businessInfo={previewBusinessInfo}
      />
      
      <JobOrderPreview
        isOpen={showJobOrderPreview}
        onClose={closeJobOrderPreview}
        onPrint={printFromJobOrderPreview}
        order={order}
        items={detailedOrderData?.items || enrichedItems || order.order_items || []}
        deliverySchedule={detailedOrderData?.delivery_schedule || deliverySchedule}
        pickupPoint={pickupPoint}
      />
    </>
  );
};

export default OrderDetailsDialog;