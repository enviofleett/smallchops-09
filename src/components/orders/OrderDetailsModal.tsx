import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderItemsBreakdown } from './OrderItemsBreakdown';
import { PaymentDetailsCard } from './PaymentDetailsCard';
import { DeliveryScheduleDisplay } from './DeliveryScheduleDisplay';
import { usePayment } from '@/hooks/usePayment';
import {
  Calendar,
  MapPin,
  Package,
  CreditCard,
  Clock,
  Truck,
  CheckCircle,
  Loader2,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface OrderDetailsModalProps {
  order: any;
  deliverySchedule?: any;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDetailsModal({
  order,
  deliverySchedule,
  isOpen,
  onClose
}: OrderDetailsModalProps) {
  const { processing, processPayment } = usePayment();

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return {
          label: 'Delivered',
          className: 'bg-green-100 text-green-800',
          icon: CheckCircle,
          iconColor: 'text-green-600'
        };
      case 'out_for_delivery':
        return {
          label: 'Out for Delivery',
          className: 'bg-blue-100 text-blue-800',
          icon: Truck,
          iconColor: 'text-blue-600'
        };
      case 'preparing':
        return {
          label: 'Preparing',
          className: 'bg-yellow-100 text-yellow-800',
          icon: Package,
          iconColor: 'text-yellow-600'
        };
      case 'confirmed':
        return {
          label: 'Confirmed',
          className: 'bg-blue-100 text-blue-800',
          icon: CheckCircle,
          iconColor: 'text-blue-600'
        };
      case 'pending':
        return {
          label: 'Pending',
          className: 'bg-yellow-100 text-yellow-800',
          icon: Clock,
          iconColor: 'text-yellow-600'
        };
      default:
        return {
          label: 'Unknown',
          className: 'bg-gray-100 text-gray-800',
          icon: Clock,
          iconColor: 'text-gray-600'
        };
    }
  };

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;

  // Check if payment can be continued
  const canContinuePayment =
    order.payment_status !== 'paid' &&
    order.total_amount > 0 &&
    ['pending', 'confirmed', 'preparing'].includes(order.status);

  const handleContinuePayment = async () => {
    if (!order.customer_email) {
      toast.error('Customer email not found for this order');
      return;
    }

    try {
      const success = await processPayment(
        order.id,
        order.total_amount,
        order.customer_email,
        true // Open in new tab
      );

      if (success) {
        toast.success('Payment window opened. Complete your payment to continue.');
        onClose(); // Close modal after initiating payment
      }
    } catch (error) {
      console.error('Payment continuation error:', error);
      toast.error('Failed to continue payment. Please try again.');
    }
  };

  // Calculate totals from order items
  const subtotal = order.order_items?.reduce((sum: number, item: any) =>
    sum + (item.total_price || 0), 0) || order.total_amount || 0;

  const totalVat = order.order_items?.reduce((sum: number, item: any) =>
    sum + (item.vat_amount || 0), 0) || 0;

  const totalDiscount = order.order_items?.reduce((sum: number, item: any) =>
    sum + (item.discount_amount || 0), 0) || 0;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between">
            <DialogTitle className="flex items-center gap-3">
              <StatusIcon className={`h-5 w-5 ${statusConfig.iconColor}`} />
              Order #{order.order_number}
              <Badge className={statusConfig.className}>
                {statusConfig.label}
              </Badge>
            </DialogTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Summary */}
          <div className="bg-gray-50 p-4 rounded-lg">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span>{format(new Date(order.order_time), 'MMM d, yyyy h:mm a')}</span>
              </div>

              {order.order_type === 'delivery' && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-gray-500" />
                  <span className="capitalize">{order.order_type}</span>
                </div>
              )}

              <div className="flex items-center gap-2">
                <Package className="h-4 w-4 text-gray-500" />
                <span>{order.order_items?.length || 0} items</span>
              </div>

              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-gray-500" />
                <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                  {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                </Badge>
              </div>
            </div>

            <div className="mt-4 flex items-center justify-between">
              <span className="text-lg font-semibold">Total Amount:</span>
              <span className="text-2xl font-bold text-primary">
                {formatCurrency(order.total_amount)}
              </span>
            </div>
          </div>

          {/* Continue Payment Button - Prominent placement */}
          {canContinuePayment && (
            <div className="bg-orange-50 border border-orange-200 p-4 rounded-lg">
              <div className="flex items-center justify-between">
                <div>
                  <h4 className="font-semibold text-orange-800">Payment Required</h4>
                  <p className="text-sm text-orange-600">
                    Complete your payment to process this order
                  </p>
                </div>
                <Button
                  onClick={handleContinuePayment}
                  disabled={processing}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  {processing ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    <>
                      <CreditCard className="h-4 w-4 mr-2" />
                      Continue Payment
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}

          {/* Order Items Breakdown */}
          {order.order_items && order.order_items.length > 0 && (
            <OrderItemsBreakdown
              items={order.order_items}
              subtotal={subtotal}
              totalVat={totalVat}
              totalDiscount={totalDiscount}
              grandTotal={order.total_amount}
              showDetailed={true}
            />
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Payment Details */}
            <PaymentDetailsCard
              paymentStatus={order.payment_status}
              paymentMethod={order.payment_method}
              paymentReference={order.payment_reference}
              paidAt={order.paid_at}
              totalAmount={order.total_amount}
            />

            {/* Delivery Schedule */}
            {order.order_type === 'delivery' && deliverySchedule && (
              <DeliveryScheduleDisplay
                schedule={deliverySchedule}
                orderType={order.order_type}
                orderStatus={order.status}
                className="h-fit"
              />
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}