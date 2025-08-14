import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Clock, MapPin, CreditCard, Package, Truck, Calendar, Phone, ChevronRight } from 'lucide-react';
import { formatAddress } from '@/utils/formatAddress';
import { DeliveryCountdown } from './DeliveryCountdown';

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
  customer_phone?: string;
  order_items: OrderItem[];
  paid_at?: string;
}

interface OrderDetailsModalProps {
  order: Order | null;
  deliverySchedule?: DeliverySchedule | null;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  deliverySchedule,
  isOpen,
  onClose,
}) => {
  if (!order) return null;

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
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

  const subtotal = order.order_items.reduce((sum, item) => sum + item.total_price, 0);
  const totalVat = order.order_items.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
  const totalDiscount = order.order_items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader className="space-y-3">
          <DialogTitle className="flex items-center gap-3 text-lg sm:text-xl">
            <Package className="h-5 w-5 text-primary flex-shrink-0" />
            <span className="truncate">Order Details - {order.order_number}</span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 sm:space-y-6">
          {/* Delivery Countdown - Only show if delivery is scheduled */}
          {deliverySchedule && (
            <DeliveryCountdown
              deliveryDate={deliverySchedule.delivery_date}
              deliveryTimeStart={deliverySchedule.delivery_time_start}
              className="w-full"
            />
          )}

          {/* Order Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Card className="p-3 sm:p-4">
              <CardContent className="p-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getStatusColor(order.status)} variant="secondary">
                      {order.status.replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Order Status</p>
                </div>
              </CardContent>
            </Card>

            <Card className="p-3 sm:p-4">
              <CardContent className="p-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge className={getPaymentStatusColor(order.payment_status)} variant="secondary">
                      {order.payment_status.toUpperCase()}
                    </Badge>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Payment Status</p>
                </div>
              </CardContent>
            </Card>

            <Card className="p-3 sm:p-4 sm:col-span-2 lg:col-span-1">
              <CardContent className="p-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="font-medium text-sm sm:text-base break-words">
                      {formatDateTime(order.order_time)}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-muted-foreground">Order Time</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Items */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <Package className="h-5 w-5 flex-shrink-0" />
                Order Items ({order.order_items.length} {order.order_items.length === 1 ? 'item' : 'items'})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 sm:space-y-4">
                {order.order_items.map((item) => (
                  <div key={item.id} className="border rounded-lg p-3 sm:p-4 bg-card">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <h4 className="font-medium text-sm sm:text-base break-words">{item.product_name}</h4>
                        <div className="flex items-center gap-2 text-xs sm:text-sm text-muted-foreground mt-1">
                          <span>Qty: {item.quantity}</span>
                          <span>•</span>
                          <span>{formatCurrency(item.unit_price)} each</span>
                        </div>
                        
                        {item.special_instructions && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs sm:text-sm">
                            <p className="font-medium text-muted-foreground mb-1">Special Instructions:</p>
                            <p className="break-words">{item.special_instructions}</p>
                          </div>
                        )}
                        
                        {item.customizations && typeof item.customizations === 'object' && (
                          <div className="mt-2 p-2 bg-muted/50 rounded text-xs sm:text-sm">
                            <p className="font-medium text-muted-foreground mb-1">Customizations:</p>
                            <div className="space-y-1">
                              {Object.entries(item.customizations).map(([key, value]) => (
                                <div key={key} className="flex gap-2 break-words">
                                  <span className="font-medium">{key}:</span>
                                  <span>{String(value)}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      <div className="text-right sm:ml-4 flex-shrink-0">
                        <p className="font-bold text-primary text-sm sm:text-base">
                          {formatCurrency(item.total_price)}
                        </p>
                        {(item.vat_amount > 0 || item.discount_amount > 0) && (
                          <div className="text-xs text-muted-foreground mt-1 space-y-1">
                            {item.vat_amount > 0 && (
                              <div>VAT: {formatCurrency(item.vat_amount)}</div>
                            )}
                            {item.discount_amount > 0 && (
                              <div className="text-green-600">Discount: -{formatCurrency(item.discount_amount)}</div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                ))}

                <Separator className="my-4" />

                {/* Order Summary */}
                <div className="bg-muted/30 rounded-lg p-3 sm:p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Subtotal:</span>
                    <span className="font-medium">{formatCurrency(subtotal)}</span>
                  </div>
                  {totalVat > 0 && (
                    <div className="flex justify-between text-sm">
                      <span>VAT (7.5%):</span>
                      <span className="font-medium">{formatCurrency(totalVat)}</span>
                    </div>
                  )}
                  {totalDiscount > 0 && (
                    <div className="flex justify-between text-sm text-green-600">
                      <span>Total Discount:</span>
                      <span className="font-medium">-{formatCurrency(totalDiscount)}</span>
                    </div>
                  )}
                  <Separator className="my-2" />
                  <div className="flex justify-between font-bold text-base sm:text-lg text-primary">
                    <span>Total:</span>
                    <span>{formatCurrency(order.total_amount)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                <CreditCard className="h-5 w-5 flex-shrink-0" />
                Payment Information
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                <div className="space-y-1">
                  <p className="text-xs sm:text-sm text-muted-foreground">Payment Method</p>
                  <p className="font-medium text-sm sm:text-base">{order.payment_method || 'Online Payment'}</p>
                </div>
                {order.payment_reference && (
                  <div className="space-y-1">
                    <p className="text-xs sm:text-sm text-muted-foreground">Payment Reference</p>
                    <p className="font-mono text-xs sm:text-sm break-all">{order.payment_reference}</p>
                  </div>
                )}
                {order.paid_at && (
                  <div className="space-y-1 sm:col-span-2">
                    <p className="text-xs sm:text-sm text-muted-foreground">Paid At</p>
                    <p className="font-medium text-sm sm:text-base">{formatDateTime(order.paid_at)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Delivery Information */}
          {(order.order_type === 'delivery' || deliverySchedule) && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Truck className="h-5 w-5 flex-shrink-0" />
                  Delivery Information
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4 sm:space-y-6">
                  {order.delivery_address && (
                    <div className="bg-muted/30 rounded-lg p-3 sm:p-4">
                      <div className="flex items-start gap-3">
                        <MapPin className="h-5 w-5 text-primary mt-0.5 flex-shrink-0" />
                        <div className="min-w-0 flex-1">
                          <p className="text-xs sm:text-sm text-muted-foreground mb-2">Delivery Address</p>
                          <p className="font-medium text-sm sm:text-base leading-relaxed break-words">
                            {formatAddress(order.delivery_address)}
                          </p>
                        </div>
                      </div>
                    </div>
                  )}

                  {deliverySchedule && (
                    <div className="bg-primary/5 rounded-lg p-3 sm:p-4 border border-primary/10">
                      <h4 className="font-semibold text-primary mb-3 flex items-center gap-2">
                        <Calendar className="h-4 w-4" />
                        Scheduled Delivery
                      </h4>
                      
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">Delivery Date</p>
                          <p className="font-medium text-sm sm:text-base">
                            {new Date(deliverySchedule.delivery_date).toLocaleDateString('en-NG', {
                              weekday: 'long',
                              year: 'numeric',
                              month: 'long',
                              day: 'numeric'
                            })}
                          </p>
                        </div>
                        
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">Time Window</p>
                          <p className="font-medium text-sm sm:text-base">
                            {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}
                          </p>
                        </div>
                        
                        {deliverySchedule.delivery_zone && (
                          <div className="space-y-1">
                            <p className="text-xs sm:text-sm text-muted-foreground">Delivery Zone</p>
                            <p className="font-medium text-sm sm:text-base">{deliverySchedule.delivery_zone}</p>
                          </div>
                        )}
                        
                        {deliverySchedule.delivery_fee && (
                          <div className="space-y-1">
                            <p className="text-xs sm:text-sm text-muted-foreground">Delivery Fee</p>
                            <p className="font-medium text-sm sm:text-base text-primary">
                              {formatCurrency(deliverySchedule.delivery_fee)}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {deliverySchedule.special_instructions && (
                        <div className="mt-4 pt-3 border-t border-primary/10">
                          <p className="text-xs sm:text-sm text-muted-foreground mb-2">Special Instructions</p>
                          <p className="font-medium text-sm sm:text-base break-words bg-white/50 p-2 rounded">
                            {deliverySchedule.special_instructions}
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {order.customer_phone && (
                    <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-lg">
                      <Phone className="h-5 w-5 text-primary flex-shrink-0" />
                      <div>
                        <p className="text-xs sm:text-sm text-muted-foreground">Contact Phone</p>
                        <p className="font-medium text-sm sm:text-base">{order.customer_phone}</p>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};