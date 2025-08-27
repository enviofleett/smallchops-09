import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Card, CardContent } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { toast } from 'sonner';
import {
  MapPin,
  Clock,
  User,
  Phone,
  Mail,
  Package,
  Printer,
  Calendar,
  AlertCircle,
  X,
} from 'lucide-react';

interface OrderDetailsModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

const STARTERS_LOGO = '/logo-starters.svg'; // Update this path to your actual logo!

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed':
      return 'bg-blue-500/10 text-blue-700 border-blue-200';
    case 'preparing':
      return 'bg-orange-500/10 text-orange-700 border-orange-200';
    case 'ready':
      return 'bg-green-500/10 text-green-700 border-green-200';
    case 'out_for_delivery':
      return 'bg-purple-500/10 text-purple-700 border-purple-200';
    case 'delivered':
      return 'bg-green-600/10 text-green-800 border-green-300';
    case 'cancelled':
      return 'bg-red-500/10 text-red-700 border-red-200';
    default:
      return 'bg-gray-500/10 text-gray-700 border-gray-200';
  }
};

const formatCurrency = (amount: number) =>
  new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency: 'NGN',
  }).format(amount);

const formatDateTime = (dateString: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-NG', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateString;
  }
};

const formatDate = (dateString: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-NG', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return dateString;
  }
};

const formatTimeWindow = (start: string, end: string) => {
  // expects "09:00" or "09:00:00"
  if (!start || !end) return '';
  try {
    const s = start.split(':');
    const e = end.split(':');
    return `${s[0].padStart(2, '0')}:${s[1] || '00'} - ${e[0].padStart(2, '0')}:${e[1] || '00'}`;
  } catch {
    return `${start} - ${end}`;
  }
};

const formatAddress = (address: any) => {
  if (!address || typeof address !== 'object') return 'N/A';
  const parts = [
    address.address_line_1,
    address.address_line_2,
    address.city,
    address.state,
  ].filter(Boolean);
  return parts.join(', ') || 'N/A';
};

