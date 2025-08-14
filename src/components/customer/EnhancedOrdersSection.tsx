import React from 'react';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { useOrderDeliverySchedules } from '@/hooks/useOrderDeliverySchedules';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { EnhancedOrderCard } from '@/components/orders/EnhancedOrderCard';
import { OrderDetailsModal } from './OrderDetailsModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { ShoppingBag, AlertTriangle } from 'lucide-react';

// Loading skeleton component
const ContentSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map(i => (
      <Card key={i} className="p-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Card>
    ))}
  </div>
);

export function EnhancedOrdersSection() {
  const { data: ordersData, isLoading: ordersLoading, error: ordersError } = useCustomerOrders();
  const { handleError } = useErrorHandler();
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  
  // Debug logging for order data
  React.useEffect(() => {
    console.log('📊 EnhancedOrdersSection - Orders data:', {
      ordersData,
      loading: ordersLoading,
      error: ordersError,
      ordersCount: ordersData?.orders?.length || 0,
    });
  }, [ordersData, ordersLoading, ordersError]);
  
  // Get delivery schedules for all orders - with null safety
  const orders = React.useMemo(() => {
    if (!ordersData?.orders || !Array.isArray(ordersData.orders)) {
      console.log('⚠️ No valid orders data found');
      return [];
    }
    return ordersData.orders.filter(order => order && order.id);
  }, [ordersData]);
  
  const orderIds = React.useMemo(() => orders.map(order => order.id), [orders]);
  const { schedules } = useOrderDeliverySchedules(orderIds);

  // Handle query errors
  if (ordersError) {
    console.error('Orders query error:', ordersError);
    handleError(ordersError, 'loading orders');
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Unable to load orders</h3>
        <p className="text-gray-500 mb-4">There was a problem loading your orders. Please try again.</p>
        <Button onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      </Card>
    );
  }

  if (ordersLoading) {
    return <ContentSkeleton />;
  }

  if (orders.length === 0) {
    return (
      <Card className="p-8 text-center">
        <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
        <p className="text-gray-500 mb-4">You haven't placed any orders yet</p>
        <Button onClick={() => window.location.href = '/products'}>
          Start Shopping
        </Button>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">My Orders</h2>
        <p className="text-gray-500">Track and manage your orders</p>
      </div>
      
      <div className="flex gap-6">
        {/* Enhanced Orders List */}
        <div className="flex-1 space-y-4">
          {orders.slice(0, 3).map((order) => {
            try {
              return (
                <div 
                  key={order?.id || Math.random()}
                  onClick={() => {
                    setSelectedOrder(order);
                    setIsModalOpen(true);
                  }}
                  className="cursor-pointer transition-transform hover:scale-[1.02]"
                >
                  <EnhancedOrderCard
                    order={order}
                    deliverySchedule={schedules[order.id]}
                    showExpandedByDefault={false}
                  />
                </div>
              );
            } catch (error) {
              console.error('Error rendering order card:', error);
              return (
                <Card key={order?.id || Math.random()} className="p-6 border border-red-200">
                  <p className="text-red-600">Error loading order details</p>
                </Card>
              );
            }
          })}
          
          {orders.length > 3 && (
            <div className="text-center pt-4">
              <Button variant="outline" onClick={() => window.location.href = '/orders'}>
                View All Orders ({orders.length})
              </Button>
            </div>
          )}
        </div>

        {/* Order History Sidebar */}
        <div className="w-80 bg-white rounded-lg border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold">Order Summary</h3>
            <Button variant="ghost" size="sm" className="text-primary">
              View All
            </Button>
          </div>
          
          <div className="space-y-3">
            {orders.slice(0, 5).map((order) => {
              // Safe access to order properties
              const orderNumber = order?.order_number || 'N/A';
              const orderTime = order?.order_time ? new Date(order.order_time).toLocaleDateString() : 'N/A';
              const totalAmount = typeof order?.total_amount === 'number' ? order.total_amount : 0;
              const status = order?.status || 'unknown';
              
              return (
                <div key={order?.id || Math.random()} className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0">
                  <div>
                    <p className="font-medium text-sm">#{orderNumber}</p>
                    <p className="text-xs text-gray-500">{orderTime}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium text-sm">₦{totalAmount.toLocaleString()}</p>
                    <Badge variant={status === 'delivered' ? 'default' : 'secondary'} className="text-xs">
                      {status}
                    </Badge>
                  </div>
                </div>
              );
            })}
          </div>
          
          {orders.length > 0 && (
            <div className="mt-4 pt-4 border-t space-y-2 text-sm text-gray-600">
              <div className="flex justify-between">
                <span>Total Orders:</span>
                <span className="font-medium">{orders.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Total Spent:</span>
                <span className="font-medium">
                  ₦{orders.reduce((sum, order) => sum + (order.total_amount || 0), 0).toLocaleString()}
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      <OrderDetailsModal
        order={selectedOrder}
        deliverySchedule={selectedOrder ? schedules[selectedOrder.id] : null}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
}