import { useEffect, useState, useCallback } from 'react';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import ProductionOrdersErrorBoundary from './ProductionOrdersErrorBoundary';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RefreshCw, ShoppingBag, Clock, CheckCircle } from 'lucide-react';

interface ProcessedOrder {
  id: string;
  order_number?: string;
  customer_email: string;
  created_at: string;
  order_time?: string;
  status: string;
  payment_status?: string;
  total_amount?: number;
  order_items?: Array<{
    id: string;
    product_name: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
}

function OrdersContent() {
  const { user, session, isAuthenticated } = useCustomerAuth();
  const ordersQuery = useCustomerOrders();
  
  const [mounted, setMounted] = useState(false);
  const [realtimeConnected, setRealtimeConnected] = useState(false);

  // Prevent hydration issues
  useEffect(() => {
    setMounted(true);
  }, []);

  // Monitor realtime connection status
  useEffect(() => {
    if (!isAuthenticated || !user?.email) return;

    // Listen for realtime connection status
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        ordersQuery.refetch();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isAuthenticated, user?.email, ordersQuery]);

  const handleManualRefresh = useCallback(() => {
    ordersQuery.refetch();
  }, [ordersQuery]);

  const formatOrderDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return 'bg-success/10 text-success border-success/20';
      case 'confirmed':
      case 'preparing':
      case 'ready':
        return 'bg-warning/10 text-warning border-warning/20';
      case 'pending':
        return 'bg-info/10 text-info border-info/20';
      case 'cancelled':
      case 'refunded':
        return 'bg-destructive/10 text-destructive border-destructive/20';
      default:
        return 'bg-muted/10 text-muted-foreground border-muted/20';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status.toLowerCase()) {
      case 'completed':
      case 'delivered':
        return <CheckCircle className="h-3 w-3" />;
      case 'pending':
        return <Clock className="h-3 w-3" />;
      default:
        return null;
    }
  };

  // Don't render until mounted
  if (!mounted) {
    return null;
  }

  if (ordersQuery.isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        <span className="ml-3 text-muted-foreground">Loading your orders...</span>
      </div>
    );
  }

  if (ordersQuery.error) {
    return (
      <div className="text-center p-8 bg-destructive/5 border border-destructive/20 rounded-lg">
        <div className="text-destructive mb-4">
          <ShoppingBag className="mx-auto h-12 w-12 mb-2" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">Unable to load orders</h3>
        <p className="text-muted-foreground mb-4 max-w-md mx-auto">
          {ordersQuery.error instanceof Error ? ordersQuery.error.message : 'An unexpected error occurred'}
        </p>
        <p className="text-sm text-muted-foreground mb-6">Customer: {user?.email}</p>
        
        <div className="flex items-center justify-center mb-4 text-sm">
          <div className={`w-2 h-2 rounded-full mr-2 ${realtimeConnected ? 'bg-success' : 'bg-destructive'}`}></div>
          <span className="text-muted-foreground">
            Real-time: {realtimeConnected ? 'Connected' : 'Disconnected'}
          </span>
        </div>
        
        <div className="space-x-4">
          <Button onClick={handleManualRefresh} className="flex items-center">
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
          <Button variant="outline" onClick={() => window.location.reload()}>
            Refresh Page
          </Button>
        </div>
      </div>
    );
  }

  const orders: ProcessedOrder[] = ordersQuery.data?.orders || [];

  if (orders.length === 0) {
    return (
      <Card className="max-w-2xl mx-auto">
        <CardContent className="text-center p-8">
          <ShoppingBag className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-medium text-foreground mb-2">No orders yet</h3>
          <p className="text-muted-foreground mb-6">You haven't placed any orders yet.</p>
          <Button asChild>
            <a href="/shop">Start Shopping</a>
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="orders-section space-y-6">
      <div className="flex justify-between items-center">
        <div className="flex items-center space-x-4">
          <h3 className="text-xl font-semibold text-foreground">My Orders ({orders.length})</h3>
          {realtimeConnected && (
            <Badge variant="outline" className="text-xs bg-success/10 text-success border-success/20">
              <div className="w-1.5 h-1.5 bg-success rounded-full mr-1 animate-pulse"></div>
              Live Updates
            </Badge>
          )}
        </div>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={handleManualRefresh}
          disabled={ordersQuery.isFetching}
          className="flex items-center"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${ordersQuery.isFetching ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>
      
      {orders.map((order) => (
        <Card key={order.id} className="hover:shadow-md transition-shadow">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <CardTitle className="text-base">
                  Order #{(order.order_number || order.id).slice(0, 8).toUpperCase()}
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  {formatOrderDate(order.order_time || order.created_at)}
                </p>
              </div>
              <Badge 
                variant="outline" 
                className={`${getStatusColor(order.status)} flex items-center gap-1`}
              >
                {getStatusIcon(order.status)}
                {order.status.charAt(0).toUpperCase() + order.status.slice(1)}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent>
            {order.order_items && order.order_items.length > 0 && (
              <div className="mb-4">
                <h5 className="text-sm font-medium text-foreground mb-2">Items:</h5>
                <div className="space-y-1">
                  {order.order_items.map((item) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">
                        {item.product_name} × {item.quantity}
                      </span>
                      <span className="font-medium">
                        ₦{(item.total_price || (item.unit_price * item.quantity)).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            <div className="flex justify-between items-center pt-4 border-t border-border">
              <div className="flex items-center space-x-4">
                <span className="text-sm font-medium text-foreground">Total</span>
                {order.payment_status && (
                  <Badge 
                    variant="outline" 
                    className={`text-xs ${
                      order.payment_status === 'paid' 
                        ? 'bg-success/10 text-success border-success/20' 
                        : 'bg-warning/10 text-warning border-warning/20'
                    }`}
                  >
                    {order.payment_status === 'paid' ? 'Paid' : 'Pending Payment'}
                  </Badge>
                )}
              </div>
              <span className="text-lg font-bold text-foreground">
                ₦{(order.total_amount || 0).toLocaleString()}
              </span>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function OrdersSection() {
  const { user } = useCustomerAuth();
  
  return (
    <ProductionOrdersErrorBoundary customerEmail={user?.email}>
      <OrdersContent />
    </ProductionOrdersErrorBoundary>
  );
}