export function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const { data: detailedOrder, isLoading, error, refetch } = useDetailedOrderData(order?.id);

  const { data: businessSettings } = useBusinessSettings();

  useEffect(() => {
    if (error) {
      toast.error('Failed to load order details');
    }
  }, [error]);

  // Delivery fee and subtotal calculation
  const shippingFee =
    Number(order?.delivery_fee ?? detailedOrder?.delivery_schedule?.delivery_fee ?? 0);
  const subtotal = Math.max(0, Number(order?.total_amount || 0) - shippingFee);

  // Product features parser
  const getProductFeatures = (product: any) => {
    if (!product?.features) return null;
    if (typeof product.features === 'string') {
      try {
        return JSON.parse(product.features);
      } catch {
        // fallback: try to split by lines
        return null;
      }
    }
    return product.features;
  };

  // Delivery schedule info
  const deliverySchedule =
    detailedOrder?.delivery_schedule || order?.delivery_schedule || null;
  const deliveryDate = deliverySchedule?.delivery_date;
  const deliveryWindowStart = deliverySchedule?.delivery_time_start;
  const deliveryWindowEnd = deliverySchedule?.delivery_time_end;

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  // RESPONSIVE MODAL STYLES
  const modalContentStyles =
    'max-w-[96vw] w-full sm:max-w-4xl max-h-[90vh] overflow-y-auto rounded-xl bg-white p-0 border-none';

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className={modalContentStyles}>
          {/* HEADER */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-2 px-4 pt-4 pb-2 border-b">
            <div className="flex items-center gap-2">
              <img src={STARTERS_LOGO} alt="Starters Logo" className="h-8 w-auto mr-2" />
              <span className="text-lg font-bold text-primary">Order Details</span>
              <span className="font-mono text-xs text-muted-foreground ml-2">
                {order?.order_number}
              </span>
              <Badge
                className={`ml-2 capitalize ${getStatusColor(order?.status)}`}
                variant="outline"
              >
                {order?.status?.replace(/_/g, ' ') ?? 'Unknown'}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-2 md:mt-0">
              <Button
                variant="outline"
                size="sm"
                className="flex items-center gap-1"
                onClick={handlePrint}
              >
                <Printer className="h-4 w-4" />
                Print
              </Button>
              <DialogClose asChild>
                <Button variant="ghost" size="icon" aria-label="Close">
                  <X className="h-5 w-5" />
                </Button>
              </DialogClose>
            </div>
          </div>

          {/* TOTAL + SCHEDULED DELIVERY */}
          <div className="flex flex-col md:flex-row gap-4 px-4 pt-2 pb-2">
            <div className="flex-1 min-w-0">
              <div className="flex flex-col gap-2">
                <span className="font-bold text-xl text-primary">
                  {formatCurrency(order?.total_amount || 0)}
                </span>
                <div className="flex gap-2 text-muted-foreground text-xs">
                  <Package className="h-4 w-4 text-green-600" />
                  <span>
                    {order?.status === 'ready' && (
                      <span className="font-bold text-green-700">READY</span>
                    )}
                  </span>
                  <span className="ml-2">
                    {order?.order_time && formatDateTime(order?.order_time)}
                  </span>
                </div>
              </div>
            </div>
            <div className="flex-1 min-w-0 flex flex-col gap-2">
              {deliveryDate && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-primary" />
                  <span>
                    Scheduled Delivery: <span className="font-semibold">{formatDate(deliveryDate)}</span>
                  </span>
                </div>
              )}
              {deliveryWindowStart && deliveryWindowEnd && (
                <div className="flex items-center gap-2 text-sm">
                  <Clock className="h-4 w-4 text-primary" />
                  <span>
                    Time Window:{' '}
                    <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                      {formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)} Delivery Window
                    </Badge>
                  </span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <MapPin className="h-4 w-4 text-primary" />
                <span>{formatAddress(order?.delivery_address)}</span>
              </div>
              {shippingFee > 0 && (
                <div className="flex items-center gap-2 text-sm text-green-700">
                  <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                    ₦{shippingFee.toLocaleString()} Delivery Fee
                  </Badge>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* CUSTOMER INFO & DELIVERY INFO */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-4 py-2">
            <Card className="border-none shadow-none bg-transparent">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 mb-2 font-bold">
                  <User className="h-4 w-4 text-primary" />
                  Customer Information
                </div>
                <div className="space-y-1 text-sm">
                  <div className="font-semibold">{order?.customer_name}</div>
                  <div className="flex gap-1 items-center">
                    <Mail className="h-4 w-4" />
                    <span>{order?.customer_email}</span>
                  </div>
                  <div className="flex gap-1 items-center">
                    <Phone className="h-4 w-4" />
                    <span>{order?.customer_phone}</span>
                  </div>
                </div>
              </CardContent>
            </Card>
            <Card className="border-none shadow-none bg-transparent">
              <CardContent className="p-0">
                <div className="flex items-center gap-2 mb-2 font-bold">
                  <MapPin className="h-4 w-4 text-primary" />
                  Delivery Information
                </div>
                <div className="space-y-1 text-sm">
                  <div>
                    <span className="font-semibold">Address:</span> {formatAddress(order?.delivery_address)}
                  </div>
                  {deliveryDate && (
                    <div>
                      <span className="font-semibold">Date:</span> {formatDate(deliveryDate)}
                    </div>
                  )}
                  {deliveryWindowStart && deliveryWindowEnd && (
                    <div>
                      <span className="font-semibold">Window:</span>{' '}
                      <Badge variant="outline" className="bg-blue-100 text-blue-700 border-blue-200">
                        {formatTimeWindow(deliveryWindowStart, deliveryWindowEnd)}
                      </Badge>
                    </div>
                  )}
                  {shippingFee > 0 && (
                    <div>
                      <span className="font-semibold">Delivery Fee:</span>{' '}
                      <Badge variant="outline" className="bg-green-100 text-green-700 border-green-300">
                        ₦{shippingFee.toLocaleString()}
                      </Badge>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          <Separator />

          {/* ORDER ITEMS */}
          <div className="px-4 py-2">
            <div className="font-bold mb-2 flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Order Items ({order?.order_items?.length || 0})
            </div>
            {isLoading ? (
              <div className="space-y-3">
                {[...Array(2)].map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full rounded-lg" />
                ))}
              </div>
            ) : (
              <ScrollArea className="max-h-[320px] w-full rounded-lg border p-2 bg-muted/10">
                {order?.order_items?.map((item: any, idx: number) => {
                  // Try to extract features (object, array, string, or simple text)
                  let features = getProductFeatures(item.product);
                  if (!features && item?.features) {
                    features = item.features;
                  }
                  return (
                    <div
                      key={item.id || idx}
                      className="flex flex-col md:flex-row items-start md:items-center justify-between border-b last:border-b-0 py-3 gap-3"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="font-medium">{item.product_name}</div>
                        {item.product?.description && (
                          <div className="text-xs text-muted-foreground">
                            {item.product.description}
                          </div>
                        )}
                        {/* Features/details */}
                        {features && (
                          <div className="mt-1 text-xs text-muted-foreground">
                            <span className="font-semibold">What's included:</span>
                            {typeof features === 'object' && !Array.isArray(features) ? (
                              <ul className="list-disc ml-4">
                                {Object.entries(features).map(([key, value], i) =>
                                  value ? (
                                    <li key={i}>
                                      <span className="font-semibold">{key}:</span> {String(value)}
                                    </li>
                                  ) : null
                                )}
                              </ul>
                            ) : Array.isArray(features) ? (
                              <ul className="list-disc ml-4">
                                {features.map((f, i) =>
                                  f ? <li key={i}>{String(f)}</li> : null
                                )}
                              </ul>
                            ) : (
                              <span className="ml-2">{String(features)}</span>
                            )}
                          </div>
                        )}
                        {item.special_instructions && (
                          <div className="text-xs mt-1 text-orange-700">
                            <span className="font-semibold">Note:</span> {item.special_instructions}
                          </div>
                        )}
                      </div>
                      <div className="flex items-center gap-3 text-right md:text-left">
                        <div>
                          <span className="font-semibold">Qty:</span> {item.quantity}
                        </div>
                        <div>
                          <span className="font-semibold">Unit Price:</span>{' '}
                          {formatCurrency(item.unit_price)}
                        </div>
                        <div>
                          <span className="font-semibold">Total:</span>{' '}
                          {formatCurrency(item.total_price)}
                        </div>
                        {item.status && (
                          <Badge
                            variant="outline"
                            className={`capitalize ml-2 text-xs ${getStatusColor(item.status)}`}
                          >
                            {item.status}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
                {(!order?.order_items || order?.order_items.length === 0) && (
                  <div className="py-4 text-center text-muted-foreground">No order items found.</div>
                )}
              </ScrollArea>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
