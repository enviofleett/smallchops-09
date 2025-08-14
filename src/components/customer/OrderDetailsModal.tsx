import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Button } from '@/components/ui/button';
import { Clock, MapPin, CreditCard, Package, Truck, Calendar, Phone, ChevronRight, User, Car, MapPinIcon, Building, Navigation, CheckCircle } from 'lucide-react';
import { formatAddress } from '@/utils/formatAddress';
import { DeliveryCountdown } from './DeliveryCountdown';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

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

interface DeliveryZone {
  id: string;
  name: string;
  description?: string;
  area?: any;
  created_at: string;
  updated_at: string;
}

interface DispatchRider {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  vehicle_type?: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  license_plate?: string;
  is_active: boolean;
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
  delivery_zone_id?: string;
  assigned_rider_id?: string;
  customer_phone?: string;
  order_items: OrderItem[];
  paid_at?: string;
  delivery_fee?: number;
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
  const [deliveryZone, setDeliveryZone] = useState<DeliveryZone | null>(null);
  const [dispatchRider, setDispatchRider] = useState<DispatchRider | null>(null);
  const [orderStatus, setOrderStatus] = useState(order?.status);
  const [loading, setLoading] = useState(false);

  // Initialize orderStatus when order changes
  useEffect(() => {
    if (order) {
      console.log('🔄 Initializing order status:', order.status);
      setOrderStatus(order.status);
    }
  }, [order]);

  if (!order) {
    console.log('❌ No order provided to OrderDetailsModal');
    return null;
  }

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

