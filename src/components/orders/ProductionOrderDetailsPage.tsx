import React, { useState } from 'react';
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
  Calendar,
  Phone,
  Mail,
  CheckCircle2,
  Circle,
  ArrowRight,
  MessageSquare,
  Copy,
  ExternalLink,
  Wifi,
  WifiOff,
  AlertCircle,
  Timer,
  Hash
} from 'lucide-react';
import { format } from 'date-fns';
import { useRealTimeOrderData } from '@/hooks/useRealTimeOrderData';
import { RealTimeConnectionStatus } from '@/components/common/RealTimeConnectionStatus';
import { cn } from '@/lib/utils';

interface ProductionOrderDetailsPageProps {
  orderId: string;
  onClose?: () => void;
}

export const ProductionOrderDetailsPage: React.FC<ProductionOrderDetailsPageProps> = ({
  orderId,
  onClose
}) => {
  const printRef = React.useRef<HTMLDivElement>(null);
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  
  const { 
    data: orderData, 
    isLoading, 
    error, 
    lastUpdated, 
    connectionStatus, 
    reconnect 
  } = useRealTimeOrderData(orderId);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Order-${orderData?.order?.order_number}`,
    onAfterPrint: () => toast.success('Order details printed successfully'),
    onPrintError: () => toast.error('Failed to print order details')
  });

  const copyOrderNumber = () => {
    if (orderData?.order?.order_number) {
      navigator.clipboard.writeText(orderData.order.order_number);
      toast.success('Order number copied to clipboard');
    }
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200';
      case 'out_for_delivery': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'ready': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'preparing': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'confirmed': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
      case 'pending': return 'bg-gray-100 text-gray-800 border-gray-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(amount);
  };

  const formatDateTime = (date: string | Date) => {
    if (!date) return 'Not set';
    return format(new Date(date), 'PPP p');
  };

  const getTimelineSteps = () => {
    const status = orderData?.order?.status;
    const steps = [
      { id: 'created', label: 'Order Created', completed: true },
      { id: 'confirmed', label: 'Confirmed', completed: ['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'].includes(status) },
      { id: 'preparing', label: 'Preparing', completed: ['preparing', 'ready', 'out_for_delivery', 'delivered'].includes(status) },
      { id: 'ready', label: orderData?.order?.order_type === 'pickup' ? 'Ready for Pickup' : 'Ready for Delivery', completed: ['ready', 'out_for_delivery', 'delivered'].includes(status) },
    ];

    if (orderData?.order?.order_type === 'delivery') {
      steps.push({ id: 'out_for_delivery', label: 'Out for Delivery', completed: ['out_for_delivery', 'delivered'].includes(status) });
    }
    
    steps.push({ 
      id: 'delivered', 
      label: orderData?.order?.order_type === 'pickup' ? 'Picked Up' : 'Delivered', 
      completed: status === 'delivered' 
    });

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
              <Badge className={cn('px-3 py-1', getStatusColor(order.status))}>
                {order.status?.replace(/_/g, ' ').toUpperCase()}
              </Badge>
            </div>
            
            <div className="flex items-center gap-3">
              <RealTimeConnectionStatus
                connectionStatus={connectionStatus}
                lastUpdated={lastUpdated}
                onReconnect={reconnect}
                compact={true}
              />
              <Button variant="outline" onClick={handlePrint} className="print:hidden">
                <Printer className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Print Details</span>
                <span className="sm:hidden">Print</span>
              </Button>
              {onClose && (
                <Button variant="ghost" onClick={onClose}>
                  Close
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4 space-y-6">
        {/* Customer & Order Overview */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Information */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Name</p>
                  <p className="font-medium">{order.customer_name || 'Not provided'}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Email</p>
                  <div className="flex items-center gap-2">
                    <Mail className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{order.customer_email || 'Not provided'}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Phone</p>
                  <div className="flex items-center gap-2">
                    <Phone className="h-4 w-4 text-muted-foreground" />
                    <p className="font-medium">{order.customer_phone || 'Not provided'}</p>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-muted-foreground">Order Type</p>
                  <div className="flex items-center gap-2">
                    {order.order_type === 'pickup' ? <Building2 className="h-4 w-4" /> : <Truck className="h-4 w-4" />}
                    <p className="font-medium capitalize">{order.order_type}</p>
                  </div>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Amount</p>
                  <p className="text-2xl font-bold text-primary">{formatCurrency(order.total_amount)}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Payment Status</p>
                  <Badge variant={order.payment_status === 'completed' ? 'default' : 'secondary'}>
                    {order.payment_status || 'Pending'}
                  </Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Quick Actions */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button className="w-full" variant="outline">
                <Phone className="h-4 w-4 mr-2" />
                Call Customer
              </Button>
              <Button className="w-full" variant="outline">
                <Mail className="h-4 w-4 mr-2" />
                Send Email
              </Button>
              <Button className="w-full" variant="outline">
                <ExternalLink className="h-4 w-4 mr-2" />
                View Map
              </Button>
            </CardContent>
          </Card>
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
                  <tfoot>
                    <tr className="border-t-2 font-bold">
                      <td colSpan={3} className="text-right py-3">Total:</td>
                      <td className="text-right py-3 text-primary">{formatCurrency(order.total_amount)}</td>
                    </tr>
                  </tfoot>
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
              <Timer className="h-5 w-5" />
              Fulfillment Progress
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {getTimelineSteps().map((step, index) => (
                <div key={step.id} className="flex items-center gap-4">
                  <div className="flex items-center gap-2">
                    {step.completed ? (
                      <CheckCircle2 className="h-6 w-6 text-green-600" />
                    ) : (
                      <Circle className="h-6 w-6 text-muted-foreground" />
                    )}
                    <span className={cn(
                      "font-medium",
                      step.completed ? "text-green-600" : "text-muted-foreground"
                    )}>
                      {step.label}
                    </span>
                  </div>
                  {index < getTimelineSteps().length - 1 && (
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Location & Scheduling */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {order.order_type === 'pickup' ? 'Pickup' : 'Delivery'} Location
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

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calendar className="h-5 w-5" />
                Order History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-sm font-medium">Order Created</p>
                  <p className="text-xs text-muted-foreground">{formatDateTime(order.created_at)}</p>
                </div>
                {order.updated_at && order.updated_at !== order.created_at && (
                  <div className="p-3 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium">Last Updated</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(order.updated_at)}</p>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
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