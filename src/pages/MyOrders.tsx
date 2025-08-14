import React, { useState, useEffect, Suspense } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Clock, Package, MapPin, Eye, AlertCircle, Loader2 } from 'lucide-react';
import { useOrderSummary, OrderWithDetails } from '@/hooks/useOrderSummary';
import { OrderDetailsModal } from '@/components/customer/OrderDetailsModal';
import { OrderListErrorBoundary } from '@/components/customer/OrderListErrorBoundary';
import { ErrorFallback } from '@/components/ErrorFallback';
import { Skeleton } from '@/components/ui/skeleton';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// Loading Skeleton Component
const OrderCardSkeleton = () => (
  <Card className="w-full">
    <CardHeader className="pb-3">
      <div className="flex justify-between items-start">
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-6 w-20" />
      </div>
    </CardHeader>
    <CardContent>
      <div className="space-y-3">
        <div className="space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <div className="flex justify-between items-center pt-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-8 w-24" />
        </div>
      </div>
    </CardContent>
  </Card>
);

// Single Order Card Component
const OrderCard: React.FC<{ 
  order: OrderWithDetails; 
  onViewDetails: (order: OrderWithDetails) => void;
}> = ({ order, onViewDetails }) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
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

  return (
    <Card className="w-full hover:shadow-md transition-shadow">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-lg">{order.order_number}</CardTitle>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Clock className="h-4 w-4" />
              {formatDateTime(order.order_time)}
            </div>
          </div>
          <Badge className={getStatusColor(order.status)} variant="secondary">
            {order.status.replace('_', ' ').toUpperCase()}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {order.order_items?.length || 0} item{(order.order_items?.length || 0) !== 1 ? 's' : ''}
              </span>
            </div>
            {order.delivery_address && (
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                <span className="text-sm text-muted-foreground line-clamp-2">
                  {order.delivery_address.address_line_1}, {order.delivery_address.city}
                </span>
              </div>
            )}
          </div>
          <div className="flex justify-between items-center pt-2 border-t">
            <div className="text-lg font-semibold text-primary">
              {formatCurrency(order.total_amount)}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewDetails(order)}
              className="flex items-center gap-2"
            >
              <Eye className="h-4 w-4" />
              View Details
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

// Main Orders List Component
const OrdersList: React.FC = () => {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithDetails | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalOrder, setModalOrder] = useState<any>(null);

  const { orders, isLoading, isError, error, refetch } = useOrderSummary({
    page: 1,
    limit: 50
  });

  // Enhanced order fetching for modal
  const handleViewDetails = async (order: OrderWithDetails) => {
    try {
      console.log('🔍 Fetching detailed order data for:', order.id);
      setSelectedOrder(order);
      
      // Get detailed order data
      const { data: detailedOrder, error: detailError } = await supabase
        .rpc('get_detailed_order_with_products', {
          p_order_id: order.id
        });

      if (detailError) {
        console.error('❌ Error fetching detailed order:', detailError);
        // Fallback to basic order data
        setModalOrder({
          ...order,
          order_type: 'delivery', // Default to delivery
          order_items: order.order_items || []
        });
      } else if (detailedOrder && typeof detailedOrder === 'object' && 'order' in detailedOrder) {
        console.log('✅ Detailed order data loaded:', detailedOrder);
        setModalOrder((detailedOrder as any).order || order);
      } else {
        // Fallback to basic order data
        setModalOrder({
          ...order,
          order_type: 'delivery',
          order_items: order.order_items || []
        });
      }
      
      setIsModalOpen(true);
    } catch (error) {
      console.error('❌ Critical error in handleViewDetails:', error);
      toast.error('Failed to load order details');
      
      // Still show modal with basic data
      setModalOrder({
        ...order,
        order_type: 'delivery',
        order_items: order.order_items || []
      });
      setIsModalOpen(true);
    }
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setSelectedOrder(null);
    setModalOrder(null);
  };

  if (isError) {
    return (
      <ErrorFallback
        message="Unable to load your orders"
        error={error}
        onRetry={refetch}
        showDetails={false}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">My Orders</h1>
          <p className="text-muted-foreground">Track and manage your recent orders</p>
        </div>
        {!isLoading && (
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Refresh'}
          </Button>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
          {[...Array(6)].map((_, i) => (
            <OrderCardSkeleton key={i} />
          ))}
        </div>
      ) : orders.length === 0 ? (
        <Card className="text-center py-12">
          <CardContent>
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No orders found</h3>
            <p className="text-muted-foreground mb-4">
              You haven't placed any orders recently. Start shopping to see your orders here.
            </p>
            <Button onClick={() => window.location.href = '/'}>
              Start Shopping
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
          {orders.map((order) => (
            <OrderCard
              key={order.id}
              order={order}
              onViewDetails={handleViewDetails}
            />
          ))}
        </div>
      )}

      {modalOrder && (
        <OrderDetailsModal
          order={modalOrder}
          isOpen={isModalOpen}
          onClose={handleCloseModal}
        />
      )}
    </div>
  );
};

// Main Page Component with Error Boundary
const MyOrders: React.FC = () => {
  // Check authentication status
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const { data: { user }, error } = await supabase.auth.getUser();
        
        if (error) {
          console.error('❌ Auth check error:', error);
          setIsAuthenticated(false);
          return;
        }
        
        setIsAuthenticated(!!user);
      } catch (error) {
        console.error('❌ Critical auth error:', error);
        setIsAuthenticated(false);
      }
    };

    checkAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      setIsAuthenticated(!!session?.user);
    });

    return () => subscription.unsubscribe();
  }, []);

  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="flex items-center gap-2">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Checking authentication...</span>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Card className="text-center py-12">
        <CardContent>
          <AlertCircle className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">Authentication Required</h3>
          <p className="text-muted-foreground mb-4">
            Please sign in to view your orders.
          </p>
          <Button onClick={() => window.location.href = '/auth'}>
            Sign In
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <OrderListErrorBoundary>
      <div className="container mx-auto px-4 py-8">
        <Suspense fallback={
          <div className="space-y-6">
            <div className="space-y-2">
              <Skeleton className="h-8 w-48" />
              <Skeleton className="h-4 w-64" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-1">
              {[...Array(6)].map((_, i) => (
                <OrderCardSkeleton key={i} />
              ))}
            </div>
          </div>
        }>
          <OrdersList />
        </Suspense>
      </div>
    </OrderListErrorBoundary>
  );
};

export default MyOrders;