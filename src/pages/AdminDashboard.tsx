import React from 'react';
import { Package, ShoppingCart, Users, TrendingUp, RefreshCw } from 'lucide-react';
import DashboardCard from '@/components/DashboardCard';
import { TopCustomersChart } from '@/components/customers/TopCustomersChart';
import { TopSellingProducts } from '@/components/admin/TopSellingProducts';
import { FulfillmentStatistics } from '@/components/admin/FulfillmentStatistics';
import { useAdminDashboardData } from '@/hooks/useAdminDashboardData';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';

export const AdminDashboard: React.FC = () => {
  const { data, isLoading, error, refetch } = useAdminDashboardData();

  const formatCurrency = (amount: number) => {
    if (amount === 0) return "₦0";
    return new Intl.NumberFormat('en-NG', { 
      style: 'currency', 
      currency: 'NGN',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0 
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-NG').format(num);
  };

  if (error) {
    return (
      <div className="container mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>
            Failed to load dashboard data. Please try refreshing the page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Admin Dashboard</h1>
          <p className="text-muted-foreground">Business insights and key metrics</p>
        </div>
        <Button
          onClick={() => refetch()}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Key Metrics */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {isLoading ? (
          [...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl shadow-sm border border-border p-4 md:p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-6 md:h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))
        ) : (
          <>
            <DashboardCard
              title="Total Products"
              value={formatNumber(data?.stats.totalProducts || 0)}
              icon={<Package />}
              className="bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-950 dark:to-blue-900"
            />
            <DashboardCard
              title="Total Orders"
              value={formatNumber(data?.stats.totalOrders || 0)}
              icon={<ShoppingCart />}
              className="bg-gradient-to-br from-green-50 to-green-100 dark:from-green-950 dark:to-green-900"
            />
            <DashboardCard
              title="Total Customers"
              value={formatNumber(data?.stats.totalCustomers || 0)}
              icon={<Users />}
              className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950 dark:to-purple-900"
            />
            <DashboardCard
              title="Total Revenue"
              value={formatCurrency(data?.stats.totalRevenue || 0)}
              icon={<TrendingUp />}
              className="bg-gradient-to-br from-orange-50 to-orange-100 dark:from-orange-950 dark:to-orange-900"
            />
          </>
        )}
      </div>

      {/* Charts and Analytics */}
      <div className="grid gap-6 lg:grid-cols-2">
        <TopSellingProducts 
          products={data?.topProducts || []} 
          isLoading={isLoading}
        />
        
        <FulfillmentStatistics 
          stats={data?.fulfillmentStats || {
            delivery_orders: 0,
            pickup_orders: 0,
            delivery_percentage: 0,
            pickup_percentage: 0,
            total_fulfillment_orders: 0
          }}
          isLoading={isLoading}
        />
      </div>

      {/* Top Customers */}
      <div className="lg:col-span-2">
        <TopCustomersChart 
          customers={data?.topCustomers || []} 
          type="orders"
          title="Top Customers by Orders"
        />
      </div>

      {/* No Data State */}
      {(!data || (!data.stats.totalProducts && !data.stats.totalOrders)) && !isLoading && (
        <div className="text-center py-8 space-y-4">
          <div className="text-muted-foreground">
            <Package className="mx-auto h-12 w-12 mb-4 opacity-50" />
            <h3 className="text-lg font-medium">No Data Available</h3>
            <p>Your dashboard will show data once you start adding products and receiving orders.</p>
          </div>
        </div>
      )}
    </div>
  );
};