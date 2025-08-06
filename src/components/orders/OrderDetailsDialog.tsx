import React, { useState, useEffect } from 'react';
import { OrderWithItems, updateOrder, manuallyQueueCommunicationEvent } from '@/api/orders';
import { getDispatchRiders, Profile } from '@/api/users';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { Constants } from '@/integrations/supabase/types';
import { OrderStatus } from '@/types/orders';
import { format } from 'date-fns';
import { User, Phone, MapPin, Calendar, Hash, X } from 'lucide-react';

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

  useEffect(() => {
    setSelectedStatus(order.status);
    setAssignedRider(order.assigned_rider_id);
  }, [order]);

  const { data: riders, isLoading: isLoadingRiders } = useQuery<Profile[]>({
    queryKey: ['dispatchRiders'],
    queryFn: getDispatchRiders,
  });

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

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-full sm:max-w-3xl h-full sm:h-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Order Details</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute top-4 right-4">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-4 md:p-6">
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
              <div className="flex items-start">
                <MapPin className="h-4 w-4 mr-3 mt-1 text-gray-500 flex-shrink-0" />
                <span className="break-words">
                  {typeof order.delivery_address === 'string' 
                    ? order.delivery_address || 'N/A'
                    : JSON.stringify(order.delivery_address, null, 2) || 'N/A'}
                </span>
              </div>
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
                    <SelectValue placeholder="Select a rider" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="unassigned">Unassigned</SelectItem>
                    {riders?.map((rider) => (
                      <SelectItem key={rider.id} value={rider.id}>
                        {rider.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
            </div>
             <div className="mt-6 border-t pt-4">
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
