import React from 'react';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AlertTriangle, CheckCircle, X } from 'lucide-react';
import { OrderStatus } from '@/types/orders';

interface StatusTransitionValidatorProps {
  currentStatus: OrderStatus;
  targetStatus: OrderStatus;
  onValidationResult: (isValid: boolean, message?: string) => void;
}

// Define allowed status transitions matrix
const STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  'pending': ['confirmed', 'cancelled'],
  'confirmed': ['preparing', 'cancelled'],
  'preparing': ['ready', 'cancelled'],
  'ready': ['out_for_delivery', 'completed', 'cancelled'],
  'out_for_delivery': ['delivered', 'cancelled'],
  'delivered': ['completed', 'returned'],
  'cancelled': [], // Terminal state
  'refunded': [], // Terminal state
  'completed': ['returned'], // Generally terminal, but can be returned
  'returned': ['refunded'] // Can be refunded after return
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  'pending': 'Pending Payment',
  'confirmed': 'Confirmed',
  'preparing': 'Preparing',
  'ready': 'Ready',
  'out_for_delivery': 'Out for Delivery',
  'delivered': 'Delivered',
  'cancelled': 'Cancelled',
  'refunded': 'Refunded',
  'completed': 'Completed',
  'returned': 'Returned'
};

const STATUS_COLORS: Record<OrderStatus, string> = {
  'pending': 'bg-yellow-50 text-yellow-700 border-yellow-200',
  'confirmed': 'bg-blue-50 text-blue-700 border-blue-200',
  'preparing': 'bg-orange-50 text-orange-700 border-orange-200',
  'ready': 'bg-purple-50 text-purple-700 border-purple-200',
  'out_for_delivery': 'bg-indigo-50 text-indigo-700 border-indigo-200',
  'delivered': 'bg-green-50 text-green-700 border-green-200',
  'cancelled': 'bg-red-50 text-red-700 border-red-200',
  'refunded': 'bg-gray-50 text-gray-700 border-gray-200',
  'completed': 'bg-emerald-50 text-emerald-700 border-emerald-200',
  'returned': 'bg-yellow-50 text-yellow-800 border-yellow-300'
};

export const StatusTransitionValidator: React.FC<StatusTransitionValidatorProps> = ({
  currentStatus,
  targetStatus,
  onValidationResult
}) => {
  const allowedTransitions = STATUS_TRANSITIONS[currentStatus] || [];
  const isValidTransition = allowedTransitions.includes(targetStatus);
  const isSameStatus = currentStatus === targetStatus;

  React.useEffect(() => {
    if (isSameStatus) {
      onValidationResult(false, 'Status unchanged');
    } else if (isValidTransition) {
      onValidationResult(true);
    } else {
      onValidationResult(false, `Cannot change from ${STATUS_LABELS[currentStatus]} to ${STATUS_LABELS[targetStatus]}`);
    }
  }, [currentStatus, targetStatus, isValidTransition, isSameStatus, onValidationResult]);

  if (isSameStatus) {
    return (
      <Alert className="border-blue-200 bg-blue-50">
        <CheckCircle className="h-4 w-4 text-blue-600" />
        <AlertDescription className="text-blue-700">
          Current status: <Badge className={STATUS_COLORS[currentStatus]}>{STATUS_LABELS[currentStatus]}</Badge>
        </AlertDescription>
      </Alert>
    );
  }

  if (isValidTransition) {
    return (
      <Alert className="border-green-200 bg-green-50">
        <CheckCircle className="h-4 w-4 text-green-600" />
        <AlertDescription className="text-green-700">
          Valid transition: <Badge className={STATUS_COLORS[currentStatus]}>{STATUS_LABELS[currentStatus]}</Badge> → 
          <Badge className={`ml-2 ${STATUS_COLORS[targetStatus]}`}>{STATUS_LABELS[targetStatus]}</Badge>
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-red-200 bg-red-50">
      <X className="h-4 w-4 text-red-600" />
      <AlertDescription className="text-red-700">
        <div className="space-y-2">
          <div>
            Invalid transition: <Badge className={STATUS_COLORS[currentStatus]}>{STATUS_LABELS[currentStatus]}</Badge> → 
            <Badge className={`ml-2 ${STATUS_COLORS[targetStatus]}`}>{STATUS_LABELS[targetStatus]}</Badge>
          </div>
          <div className="text-sm">
            Allowed transitions from {STATUS_LABELS[currentStatus]}: {
              allowedTransitions.length > 0 
                ? allowedTransitions.map(status => STATUS_LABELS[status]).join(', ')
                : 'None (terminal state)'
            }
          </div>
        </div>
      </AlertDescription>
    </Alert>
  );
};

export const getValidTransitions = (currentStatus: OrderStatus): OrderStatus[] => {
  return STATUS_TRANSITIONS[currentStatus] || [];
};

export const isValidTransition = (currentStatus: OrderStatus, targetStatus: OrderStatus): boolean => {
  return STATUS_TRANSITIONS[currentStatus]?.includes(targetStatus) || false;
};

export const getStatusLabel = (status: OrderStatus): string => {
  return STATUS_LABELS[status] || status;
};

export const getStatusColor = (status: OrderStatus): string => {
  return STATUS_COLORS[status] || 'bg-gray-50 text-gray-700 border-gray-200';
};