  // Fetch delivery zone and dispatch rider information
  useEffect(() => {
    let isMounted = true;
    const abortController = new AbortController();

    const fetchDeliveryInfo = async () => {
      if (!order || !isMounted) return;
      
      console.log('🔍 Fetching delivery info for order:', order.id);
      setLoading(true);
      
      try {
        // Fetch delivery zone if available
        if (order.delivery_zone_id && isMounted) {
          console.log('📍 Fetching delivery zone:', order.delivery_zone_id);
          const { data: zoneData, error: zoneError } = await supabase
            .from('delivery_zones')
            .select('*')
            .eq('id', order.delivery_zone_id)
            .maybeSingle();
          
          if (abortController.signal.aborted || !isMounted) return;
          
          if (zoneError) {
            console.warn('⚠️ Delivery zone fetch error:', zoneError);
          } else if (zoneData) {
            console.log('✅ Delivery zone loaded:', zoneData);
            setDeliveryZone(zoneData);
          } else {
            console.log('ℹ️ No delivery zone found for ID:', order.delivery_zone_id);
          }
        }

        // Fetch dispatch rider if assigned
        if (order.assigned_rider_id && isMounted) {
          console.log('🚚 Fetching dispatch rider:', order.assigned_rider_id);
          const { data: riderData, error: riderError } = await supabase
            .from('drivers')
            .select('*')
            .eq('id', order.assigned_rider_id)
            .maybeSingle();
          
          if (abortController.signal.aborted || !isMounted) return;
          
          if (riderError) {
            console.warn('⚠️ Dispatch rider fetch error:', riderError);
          } else if (riderData) {
            console.log('✅ Dispatch rider loaded:', riderData);
            setDispatchRider(riderData);
          } else {
            console.log('ℹ️ No dispatch rider found for ID:', order.assigned_rider_id);
          }
        }
      } catch (error) {
        if (!abortController.signal.aborted && isMounted) {
          console.error('❌ Critical error fetching delivery info:', error);
          // Don't break the modal, just log the error
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchDeliveryInfo();

    return () => {
      isMounted = false;
      abortController.abort();
    };
  }, [order?.id]);

  // Real-time status updates
  useEffect(() => {
    if (!order?.id) return;

    console.log('📡 Setting up real-time subscription for order:', order.id);
    let isMounted = true;
    
    const channel = supabase
      .channel(`order-status-updates-${order.id}`)
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders',
          filter: `id=eq.${order.id}`
        },
        (payload) => {
          if (isMounted) {
            console.log('📦 Order status update received:', payload);
            setOrderStatus(payload.new.status);
            if (payload.new.status === 'delivered') {
              toast.success('Your order has been delivered!');
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('📡 Real-time subscription status:', status);
      });

    return () => {
      isMounted = false;
      console.log('🔌 Cleaning up real-time subscription');
      supabase.removeChannel(channel);
    };
  }, [order?.id]);

  const subtotal = order.order_items.reduce((sum, item) => sum + item.total_price, 0);
  const totalVat = order.order_items.reduce((sum, item) => sum + (item.vat_amount || 0), 0);
  const totalDiscount = order.order_items.reduce((sum, item) => sum + (item.discount_amount || 0), 0);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'out_for_delivery':
        return <Truck className="h-4 w-4 text-blue-600" />;
      case 'ready':
        return <Package className="h-4 w-4 text-purple-600" />;
      default:
        return <Clock className="h-4 w-4 text-orange-600" />;
    }
  };

  const getStatusSteps = () => {
    const steps = [
      { key: 'pending', label: 'Order Placed', completed: true },
      { key: 'confirmed', label: 'Confirmed', completed: ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'].includes(orderStatus) },
      { key: 'preparing', label: 'Preparing', completed: ['preparing', 'ready', 'out_for_delivery', 'delivered'].includes(orderStatus) },
      { key: 'ready', label: 'Ready', completed: ['ready', 'out_for_delivery', 'delivered'].includes(orderStatus) },
      { key: 'out_for_delivery', label: 'Out for Delivery', completed: ['out_for_delivery', 'delivered'].includes(orderStatus) },
      { key: 'delivered', label: 'Delivered', completed: orderStatus === 'delivered' }
    ];
    return steps;
  };

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

          {/* Order Status Timeline */}
          {order.order_type === 'delivery' && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2 text-base sm:text-lg">
                  <Navigation className="h-5 w-5 flex-shrink-0" />
                  Order Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {getStatusSteps().map((step, index) => (
                    <div key={step.key} className="flex items-center gap-3">
                      <div className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        step.completed ? 'bg-green-500' : 'bg-muted'
                      }`} />
                      <div className="flex-1">
                        <p className={`text-sm font-medium ${
                          step.completed ? 'text-green-700' : 'text-muted-foreground'
                        }`}>
                          {step.label}
                        </p>
                      </div>
                      {step.completed && (
                        <CheckCircle className="h-4 w-4 text-green-500" />
                      )}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Order Header */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
            <Card className="p-3 sm:p-4">
              <CardContent className="p-0">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    {getStatusIcon(orderStatus)}
                    <Badge className={getStatusColor(orderStatus)} variant="secondary">
                      {orderStatus.replace('_', ' ').toUpperCase()}
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
                          <div className="space-y-1">
                            <p className="font-medium text-sm sm:text-base leading-relaxed break-words">
                              {order.delivery_address.address_line_1}
                            </p>
                            {order.delivery_address.address_line_2 && (
                              <p className="font-medium text-sm sm:text-base leading-relaxed break-words">
                                {order.delivery_address.address_line_2}
                              </p>
                            )}
                            {order.delivery_address.apartment && (
                              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                <Building className="h-4 w-4" />
                                <span>Apt/Unit: {order.delivery_address.apartment}</span>
                              </div>
                            )}
                            {order.delivery_address.landmark && (
                              <div className="flex items-center gap-2 text-sm text-primary">
                                <MapPinIcon className="h-4 w-4" />
                                <span>Landmark: {order.delivery_address.landmark}</span>
                              </div>
                            )}
                            <p className="text-sm text-muted-foreground">
                              {order.delivery_address.city}, {order.delivery_address.state} {order.delivery_address.postal_code}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Delivery Zone Information */}
                  {deliveryZone && (
                    <div className="bg-blue-50/50 rounded-lg p-3 sm:p-4 border border-blue-200/50">
                      <h4 className="font-semibold text-blue-800 mb-3 flex items-center gap-2">
                        <MapPin className="h-4 w-4" />
                        Delivery Zone
                      </h4>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">Zone</p>
                          <p className="font-medium text-sm sm:text-base">{deliveryZone.name}</p>
                        </div>
                        <div className="space-y-1">
                          <p className="text-xs sm:text-sm text-muted-foreground">Delivery Fee</p>
                          <p className="font-medium text-sm sm:text-base text-primary">
                            {order.delivery_fee ? formatCurrency(order.delivery_fee) : 'Contact for pricing'}
                          </p>
                        </div>
                        {deliveryZone.description && (
                          <div className="space-y-1 sm:col-span-2">
                            <p className="text-xs sm:text-sm text-muted-foreground">Coverage Area</p>
                            <p className="text-sm break-words">{deliveryZone.description}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Dispatch Rider Information */}
                  {dispatchRider && (
                    <div className="bg-green-50/50 rounded-lg p-3 sm:p-4 border border-green-200/50">
                      <h4 className="font-semibold text-green-800 mb-3 flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Dispatch Rider
                      </h4>
                      <div className="space-y-3">
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <p className="text-xs sm:text-sm text-muted-foreground">Rider Name</p>
                            <p className="font-medium text-sm sm:text-base">{dispatchRider.name}</p>
                          </div>
                          {dispatchRider.phone && (
                            <div className="space-y-1">
                              <p className="text-xs sm:text-sm text-muted-foreground">Contact</p>
                              <div className="flex items-center gap-2">
                                <p className="font-medium text-sm sm:text-base">{dispatchRider.phone}</p>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2"
                                  onClick={() => window.open(`tel:${dispatchRider.phone}`, '_self')}
                                >
                                  <Phone className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {(dispatchRider.vehicle_type || dispatchRider.vehicle_brand) && (
                          <div className="pt-2 border-t border-green-200/50">
                            <div className="flex items-center gap-2 mb-2">
                              <Car className="h-4 w-4 text-green-600" />
                              <span className="text-xs sm:text-sm text-muted-foreground">Vehicle Information</span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                              {dispatchRider.vehicle_type && (
                                <div>
                                  <span className="text-muted-foreground">Type: </span>
                                  <span className="font-medium capitalize">{dispatchRider.vehicle_type}</span>
                                </div>
                              )}
                              {dispatchRider.vehicle_brand && (
                                <div>
                                  <span className="text-muted-foreground">Brand: </span>
                                  <span className="font-medium">{dispatchRider.vehicle_brand} {dispatchRider.vehicle_model}</span>
                                </div>
                              )}
                              {dispatchRider.license_plate && (
                                <div className="sm:col-span-2">
                                  <span className="text-muted-foreground">License Plate: </span>
                                  <span className="font-medium font-mono">{dispatchRider.license_plate}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        )}
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
                        
                        {(deliverySchedule.delivery_zone || deliveryZone) && (
                          <div className="space-y-1">
                            <p className="text-xs sm:text-sm text-muted-foreground">Delivery Zone</p>
                            <p className="font-medium text-sm sm:text-base">
                              {deliverySchedule.delivery_zone || deliveryZone?.name}
                            </p>
                          </div>
                        )}
                        
                         {(deliverySchedule.delivery_fee || order.delivery_fee) && (
                          <div className="space-y-1">
                            <p className="text-xs sm:text-sm text-muted-foreground">Delivery Fee</p>
                            <p className="font-medium text-sm sm:text-base text-primary">
                              {formatCurrency(deliverySchedule.delivery_fee || order.delivery_fee || 0)}
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