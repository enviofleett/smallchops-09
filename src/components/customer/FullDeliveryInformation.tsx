import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  FileText, 
  Truck, 
  Package, 
  CheckCircle, 
  Phone,
  CreditCard 
} from 'lucide-react';
import { format } from 'date-fns';
import { formatAddressMultiline, emergencySafeFormatAddress } from '@/utils/formatAddress';
import { safeStringify, validateComponentData } from '@/utils/productionSafeData';
import { SafeOrderDataRenderer } from '@/components/common/SafeOrderDataRenderer';
import type { PickupPoint } from '@/hooks/usePickupPoints';

interface DeliverySchedule {
  id: string;
  delivery_date: string;
  delivery_time_start: string;
  delivery_time_end: string;
  delivery_zone?: string;
  special_instructions?: string;
  delivery_fee?: number;
  is_flexible?: boolean;
}

interface OrderItem {
  id: string;
  product_name: string;
  special_instructions?: string;
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
  paid_at?: string;
  special_instructions?: string;
  delivery_fee?: number;
  order_items?: OrderItem[];
}

interface FullDeliveryInformationProps {
  order: Order;
  deliverySchedule?: DeliverySchedule | null;
  pickupPoint?: PickupPoint | null;
  className?: string;
}

export const FullDeliveryInformation: React.FC<FullDeliveryInformationProps> = ({
  order,
  deliverySchedule,
  pickupPoint,
  className = ""
}) => {
  const formatTime = (timeString: string) => {
    if (!timeString) return '';
    try {
      const [hours, minutes] = timeString.split(':');
      const time = new Date();
      time.setHours(parseInt(hours), parseInt(minutes), 0, 0);
      return format(time, 'h:mm a');
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

  const formatCurrency = (value: number | string | null | undefined) => {
    const n = Number(value);
    const safe = Number.isFinite(n) ? n : 0;
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(safe);
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

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Fulfillment Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg">
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
            {/* Fulfillment Channel & Status */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <div className="flex items-center gap-2">
                  {order.order_type === 'delivery' ? (
                    <Truck className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground" />
                  )}
                  <div>
                    <p className="text-sm text-muted-foreground">Fulfillment Channel</p>
                    <p className="font-medium">
                      {order.order_type === 'delivery' ? 'Home Delivery' : 'Store Pickup'}
                    </p>
                  </div>
                </div>
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm text-muted-foreground">Current Status</p>
                    <Badge className={getStatusColor(order.status || 'pending')}>
                      {(order.status || 'pending').replace('_', ' ').toUpperCase()}
                    </Badge>
                  </div>
                </div>
              </div>
            </div>

            <Separator />

            {/* Delivery Address - only for delivery orders */}
            {order.order_type === 'delivery' && order.delivery_address && (
              <div>
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground mt-1" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Delivery Address</p>
                    <p className="font-medium whitespace-pre-line break-words">
                      {(() => {
                        try {
                          // Validate address data before rendering
                          if (!validateComponentData(order.delivery_address, 'FullDeliveryInformation.address')) {
                            return emergencySafeFormatAddress(order.delivery_address);
                          }
                          return formatAddressMultiline(order.delivery_address);
                        } catch (error) {
                          console.warn('Address rendering error, using emergency fallback:', error);
                          return emergencySafeFormatAddress(order.delivery_address);
                        }
                      })()}
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
                    <div className="flex-1">
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
                    <div className="flex items-start gap-2">
                      <Clock className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm text-muted-foreground">Operating Hours</p>
                        <div className="font-medium text-sm">
                          {typeof pickupPoint.operating_hours === 'object' ? (
                            <div className="space-y-1">
                              {Object.entries(pickupPoint.operating_hours).map(([day, hours]) => {
                                let display: string = '';
                                if (!hours) {
                                  display = 'Closed';
                                } else if (typeof hours === 'string') {
                                  display = hours;
                                } else if (typeof hours === 'object') {
                                  const h: any = hours;
                                  const isClosed = h.closed === true || h.is_open === false;
                                  if (isClosed) display = 'Closed';
                                  else display = [h.open, h.close].filter(Boolean).join(' - ');
                                }
                                return (
                                  <div key={day} className="flex justify-between">
                                    <span className="capitalize">{day}:</span>
                                    <span>{display || 'N/A'}</span>
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <p>{String(pickupPoint.operating_hours)}</p>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {pickupPoint.instructions && (
                  <div>
                    <div className="flex items-start gap-2">
                      <FileText className="h-4 w-4 text-muted-foreground mt-1" />
                      <div>
                        <p className="text-sm text-muted-foreground">Pickup Instructions</p>
                        <p className="font-medium text-sm break-words">{pickupPoint.instructions}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Schedule Information - with fallback to order-level data */}
            {(deliverySchedule || order.delivery_address || pickupPoint) && (
              <>
                <Separator />
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Calendar className="h-4 w-4" />
                    {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'} Schedule
                  </h4>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {deliverySchedule ? (
                      <>
                        <div>
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-muted-foreground" />
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'} Date
                              </p>
                              <p className="font-medium">
                                {formatDate(deliverySchedule.delivery_date)}
                              </p>
                              <p className="text-xs text-muted-foreground">
                                {new Date(deliverySchedule.delivery_date).toLocaleDateString('en-NG', {
                                  weekday: 'long',
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
                            <div>
                              <p className="text-sm text-muted-foreground">
                                {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'} Time Window
                              </p>
                              <p className="font-medium">
                                {formatTime(deliverySchedule.delivery_time_start)} – {formatTime(deliverySchedule.delivery_time_end)}
                              </p>
                              <p className="text-xs text-blue-600">1-hour window</p>
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
                            <div className="flex items-start gap-2">
                              <FileText className="h-4 w-4 text-muted-foreground mt-1" />
                              <div>
                                <p className="text-sm text-muted-foreground">Special Instructions</p>
                                <p className="font-medium break-words text-sm bg-muted/50 p-2 rounded">
                                  {safeStringify(deliverySchedule.special_instructions)}
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        {deliverySchedule.is_flexible && (
                          <div className="sm:col-span-2">
                            <Badge variant="outline" className="border-green-500 text-green-700 bg-green-50">
                              <MapPin className="w-3 h-3 mr-1" />
                              Flexible {order.order_type === 'delivery' ? 'delivery' : 'pickup'} time
                            </Badge>
                          </div>
                        )}
                      </>
                    ) : (
                      <div className="sm:col-span-2">
                        <div className="bg-muted/30 rounded-lg p-3">
                          <p className="text-sm text-muted-foreground">
                            {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'} schedule will be confirmed after payment.
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {/* Order-level Special Instructions Fallback */}
            {!deliverySchedule?.special_instructions && order.special_instructions && (
              <>
                <Separator />
                <div>
                  <div className="flex items-start gap-2">
                    <FileText className="h-4 w-4 text-muted-foreground mt-1" />
                    <div>
                      <p className="text-sm text-muted-foreground">Special Instructions</p>
                      <p className="font-medium break-words text-sm bg-muted/50 p-2 rounded">
                        {safeStringify(order.special_instructions)}
                      </p>
                    </div>
                  </div>
                </div>
              </>
            )}

            {/* Order Items Special Instructions - when no schedule or order-level instructions */}
            {!deliverySchedule?.special_instructions && !order.special_instructions && order.order_items && (
              (() => {
                const itemInstructions = order.order_items
                  .filter(item => item.special_instructions)
                  .map(item => `${item.product_name}: ${item.special_instructions}`)
                  .join('\n');
                
                return itemInstructions ? (
                  <>
                    <Separator />
                    <div>
                      <div className="flex items-start gap-2">
                        <FileText className="h-4 w-4 text-muted-foreground mt-1" />
                        <div>
                          <p className="text-sm text-muted-foreground">Item Instructions</p>
                          <p className="font-medium break-words text-sm bg-muted/50 p-2 rounded whitespace-pre-line">
                            {safeStringify(itemInstructions)}
                          </p>
                        </div>
                      </div>
                    </div>
                  </>
                ) : null;
              })()
            )}

            {/* Contact Phone */}
            {order.customer_phone && (
              <>
                <Separator />
                <div>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm text-muted-foreground">Contact Phone</p>
                      <p className="font-medium">{safeStringify(order.customer_phone)}</p>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};