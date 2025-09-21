import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useSimpleOrderStatusUpdate } from '@/hooks/useSimpleOrderStatusUpdate';
import { OrderStatus } from '@/types/orders';
import { RefreshCw, Send, Clock } from 'lucide-react';

interface SimpleAdminOrderStatusManagerProps {
  orderId: string;
  currentStatus: OrderStatus;
  orderNumber: string;
  customerEmail?: string;
  className?: string;
}

const STATUS_FLOW = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: [],
  cancelled: [],
  completed: []
};

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  completed: 'Completed'
};

const STATUS_COLORS = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  preparing: 'bg-orange-500',
  ready: 'bg-green-500',
  out_for_delivery: 'bg-purple-500',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-red-500',
  completed: 'bg-gray-500'
};

export const SimpleAdminOrderStatusManager: React.FC<SimpleAdminOrderStatusManagerProps> = ({
  orderId,
  currentStatus,
  orderNumber,
  customerEmail,
  className
}) => {
  const { updateOrderStatus, isUpdating, adminUserId } = useSimpleOrderStatusUpdate();
  const [emailStatus, setEmailStatus] = useState<'sending' | 'sent' | 'failed' | null>(null);

  const nextStatuses = STATUS_FLOW[currentStatus as keyof typeof STATUS_FLOW] || [];

  const handleStatusUpdate = async (newStatus: OrderStatus) => {
    try {
      setEmailStatus('sending');
      await updateOrderStatus(orderId, newStatus);
      setEmailStatus('sent');
      
      // Clear email status after 3 seconds
      setTimeout(() => setEmailStatus(null), 3000);
    } catch (error) {
      console.error('Status update failed:', error);
      setEmailStatus('failed');
      setTimeout(() => setEmailStatus(null), 3000);
    }
  };

  const getEmailStatusIcon = () => {
    switch (emailStatus) {
      case 'sending':
        return <Send className="h-3 w-3 animate-pulse text-blue-500" />;
      case 'sent':
        return <RefreshCw className="h-3 w-3 text-green-500" />;
      case 'failed':
        return <Clock className="h-3 w-3 text-red-500" />;
      default:
        return null;
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Current Status */}
      <div className="flex items-center justify-between">
        <span className="text-sm font-medium text-gray-700">Current Status:</span>
        <Badge className={STATUS_COLORS[currentStatus as keyof typeof STATUS_COLORS]}>
          {STATUS_LABELS[currentStatus as keyof typeof STATUS_LABELS]}
        </Badge>
      </div>

      {/* Status Update Actions */}
      {nextStatuses.length > 0 && (
        <div className="space-y-2">
          <div className="text-sm font-medium text-gray-700">Available Actions:</div>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((status) => (
              <Button
                key={status}
                onClick={() => handleStatusUpdate(status as OrderStatus)}
                disabled={isUpdating}
                size="sm"
                variant="outline"
                className="flex items-center gap-2"
              >
                {isUpdating ? (
                  <RefreshCw className="h-3 w-3 animate-spin" />
                ) : (
                  <div 
                    className={`w-2 h-2 rounded-full ${STATUS_COLORS[status as keyof typeof STATUS_COLORS]}`}
                  />
                )}
                Mark as {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
              </Button>
            ))}
          </div>
        </div>
      )}

      {/* Email Status Feedback */}
      {emailStatus && customerEmail && (
        <div className="flex items-center gap-2 text-sm">
          {getEmailStatusIcon()}
          <span className="text-gray-600">
            {emailStatus === 'sending' && 'Sending email notification...'}
            {emailStatus === 'sent' && 'Customer notification sent'}
            {emailStatus === 'failed' && 'Email notification failed (will retry)'}
          </span>
        </div>
      )}

      {/* Order Info */}
      <div className="text-xs text-gray-500">
        <div>Order: {orderNumber}</div>
        {customerEmail && <div>Customer: {customerEmail}</div>}
        {adminUserId && <div>Admin: {adminUserId}</div>}
      </div>
    </div>
  );
};