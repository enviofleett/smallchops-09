import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { 
  Settings, 
  Truck, 
  Mail, 
  Phone, 
  CheckCircle2, 
  AlertCircle,
  Loader2,
  UserCheck
} from 'lucide-react';
import { useSimpleStatusUpdate } from '@/hooks/useSimpleStatusUpdate';
import { useDrivers, useRiderAssignment } from '@/hooks/useDrivers';
import { useManualCommunication } from '@/hooks/useCommunicationEvents';
import { OrderStatus } from '@/types/orders';

interface ActionCenterProps {
  order: any;
  onClose?: () => void;
}

const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-500' },
  { value: 'preparing', label: 'Preparing', color: 'bg-orange-500' },
  { value: 'ready', label: 'Ready', color: 'bg-green-500' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'bg-purple-500' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-700' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500' }
];

export const ActionCenter: React.FC<ActionCenterProps> = ({ order, onClose }) => {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus | ''>('');
  const [statusDialogOpen, setStatusDialogOpen] = useState(false);
  
  const { updateStatus, isUpdating } = useSimpleStatusUpdate();
  const { data: drivers, isLoading: driversLoading } = useDrivers();
  const { mutate: assignRider, isPending: isAssigningRider } = useRiderAssignment();
  const { mutate: sendCommunication, isPending: isSendingCommunication } = useManualCommunication();

  const handleStatusUpdate = async () => {
    if (!selectedStatus || selectedStatus === order.status) return;
    
    await updateStatus({
      orderId: order.id,
      status: selectedStatus
    });
    
    setStatusDialogOpen(false);
    setSelectedStatus('');
    onClose?.();
  };

  const handleRiderAssignment = (riderId: string | null) => {
    assignRider({ orderId: order.id, riderId });
  };

  const handleSendEmail = () => {
    if (!order.customer_email) return;
    
    sendCommunication({
      orderId: order.id,
      type: 'manual_email',
      recipient: order.customer_email,
      template: 'order_update'
    });
  };

  const handleSendSMS = () => {
    // SMS functionality would require phone number and SMS provider
    console.log('SMS functionality not implemented yet');
  };

  const currentStatus = STATUS_OPTIONS.find(s => s.value === order.status);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          Action Center
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Current Status Display */}
        <div>
          <p className="text-sm font-medium mb-2">Current Status</p>
          <Badge 
            variant="secondary" 
            className={`${currentStatus?.color} text-white`}
          >
            {currentStatus?.label || order.status}
          </Badge>
        </div>

        {/* Status Update */}
        <div>
          <p className="text-sm font-medium mb-3">Update Status</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {STATUS_OPTIONS.map((status) => (
              <Button
                key={status.value}
                variant={order.status === status.value ? "default" : "outline"}
                size="sm"
                disabled={isUpdating || order.status === status.value}
                onClick={() => {
                  setSelectedStatus(status.value as OrderStatus);
                  setStatusDialogOpen(true);
                }}
                className="text-xs"
              >
                {isUpdating ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  status.label
                )}
              </Button>
            ))}
          </div>
        </div>

        {/* Rider Assignment */}
        <div>
          <p className="text-sm font-medium mb-3">Assign Rider</p>
        <Select
          value={order.assigned_rider_id || 'unassigned'}
          onValueChange={(value) => handleRiderAssignment(value === 'unassigned' ? null : value)}
          disabled={isAssigningRider || driversLoading}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a rider..." />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="unassigned">No rider assigned</SelectItem>
              {drivers?.map((driver) => (
                <SelectItem key={driver.id} value={driver.id}>
                  <div className="flex items-center gap-2">
                    <UserCheck className="h-4 w-4" />
                    {driver.name} ({driver.vehicle_type})
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {order.assigned_rider_id && (
            <p className="text-xs text-muted-foreground mt-1">
              Current: {drivers?.find(d => d.id === order.assigned_rider_id)?.name}
            </p>
          )}
        </div>

        {/* Manual Communications */}
        <div>
          <p className="text-sm font-medium mb-3">Manual Communications</p>
          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendEmail}
              disabled={isSendingCommunication || !order.customer_email}
              className="flex items-center gap-2"
            >
              {isSendingCommunication ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Mail className="h-4 w-4" />
              )}
              Send Email
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleSendSMS}
              disabled={isSendingCommunication}
              className="flex items-center gap-2"
            >
              <Phone className="h-4 w-4" />
              Send SMS
            </Button>
          </div>
        </div>

        {/* Order Actions */}
        <div>
          <p className="text-sm font-medium mb-3">Order Actions</p>
          <div className="grid grid-cols-1 gap-2">
            <Button variant="outline" size="sm">
              <Truck className="h-4 w-4 mr-2" />
              Track Order
            </Button>
            <Button variant="outline" size="sm">
              <CheckCircle2 className="h-4 w-4 mr-2" />
              Verify Payment
            </Button>
          </div>
        </div>
      </CardContent>

      {/* Status Update Confirmation Dialog */}
      <Dialog open={statusDialogOpen} onOpenChange={setStatusDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Status Update</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to update the order status from{' '}
              <Badge variant="secondary">{currentStatus?.label}</Badge> to{' '}
              <Badge variant="secondary">
                {STATUS_OPTIONS.find(s => s.value === selectedStatus)?.label}
              </Badge>?
            </p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setStatusDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleStatusUpdate} disabled={isUpdating}>
                {isUpdating ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Updating...
                  </>
                ) : (
                  'Confirm Update'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Card>
  );
};