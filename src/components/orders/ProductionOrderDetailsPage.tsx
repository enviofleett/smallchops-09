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
import { EnhancedItemsDisplay } from './EnhancedItemsDisplay';
import { EnhancedCommunicationLog } from './EnhancedCommunicationLog';
import { EnhancedOrderFinancials } from './EnhancedOrderFinancials';
import { EnhancedTimelineTab } from './details/EnhancedTimelineTab';

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
    const getErrorMessage = () => {
      if (!orderId) return "No order ID provided";
      if (error?.message?.includes('Order ID is required')) return "Invalid order ID format";
      if (error?.message?.includes('RPC call failed')) return "Database connection issue";
      if (error?.message?.includes('record "v_assigned_driver" is not assigned')) return "Order data loading issue - driver assignment system error";
      if (error?.message?.includes('Database error occurred')) return "Temporary database issue - please try again";
      if (!orderData?.order) return "Order not found - it may have been deleted or you may not have permission to view it";
      return `Error loading order: ${error?.message || 'Unknown error'}`;
    };

    const canRetry = error && !error?.message?.includes('not found') && orderId;

    return (
      <div className="max-w-4xl mx-auto p-4 space-y-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="space-y-3">
            <div>
              <p className="font-medium">Unable to load order details</p>
              <p className="text-sm opacity-90">{getErrorMessage()}</p>
              {orderId && (
                <p className="text-xs opacity-75 mt-2">Order ID: {orderId}</p>
              )}
            </div>
            
            {canRetry && (
              <div className="flex gap-2 pt-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={() => window.location.reload()}
                  className="flex items-center gap-2"
                >
                  <RefreshCw className="h-3 w-3" />
                  Retry
                </Button>
                {onClose && (
                  <Button variant="ghost" size="sm" onClick={onClose}>
                    Close
                  </Button>
                )}
              </div>
            )}
            
            {!canRetry && (
              <div className="pt-2">
                <Button variant="ghost" size="sm" onClick={() => window.history.back()}>
                  Go Back
                </Button>
              </div>
            )}
          </AlertDescription>
        </Alert>

        {/* Development error details */}
        {process.env.NODE_ENV === 'development' && error && (
          <Alert>
            <AlertDescription>
              <details className="space-y-2">
                <summary className="cursor-pointer font-medium">Debug Information</summary>
                <pre className="text-xs bg-muted p-3 rounded overflow-auto">
                  {JSON.stringify({ error, orderId, orderData }, null, 2)}
                </pre>
              </details>
            </AlertDescription>
          </Alert>
        )}
      </div>
    );
  }

  const { 
    order, 
    items, 
    fulfillment_info, 
    pickup_point, 
    business_settings, 
    timeline,
    communication_events,
    audit_logs,
    assigned_agent
  } = orderData;

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
        {/* Customer Information & Enhanced Financials */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                  <p className="text-sm text-muted-foreground mb-1">Customer ID</p>
                  <p className="font-mono text-sm">{order.customer_id || 'Guest Customer'}</p>
                </div>
              </div>
              
              {/* Payment Status */}
              <div className="pt-4 border-t">
                <p className="text-sm text-muted-foreground mb-2">Payment Status</p>
                <Badge 
                  variant={order.payment_status === 'completed' ? 'default' : 'secondary'}
                  className={order.payment_status === 'completed' ? 'bg-green-500' : ''}
                >
                  {order.payment_status || 'pending'}
                </Badge>
              </div>
            </CardContent>
          </Card>

          {/* Enhanced Financial Details */}
          <div className="lg:col-span-2">
            <EnhancedOrderFinancials order={order} showInternalMetrics={true} />
          </div>
        </div>

        {/* Action Center */}
        <Card>
          <CardContent className="p-6">
            <ActionCenter order={order} />
          </CardContent>
        </Card>

        {/* Enhanced Order Items Display */}
        <EnhancedItemsDisplay items={items || []} showFinancialDetails={true} />

        {/* Enhanced Timeline View */}
        <EnhancedTimelineTab 
          detailedOrderData={{
            timeline,
            audit_logs,
            communication_events,
            order
          }}
          isLoading={isLoading}
          error={error}
          order={order}
        />

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
              
              {order.order_type === 'pickup' && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Pickup Time</p>
                  <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded-lg">
                    <p className="font-medium">
                      {order.pickup_time ? format(new Date(order.pickup_time), 'PPpp') : 'Not scheduled'}
                    </p>
                  </div>
                </div>
              )}
              
              {fulfillment_info?.delivery_hours && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Delivery Window</p>
                  <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded-lg">
                    <p className="font-medium">
                      {fulfillment_info.delivery_hours.start} - {fulfillment_info.delivery_hours.end}
                      {fulfillment_info.delivery_hours.is_flexible && ' (Flexible)'}
                    </p>
                  </div>
                </div>
              )}
              
              {fulfillment_info?.special_instructions && (
                <div>
                  <p className="text-sm text-muted-foreground mb-2">Special Instructions</p>
                  <div className="p-3 bg-yellow-50 dark:bg-yellow-950/20 rounded-lg">
                    <p>{fulfillment_info.special_instructions}</p>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Assigned Agent */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Assigned Agent
              </CardTitle>
            </CardHeader>
            <CardContent>
              {assigned_agent ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <p className="font-medium">{assigned_agent.name}</p>
                      <p className="text-sm text-muted-foreground">Delivery Agent</p>
                    </div>
                  </div>
                  
                  {assigned_agent.phone && (
                    <div className="flex items-center gap-2">
                      <Phone className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{assigned_agent.phone}</span>
                    </div>
                  )}
                  
                  {assigned_agent.email && (
                    <div className="flex items-center gap-2">
                      <Mail className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{assigned_agent.email}</span>
                    </div>
                  )}

                  {(assigned_agent.vehicle_type || assigned_agent.license_plate) && (
                    <div className="mt-4 p-3 bg-muted/50 rounded-lg">
                      <p className="text-sm font-medium mb-2">Vehicle Information</p>
                      {assigned_agent.vehicle_type && (
                        <p className="text-sm">Type: {assigned_agent.vehicle_type}</p>
                      )}
                      {assigned_agent.vehicle_brand && assigned_agent.vehicle_model && (
                        <p className="text-sm">
                          Vehicle: {assigned_agent.vehicle_brand} {assigned_agent.vehicle_model}
                        </p>
                      )}
                      {assigned_agent.license_plate && (
                        <p className="text-sm">Plate: {assigned_agent.license_plate}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Truck className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-muted-foreground">No agent assigned yet</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Enhanced Communication Log */}
        <EnhancedCommunicationLog 
          events={communication_events || []} 
          isLoading={isLoading}
        />

        {/* Admin Notes & Activity Log */}
        {audit_logs && audit_logs.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Hash className="h-5 w-5" />
                Activity Log ({audit_logs.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-96 overflow-y-auto">
                {audit_logs.map((log: any) => (
                  <div key={log.id} className="flex items-start gap-3 p-3 border border-border rounded-lg">
                    <div className="flex-shrink-0 w-2 h-2 rounded-full bg-primary mt-2"></div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium text-sm">{log.message}</p>
                          <p className="text-xs text-muted-foreground">
                            {log.category} • {format(new Date(log.created_at), 'MMM dd, HH:mm')}
                          </p>
                        </div>
                        <Badge variant="outline" className="text-xs">
                          {log.action}
                        </Badge>
                      </div>
                      
                      {(log.old_values || log.new_values) && (
                        <details className="mt-2">
                          <summary className="text-xs text-muted-foreground cursor-pointer">
                            View Details
                          </summary>
                          <div className="mt-1 p-2 bg-muted/30 rounded text-xs">
                            {log.old_values && (
                              <div className="mb-1">
                                <strong>Before:</strong> {JSON.stringify(log.old_values, null, 2)}
                              </div>
                            )}
                            {log.new_values && (
                              <div>
                                <strong>After:</strong> {JSON.stringify(log.new_values, null, 2)}
                              </div>
                            )}
                          </div>
                        </details>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Notes */}
        {order.admin_notes && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Admin Notes
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-4 bg-yellow-50 dark:bg-yellow-950/20 border border-yellow-200 dark:border-yellow-800 rounded-lg">
                <pre className="whitespace-pre-wrap text-sm">{order.admin_notes}</pre>
              </div>
            </CardContent>
          </Card>
        )}

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