import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Clock, MapPin, CreditCard, Package, Truck, Calendar, Phone } from 'lucide-react';
import { formatAddressMultiline } from '@/utils/formatAddress';
import { format } from 'date-fns';
import type { PickupPoint } from '@/hooks/usePickupPoints';

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

          {/* Fulfillment Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                {order.order_type === 'delivery' ? (
                  <Truck className="h-5 w-5" />
                ) : (
                  <Package className="h-5 w-5" />
                )}
                {order.order_type === 'delivery' ? 'Delivery Information' : 'Pickup Information'}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Fulfillment Channel */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
                  <div>
                    <div className="flex items-center gap-2">
                      {order.order_type === 'delivery' ? (
                        <Truck className="h-4 w-4 text-muted-foreground" />
                      ) : (
                        <Package className="h-4 w-4 text-muted-foreground" />
                      )}
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Fulfillment Channel</p>
                        <p className="font-medium">
                          {order.order_type === 'delivery' ? 'Home Delivery' : 'Store Pickup'}
                        </p>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <Badge className={getStatusColor(order.status)}>
                        {order.status.replace('_', ' ').toUpperCase()}
                      </Badge>
                    </div>
                    <p className="text-sm text-muted-foreground mt-1">Current Status</p>
                  </div>
                </div>

                {/* Delivery Address - only for delivery orders */}
                {order.order_type === 'delivery' && order.delivery_address && (
                  <div>
                    <div className="flex items-start gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                      <div className="min-w-0 flex-1">
                        <p className="text-sm text-muted-foreground">Delivery Address</p>
                        <p className="font-medium whitespace-pre-line break-words">
                          {formatAddressMultiline(order.delivery_address)}
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Pickup Point Information - only for pickup orders */}
                {order.order_type === 'pickup' && pickupPoint && (
                  <div className="space-y-3">
                    <div>
                      <div className="flex items-start gap-2">
                        <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm text-muted-foreground">Pickup Location</p>
                          <p className="font-medium">{pickupPoint.name}</p>
                          <p className="text-sm text-muted-foreground break-words">{pickupPoint.address}</p>
                        </div>
                      </div>
                    </div>
                    
                    {pickupPoint.contact_phone && (
                      <div>
                        <div className="flex items-center gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Pickup Location Phone</p>
                            <p className="font-medium">{pickupPoint.contact_phone}</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {pickupPoint.operating_hours && (
                      <div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm text-muted-foreground">Operating Hours</p>
                            <p className="font-medium text-sm">
                              {typeof pickupPoint.operating_hours === 'string' 
                                ? pickupPoint.operating_hours 
                                : JSON.stringify(pickupPoint.operating_hours)
                              }
                            </p>
                          </div>
                        </div>
                      </div>
                    )}

                    {pickupPoint.instructions && (
                      <div>
                        <p className="text-sm text-muted-foreground">Pickup Instructions</p>
                        <p className="font-medium text-sm break-words">{pickupPoint.instructions}</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Schedule Information */}
                {deliverySchedule && (
                  <div className="pt-4 border-t">
                    <h4 className="font-medium mb-3 flex items-center gap-2">
                      <Calendar className="h-4 w-4" />
                      {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'} Schedule
                    </h4>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="text-sm text-muted-foreground">
                              {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'} Date
                            </p>
                            <p className="font-medium">
                              {new Date(deliverySchedule.delivery_date).toLocaleDateString('en-NG', {
                                weekday: 'long',
                                year: 'numeric',
                                month: 'long',
                                day: 'numeric'
                              })}
                            </p>
                          </div>
                        </div>
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <Clock className="h-4 w-4 text-muted-foreground" />
                          <div className="min-w-0">
                            <p className="text-sm text-muted-foreground">
                              {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'} Time Window
                            </p>
                            <p className="font-medium">
                              {formatTime(deliverySchedule.delivery_time_start)} - {formatTime(deliverySchedule.delivery_time_end)}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      {deliverySchedule.delivery_zone && order.order_type === 'delivery' && (
                        <div>
                          <p className="text-sm text-muted-foreground">Delivery Zone</p>
                          <p className="font-medium break-words">{deliverySchedule.delivery_zone}</p>
                        </div>
                      )}
                      
                      {deliverySchedule.delivery_fee && order.order_type === 'delivery' && (
                        <div>
                          <p className="text-sm text-muted-foreground">Delivery Fee</p>
                          <p className="font-medium">{formatCurrency(Number(deliverySchedule.delivery_fee ?? 0))}</p>
                        </div>
                      )}
                      
                      {deliverySchedule.special_instructions && (
                        <div className="sm:col-span-2">
                          <p className="text-sm text-muted-foreground">Special Instructions</p>
                          <p className="font-medium break-words text-sm">{deliverySchedule.special_instructions}</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}

                {/* Delivery Location - only for delivery orders without explicit schedule */}
                {order.order_type === 'delivery' && !deliverySchedule && (
                  <div>
                    <div className="flex items-center gap-2">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="text-sm text-muted-foreground">Delivery Location</p>
                        <p className="font-medium break-words">{getDeliveryLocation()}</p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Contact Phone */}
                {order.customer_phone && (
                  <div>
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <div>
                        <p className="text-sm text-muted-foreground">Contact Phone</p>
                        <p className="font-medium">{order.customer_phone}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>
  );
};