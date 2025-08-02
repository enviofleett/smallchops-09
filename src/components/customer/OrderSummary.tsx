import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { ShoppingBag, Package, Clock, CheckCircle, Eye, RotateCcw } from 'lucide-react';
import { useCustomerAnalytics } from '@/hooks/useCustomerProfile';
import { format } from 'date-fns';

interface OrderSummaryProps {
  detailed?: boolean;
}

export function OrderSummary({ detailed = false }: OrderSummaryProps) {
  const { data: analytics, isLoading } = useCustomerAnalytics();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="space-y-3">
            <div className="h-4 bg-muted animate-pulse rounded" />
            <div className="h-4 bg-muted animate-pulse rounded w-2/3" />
            <div className="h-4 bg-muted animate-pulse rounded w-1/2" />
          </div>
        </CardContent>
      </Card>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'processing':
        return <Package className="w-4 h-4 text-blue-600" />;
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-600" />;
      default:
        return <ShoppingBag className="w-4 h-4 text-muted-foreground" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'default';
      case 'processing':
        return 'secondary';
      case 'pending':
        return 'outline';
      default:
        return 'secondary';
    }
  };

  if (detailed) {
    return (
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingBag className="w-5 h-5" />
              Order History
            </CardTitle>
          </CardHeader>
          <CardContent>
            {analytics?.recentOrders && analytics.recentOrders.length > 0 ? (
              <div className="space-y-4">
                {analytics.recentOrders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {getStatusIcon(order.status)}
                        <div>
                          <h4 className="font-medium">Order #{order.order_number}</h4>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(order.order_time), 'PPP')}
                          </p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="font-medium">{formatCurrency(order.total_amount)}</p>
                        <Badge variant={getStatusColor(order.status) as any}>
                          {order.status}
                        </Badge>
                      </div>
                    </div>

                    {order.order_items && order.order_items.length > 0 && (
                      <>
                        <Separator />
                        <div className="space-y-2">
                          <h5 className="text-sm font-medium">Items ({order.order_items.length})</h5>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {order.order_items.slice(0, detailed ? undefined : 3).map((item, index) => (
                              <div key={index} className="flex items-center gap-2 text-sm">
                                {item.products?.image_url && (
                                  <img
                                    src={item.products.image_url}
                                    alt={item.products.name}
                                    className="w-8 h-8 rounded object-cover"
                                  />
                                )}
                                <div className="flex-1 min-w-0">
                                  <p className="truncate">{item.products?.name}</p>
                                  <p className="text-muted-foreground">
                                    Qty: {item.quantity} × {formatCurrency(item.price)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    <div className="flex justify-end gap-2 pt-2">
                      <Button size="sm" variant="outline">
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                      {order.status === 'completed' && (
                        <Button size="sm" variant="outline">
                          <RotateCcw className="w-4 h-4 mr-2" />
                          Reorder
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <ShoppingBag className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
                <p className="text-muted-foreground mb-4">
                  Start shopping to see your order history here.
                </p>
                <Button>Start Shopping</Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShoppingBag className="w-5 h-5" />
          Recent Orders
        </CardTitle>
      </CardHeader>
      <CardContent>
        {analytics?.recentOrders && analytics.recentOrders.length > 0 ? (
          <div className="space-y-3">
            {analytics.recentOrders.slice(0, 3).map((order) => (
              <div key={order.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex items-center gap-3">
                  {getStatusIcon(order.status)}
                  <div>
                    <p className="font-medium">#{order.order_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {format(new Date(order.order_time), 'MMM d, yyyy')}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium">{formatCurrency(order.total_amount)}</p>
                  <Badge variant={getStatusColor(order.status) as any} className="text-xs">
                    {order.status}
                  </Badge>
                </div>
              </div>
            ))}
            
            <Separator />
            
            <div className="text-center">
              <Button variant="outline" size="sm">
                View All Orders
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-center py-6">
            <ShoppingBag className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-1">No orders yet</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Start shopping to see your orders here.
            </p>
            <Button size="sm">Browse Products</Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}