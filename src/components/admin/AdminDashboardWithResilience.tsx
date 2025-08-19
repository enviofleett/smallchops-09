import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useDashboardResilience } from '@/hooks/useAdminResilience';
import { supabaseSafe } from '@/utils/supabase-safe-operations';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2 } from 'lucide-react';

interface DashboardStats {
  totalOrders: number;
  totalRevenue: number;
  totalCustomers: number;
  recentOrders: any[];
}

// Example of how to use resilient patterns in admin components
export const AdminDashboardWithResilience = () => {
  // Use resilient query patterns
  const dashboardQuery = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: async (): Promise<DashboardStats> => {
      // Use safe operations instead of direct supabase calls
      const [ordersResult, customersResult] = await Promise.allSettled([
        supabaseSafe.getMany('orders', 
          (query) => query.select('*').order('created_at', { ascending: false }).limit(10),
          { fallbackData: [] }
        ),
        supabaseSafe.getMany('customer_accounts',
          (query) => query.select('id').limit(1000),
          { fallbackData: [] }
        )
      ]);

      // Extract data safely
      const orders = ordersResult.status === 'fulfilled' ? ordersResult.value.data || [] : [];
      const customers = customersResult.status === 'fulfilled' ? customersResult.value.data || [] : [];

      // Calculate stats with fallbacks
      const totalRevenue = orders.reduce((sum: number, order: any) => {
        const amount = parseFloat(order?.total_amount || '0');
        return sum + (isNaN(amount) ? 0 : amount);
      }, 0);

      return {
        totalOrders: orders.length,
        totalRevenue: totalRevenue,
        totalCustomers: Array.isArray(customers) ? customers.length : 0,
        recentOrders: Array.isArray(orders) ? orders.slice(0, 5) : []
      };
    },
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchInterval: 5 * 60 * 1000, // Refresh every 5 minutes
  });

  // Apply resilience patterns
  const resilientDashboard = useDashboardResilience(dashboardQuery, {
    fallbackData: {
      totalOrders: 0,
      totalRevenue: 0,
      totalCustomers: 0,
      recentOrders: []
    },
    showToast: true
  });

  if (resilientDashboard.isLoading && !resilientDashboard.data) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  if (resilientDashboard.isError && !resilientDashboard.data) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load dashboard data. Please refresh the page or contact support if the issue persists.
        </AlertDescription>
      </Alert>
    );
  }

  const stats = resilientDashboard.data!;

  return (
    <div className="space-y-6">
      {/* Show connection warning if using fallback data */}
      {resilientDashboard.isError && (
        <Alert variant="destructive">
          <AlertDescription>
            Showing cached data due to connection issues. Data may be outdated.
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Orders</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalOrders.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Revenue</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">₦{stats.totalRevenue.toLocaleString()}</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Total Customers</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{stats.totalCustomers.toLocaleString()}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Orders</CardTitle>
        </CardHeader>
        <CardContent>
          {stats.recentOrders.length > 0 ? (
            <div className="space-y-2">
              {stats.recentOrders.map((order) => (
                <div key={order.id} className="flex justify-between items-center p-2 border rounded">
                  <div>
                    <p className="font-medium">{order.order_number}</p>
                    <p className="text-sm text-muted-foreground">{order.customer_name}</p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">₦{parseFloat(order.total_amount || '0').toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">{order.status}</p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground">No recent orders found.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};