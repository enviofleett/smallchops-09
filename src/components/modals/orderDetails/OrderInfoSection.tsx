import React from 'react';
import { Calendar, CreditCard, DollarSign, Package } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Order, OrderStatus } from '@/types/orderDetailsModal';
import { useUpdateOrderStatus } from '@/hooks/useUpdateOrderStatus';
import { StatusBadge } from './StatusBadge';
import { toast } from 'sonner';

interface OrderInfoSectionProps {
  order: Order;
  isUpdatingStatus: boolean;
  onStatusUpdate: () => void;
}

const statusOptions: { value: OrderStatus; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'confirmed', label: 'Confirmed' },
  { value: 'preparing', label: 'Preparing' },
  { value: 'ready', label: 'Ready' },
  { value: 'out_for_delivery', label: 'Out for Delivery' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
];

export const OrderInfoSection: React.FC<OrderInfoSectionProps> = ({ 
  order, 
  isUpdatingStatus,
  onStatusUpdate 
}) => {
  const { updateStatus, isUpdating } = useUpdateOrderStatus(order.id);

  const handleStatusChange = async (newStatus: OrderStatus) => {
    if (newStatus === order.status) return;
    
    const success = await updateStatus(newStatus);
    if (success) {
      onStatusUpdate();
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getPaymentStatusColor = (status: string) => {
    switch (status) {
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
                {order.order_type}
              </p>
              <p className="text-xs text-muted-foreground">Order Type</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Calendar className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">
                {formatDateTime(order.created_at)}
              </p>
              <p className="text-xs text-muted-foreground">Created At</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
            <CreditCard className="h-4 w-4 text-muted-foreground" />
            <div>
              <Badge className={getPaymentStatusColor(order.payment_status)}>
                {order.payment_status}
              </Badge>
              <p className="text-xs text-muted-foreground mt-1">Payment Status</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <DollarSign className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="font-medium text-foreground">
                {formatCurrency(order.total_amount)}
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
                value={order.status}
                onValueChange={handleStatusChange}
                disabled={isUpdating || isUpdatingStatus}
              >
                <SelectTrigger className="w-48">
                  <SelectValue>
                    <StatusBadge status={order.status} />
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      <div className="flex items-center gap-2">
                        <StatusBadge status={status.value} />
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