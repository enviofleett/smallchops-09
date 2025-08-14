import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getDrivers } from '@/api/drivers';
import { assignRiderToOrder } from '@/api/assignments';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { User, Truck, MapPin, Clock } from 'lucide-react';
import { OrderWithItems } from '@/api/orders';
import { OrderStatus } from '@/types/orders';

interface DriverAssignmentDialogProps {
  order: OrderWithItems;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export function DriverAssignmentDialog({
  order,
  isOpen,
  onClose,
  onSuccess
}: DriverAssignmentDialogProps) {
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const queryClient = useQueryClient();

  // Fetch available drivers
  const { data: drivers, isLoading: driversLoading } = useQuery({
    queryKey: ['drivers'],
    queryFn: () => getDrivers(),
    enabled: isOpen,
  });

  // Driver assignment mutation
  const assignDriverMutation = useMutation({
    mutationFn: ({ orderId, driverId }: { orderId: string; driverId: string }) =>
      assignRiderToOrder(orderId, driverId),
    onSuccess: () => {
      toast.success('Driver assigned successfully');
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      onSuccess?.();
      onClose();
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to assign driver');
    },
  });

  // Status update mutation
  const statusUpdateMutation = useMutation({
    mutationFn: async ({ orderId, status }: { orderId: string; status: OrderStatus }) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId)
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('Order status updated');
      queryClient.invalidateQueries({ queryKey: ['delivery-orders'] });
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
    },
    onError: (error: any) => {
      toast.error(error.message || 'Failed to update status');
    },
  });

  const handleAssignDriver = () => {
    if (!selectedDriverId) {
      toast.error('Please select a driver');
      return;
    }

    assignDriverMutation.mutate({
      orderId: order.id,
      driverId: selectedDriverId,
    });
  };

  const handleStatusChange = (newStatus: OrderStatus) => {
    statusUpdateMutation.mutate({
      orderId: order.id,
      status: newStatus,
    });
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'confirmed':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Truck className="w-5 h-5" />
            Delivery Management - Order #{order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Summary */}
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center justify-between mb-3">
              <div>
                <h3 className="font-medium">{order.customer_name}</h3>
                <p className="text-sm text-muted-foreground">{order.customer_email}</p>
              </div>
              <Badge className={getStatusBadgeColor(order.status)}>
                {order.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            
            {typeof order.delivery_address === 'string' && (
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4" />
                <span>{order.delivery_address}</span>
              </div>
            )}
          </div>

          {/* Driver Assignment */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <User className="w-4 h-4" />
              Assign Driver
            </h3>
            
            <div className="flex gap-3">
              <Select
                value={selectedDriverId}
                onValueChange={setSelectedDriverId}
                disabled={driversLoading}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select a driver..." />
                </SelectTrigger>
                <SelectContent>
                  {drivers?.map((driver) => (
                    <SelectItem key={driver.id} value={driver.id}>
                      <div className="flex items-center gap-2">
                        <span>{driver.name}</span>
                        <Badge variant="outline">{driver.phone}</Badge>
                        {driver.is_active && (
                          <Badge variant="default" className="bg-green-100 text-green-800">
                            Active
                          </Badge>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Button 
                onClick={handleAssignDriver}
                disabled={!selectedDriverId || assignDriverMutation.isPending}
              >
                {assignDriverMutation.isPending ? 'Assigning...' : 'Assign'}
              </Button>
            </div>
          </div>

          {/* Status Management */}
          <div className="space-y-4">
            <h3 className="font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Update Status
            </h3>
            
            <div className="flex gap-2 flex-wrap">
              {order.status === 'confirmed' && (
                <Button 
                  variant="outline" 
                  onClick={() => handleStatusChange('preparing')}
                  disabled={statusUpdateMutation.isPending}
                >
                  Mark as Preparing
                </Button>
              )}
              
              {order.status === 'preparing' && (
                <Button 
                  variant="outline" 
                  onClick={() => handleStatusChange('ready')}
                  disabled={statusUpdateMutation.isPending}
                >
                  Mark as Ready
                </Button>
              )}
              
              {order.status === 'ready' && (
                <Button 
                  variant="outline" 
                  onClick={() => handleStatusChange('out_for_delivery')}
                  disabled={statusUpdateMutation.isPending}
                >
                  Mark Out for Delivery
                </Button>
              )}
              
              {order.status === 'out_for_delivery' && (
                <Button 
                  onClick={() => handleStatusChange('delivered')}
                  disabled={statusUpdateMutation.isPending}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Mark as Delivered
                </Button>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}