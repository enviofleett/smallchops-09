import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useRealTimeOrderData } from '@/hooks/useRealTimeOrderData';
import { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { ThermalPrintReceipt } from './ThermalPrintReceipt';
import { RealTimeConnectionStatus } from '@/components/common/RealTimeConnectionStatus';
import { 
  Package, 
  User, 
  MapPin, 
  Phone, 
  Mail, 
  Printer,
  RefreshCw,
  CreditCard,
  FileText,
  DollarSign
} from 'lucide-react';
import { format } from 'date-fns';
import { parseProductFeatures } from '@/utils/productFeatureParser';
import { DriverAssignmentSection } from './details/DriverAssignmentSection';
import { StatusManagementSection } from './details/StatusManagementSection';
import { useOrderPageHooks } from '@/hooks/orderPageHooks';
import { UnifiedOrder } from '@/types/unifiedOrder';
import { OrderWithItems } from '@/api/orders';

interface NewOrderDetailsModalProps {
  open: boolean;
  onClose: () => void;
  order: any;
}

export function NewOrderDetailsModal({ open, onClose, order }: NewOrderDetailsModalProps) {
  const printRef = useRef<HTMLDivElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const { data, isLoading, error, lastUpdated, connectionStatus, reconnect } = useRealTimeOrderData(
    order?.id
  );

  const { assignRiderMutation, handleStatusUpdate } = useOrderPageHooks(order?.id || '');

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Order-${order?.order_number || 'Receipt'}`,
  });

  const handleRefresh = () => {
    setRefreshTrigger(prev => prev + 1);
    reconnect();
  };

  const handleAssignDriver = async (driverId: string) => {
    await assignRiderMutation.mutateAsync({
      orderId: order.id,
      riderId: driverId
    });
  };

  if (isLoading && !data) {
    return (
      <AdaptiveDialog open={open} onOpenChange={onClose} title="Loading Order" description="Please wait">
        <div className="p-8 text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-muted-foreground" />
          <p className="text-muted-foreground">Loading order details...</p>
        </div>
      </AdaptiveDialog>
    );
  }

  if (error) {
    return (
      <AdaptiveDialog open={open} onOpenChange={onClose} title="Error" description="Failed to load order">
        <div className="p-8 text-center">
          <p className="text-destructive mb-4">Failed to load order details</p>
          <Button onClick={handleRefresh} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry
          </Button>
        </div>
      </AdaptiveDialog>
    );
  }

  const orderData = data?.order || order;
  const items = data?.items || [];
  const assignedAgent = data?.assigned_agent;

  const safeOrder: UnifiedOrder = {
    id: orderData.id || '',
    order_number: orderData.order_number || 'N/A',
    status: orderData.status || 'pending',
    order_type: orderData.order_type || 'delivery',
    customer_name: orderData.customer_name || 'N/A',
    customer_email: orderData.customer_email || 'N/A',
    customer_phone: orderData.customer_phone,
    payment_status: orderData.payment_status || 'pending',
    total_amount: orderData.total_amount || 0,
    created_at: orderData.created_at || new Date().toISOString(),
    updated_at: orderData.updated_at,
    order_time: orderData.order_time || orderData.created_at || new Date().toISOString(),
    items: items,
    delivery_address: orderData.delivery_address,
    special_instructions: orderData.special_instructions,
    subtotal: orderData.subtotal,
    tax_amount: orderData.tax_amount || orderData.vat_amount,
    delivery_fee: orderData.delivery_fee,
    discount_amount: orderData.discount_amount,
    vat_amount: orderData.vat_amount,
    payment_method: orderData.payment_method,
    payment_reference: orderData.payment_reference || orderData.paystack_reference,
    assigned_rider_id: orderData.assigned_rider_id || assignedAgent?.id,
    assigned_rider_name: assignedAgent?.name,
  };

  if (!safeOrder.id) {
    return (
      <AdaptiveDialog open={open} onOpenChange={onClose} title="Invalid Order" description="Order data is missing">
        <div className="p-8 text-center text-destructive">
          Invalid order data
        </div>
      </AdaptiveDialog>
    );
  }

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      confirmed: 'bg-blue-500',
      preparing: 'bg-indigo-500',
      ready: 'bg-purple-500',
      out_for_delivery: 'bg-orange-500',
      delivered: 'bg-green-500',
      cancelled: 'bg-red-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  const getPaymentStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      pending: 'bg-yellow-500',
      paid: 'bg-green-500',
      failed: 'bg-red-500',
      refunded: 'bg-gray-500',
    };
    return colors[status] || 'bg-gray-500';
  };

  return (
    <>
      <AdaptiveDialog 
        open={open} 
        onOpenChange={onClose}
        title={`Order #${safeOrder.order_number}`}
        description={`${safeOrder.order_type} order for ${safeOrder.customer_name}`}
        size="xl"
      >
        <div className="space-y-4 max-h-[80vh] overflow-y-auto p-6">
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b">
            <div>
              <h2 className="text-2xl font-bold">Order #{safeOrder.order_number}</h2>
              <p className="text-sm text-muted-foreground">
                {format(new Date(safeOrder.order_time), 'MMM dd, yyyy hh:mm a')}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge className={`${getStatusColor(safeOrder.status)} text-white`}>
                {safeOrder.status.replace('_', ' ').toUpperCase()}
              </Badge>
              <Button variant="outline" size="sm" onClick={handlePrint}>
                <Printer className="h-4 w-4 mr-2" />
                Print
              </Button>
              <Button variant="outline" size="sm" onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>

          <RealTimeConnectionStatus 
            connectionStatus={connectionStatus}
            lastUpdated={lastUpdated}
            onReconnect={reconnect}
            compact={true}
          />

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Customer Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{safeOrder.customer_name}</span>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm">{safeOrder.customer_email}</span>
              </div>
              {safeOrder.customer_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span className="text-sm">{safeOrder.customer_phone}</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Order Summary */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Order Summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="text-muted-foreground">Order Type:</div>
                <div className="font-medium capitalize">{safeOrder.order_type}</div>
                
                <div className="text-muted-foreground">Payment Status:</div>
                <div>
                  <Badge className={`${getPaymentStatusColor(safeOrder.payment_status)} text-white`}>
                    {safeOrder.payment_status.toUpperCase()}
                  </Badge>
                </div>
              </div>

              {safeOrder.order_type === 'delivery' && safeOrder.delivery_address && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-sm font-medium">
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                      Delivery Address
                    </div>
                    <p className="text-sm text-muted-foreground pl-6">
                      {typeof safeOrder.delivery_address === 'string' 
                        ? safeOrder.delivery_address 
                        : safeOrder.delivery_address.address_line_1}
                    </p>
                  </div>
                </>
              )}

              {safeOrder.special_instructions && (
                <>
                  <Separator />
                  <div className="space-y-1">
                    <div className="text-sm font-medium">Special Instructions</div>
                    <p className="text-sm text-muted-foreground">{safeOrder.special_instructions}</p>
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Package className="h-5 w-5" />
                Order Items
              </CardTitle>
            </CardHeader>
            <CardContent>
              {items.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No items found
                </div>
              ) : (
                <div className="space-y-3">
                  {items.map((item: any) => {
                    const features = item.product?.features 
                      ? parseProductFeatures(item.product.features)
                      : [];
                    
                    return (
                      <div key={item.id} className="flex justify-between items-start p-3 bg-muted/50 rounded-lg">
                        <div className="flex-1">
                          <div className="font-medium">
                            {item.product?.name || item.product_name || 'Unknown Product'}
                          </div>
                          {features.length > 0 && (
                            <div className="text-xs text-muted-foreground mt-1">
                              {features.join(' • ')}
                            </div>
                          )}
                          {item.special_instructions && (
                            <div className="text-xs text-muted-foreground mt-1 italic">
                              Note: {item.special_instructions}
                            </div>
                          )}
                          <div className="text-sm text-muted-foreground mt-1">
                            Qty: {item.quantity} × ₦{item.unit_price.toLocaleString()}
                          </div>
                        </div>
                        <div className="font-semibold">
                          ₦{item.total_price.toLocaleString()}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Pricing Breakdown */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <DollarSign className="h-5 w-5" />
                Pricing Breakdown
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {safeOrder.subtotal !== undefined && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Subtotal:</span>
                    <span>₦{safeOrder.subtotal.toLocaleString()}</span>
                  </div>
                )}
                {safeOrder.tax_amount !== undefined && safeOrder.tax_amount > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Tax/VAT:</span>
                    <span>₦{safeOrder.tax_amount.toLocaleString()}</span>
                  </div>
                )}
                {safeOrder.delivery_fee !== undefined && safeOrder.delivery_fee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Delivery Fee:</span>
                    <span>₦{safeOrder.delivery_fee.toLocaleString()}</span>
                  </div>
                )}
                {safeOrder.discount_amount !== undefined && safeOrder.discount_amount > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Discount:</span>
                    <span>-₦{safeOrder.discount_amount.toLocaleString()}</span>
                  </div>
                )}
                <Separator />
                <div className="flex justify-between font-bold text-lg">
                  <span>Total:</span>
                  <span>₦{safeOrder.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          {(safeOrder.payment_method || safeOrder.payment_reference) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {safeOrder.payment_method && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Method:</span>
                    <span className="font-medium capitalize">{safeOrder.payment_method}</span>
                  </div>
                )}
                {safeOrder.payment_reference && (
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Reference:</span>
                    <span className="font-mono text-xs">{safeOrder.payment_reference}</span>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {/* Driver Assignment */}
          <DriverAssignmentSection
            orderId={safeOrder.id}
            currentDriverId={safeOrder.assigned_rider_id}
            currentDriverName={safeOrder.assigned_rider_name}
            onAssignDriver={handleAssignDriver}
            isAssigning={assignRiderMutation.isPending}
          />

          {/* Status Management */}
          <StatusManagementSection
            currentStatus={safeOrder.status}
            orderId={safeOrder.id}
            updatedAt={safeOrder.updated_at}
            onUpdateStatus={handleStatusUpdate}
            isUpdating={false}
          />
        </div>
      </AdaptiveDialog>

      {/* Hidden print component */}
      <div className="hidden">
        <div ref={printRef}>
          <ThermalPrintReceipt order={safeOrder as unknown as OrderWithItems} />
        </div>
      </div>
    </>
  );
}
