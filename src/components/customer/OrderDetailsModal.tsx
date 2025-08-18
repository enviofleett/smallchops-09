import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Clock, MapPin, CreditCard, Package, Truck, Calendar, Phone } from 'lucide-react';
import { formatAddressMultiline } from '@/utils/formatAddress';
import { format } from 'date-fns';
import type { PickupPoint } from '@/hooks/usePickupPoints';
import { FullDeliveryInformation } from './FullDeliveryInformation';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  vat_amount?: number;
  discount_amount?: number;
  customizations?: any;
  special_instructions?: string;
}

interface DeliverySchedule {
  id: string;
  delivery_date: string;
  delivery_time_start: string;
  delivery_time_end: string;
  delivery_zone?: string;
  special_instructions?: string;
  delivery_fee?: number;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  payment_status: string;
  payment_method?: string;
  payment_reference?: string;
  total_amount: number;
  order_time: string;
  order_type: 'delivery' | 'pickup';
  delivery_address?: any;
  pickup_point_id?: string;
  customer_phone?: string;
  order_items: OrderItem[];
  paid_at?: string;
}

interface OrderDetailsModalProps {
  order: Order | null;
  deliverySchedule?: DeliverySchedule | null;
  pickupPoint?: PickupPoint | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  deliverySchedule,
  pickupPoint,
  isOpen,
  onClose,
}) => {
  if (!order) return null;

  const formatCurrency = (value: number | string | null | undefined) => {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(safe);
  };

  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    try {
      // Handle both "HH:mm" and "HH:mm:ss" formats
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      return format(date, 'h:mm a');
    } catch {
      return timeString;
    }
  };

  const formatDate = (dateString: string) => {
    if (!dateString) return '';
    try {
      return format(new Date(dateString), 'dd/MM/yyyy');
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-amber-100 text-amber-800',
      confirmed: 'bg-blue-100 text-blue-800',
      preparing: 'bg-purple-100 text-purple-800',
      ready: 'bg-green-100 text-green-800',
      out_for_delivery: 'bg-orange-100 text-orange-800',
      delivered: 'bg-green-100 text-green-800',
      completed: 'bg-emerald-100 text-emerald-800',
      cancelled: 'bg-red-100 text-red-800',
    };
    return colors[status as keyof typeof colors] || 'bg-muted text-muted-foreground';
  };

  const getPaymentStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-amber-100 text-amber-800',
      paid: 'bg-green-100 text-green-800',
      failed: 'bg-red-100 text-red-800',
      refunded: 'bg-purple-100 text-purple-800',
    };
    return colors[status as keyof typeof colors] || 'bg-muted text-muted-foreground';
  };

  const subtotal = order.order_items.reduce((sum, item) => sum + Number(item.total_price ?? Number(item.unit_price ?? 0) * Number(item.quantity ?? 0)), 0);
  const totalVat = order.order_items.reduce((sum, item) => sum + Number(item.vat_amount ?? 0), 0);
  const totalDiscount = order.order_items.reduce((sum, item) => sum + Number(item.discount_amount ?? 0), 0);

  // Helper to get delivery location
  const getDeliveryLocation = () => {
    if (deliverySchedule?.delivery_zone) {
      return deliverySchedule.delivery_zone;
    }
    if (order.delivery_address) {
      try {
        const addr = typeof order.delivery_address === 'string' 
          ? JSON.parse(order.delivery_address) 
          : order.delivery_address;
        const parts = [];
        if (addr.city) parts.push(addr.city);
        if (addr.state) parts.push(addr.state);
        return parts.join(', ') || 'N/A';
      } catch {
        return 'N/A';
      }
    }
    return 'N/A';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Package className="h-5 w-5 text-primary" />
            Order Details - {order.order_number}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(order.status)}>
                      {order.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Order Status</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getPaymentStatusColor(order.payment_status)}>
                      {order.payment_status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-4">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{formatDateTime(order.order_time)}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">Order Time</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items ({order.order_items.length} items)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {order.order_items.map((item) => (
                  <div key={item.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex-1">
                        <h4 className="font-medium">{item.product_name}</h4>
                        {item.special_instructions && (
                          <p className="text-sm text-muted-foreground mt-1">
                            <strong>Special Instructions:</strong> {item.special_instructions}
                          </p>
                        )}
                        {item.customizations && (
                          <p className="text-sm text-muted-foreground mt-1">
                            <strong>Customizations:</strong> {JSON.stringify(item.customizations)}
                          </p>
                        )}
                      </div>
                      <div className="text-right ml-4 min-w-0">
                        <p className="font-medium">{formatCurrency(Number(item.total_price ?? 0))}</p>
                        <p className="text-sm text-muted-foreground">
                          {Number(item.quantity ?? 0)} × {formatCurrency(Number(item.unit_price ?? 0))}
                        </p>
                      </div>
                    </div>
                    
                    {(Number(item.vat_amount ?? 0) > 0 || Number(item.discount_amount ?? 0) > 0) && (
                      <div className="flex justify-between text-sm text-muted-foreground pt-2 border-t">
                        {Number(item.vat_amount ?? 0) > 0 && (
                          <span>VAT: {formatCurrency(Number(item.vat_amount ?? 0))}</span>
                        )}
                        {Number(item.discount_amount ?? 0) > 0 && (
                          <span>Discount: -{formatCurrency(Number(item.discount_amount ?? 0))}</span>
                        )}
                      </div>
                    )}
                  </div>
                ))}

                <Separator />

                {/* Order Summary */}
                <div className="space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span>{formatCurrency(subtotal)}</span>
                  </div>
                  {totalVat > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>VAT (7.5%):</span>
                      <span>{formatCurrency(totalVat)}</span>
                    </div>
                  )}
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Total Discount:</span>
                      <span>-{formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
                  <Separator />
                  <div className="flex justify-between font-semibold text-lg">
                    <span>Total:</span>
                    <span>{formatCurrency(order.total_amount)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium">{order.payment_method || 'Online Payment'}</p>
                </div>
                {order.payment_reference && (
                  <div>
                    <p className="text-sm text-muted-foreground">Payment Reference</p>
                    <p className="font-mono text-sm">{order.payment_reference}</p>
                  </div>
                )}
                {order.paid_at && (
                  <div>
                    <p className="text-sm text-muted-foreground">Paid At</p>
                    <p className="font-medium">{formatDateTime(order.paid_at)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Full Delivery Information */}
          <FullDeliveryInformation
            order={order}
            deliverySchedule={deliverySchedule}
            pickupPoint={pickupPoint}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};