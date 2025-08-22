import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, Package, Heart, Calendar, DollarSign, ShoppingCart } from 'lucide-react';
import { CustomerAnalytics, getCustomerOrderHistory } from '@/api/purchaseHistory';
import { OrderWithItems } from '@/api/orders';
import { useToast } from '@/hooks/use-toast';

interface PurchaseAnalyticsTabProps {
  customerEmail: string;
  analytics: CustomerAnalytics | null;
}

interface ProductFrequency {
  product_name: string;
  count: number;
  total_spent: number;
}

interface MonthlySpending {
  month: string;
  amount: number;
  orders: number;
}

export function PurchaseAnalyticsTab({ customerEmail, analytics }: PurchaseAnalyticsTabProps) {
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [topProducts, setTopProducts] = useState<ProductFrequency[]>([]);
  const [monthlySpending, setMonthlySpending] = useState<MonthlySpending[]>([]);
  const [recentOrders, setRecentOrders] = useState<OrderWithItems[]>([]);

  useEffect(() => {
    const fetchAnalyticsData = async () => {
      try {
        setLoading(true);
        
        // Fetch all customer orders for analytics
        const { orders } = await getCustomerOrderHistory(customerEmail, { 
          pageSize: 100,
          status: 'delivered' 
        });
        
        // Calculate top products
        const productMap = new Map<string, ProductFrequency>();
        orders.forEach(order => {
          order.order_items?.forEach(item => {
            const existing = productMap.get(item.product_name);
            if (existing) {
              existing.count += item.quantity;
              existing.total_spent += Number(item.total_price);
            } else {
              productMap.set(item.product_name, {
                product_name: item.product_name,
                count: item.quantity,
                total_spent: Number(item.total_price)
              });
            }
          });
        });
        
        const sortedProducts = Array.from(productMap.values())
          .sort((a, b) => b.count - a.count)
          .slice(0, 5);
        setTopProducts(sortedProducts);
        
        // Calculate monthly spending
        const monthlyMap = new Map<string, MonthlySpending>();
        orders.forEach(order => {
          const date = new Date(order.order_time);
          const monthKey = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}`;
          const monthName = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
          
          const existing = monthlyMap.get(monthKey);
          if (existing) {
            existing.amount += Number(order.total_amount);
            existing.orders += 1;
          } else {
            monthlyMap.set(monthKey, {
              month: monthName,
              amount: Number(order.total_amount),
              orders: 1
            });
          }
        });
        
        const sortedMonthly = Array.from(monthlyMap.values())
          .sort((a, b) => new Date(b.month).getTime() - new Date(a.month).getTime())
          .slice(0, 6);
        setMonthlySpending(sortedMonthly);
        
        // Get recent orders
        setRecentOrders(orders.slice(0, 5));
        
      } catch (error) {
        console.error('Error fetching analytics data:', error);
        toast({
          title: "Error",
          description: "Failed to load analytics data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (customerEmail) {
      fetchAnalyticsData();
    }
  }, [customerEmail, toast]);

  if (loading) {
    return (
      <div className="text-center py-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
        <p className="mt-2 text-muted-foreground">Loading analytics...</p>
      </div>
    );
  }

  if (!analytics) {
    return (
      <Card>
        <CardContent className="text-center py-8">
          <TrendingUp className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Analytics Available</h3>
          <p className="text-muted-foreground">
            Complete your first order to see purchase analytics.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Overview Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Purchase Frequency</p>
                <p className="text-lg font-semibold">
                  {analytics.total_orders > 0 && analytics.last_purchase_date
                    ? `${Math.round(analytics.total_orders / 12)} orders/month`
                    : 'No data'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Heart className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Favorite Category</p>
                <p className="text-lg font-semibold">
                  {analytics.favorite_category?.name || 'No preference'}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <DollarSign className="h-5 w-5 text-primary" />
              <div>
                <p className="text-sm text-muted-foreground">Customer Since</p>
                <p className="text-lg font-semibold">
                  {analytics.last_purchase_date
                    ? new Date(analytics.last_purchase_date).getFullYear()
                    : 'New'
                  }
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Top Products */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Package className="h-5 w-5" />
            Most Ordered Products
          </CardTitle>
        </CardHeader>
        <CardContent>
          {topProducts.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No product data available
            </p>
          ) : (
            <div className="space-y-3">
              {topProducts.map((product, index) => (
                <div key={product.product_name} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary">#{index + 1}</Badge>
                    <div>
                      <p className="font-medium">{product.product_name}</p>
                      <p className="text-sm text-muted-foreground">
                        Ordered {product.count} times
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${product.total_spent.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">Total spent</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Monthly Spending */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Calendar className="h-5 w-5" />
            Monthly Spending Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          {monthlySpending.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No spending data available
            </p>
          ) : (
            <div className="space-y-3">
              {monthlySpending.map((month) => (
                <div key={month.month} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{month.month}</p>
                    <p className="text-sm text-muted-foreground">
                      {month.orders} order{month.orders !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${month.amount.toFixed(2)}</p>
                    <p className="text-sm text-muted-foreground">
                      ${(month.amount / month.orders).toFixed(2)} avg
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Orders Summary */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" />
            Recent Order Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {recentOrders.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">
              No recent orders available
            </p>
          ) : (
            <div className="space-y-3">
              {recentOrders.map((order) => (
                <div key={order.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div>
                    <p className="font-medium">{order.order_number}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(order.order_time).toLocaleDateString()} • 
                      {order.order_items?.length || 0} item{(order.order_items?.length || 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">${order.total_amount}</p>
                    <Badge variant="secondary">{order.status}</Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}