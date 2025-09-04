
import React from 'react';
import { Package, ShoppingCart, Users, TrendingUp, RefreshCw } from 'lucide-react';
import DashboardCard from '@/components/DashboardCard';
import RevenueChart from '@/components/charts/RevenueChart';
import OrdersChart from '@/components/charts/OrdersChart';
import { TopCustomersChart } from '@/components/customers/TopCustomersChart';
import DashboardHeader from '@/components/DashboardHeader';
import { useDashboardData } from '@/hooks/useDashboardData';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ProgressiveLoader } from '@/components/ui/progressive-loader';


const Dashboard = () => {
  const { data, isLoading, error, refresh } = useDashboardData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        
        {/* Loading Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-card rounded-2xl shadow-sm border border-border p-4 md:p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-6 md:h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Loading Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
          <div className="bg-card p-4 md:p-6 rounded-xl shadow-sm border border-border">
            <Skeleton className="h-5 md:h-6 w-32 mb-4" />
            <Skeleton className="h-48 md:h-64 w-full" />
          </div>
          <div className="bg-card p-4 md:p-6 rounded-xl shadow-sm border border-border">
            <Skeleton className="h-5 md:h-6 w-32 mb-4" />
            <Skeleton className="h-48 md:h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

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

  return (
    <div className="space-y-4 md:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <DashboardHeader />
        <Button
          onClick={() => refresh(true)}
          disabled={isLoading}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      <ProgressiveLoader
        isLoading={isLoading}
        error={error ? new Error(error) : null}
        data={data}
        skeletonType="card"
        retryFn={() => refresh(true)}
        timeout={15000}
      >
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
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
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <RevenueChart 
            data={data?.revenueTrends || []} 
            isLoading={false}
          />
          <OrdersChart 
            data={data?.orderTrends || []} 
            isLoading={false}
          />
        </div>

        <TopCustomersChart 
          customers={data?.topCustomersByOrders || []} 
          type="orders"
          title="Top Customers by Orders"
        />
      </ProgressiveLoader>

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

export default Dashboard;
