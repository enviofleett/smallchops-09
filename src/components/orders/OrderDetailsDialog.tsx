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

  // ...other hooks and logic

  // Example placeholders for missing hooks/logic
  const isLoadingSchedule = false; // Replace with actual loading state
  const recoveryMutation = {
    isPending: false,
    isError: false,
    mutate: (id: string) => {},
  }; // Replace with actual mutation
  const deliverySchedule = null; // Replace with actual schedule fetched state

  // Example: order.items
  order.items = order.order_items || [];

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
            {/* ...Customer Information, etc... */}

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
              {isLoadingSchedule || recoveryMutation.isPending ? (
                <div className="bg-gray-100 rounded-lg p-4 animate-pulse">
                  <div className="h-4 bg-gray-300 rounded mb-2"></div>
                  <div className="h-3 bg-gray-300 rounded w-2/3"></div>
                  {recoveryMutation.isPending && (
                    <p className="text-xs text-blue-600 mt-2">🔄 Attempting to recover schedule...</p>
                  )}
                </div>
              ) : deliverySchedule ? (
                <DeliveryScheduleDisplay 
                  schedule={deliverySchedule}
                  orderType={order.order_type as 'delivery' | 'pickup'}
                  orderStatus={order.status}
                  className="mb-0" 
                />
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 space-y-2">
                  <p className="text-sm text-yellow-800">
                    No {order.order_type === 'delivery' ? 'delivery' : 'pickup'} schedule found for this order.
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {recoveryMutation.isError ? 
                      'Recovery failed. Schedule will be confirmed after payment is verified.' :
                      'Schedule will be confirmed after payment is verified.'
                    }
                  </p>
                  {/* Show order-level delivery info if available */}
                  {order.delivery_address && (
                    <div className="flex items-start gap-2 text-xs mt-2">
                      <span className="font-semibold text-muted-foreground">Address:</span>
                      <span className="break-words">{order.delivery_address}</span>
                    </div>
                  )}
                  {order.delivery_zone && (
                    <div className="flex items-start gap-2 text-xs">
                      <span className="font-semibold text-muted-foreground">Zone:</span>
                      <span>{order.delivery_zone}</span>
                    </div>
                  )}
                  {order.estimated_delivery_date && (
                    <div className="flex items-start gap-2 text-xs">
                      <span className="font-semibold text-muted-foreground">Estimated Date:</span>
                      <span>{order.estimated_delivery_date}</span>
                    </div>
                  )}
                  {order.estimated_delivery_time && (
                    <div className="flex items-start gap-2 text-xs">
                      <span className="font-semibold text-muted-foreground">Estimated Time:</span>
                      <span>{order.estimated_delivery_time}</span>
                    </div>
                  )}
                  {(order.special_instructions ||
                    (order.items && order.items.find((item: any) => item.special_instructions))) && (
                    <div className="flex items-start gap-2 text-xs">
                      <span className="font-semibold text-muted-foreground">Instructions:</span>
                      <span>
                        {order.special_instructions || 
                          order.items?.find((item: any) => item.special_instructions)?.special_instructions ||
                          'See order details'}
                      </span>
                    </div>
                  )}
                  {order.delivery_fee && order.delivery_fee > 0 && (
                    <div className="flex items-start gap-2 text-xs">
                      <span className="font-semibold text-muted-foreground">Delivery Fee:</span>
                      <span>₦{order.delivery_fee.toLocaleString()}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-xs">
                    <span className="font-semibold text-muted-foreground">Order Status:</span>
                    <span>{order.status.replace('_', ' ').toUpperCase()}</span>
                  </div>
                  {recoveryMutation.isError && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="mt-2"
                      onClick={() => recoveryMutation.mutate(order.id)}
                      disabled={recoveryMutation.isPending}
                    >
                      <RefreshCw className="h-3 w-3 mr-1" />
                      Retry Recovery
                    </Button>
                  )}
                </div>
              )}
              {/* Order-level Special Instructions Fallback */}
              {!deliverySchedule?.special_instructions && order.special_instructions && (
                <div className="mt-4 bg-muted/30 rounded-lg p-3">
                  <h4 className="text-sm font-medium text-muted-foreground mb-2">Special Instructions</h4>
                  <p className="text-sm break-words">{order.special_instructions}</p>
                </div>
              )}
            </div>

            {/* ...rest of your component */}
          </div>
          {/* ...right panel, actions, etc. */}
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default OrderDetailsDialog;