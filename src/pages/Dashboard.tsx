
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

const Dashboard = () => {
  const { data, isLoading, error, refresh } = useDashboardData();

  if (isLoading) {
    return (
      <div className="space-y-6">
        <DashboardHeader />
        
        {/* Loading Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-16 mb-2" />
              <Skeleton className="h-3 w-20" />
            </div>
          ))}
        </div>

        {/* Loading Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
            <Skeleton className="h-6 w-32 mb-4" />
            <Skeleton className="h-64 w-full" />
          </div>
        </div>
      </div>
    );
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const formatNumber = (num: number) => {
    return new Intl.NumberFormat('en-NG').format(num);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <DashboardHeader />
        <Button
          onClick={refresh}
          variant="outline"
          size="sm"
          className="flex items-center gap-2"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </Button>
      </div>
      
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Error loading dashboard: {error}</p>
        </div>
      )}
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard
          title="Total Products"
          value={formatNumber(data?.stats.totalProducts || 0)}
          icon={<Package className="w-6 h-6 text-blue-600" />}
        />
        <DashboardCard
          title="Total Orders"
          value={formatNumber(data?.stats.totalOrders || 0)}
          icon={<ShoppingCart className="w-6 h-6 text-green-600" />}
        />
        <DashboardCard
          title="Total Customers"
          value={formatNumber(data?.stats.totalCustomers || 0)}
          icon={<Users className="w-6 h-6 text-purple-600" />}
        />
        <DashboardCard
          title="Revenue"
          value={formatCurrency(data?.stats.totalRevenue || 0)}
          icon={<TrendingUp className="w-6 h-6 text-orange-600" />}
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue Overview</h3>
          <RevenueChart data={data?.revenueTrends} />
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Orders This Week</h3>
          <OrdersChart data={data?.orderTrends} />
        </div>
      </div>

      {/* Top Customers Section */}
      {data?.topCustomersByOrders && data.topCustomersByOrders.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <TopCustomersChart 
            customers={data.topCustomersByOrders} 
            type="orders" 
            title="Top Customers by Orders" 
          />
          <TopCustomersChart 
            customers={data.topCustomersBySpending} 
            type="spending" 
            title="Top Customers by Spending" 
          />
        </div>
      )}

      {/* Empty State for No Data */}
      {(!data?.topCustomersByOrders || data.topCustomersByOrders.length === 0) && (
        <div className="bg-white p-8 rounded-xl shadow-sm border border-gray-100">
          <div className="text-center">
            <Package className="w-12 h-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-800 mb-2">No Data Available</h3>
            <p className="text-gray-600">Start adding products and taking orders to see analytics here.</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
