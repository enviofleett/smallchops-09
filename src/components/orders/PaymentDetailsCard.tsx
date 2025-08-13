import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CreditCard, Calendar, Hash, CheckCircle, AlertCircle, Clock } from 'lucide-react';
import { format } from 'date-fns';

interface PaymentTransaction {
  id: string;
  provider_reference?: string;
  amount: number;
  currency: string;
  status: string;
  payment_method?: string;
  paid_at?: string;
  created_at: string;
  gateway_response?: string;
  provider_response?: any;
}

interface PaymentDetailsCardProps {
  paymentStatus: string;
  paymentMethod?: string;
  paymentReference?: string;
  paidAt?: string;
  totalAmount: number;
  transaction?: PaymentTransaction;
  className?: string;
}

export function PaymentDetailsCard({
  paymentStatus,
  paymentMethod,
  paymentReference,
  paidAt,
  totalAmount,
  transaction,
  className = ""
}: PaymentDetailsCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const getPaymentStatusConfig = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'paid':
      case 'success':
      case 'completed':
        return {
          icon: CheckCircle,
          label: 'Paid',
          className: 'bg-green-100 text-green-800',
          iconColor: 'text-green-600'
        };
      case 'failed':
      case 'error':
        return {
          icon: AlertCircle,
          label: 'Failed',
          className: 'bg-red-100 text-red-800',
          iconColor: 'text-red-600'
        };
      case 'pending':
      case 'processing':
        return {
          icon: Clock,
          label: 'Pending',
          className: 'bg-yellow-100 text-yellow-800',
          iconColor: 'text-yellow-600'
        };
      default:
        return {
          icon: AlertCircle,
          label: 'Unknown',
          className: 'bg-gray-100 text-gray-800',
          iconColor: 'text-gray-600'
        };
    }
  };

  const statusConfig = getPaymentStatusConfig(paymentStatus);
  const StatusIcon = statusConfig.icon;

  return (
    <Card className={`p-6 ${className}`}>
      <div className="space-y-4">
        <div className="flex items-center gap-2 mb-4">
          <CreditCard className="h-5 w-5 text-primary" />
          <h3 className="text-lg font-semibold">Payment Details</h3>
        </div>

        {/* Payment Status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <StatusIcon className={`h-4 w-4 ${statusConfig.iconColor}`} />
            <span className="text-sm text-gray-600">Status</span>
          </div>
          <Badge className={statusConfig.className}>
            {statusConfig.label}
          </Badge>
        </div>

        {/* Payment Amount */}
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Amount</span>
          <span className="font-semibold text-lg">{formatCurrency(totalAmount)}</span>
        </div>

        {/* Payment Method */}
        {paymentMethod && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Method</span>
            <span className="font-medium capitalize">{paymentMethod}</span>
          </div>
        )}

        {/* Payment Reference */}
        {paymentReference && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Hash className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Reference</span>
            </div>
            <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded break-all">
              {paymentReference}
            </span>
          </div>
        )}

        {/* Payment Date */}
        {paidAt && (
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <span className="text-sm text-gray-600">Paid At</span>
            </div>
            <span className="font-medium">
              {format(new Date(paidAt), 'MMM d, yyyy h:mm a')}
            </span>
          </div>
        )}

        {/* Transaction Details */}
        {transaction && (
          <div className="pt-4 border-t space-y-3">
            <h4 className="font-medium text-gray-900">Transaction Details</h4>
            
            {transaction.provider_reference && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-600">Provider Ref</span>
                <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                  {transaction.provider_reference}
                </span>
              </div>
            )}
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Transaction ID</span>
              <span className="font-mono text-xs bg-gray-100 px-2 py-1 rounded">
                {transaction.id.substring(0, 8)}...
              </span>
            </div>
            
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Created</span>
              <span>{format(new Date(transaction.created_at), 'MMM d, yyyy h:mm a')}</span>
            </div>
            
            {transaction.gateway_response && (
              <div className="text-xs text-gray-500 mt-2">
                <span className="font-medium">Gateway Response:</span>
                <div className="bg-gray-50 p-2 rounded mt-1 font-mono">
                  {transaction.gateway_response}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </Card>
  );
}