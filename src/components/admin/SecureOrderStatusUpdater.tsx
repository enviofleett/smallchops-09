import React from 'react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { useProductionStatusUpdate } from '@/hooks/useProductionStatusUpdate';
import { OrderStatus } from '@/types/orders';
import { getStatusLabel } from '@/utils/orderValidation';
import { RefreshCw, Shield, AlertTriangle, RotateCcw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { toast } from 'sonner';

interface SecureOrderStatusUpdaterProps {
  orderId: string;
  currentStatus: OrderStatus;
  orderNumber: string;
  availableStatuses?: OrderStatus[];
  onStatusUpdate?: (newStatus: OrderStatus) => void;
  showSecurityBadge?: boolean;
}

export const SecureOrderStatusUpdater = ({
  orderId,
  currentStatus,
  orderNumber,
  availableStatuses,
  onStatusUpdate,
  showSecurityBadge = false
}: SecureOrderStatusUpdaterProps) => {
  const { updateStatus, isUpdating, error } = useProductionStatusUpdate();
  const [selectedStatus, setSelectedStatus] = React.useState<OrderStatus>(currentStatus);
  
  // PRODUCTION FIX: Enhanced error recovery state
  const [retryCount, setRetryCount] = React.useState(0);
  const [lastError, setLastError] = React.useState<string | null>(null);
  const [isRecovering, setIsRecovering] = React.useState(false);

  // Default available statuses with proper transitions
  const defaultAvailableStatuses: OrderStatus[] = React.useMemo(() => {
    switch (currentStatus) {
      case 'pending':
        return ['confirmed', 'cancelled'];
      case 'confirmed':
        return ['preparing', 'cancelled'];
      case 'preparing':
        return ['ready', 'cancelled'];
      case 'ready':
        return ['out_for_delivery', 'cancelled'];
      case 'out_for_delivery':
        return ['delivered', 'cancelled'];
      case 'delivered':
        return ['completed', 'returned'];
      case 'cancelled':
        return ['confirmed']; // Allow uncancelling
      case 'refunded':
        return []; // No transitions from refunded
      case 'completed':
        return ['returned']; // Can only return from completed
      case 'returned':
        return []; // Final state
      default:
        return [];
    }
  }, [currentStatus]);

  const statusOptions = availableStatuses || defaultAvailableStatuses;

  const handleStatusUpdate = async () => {
    if (selectedStatus === currentStatus) {
      toast.info('Status unchanged');
      return;
    }

    try {
      setLastError(null);
      setIsRecovering(false);
      setRetryCount(0);
      
      await updateStatus({ orderId, status: selectedStatus });
      onStatusUpdate?.(selectedStatus);
      toast.success(`Order #${orderNumber} status updated to ${getStatusLabel(selectedStatus)}`);
    } catch (error: any) {
      console.error('Secure status update failed:', error);
      setSelectedStatus(currentStatus); // Reset to original status
      setLastError(error.message);
    }
  };

  // Reset status if there was an error (prevents stuck state)
  React.useEffect(() => {
    if (error) {
      setSelectedStatus(currentStatus);
      setLastError(error.message);
    }
  }, [error, currentStatus]);

  // Auto-retry logic for recoverable errors
  React.useEffect(() => {
    if (error && retryCount < 2) {
      const errorMsg = error.message?.toLowerCase() || '';
      if (errorMsg.includes('concurrent') || errorMsg.includes('timeout') || errorMsg.includes('temporarily unavailable')) {
        setIsRecovering(true);
        const retryDelay = (retryCount + 1) * 2000; // 2s, 4s delays
        
        setTimeout(() => {
          console.log(`🔄 Auto-retrying status update (attempt ${retryCount + 1})`);
          setRetryCount(prev => prev + 1);
          handleStatusUpdate();
        }, retryDelay);
      }
    }
  }, [error, retryCount]);

  const isStatusChanged = selectedStatus !== currentStatus;
  const canUpdate = isStatusChanged && !isUpdating && !isRecovering;

  return (
    <Card className={`${showSecurityBadge ? 'border-green-200 bg-green-50/30' : ''}`}>
      <CardContent className="p-4 space-y-3">
        {showSecurityBadge && (
          <div className="flex items-center gap-2 text-sm text-green-700">
            <Shield className="w-4 h-4" />
            <span className="font-medium">Secure Status Update</span>
            <span className="text-xs bg-green-100 px-2 py-1 rounded">
              RPC Protected • Audit Logged
            </span>
          </div>
        )}

        <div className="space-y-2">
          <label className="text-sm font-medium text-muted-foreground">
            Update Status for Order #{orderNumber}
          </label>
          
          <div className="flex gap-2">
            <Select
              value={selectedStatus}
              onValueChange={(value) => setSelectedStatus(value as OrderStatus)}
              disabled={isUpdating}
            >
              <SelectTrigger className="flex-1">
                <SelectValue placeholder="Select new status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={currentStatus} disabled>
                  {getStatusLabel(currentStatus)} (Current)
                </SelectItem>
                {statusOptions.map((status) => (
                  <SelectItem key={status} value={status}>
                    {getStatusLabel(status)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Button
              onClick={handleStatusUpdate}
              disabled={!canUpdate}
              className="min-w-[120px]"
            >
              {isRecovering ? (
                <>
                  <RotateCcw className="w-4 h-4 mr-2 animate-spin" />
                  Retrying... ({retryCount}/2)
                </>
              ) : isUpdating ? (
                <>
                  <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update'
              )}
            </Button>
          </div>

          {selectedStatus !== currentStatus && !isUpdating && !isRecovering && (
            <div className="bg-blue-50 border border-blue-200 rounded p-2">
              <p className="text-xs text-blue-700">
                <strong>Status Change:</strong> {getStatusLabel(currentStatus)} → {getStatusLabel(selectedStatus)}
              </p>
              <p className="text-xs text-blue-600 mt-1">
                This action will be logged and trigger customer notifications if applicable.
              </p>
            </div>
          )}

          {isRecovering && (
            <div className="bg-amber-50 border border-amber-200 rounded p-2 flex items-start gap-2">
              <RotateCcw className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0 animate-spin" />
              <div>
                <p className="text-xs font-medium text-amber-700">Auto-retrying Update</p>
                <p className="text-xs text-amber-600">Attempting to recover from temporary error... ({retryCount}/2)</p>
              </div>
            </div>
          )}

          {lastError && !isUpdating && !isRecovering && (
            <div className="bg-red-50 border border-red-200 rounded p-2 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-xs font-medium text-red-700">Update Failed</p>
                <p className="text-xs text-red-600">{lastError}</p>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};