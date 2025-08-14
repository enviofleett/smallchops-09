import React from 'react';
import { useCustomerOrdersFixed } from '@/hooks/useCustomerOrdersFixed';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Package, RefreshCw, AlertCircle, ShoppingCart } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import ErrorBoundary from '@/components/ErrorBoundary';

interface Props {
  customerEmail?: string;
}

const OrderStatusBadge = ({ status }: { status: string }) => {
  const statusConfig = {
    pending: { color: 'bg-yellow-100 text-yellow-800 border-yellow-200', label: 'Pending' },
    confirmed: { color: 'bg-blue-100 text-blue-800 border-blue-200', label: 'Confirmed' },
    preparing: { color: 'bg-purple-100 text-purple-800 border-purple-200', label: 'Preparing' },
    ready: { color: 'bg-green-100 text-green-800 border-green-200', label: 'Ready' },
    out_for_delivery: { color: 'bg-orange-100 text-orange-800 border-orange-200', label: 'Out for Delivery' },
    delivered: { color: 'bg-gray-100 text-gray-800 border-gray-200', label: 'Delivered' },
    cancelled: { color: 'bg-red-100 text-red-800 border-red-200', label: 'Cancelled' }
  };

  const config = statusConfig[status as keyof typeof statusConfig] || statusConfig.pending;
  
  return (
    <Badge className={`${config.color} border`}>
      {config.label}
    </Badge>
  );
};

const PaymentStatusBadge = ({ status }: { status: string }) => {
  const config = {
    pending: { color: 'bg-yellow-50 text-yellow-700 border-yellow-200', label: 'Payment Pending' },
    paid: { color: 'bg-green-50 text-green-700 border-green-200', label: 'Paid' },
    failed: { color: 'bg-red-50 text-red-700 border-red-200', label: 'Payment Failed' }
  };

  const paymentConfig = config[status as keyof typeof config] || config.pending;
  
  return (
    <Badge variant="outline" className={`${paymentConfig.color} border`}>
      {paymentConfig.label}
    </Badge>
  );
};

const OrderCard = ({ order }: { order: any }) => {
  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid date';
    }
  };

  const formatCurrency = (amount: number) => {
    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: 'NGN'
      }).format(amount || 0);
    } catch {
      return `₦${(amount || 0).toFixed(2)}`;
    }
  };

  return (
    <Card className="mb-4 hover:shadow-md transition-all duration-200 border border-border">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start">
          <div className="space-y-1">
            <CardTitle className="text-lg font-semibold text-foreground">
              Order #{order.order_number}
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {formatDate(order.created_at)}
            </p>
          </div>
          <div className="text-right space-y-2">
            <div className="flex flex-col space-y-1">
              <OrderStatusBadge status={order.status} />
              <PaymentStatusBadge status={order.payment_status} />
            </div>
            <p className="text-lg font-bold text-foreground">
              {formatCurrency(order.total_amount)}
            </p>
          </div>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {/* Order Items */}
        {order.order_items && order.order_items.length > 0 ? (
          <div className="space-y-3">
            <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
              Items Ordered ({order.order_items.length})
            </h4>
            <div className="space-y-2">
              {order.order_items.slice(0, 3).map((item: any, index: number) => (
                <div key={item.id || index} className="flex justify-between items-center py-2 border-b border-border last:border-b-0">
                  <div className="flex items-center space-x-3">
                    {item.product?.image_url && (
                      <img 
                        src={item.product.image_url} 
                        alt={item.product_name}
                        className="w-10 h-10 object-cover rounded border"
                        onError={(e) => {
                          (e.target as HTMLImageElement).style.display = 'none';
                        }}
                      />
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium text-sm text-foreground truncate">
                        {item.product_name}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                      </p>
                    </div>
                  </div>
                  <p className="font-medium text-sm text-foreground">
                    {formatCurrency(item.total_price)}
                  </p>
                </div>
              ))}
              
              {order.order_items.length > 3 && (
                <p className="text-xs text-muted-foreground text-center py-2">
                  +{order.order_items.length - 3} more items
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center py-4 text-muted-foreground">
            <Package className="h-5 w-5 mr-2" />
            <span className="text-sm">No items found for this order</span>
          </div>
        )}

        {/* Delivery Information */}
        {order.delivery_address && (
          <div className="pt-3 border-t border-border">
            <p className="text-sm text-muted-foreground">
              <strong className="text-foreground">Delivery Address:</strong> {order.delivery_address}
            </p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex space-x-2 pt-2">
          <Button variant="outline" size="sm" className="flex-1">
            View Details
          </Button>
          {order.status === 'delivered' && (
            <Button variant="outline" size="sm" className="flex-1">
              <ShoppingCart className="h-4 w-4 mr-1" />
              Reorder
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

const OrdersListContent = ({ customerEmail }: Props) => {
  const { data: orders, isLoading, error, refetch } = useCustomerOrdersFixed(customerEmail);

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground">Loading your orders...</p>
        <p className="text-xs text-muted-foreground mt-2">This may take a moment</p>
      </div>
    );
  }

  if (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
    
    return (
      <Alert variant="destructive" className="mb-6">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription className="flex items-center justify-between">
          <div className="flex-1">
            <p className="font-medium">Unable to load orders</p>
            <p className="text-xs mt-1">Error: {errorMessage}</p>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={() => refetch()}
            className="ml-4 shrink-0"
          >
            <RefreshCw className="h-4 w-4 mr-1" />
            Retry
          </Button>
        </AlertDescription>
      </Alert>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="mx-auto mb-4 p-4 bg-muted rounded-full w-fit">
          <Package className="h-12 w-12 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium text-foreground mb-2">No orders yet</h3>
        <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
          You haven't placed any orders yet. Start shopping to see your orders here.
        </p>
        <Button className="bg-primary text-primary-foreground hover:bg-primary/90">
          <ShoppingCart className="h-4 w-4 mr-2" />
          Start Shopping
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-foreground">My Orders</h2>
          <p className="text-sm text-muted-foreground mt-1">
            {orders.length} order{orders.length !== 1 ? 's' : ''} found
          </p>
        </div>
        <Button variant="outline" onClick={() => refetch()} size="sm">
          <RefreshCw className="h-4 w-4 mr-2" />
          Refresh
        </Button>
      </div>
      
      <div className="space-y-4">
        {orders.map((order) => (
          <OrderCard key={order.id} order={order} />
        ))}
      </div>
    </div>
  );
};

export const ProductionOrdersList: React.FC<Props> = ({ customerEmail }) => {
  return (
    <ErrorBoundary
      fallback={
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <p className="font-medium">Orders component failed to load</p>
            <p className="text-xs mt-1">Please refresh the page and try again.</p>
          </AlertDescription>
        </Alert>
      }
    >
      <OrdersListContent customerEmail={customerEmail} />
    </ErrorBoundary>
  );
};

export default ProductionOrdersList;