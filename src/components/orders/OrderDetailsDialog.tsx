import React, { useState, useEffect } from 'react';
import { OrderWithItems, updateOrder, manuallyQueueCommunicationEvent } from '@/api/orders';
import { getDispatchRiders, DispatchRider } from '@/api/users';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { OrderStatus } from '@/types/orders';
import { format } from 'date-fns';
import { X, Clock } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { getDeliveryScheduleByOrderId } from '@/api/deliveryScheduleApi';
import { usePickupPoint } from '@/hooks/usePickupPoints';

// Import our new components
import { StatCard } from './details/StatCard';
import { CustomerInfoCard } from './details/CustomerInfoCard';
import { OrderInfoCard } from './details/OrderInfoCard';
import { ActionsPanel } from './details/ActionsPanel';
import { ItemsList } from './details/ItemsList';
import { SpecialInstructions } from './details/SpecialInstructions';

interface OrderDetailsDialogProps {
  isOpen: boolean;
  onClose: () => void;
  order: OrderWithItems;
}

const OrderDetailsDialog: React.FC<OrderDetailsDialogProps> = ({ isOpen, onClose, order }) => {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(order.status);
  const [assignedRider, setAssignedRider] = useState<string | null>(order.assigned_rider_id);
  const [manualStatus, setManualStatus] = useState<OrderStatus | ''>('');
  const [verifying, setVerifying] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [verifyState, setVerifyState] = useState<'idle'|'success'|'failed'|'pending'>('idle');

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent 
        className="max-w-full sm:max-w-6xl h-full sm:h-auto max-h-[95vh] overflow-hidden p-0"
        id="order-details-modal-content"
      >
        {/* Mobile Header */}
        <DialogHeader className="p-4 sm:p-6 border-b border-border flex-shrink-0">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-xl font-semibold text-foreground">
              Order Details
            </DialogTitle>
            <DialogClose asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </DialogClose>
          </div>

          {/* Mobile Quick Stats */}
          <div className="grid grid-cols-3 gap-2 mt-4 sm:hidden">
            <StatCard
              title="Status"
              value={order.status.charAt(0).toUpperCase() + order.status.slice(1).replace(/_/g, ' ')}
              icon={Clock}
              variant={order.status === 'completed' ? 'success' : order.status === 'cancelled' ? 'destructive' : 'default'}
            />
            <StatCard
              title="Type"
              value={order.order_type.charAt(0).toUpperCase() + order.order_type.slice(1)}
              icon={Clock}
            />
            <StatCard
              title="Payment"
              value={order.payment_status.charAt(0).toUpperCase() + order.payment_status.slice(1)}
              icon={Clock}
              variant={order.payment_status === 'paid' ? 'success' : order.payment_status === 'failed' ? 'destructive' : 'warning'}
            />
          </div>
        </DialogHeader>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-4 sm:p-6">
            {/* Desktop Layout: 2 columns */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column - Order Info */}
              <div className="lg:col-span-2 space-y-6">
                {/* Customer Information */}
                <CustomerInfoCard
                  customerName={order.customer_name}
                  customerPhone={order.customer_phone}
                  customerEmail={order.customer_email}
                  orderType={order.order_type as 'delivery' | 'pickup'}
                  deliveryAddress={order.delivery_address}
                  pickupPoint={pickupPoint}
                />

                {/* Order Information */}
                <OrderInfoCard
                  orderNumber={order.order_number}
                  orderTime={order.order_time}
                  orderType={order.order_type as 'delivery' | 'pickup'}
                  status={order.status}
                  paymentStatus={order.payment_status}
                  paymentReference={order.payment_reference}
                  totalAmount={order.total_amount}
                  deliverySchedule={deliverySchedule}
                  isLoadingSchedule={isLoadingSchedule}
                  onRecoveryAttempt={() => recoveryMutation.mutate(order.id)}
                  recoveryPending={recoveryMutation.isPending}
                  recoveryError={recoveryMutation.isError}
                />

                {/* Order Items */}
                <ItemsList
                  items={order.order_items || []}
                  subtotal={order.subtotal || 0}
                  totalVat={order.total_vat || 0}
                  totalDiscount={order.discount_amount || 0}
                  deliveryFee={order.delivery_fee || 0}
                  grandTotal={order.total_amount}
                />

                {/* Special Instructions */}
                <SpecialInstructions
                  instructions={order.special_instructions}
                  deliveryInstructions={deliverySchedule?.special_instructions}
                />
              </div>

              {/* Right Column - Actions */}
              <div className="space-y-6">
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
              </div>
            </div>
          </div>
        </div>

        {/* Mobile Footer */}
        <DialogFooter className="p-4 border-t border-border flex-shrink-0 sm:hidden">
          <div className="flex gap-2 w-full">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Close
            </Button>
            <Button onClick={handleUpdate} disabled={updateMutation.isPending} className="flex-1">
              {updateMutation.isPending ? 'Updating...' : 'Update'}
            </Button>
          </div>
        </DialogFooter>

        {/* Print-friendly footer (hidden on screen) */}
        <div className="no-print hidden print:block print:mt-8 print:pt-4 print:border-t print:text-center print:text-xs print:text-gray-500">
          <p>Generated on {format(new Date(), 'PPP')} • Order #{order.order_number}</p>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;