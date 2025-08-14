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
      
      {/* Enhanced Orders List - Full Width */}
      <div className="space-y-4">
        {orders.slice(0, 6).map((order) => {
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
        
        {orders.length > 6 && (
          <div className="text-center pt-4">
            <Button variant="outline" onClick={() => window.location.href = '/orders'}>
              View All Recent Orders ({orders.length})
            </Button>
          </div>
        )}
        
        {orders.length > 0 && (
          <div className="text-center pt-4">
            <Button variant="outline" onClick={() => window.location.href = '/order-summary'}>
              View Order History (30+ days old)
            </Button>
          </div>
        )}
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