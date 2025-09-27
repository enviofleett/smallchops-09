import React, { useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle 
} from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package, 
  Printer, 
  CreditCard, 
  Truck, 
  Building2, 
  User, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Circle, 
  Loader2, 
  Copy, 
  Wifi, 
  WifiOff, 
  RefreshCw, 
  AlertCircle, 
  Phone, 
  Mail, 
  MessageSquare,
  Calendar, 
  ExternalLink,
  Hash
} from 'lucide-react';
import { useRealTimeOrderData } from '@/hooks/useRealTimeOrderData';
import { format, formatDistanceToNow } from 'date-fns';
import { ActionCenter } from './ActionCenter';
import { CommunicationLog } from './CommunicationLog';

interface ProductionOrderDetailsPageProps {
  orderId: string;
  onClose?: () => void;
}

export const ProductionOrderDetailsPage: React.FC<ProductionOrderDetailsPageProps> = ({ 
  orderId, 
  onClose 
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const { 
    data: orderData, 
    isLoading, 
    error, 
    connectionStatus, 
    lastUpdated, 
    reconnect 
  } = useRealTimeOrderData(orderId);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Order-${orderData?.order?.order_number || orderId}`,
    pageStyle: `
      @page {
        size: A4;
        margin: 20mm;
      }
      @media print {
        body { font-size: 12px; }
        .no-print { display: none !important; }
      }
    `,
  });

  const copyOrderNumber = () => {
    if (orderData?.order?.order_number) {
      navigator.clipboard.writeText(orderData.order.order_number);
      toast.success('Order number copied to clipboard');
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const formatDateTime = (dateString: string) => {
    return format(new Date(dateString), 'PPpp');
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-blue-500',
      preparing: 'bg-orange-500',
      ready: 'bg-green-500',
      out_for_delivery: 'bg-purple-500',
      delivered: 'bg-green-700',
      cancelled: 'bg-red-500'
    };
    return colors[status] || 'bg-gray-500';
  };

  const getTimelineSteps = () => {
    const steps = [
      { key: 'created', label: 'Order Created', status: 'completed' },
      { key: 'confirmed', label: 'Confirmed', status: orderData?.order?.status === 'pending' ? 'pending' : 'completed' },
      { key: 'preparing', label: 'Preparing', status: ['pending', 'confirmed'].includes(orderData?.order?.status) ? 'pending' : 'completed' },
      { key: 'ready', label: orderData?.order?.order_type === 'pickup' ? 'Ready for Pickup' : 'Ready for Delivery', status: ['pending', 'confirmed', 'preparing'].includes(orderData?.order?.status) ? 'pending' : 'completed' },
      { key: 'final', label: orderData?.order?.order_type === 'pickup' ? 'Picked Up' : 'Delivered', status: orderData?.order?.status === 'delivered' ? 'completed' : 'pending' }
    ];

    return steps;
  };

  if (isLoading) {
    return (
      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-6">
              <div className="h-4 bg-muted rounded w-1/4 mb-4"></div>
              <div className="h-8 bg-muted rounded w-3/4 mb-2"></div>
              <div className="h-4 bg-muted rounded w-1/2"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (error || !orderData?.order) {
    return (
      <div className="max-w-4xl mx-auto p-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            Failed to load order details. Please refresh the page or contact support.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const { order, items, fulfillment_info, pickup_point, business_settings, timeline } = orderData;

  return (
    <div className="min-h-screen bg-background" ref={printRef}>
      {/* Header Section */}
      <div className="bg-gradient-to-r from-primary/10 via-background to-secondary/10 border-b sticky top-0 z-10 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-3">
                <Package className="h-8 w-8 text-primary" />
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-2xl font-bold">#{order.order_number}</h1>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      onClick={copyOrderNumber}
                      className="h-6 w-6 p-0"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Last updated {lastUpdated ? format(lastUpdated, 'p') : 'recently'}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-2">
                <Badge 
                  variant="secondary" 
                  className={`${getStatusColor(order.status)} text-white`}
                >
                  {order.status.replace('_', ' ').toUpperCase()}
                </Badge>
                <Badge variant="outline">
                  {order.order_type?.toUpperCase() || 'DELIVERY'}
                </Badge>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Connection Status */}
              <div className="flex items-center gap-2">
                {connectionStatus === 'connected' ? (
                  <Wifi className="h-4 w-4 text-green-500" />
                ) : connectionStatus === 'connecting' ? (
                  <Loader2 className="h-4 w-4 text-yellow-500 animate-spin" />
                ) : (
                  <WifiOff className="h-4 w-4 text-red-500" />
                )}
                <span className="text-xs text-muted-foreground">
                  {connectionStatus}
                </span>
                {connectionStatus === 'disconnected' && (
                  <Button variant="ghost" size="sm" onClick={reconnect}>
                    <RefreshCw className="h-3 w-3" />
                  </Button>
                )}
              </div>

              <Button onClick={handlePrint} variant="outline" size="sm" className="no-print">
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-8">
        {/* Customer & Order Summary */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-1">Name</p>
                <p className="font-medium">{order.customer_name || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Email</p>
                <p className="font-medium">{order.customer_email || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Phone</p>
                <p className="font-medium">{order.customer_phone || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-1">Payment Status</p>
                <Badge 
                  variant={order.payment_status === 'completed' ? 'default' : 'secondary'}
                  className={order.payment_status === 'completed' ? 'bg-green-500' : ''}
                >
                  {order.payment_status || 'pending'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(order.subtotal || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">Delivery Fee</span>
                <span className="font-medium">{formatCurrency(order.delivery_fee || 0)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-sm text-muted-foreground">VAT</span>
                <span className="font-medium">{formatCurrency(order.vat_amount || 0)}</span>
              </div>
              <div className="border-t pt-2">
                <div className="flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-bold text-lg">{formatCurrency(order.total_amount)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Action Center */}
          <ActionCenter order={order} />
        </div>

        {/* Order Items */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5" />
              Order Items ({items?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {items?.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left py-2">Item</th>
                      <th className="text-center py-2">Qty</th>
                      <th className="text-right py-2">Unit Price</th>
                      <th className="text-right py-2">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((item: any, index: number) => (
                      <tr key={index} className="border-b">
                        <td className="py-3">
                          <div>
                            <p className="font-medium">{item.product?.name || 'Unknown Item'}</p>
                            {item.special_instructions && (
                              <p className="text-sm text-muted-foreground">{item.special_instructions}</p>
                            )}
                          </div>
                        </td>
                        <td className="text-center py-3">{item.quantity}</td>
                        <td className="text-right py-3">{formatCurrency(item.unit_price)}</td>
                        <td className="text-right py-3 font-medium">{formatCurrency(item.total_price)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-center text-muted-foreground py-8">No items found</p>
            )}
          </CardContent>
        </Card>

        {/* Fulfillment Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Order Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="flex items-center justify-between">
                {getTimelineSteps().map((step, index) => (
                  <div key={step.key} className="flex flex-col items-center flex-1">
                    <div className={`
                      w-8 h-8 rounded-full flex items-center justify-center mb-2
                      ${step.status === 'completed' 
                        ? 'bg-green-500 text-white' 
                        : 'bg-muted text-muted-foreground'
                      }
                    `}>
                      {step.status === 'completed' ? (
                        <CheckCircle2 className="h-4 w-4" />
                      ) : (
                        <Circle className="h-4 w-4" />
                      )}
                    </div>
                    <p className="text-xs text-center font-medium">{step.label}</p>
                  </div>
                ))}
              </div>
              <div className="absolute top-4 left-4 right-4 h-0.5 bg-muted -z-10">
                <div 
                  className="h-full bg-green-500 transition-all duration-500"
                  style={{ 
                    width: `${(getTimelineSteps().filter(s => s.status === 'completed').length - 1) * 25}%` 
                  }}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Location & Scheduling Details */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Details
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Address</p>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium">{fulfillment_info?.address || 'Address not available'}</p>
                </div>
              </div>
              
              {order.order_type === 'pickup' && pickup_point && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Pickup Point Details</p>
                  <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                    <p className="font-medium">{pickup_point.name}</p>
                    {pickup_point.contact_phone && (
                      <p className="text-sm text-muted-foreground">{pickup_point.contact_phone}</p>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Clock className="h-5 w-5" />
                Scheduling Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <p className="text-sm text-muted-foreground mb-2">
                  {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Time
                </p>
                <div className="p-3 bg-muted/50 rounded-lg">
                  {order.order_type === 'pickup' && fulfillment_info?.pickup_time ? (
                    <p className="font-medium">{formatDateTime(fulfillment_info.pickup_time)}</p>
                  ) : fulfillment_info?.delivery_date ? (
                    <p className="font-medium">
                      {format(new Date(fulfillment_info.delivery_date), 'PPP')}
                      {fulfillment_info.delivery_hours && (
                        <span className="text-sm text-muted-foreground block">
                          {fulfillment_info.delivery_hours.start} - {fulfillment_info.delivery_hours.end}
                          {fulfillment_info.delivery_hours.is_flexible && ' (Flexible)'}
                        </span>
                      )}
                    </p>
                  ) : (
                    <p className="text-muted-foreground">Not scheduled</p>
                  )}
                </div>
              </div>
              
              <div>
                <p className="text-sm text-muted-foreground mb-2">Order Created</p>
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="font-medium">{formatDateTime(order.created_at)}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Special Instructions & Communication Log */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Special Instructions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {[
                  fulfillment_info?.order_instructions,
                  fulfillment_info?.special_instructions,
                  fulfillment_info?.schedule_instructions
                ].filter(Boolean).length > 0 ? (
                  [
                    fulfillment_info?.order_instructions,
                    fulfillment_info?.special_instructions,
                    fulfillment_info?.schedule_instructions
                  ].filter(Boolean).map((instruction, index) => (
                    <div key={index} className="p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm">{instruction}</p>
                    </div>
                  ))
                ) : (
                  <p className="text-muted-foreground">No special instructions</p>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Communication Log */}
          <CommunicationLog orderId={order.id} />
        </div>

        {/* Business Information Footer */}
        {business_settings && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Business Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <p className="text-sm text-muted-foreground mb-2">Business</p>
                <p className="font-medium">{business_settings.name}</p>
                {business_settings.tagline && (
                  <p className="text-sm text-muted-foreground">{business_settings.tagline}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Contact</p>
                {business_settings.whatsapp_support_number && (
                  <p className="text-sm">{business_settings.whatsapp_support_number}</p>
                )}
                {business_settings.admin_notification_email && (
                  <p className="text-sm">{business_settings.admin_notification_email}</p>
                )}
              </div>
              <div>
                <p className="text-sm text-muted-foreground mb-2">Hours</p>
                {business_settings.business_hours ? (
                  <p className="text-sm">See business hours</p>
                ) : (
                  <p className="text-sm text-muted-foreground">Contact for hours</p>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
};