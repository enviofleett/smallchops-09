import React from 'react';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { useOrderDeliverySchedules } from '@/hooks/useOrderDeliverySchedules';
import { usePickupPoint } from '@/hooks/usePickupPoints';
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
  
  // Debug logging to see if schedule data exists
  React.useEffect(() => {
    console.log('💫 Schedule data:', { schedules, selectedOrder });
  }, [schedules, selectedOrder]);
  
  // Get pickup point for selected order if it's a pickup order
  const { data: pickupPoint } = usePickupPoint(
    selectedOrder?.order_type === 'pickup' ? selectedOrder?.pickup_point_id : undefined
  );

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
      
      {/* Order summary stats positioned immediately after title */}
      {orders.length > 0 && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-bold text-primary">
                {orders.length}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">Total Orders</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-bold text-primary">
                ₦{orders.reduce((sum, order) => sum + (order.total_amount || 0), 0).toLocaleString()}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">Total Spent</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-bold text-green-600">
                {orders.filter(order => order.status === 'delivered').length}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">Delivered</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-bold text-orange-600">
                {orders.filter(order => ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status)).length}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">In Progress</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile-first responsive orders list */}
      <div className="space-y-4">
        {orders.slice(0, 10).map((order) => {
          try {
            return (
              <div 
                key={order?.id || Math.random()}
                onClick={() => {
                  setSelectedOrder(order);
                  setIsModalOpen(true);
                }}
                className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
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
              <Card key={order?.id || Math.random()} className="p-4 sm:p-6 border border-red-200">
                <p className="text-red-600 text-sm">Error loading order details</p>
              </Card>
            );
          }
        })}
        
        {orders.length > 10 && (
          <div className="text-center pt-4">
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/orders'}
              className="w-full sm:w-auto"
            >
              View All Orders ({orders.length})
            </Button>
          </div>
        )}
      </div>

      <OrderDetailsModal
        order={selectedOrder}
        deliverySchedule={selectedOrder ? schedules[selectedOrder.id] : null}
        pickupPoint={pickupPoint}
        isOpen={isModalOpen}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
}