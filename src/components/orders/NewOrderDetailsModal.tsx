import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { format } from 'date-fns';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { ThermalPrintReceipt } from './ThermalPrintReceipt';
import { DeliveryPickupSection } from '../modals/orderDetails/DeliveryPickupSection';
import { OrderWithItems } from '@/api/orders';
import { useRealTimeOrderData } from '@/hooks/useRealTimeOrderData';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useUserContext } from '@/hooks/useUserContext';
import { safeOrder } from '@/utils/orderDefensiveValidation';

interface NewOrderDetailsModalProps {
  open: boolean;
  onClose: () => void;
  order: any;
}

export const NewOrderDetailsModal: React.FC<NewOrderDetailsModalProps> = ({
  open,
  onClose,
  order
}) => {
  const userContext = useUserContext();
  const printRef = useRef<HTMLDivElement>(null);
  const thermalPrintRef = useRef<HTMLDivElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { data: businessSettings } = useBusinessSettings();

  // Fetch real-time order data
  const {
    data: detailedOrderData,
    isLoading: isLoadingDetailed,
    error,
    lastUpdated,
    connectionStatus,
    reconnect
  } = useRealTimeOrderData(order?.id);

  const handlePrint = useReactToPrint({
    contentRef: thermalPrintRef,
    documentTitle: `Order-${order?.order_number || 'Details'}`,
  });

  const handleRefresh = () => {
    reconnect();
    setRefreshTrigger(prev => prev + 1);
  };

  // Show error state if no order provided
  if (!order) {
    return (
      <AdaptiveDialog
        open={open}
        onOpenChange={onClose}
        size="sm"
        title="Order Not Found"
        description="Order details are not available"
      >
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No order data provided.</p>
          <Button onClick={onClose} className="mt-4">Close</Button>
        </div>
      </AdaptiveDialog>
    );
  }

  // Use detailed order data if available, otherwise fall back to basic order data
  const rawOrderData = detailedOrderData?.order || order;
  const rawOrderItems = detailedOrderData?.items || order.order_items || order.items || [];
  const fulfillmentInfo = detailedOrderData?.fulfillment_info || order.fulfillment_info || {};

  // Defensive logging for debugging structure
  console.log("Order item debug", rawOrderItems, rawOrderData);

  // Normalize order items - ensure .product is always present, even if nested under .products array
  const normalizedOrderItems = rawOrderItems.map((item: any) => ({
    ...item,
    product: item.product || (Array.isArray(item.products) ? item.products[0] : item.products)
  }));

  // Defensive validation - always provide both .items and .order_items for downstream
  const safeOrderData = safeOrder({
    ...rawOrderData,
    items: normalizedOrderItems,
    order_items: normalizedOrderItems
  });
  
  if (!safeOrderData) {
    return (
      <AdaptiveDialog
        open={open}
        onOpenChange={onClose}
        size="lg"
        title="Order Details"
        description="Unable to load order"
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Invalid order data</p>
                <p className="text-sm text-muted-foreground">
                  The order data is corrupted or missing. Please try refreshing the page.
                </p>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => window.location.reload()}
              >
                Refresh
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </AdaptiveDialog>
    );
  }

  // Use the validated safe order data for rendering
  const orderData = safeOrderData;
  const orderItems = safeOrderData.items;

  // Show loading state
  if (isLoadingDetailed && !orderData) {
    return (
      <AdaptiveDialog
        open={open}
        onOpenChange={onClose}
        size="lg"
        title="Loading Order Details..."
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading order details...</span>
        </div>
      </AdaptiveDialog>
    );
  }

  const isAdmin = userContext === 'admin';
  const isCustomer = userContext === 'customer';

  return (
    <>
      {/* Hidden thermal print component */}
      <div style={{ display: 'none' }}>
        <div ref={thermalPrintRef}>
          <ThermalPrintReceipt
            order={orderData as unknown as OrderWithItems}
            businessInfo={businessSettings}
          />
        </div>
      </div>

      <AdaptiveDialog
        open={open}
        onOpenChange={onClose}
        size="xl"
        title={`Order #${orderData.order_number}`}
        description={`${orderData.order_type === 'delivery' ? 'Delivery' : 'Pickup'} order for ${orderData.customer_name}`}
      >
        <div className="space-y-6">
          {/* Action buttons */}
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handlePrint}>
              Print Receipt
            </Button>
            <Button variant="outline" size="sm" onClick={handleRefresh}>
              Refresh
            </Button>
          </div>
          {/* Connection status */}
          {connectionStatus !== 'connected' && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Connection status: {connectionStatus}
              </AlertDescription>
            </Alert>
          )}

          {/* Order Items */}
          <Card>
            <CardHeader>
              <CardTitle>Order Items</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {orderItems.map((item: any) => (
                  <div key={item.id} className="flex justify-between items-start">
                    <div className="flex-1">
                      <p className="font-medium">{item.product?.name || 'Unknown Product'}</p>
                      <p className="text-sm text-muted-foreground">
                        Quantity: {item.quantity}
                      </p>
                    </div>
                    <p className="font-medium">
                      ₦{((item.unit_price || 0) * (item.quantity || 1)).toLocaleString()}
                    </p>
                  </div>
                ))}
                <div className="border-t pt-4 flex justify-between items-center font-bold">
                  <span>Total</span>
                  <span>₦{orderData.total_amount.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Delivery/Pickup Information */}
          <DeliveryPickupSection order={orderData} />

          {/* Customer Information */}
          <Card>
            <CardHeader>
              <CardTitle>Customer Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Name:</span>
                  <span className="font-medium">{orderData.customer_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Email:</span>
                  <span className="font-medium">{orderData.customer_email}</span>
                </div>
                {orderData.customer_phone && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Phone:</span>
                    <span className="font-medium">{orderData.customer_phone}</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Order Status */}
          <Card>
            <CardHeader>
              <CardTitle>Order Status</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Status:</span>
                  <span className="font-medium capitalize">{orderData.status.replace(/_/g, ' ')}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Payment:</span>
                  <span className="font-medium capitalize">{orderData.payment_status}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span className="font-medium">{format(new Date(orderData.created_at), 'PPp')}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </AdaptiveDialog>
    </>
  );
};
