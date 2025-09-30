import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ActionsPanel } from './ActionsPanel';
import { 
  Clock, CheckCircle2, XCircle, ArrowRight, Settings, 
  MessageSquare, Hash, AlertCircle, RefreshCw 
} from 'lucide-react';
import { OrderStatus } from '@/types/orders';

interface ActionsTabProps {
  order: any;
  isUpdatingStatus: boolean;
  handleStatusUpdate: (status: string) => Promise<void>;
  drivers?: any[];
  driversLoading?: boolean;
  assignedRiderId?: string | null;
  onRiderAssignment?: (riderId: string | null) => Promise<void>;
  isAssigningRider?: boolean;
}

// Status options for quick actions
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-600' },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-blue-600' },
  { value: 'preparing', label: 'Preparing', icon: Settings, color: 'text-orange-600' },
  { value: 'ready', label: 'Ready', icon: CheckCircle2, color: 'text-green-600' },
  { value: 'out_for_delivery', label: 'Out for Delivery', icon: ArrowRight, color: 'text-purple-600' },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle2, color: 'text-green-700' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-600' }
];

export const ActionsTab: React.FC<ActionsTabProps> = ({ 
  order, 
  isUpdatingStatus, 
  handleStatusUpdate,
  drivers = [],
  driversLoading = false,
  assignedRiderId,
  onRiderAssignment,
  isAssigningRider = false
}) => {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(order.status);
  const [manualStatus, setManualStatus] = useState<OrderStatus | ''>('');
  const [isSendingManual, setIsSendingManual] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [verifyState, setVerifyState] = useState<'idle' | 'success' | 'failed' | 'pending'>('idle');
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);

  const handleStatusChange = (status: OrderStatus) => {
    setSelectedStatus(status);
  };

  const handleRiderChange = async (riderId: string | null) => {
    if (onRiderAssignment) {
      await onRiderAssignment(riderId);
    }
  };

  const handleUpdate = async () => {
    await handleStatusUpdate(selectedStatus);
  };

  const handleManualSend = async () => {
    if (!manualStatus) return;
    setIsSendingManual(true);
    try {
      // Implement manual email send logic here
      console.log('Sending manual email for status:', manualStatus);
    } catch (error) {
      console.error('Failed to send manual email:', error);
    } finally {
      setIsSendingManual(false);
    }
  };

  const handleVerifyPayment = async () => {
    setIsVerifying(true);
    setVerifyState('pending');
    try {
      // Implement payment verification logic here
      console.log('Verifying payment for order:', order.id);
      setVerifyState('success');
      setVerifyMessage('Payment verified successfully');
    } catch (error) {
      setVerifyState('failed');
      setVerifyMessage('Payment verification failed');
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Quick Status Actions */}
      <Card className="rounded-lg border shadow-sm">
        <div className="p-6 space-y-4">
          <h3 className="text-base font-semibold">Quick Status Updates</h3>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {STATUS_OPTIONS.map((status) => {
              const Icon = status.icon;
              const isActive = order.status === status.value;
              const isDisabled = isUpdatingStatus;
              return (
                <Button
                  key={status.value}
                  variant={isActive ? "default" : "outline"}
                  disabled={isDisabled}
                  onClick={() => handleStatusUpdate(status.value)}
                  className={`
                    h-auto py-3 px-2 flex flex-col items-center gap-2
                    transition-colors
                    ${isActive ? 'ring-2 ring-primary ring-offset-1' : ''}
                  `}
                >
                  {isDisabled ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Icon className={`w-4 h-4 ${isActive ? 'text-primary-foreground' : status.color}`} />
                  )}
                  <span className="text-xs leading-tight text-center">{status.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Advanced Actions Panel */}
      <ActionsPanel
        selectedStatus={selectedStatus}
        onStatusChange={handleStatusChange}
        assignedRider={assignedRiderId}
        onRiderChange={handleRiderChange}
        riders={drivers}
        isLoadingRiders={driversLoading}
        manualStatus={manualStatus}
        onManualStatusChange={setManualStatus}
        onManualSend={handleManualSend}
        onUpdate={handleUpdate}
        onVerifyPayment={handleVerifyPayment}
        paymentReference={order.payment_reference}
        isUpdating={isUpdatingStatus || isAssigningRider}
        isSendingManual={isSendingManual}
        isVerifying={isVerifying}
        verifyState={verifyState}
        verifyMessage={verifyMessage}
        orderId={order.id}
        customerEmail={order.customer_email}
        orderNumber={order.order_number}
      />

      {/* Additional Actions */}
      <Card className="rounded-lg border shadow-sm">
        <div className="p-6 space-y-4">
          <h3 className="text-base font-semibold">Additional Actions</h3>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button variant="outline" size="sm" className="h-auto py-3 flex flex-col items-center gap-1.5">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs">Notify Customer</span>
            </Button>
            <Button variant="outline" size="sm" className="h-auto py-3 flex flex-col items-center gap-1.5">
              <Hash className="w-4 h-4" />
              <span className="text-xs">Generate Invoice</span>
            </Button>
            <Button variant="outline" size="sm" className="h-auto py-3 flex flex-col items-center gap-1.5">
              <Clock className="w-4 h-4" />
              <span className="text-xs">View History</span>
            </Button>
            <Button variant="outline" size="sm" className="h-auto py-3 flex flex-col items-center gap-1.5 text-destructive hover:text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">Cancel Order</span>
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
};