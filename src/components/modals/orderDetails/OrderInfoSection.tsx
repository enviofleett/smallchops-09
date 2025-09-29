import React from 'react';
import { Calendar, CreditCard, DollarSign, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Order, OrderStatus } from '@/types/orderDetailsModal';
import { useUpdateOrderStatus } from '@/hooks/useUpdateOrderStatus';
import { StatusBadge } from './StatusBadge';
import { toast } from 'sonner';
// Import defensive validation utilities
import { safeOrder, statusOptions, getSafeStatus } from '@/utils/orderDefensiveValidation';

interface OrderInfoSectionProps {
  order: Order;
  isUpdatingStatus: boolean;
  onStatusUpdate: () => void;
}

export const OrderInfoSection: React.FC<OrderInfoSectionProps> = ({ 
  order, 
  isUpdatingStatus,
  onStatusUpdate 
}) => {
  // Apply defensive validation to ensure safe rendering
  const safeOrderData = safeOrder(order);
  
  // Handle invalid order data gracefully
  if (!safeOrderData) {
    return (
      <Card className="keep-together">
        <CardContent className="py-6">
          <div className="text-center text-muted-foreground">
            <Package className="h-8 w-8 mx-auto mb-2" />
            <p>Order information unavailable</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const { updateStatus, isUpdating } = useUpdateOrderStatus(safeOrderData.id);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    const safeCurrentStatus = getSafeStatus(safeOrderData.status);
    if (newStatus === safeCurrentStatus) return;
    
    const success = await updateStatus(newStatus);
    if (success) {
      onStatusUpdate();
    }
  };

  const formatCurrency = (amount: number) => {
    // Defensive number formatting
    const safeAmount = Number(amount) || 0;
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(safeAmount);
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const getPaymentStatusColor = (status: any) => {
    const safeStatus = String(status || 'pending').toLowerCase();
    switch (safeStatus) {
      case 'paid':
        return 'bg-success text-success-foreground';
      case 'pending':
        return 'bg-warning text-warning-foreground';
      case 'failed':
      case 'refunded':
        return 'bg-destructive text-destructive-foreground';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  return (
    <Card className="keep-together">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Package className="h-5 w-5 text-primary" />
          Order Information
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <Package className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground capitalize">
                {safeOrderData.order_type || 'delivery'}
              </p>
              <p className="text-xs text-muted-foreground">Order Type</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">
                {formatDateTime(safeOrderData.created_at)}
              </p>
              <p className="text-xs text-muted-foreground">Created At</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <div>
              <Badge className={getPaymentStatusColor(safeOrderData.payment_status)}>
                {String(safeOrderData.payment_status || 'pending').toUpperCase()}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">Payment Status</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">
                {formatCurrency(safeOrderData.total_amount)}
              </p>
              <p className="text-xs text-muted-foreground">Total Amount</p>
            </div>
          </div>
        </div>

        <div className="pt-2 border-t">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">
              Current Status
            </label>
            <div className="flex items-center gap-2">
              <Select
                value={getSafeStatus(safeOrderData.status)}
                onValueChange={handleStatusChange}
                disabled={isUpdating || isUpdatingStatus}
              >
                <SelectTrigger className="w-48">
                  <SelectValue>
                    <StatusBadge status={getSafeStatus(safeOrderData.status)} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={status.value as OrderStatus} />
                        <span>{status.label}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};