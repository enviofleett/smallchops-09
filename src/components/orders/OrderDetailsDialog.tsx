import React, { useState, useEffect } from 'react';
import { OrderWithItems, updateOrder, manuallyQueueCommunicationEvent } from '@/api/orders';
import { getDispatchRiders, DispatchRider } from '@/api/users';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Constants } from '@/integrations/supabase/types';
import { OrderStatus } from '@/types/orders';
import { format } from 'date-fns';
import { User, Phone, MapPin, Calendar, Hash, X, RefreshCw, ShieldCheck, Package, Truck } from 'lucide-react';
import { formatAddressMultiline } from '@/utils/formatAddress';
import { supabase } from '@/integrations/supabase/client';
import { getDeliveryScheduleByOrderId } from '@/api/deliveryScheduleApi';
import { DeliveryScheduleDisplay } from './DeliveryScheduleDisplay';
import { OrderItemsBreakdown } from './OrderItemsBreakdown';
import { usePickupPoint } from '@/hooks/usePickupPoints';

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

  // Fetch delivery schedule for this order
  const { data: deliverySchedule, isLoading: isLoadingSchedule } = useQuery({
    queryKey: ['deliverySchedule', order.id],
    queryFn: async () => {
      return await getDeliveryScheduleByOrderId(order.id);
    },
    enabled: !!order.id
  });

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

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
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
      <DialogContent className="max-w-full sm:max-w-4xl h-full sm:h-auto max-h-[95vh] overflow-y-auto p-0 sm:p-6">
        <DialogHeader>
          <DialogTitle className="text-xl">Order Details</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute top-4 right-4">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-4 lg:gap-6 p-4 md:p-6">
          <div>
            <h3 className="font-semibold text-lg mb-4">Customer Information</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center">
                <User className="h-4 w-4 mr-3 text-gray-500 flex-shrink-0" />
                <span className="break-words">{order.customer_name}</span>
              </div>
              <div className="flex items-center">
                <Phone className="h-4 w-4 mr-3 text-gray-500 flex-shrink-0" />
                <span className="break-words">{order.customer_phone}</span>
              </div>
              
              {/* Address/Location Information */}
              {order.order_type === 'delivery' && order.delivery_address && (
                <div className="flex items-start">
                  <MapPin className="h-4 w-4 mr-3 mt-1 text-gray-500 flex-shrink-0" />
                  <div className="break-words">
                    <p className="text-xs text-gray-500 mb-1">Delivery Address</p>
                    {formatAddressMultiline(order.delivery_address).split('\n').map((line, index) => (
                      <div key={index} className="text-sm">{line}</div>
                    ))}
                  </div>
                </div>
              )}
              
              {/* Pickup Point Information */}
              {order.order_type === 'pickup' && pickupPoint && (
                <div className="flex items-start">
                  <Package className="h-4 w-4 mr-3 mt-1 text-gray-500 flex-shrink-0" />
                  <div className="break-words">
                    <p className="text-xs text-gray-500 mb-1">Pickup Location</p>
                    <div className="text-sm font-medium">{pickupPoint.name}</div>
                    <div className="text-sm text-gray-600">{pickupPoint.address}</div>
                    {pickupPoint.contact_phone && (
                      <div className="text-sm text-gray-600">📞 {pickupPoint.contact_phone}</div>
                    )}
                  </div>
                </div>
              )}
            </div>

             <h3 className="font-semibold text-lg mb-4 mt-6">Order Information</h3>
             <div className="space-y-3 text-sm">
                <div className="flex items-center">
                    <Hash className="h-4 w-4 mr-3 text-gray-500 flex-shrink-0" />
                    <span>Order ID: <span className="font-medium text-blue-600 break-words">{order.order_number}</span></span>
                </div>
                <div className="flex items-center">
                    <Calendar className="h-4 w-4 mr-3 text-gray-500 flex-shrink-0" />
                    <span className="break-words">{format(new Date(order.order_time), 'MMM d, yyyy h:mm a')}</span>
                </div>
             </div>

             {/* Schedule Section - for both delivery and pickup */}
             <div className="mt-6">
               <h3 className="font-semibold text-lg mb-4 flex items-center gap-2">
                 {order.order_type === 'delivery' ? (
                   <Truck className="h-5 w-5" />
                 ) : (
                   <Package className="h-5 w-5" />
                 )}
                 {order.order_type === 'delivery' ? 'Delivery Schedule' : 'Pickup Schedule'}
               </h3>
               {isLoadingSchedule ? (
                 <div className="bg-gray-100 rounded-lg p-4 animate-pulse">
                   <div className="h-4 bg-gray-300 rounded mb-2"></div>
                   <div className="h-3 bg-gray-300 rounded w-2/3"></div>
                 </div>
               ) : deliverySchedule ? (
                  <DeliveryScheduleDisplay 
                    schedule={deliverySchedule}
                    orderType={order.order_type as 'delivery' | 'pickup'}
                    orderStatus={order.status}
                   className="mb-0" 
                 />
               ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <p className="text-sm text-yellow-800">
                    No {order.order_type === 'delivery' ? 'delivery' : 'pickup'} schedule found for this order.
                  </p>
                </div>
              )}
             </div>
          </div>
          <div>
            <h3 className="font-semibold text-lg mb-4">Order Actions</h3>
            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium block mb-2">Update Status</label>
                <Select value={selectedStatus} onValueChange={(value) => setSelectedStatus(value as OrderStatus)}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {Constants.public.Enums.order_status.map((status) => (
                      <SelectItem key={status} value={status}>
                        {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Assign Dispatch Rider</label>
                <Select
                  value={assignedRider ?? 'unassigned'}
                  onValueChange={(value) => setAssignedRider(value === 'unassigned' ? null : value)}
                  disabled={isLoadingRiders}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={isLoadingRiders ? "Loading riders..." : "Select a rider"} />
                  </SelectTrigger>
                  <SelectContent className="bg-background border shadow-lg z-50">
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {riders?.length === 0 && !isLoadingRiders && (
                      <SelectItem value="" disabled>No active riders available</SelectItem>
                    )}
                    {riders?.map((rider) => (
                      <SelectItem key={rider.id} value={rider.id}>
                        <div className="flex flex-col">
                          <span className="font-medium">{rider.name}</span>
                          <span className="text-xs text-muted-foreground">
                            {rider.vehicle_brand} {rider.vehicle_model} • {rider.license_plate}
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {riders?.length === 0 && !isLoadingRiders && (
                  <p className="text-xs text-muted-foreground mt-1">
                    ⚠️ No active dispatch riders found. Contact admin to add riders.
                  </p>
                )}
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Send Manual Notification</label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                  <Select value={manualStatus} onValueChange={(value) => setManualStatus(value as OrderStatus)}>
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Select notification type" />
                    </SelectTrigger>
                    <SelectContent>
                      {Constants.public.Enums.order_status.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button 
                    variant="secondary" 
                    onClick={handleManualSend}
                    disabled={!manualStatus || manualSendMutation.isPending}
                    className="w-full sm:w-auto min-h-[44px]"
                  >
                    {manualSendMutation.isPending ? 'Sending...' : 'Send'}
                  </Button>
                </div>
              </div>
              <div>
                <label className="text-sm font-medium block mb-2">Payment Verification</label>
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 justify-between">
                  <div className="text-xs text-muted-foreground break-all sm:flex-1">
                    Ref: {order.payment_reference || '—'}
                    {verifyState !== 'idle' && (
                      <div className={`mt-1 text-[11px] ${verifyState === 'success' ? 'text-green-600' : verifyState === 'pending' ? 'text-amber-600' : 'text-red-600'}`}>
                        {verifyState === 'pending' ? 'Verifying…' : verifyMessage}
                      </div>
                    )}
                  </div>
                  <Button 
                    onClick={handleVerifyWithPaystack}
                    disabled={verifying || !order.payment_reference}
                    className="w-full sm:w-auto min-h-[44px]"
                  >
                    <ShieldCheck className="w-4 h-4 mr-2" />
                    {verifying ? 'Verifying…' : 'Verify with Paystack'}
                  </Button>
                </div>
              </div>
            </div>
             
             {/* Enhanced Order Items Breakdown */}
             {order.order_items && order.order_items.length > 0 && (
               <div className="mt-6">
                  <OrderItemsBreakdown 
                    items={order.order_items}
                    subtotal={order.subtotal || 0}
                    totalVat={order.total_vat || 0}
                    totalDiscount={order.discount_amount || 0}
                    deliveryFee={order.delivery_fee || 0}
                    grandTotal={order.total_amount}
                    showDetailed={true}
                  />
               </div>
             )}
             
             <div className="mt-6 pt-4 border-t">
               <h4 className="font-semibold">Order Total</h4>
               <p className="text-2xl font-bold">{formatCurrency(order.total_amount)}</p>
             </div>
          </div>
        </div>
        <DialogFooter className="flex flex-col sm:flex-row gap-3 sm:gap-0">
          <Button variant="outline" onClick={onClose} className="w-full sm:w-auto">Cancel</Button>
          <Button onClick={handleUpdate} disabled={updateMutation.isPending} className="w-full sm:w-auto">
            {updateMutation.isPending ? 'Updating...' : 'Update Order'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;
