
import React from 'react';
import DashboardCard from '../components/DashboardCard';
import RevenueChart from '../components/charts/RevenueChart';
import OrdersChart from '../components/charts/OrdersChart';
import { FileText, Users, Clock, TrendingUp, Plus, Eye, Download, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { fetchReportsData } from '@/api/reports';
import { Skeleton } from '@/components/ui/skeleton';
import { useNavigate } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

const Dashboard = () => {
  const navigate = useNavigate();
  const { toast } = useToast();

  // Fetch real dashboard data with retry logic
  const { data: reportsData, isLoading, error, refetch } = useQuery({
    queryKey: ["dashboard-data"],
    queryFn: fetchReportsData,
    staleTime: 2 * 60 * 1000, // 2min cache
    retry: 3,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
  });

  // Sample recent orders - fallback data when API fails
  const fallbackRecentOrders = [
    { id: 'SS001', customer: 'Adebayo Johnson', items: '5x Meat Pies, 2x Spring Rolls', amount: '₦2,500', status: 'Preparing' },
    { id: 'SS002', customer: 'Fatima Abdullahi', items: '10x Samosas, Combo Pack', amount: '₦3,200', status: 'Out for Delivery' },
    { id: 'SS003', customer: 'Chioma Okafor', items: '8x Chicken Wings', amount: '₦1,800', status: 'Delivered' },
    { id: 'SS004', customer: 'Emeka Nwachukwu', items: '6x Fish Rolls, 1x Chin Chin', amount: '₦2,100', status: 'Ready for Pickup' },
  ];

  const fallbackPopularItems = [
    { name: 'Meat Pies', orders: 124, revenue: '₦186,000' },
    { name: 'Spring Rolls', orders: 89, revenue: '₦133,500' },
    { name: 'Samosas', orders: 201, revenue: '₦100,500' },
    { name: 'Chicken Wings', orders: 67, revenue: '₦120,600' },
  ];

  // Use real data or fallback data
  const recentOrders = reportsData?.recentOrders?.length > 0 ? reportsData.recentOrders : fallbackRecentOrders;
  const popularItems = reportsData?.popularItems?.length > 0 ? reportsData.popularItems : fallbackPopularItems;

  const getStatusBadge = (status: string) => {
    const statusColors = {
      'Preparing': 'bg-yellow-100 text-yellow-800',
      'Out for Delivery': 'bg-blue-100 text-blue-800',
      'Delivered': 'bg-green-100 text-green-800',
      'Ready for Pickup': 'bg-purple-100 text-purple-800',
    };
    
    return statusColors[status as keyof typeof statusColors] || 'bg-gray-100 text-gray-800';
  };

  // Quick action handlers
  const handleAddProduct = () => {
    navigate('/products');
    toast({
      title: "Redirected to Products",
      description: "You can add new products from the Products page.",
    });
  };

  const handleLiveOrders = () => {
    navigate('/orders');
    toast({
      title: "Redirected to Orders",
      description: "View and manage live orders.",
    });
  };

  const handleExport = () => {
    navigate('/reports');
    toast({
      title: "Redirected to Reports",
      description: "Export data from the Reports page.",
    });
  };

  const handleRetry = () => {
    refetch();
    toast({
      title: "Retrying...",
      description: "Attempting to reload dashboard data.",
    });
  };

  // Get real KPI data or fallback to safe values
  const kpiData = reportsData?.kpiStats ? {
    todaysRevenue: reportsData.kpiStats.todaysRevenue ? `₦${Number(reportsData.kpiStats.todaysRevenue).toLocaleString()}` : '₦0',
    ordersToday: reportsData.kpiStats.ordersToday || 0,
    pendingOrders: reportsData.kpiStats.pendingOrders || 0,
    completedOrders: reportsData.kpiStats.completedOrders || 0,
  } : {
    todaysRevenue: '₦0',
    ordersToday: 0,
    pendingOrders: 0,
    completedOrders: 0,
  };

  if (error) {
    console.error('Dashboard data fetch error:', error);
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Dashboard</h1>
          <p className="text-gray-600 mt-2">Welcome back! Here's what's happening with Starters Smallchops today.</p>
        </div>
        
        {/* Quick Actions */}
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <button 
            onClick={handleAddProduct}
            className="flex items-center space-x-2 bg-orange-600 text-white px-4 py-2 rounded-xl hover:bg-orange-700 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span>Add Product</span>
          </button>
          <button 
            onClick={handleLiveOrders}
            className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-xl hover:bg-blue-700 transition-colors"
          >
            <Eye className="h-4 w-4" />
            <span>Live Orders</span>
          </button>
          <button 
            onClick={handleExport}
            className="flex items-center space-x-2 bg-green-600 text-white px-4 py-2 rounded-xl hover:bg-green-700 transition-colors"
          >
            <Download className="h-4 w-4" />
            <span>Export</span>
          </button>
        </div>
      </div>

      {/* Error Alert */}
      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load dashboard data. Showing cached/fallback data.</span>
            <button 
              onClick={handleRetry}
              className="ml-4 px-3 py-1 text-sm bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors"
            >
              Retry
            </button>
          </AlertDescription>
        </Alert>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {isLoading ? (
          // Loading skeleton for KPI cards
          [...Array(4)].map((_, idx) => (
            <div key={idx} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
              <Skeleton className="h-12 w-12 rounded-xl mb-4" />
              <Skeleton className="h-4 w-24 mb-2" />
              <Skeleton className="h-8 w-20 mb-2" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))
        ) : (
          <>
            <DashboardCard
              title="Today's Revenue"
              value={kpiData.todaysRevenue}
              change="18.2%"
              changeType="positive"
              icon={<TrendingUp className="h-6 w-6 text-green-600" />}
            />
            <DashboardCard
              title="Orders Today"
              value={kpiData.ordersToday.toString()}
              change="12.5%"
              changeType="positive"
              icon={<FileText className="h-6 w-6 text-blue-600" />}
            />
            <DashboardCard
              title="Pending Orders"
              value={kpiData.pendingOrders.toString()}
              change="3"
              changeType="positive"
              icon={<Clock className="h-6 w-6 text-orange-600" />}
            />
            <DashboardCard
              title="Completed Orders"
              value={kpiData.completedOrders.toString()}
              change="15.3%"
              changeType="positive"
              icon={<Users className="h-6 w-6 text-purple-600" />}
            />
          </>
        )}
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <DashboardCard title="Revenue Overview (This Week)" value="" className="lg:col-span-1">
          <RevenueChart data={reportsData?.revenueTrends} isLoading={isLoading} />
        </DashboardCard>
        <DashboardCard title="Daily Orders (This Week)" value="" className="lg:col-span-1">
          <OrdersChart data={reportsData?.orderTrends} isLoading={isLoading} />
        </DashboardCard>
      </div>

      {/* Tables Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Recent Orders</h3>
            <button 
              onClick={handleLiveOrders}
              className="text-orange-600 hover:text-orange-700 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {recentOrders.map((order, index) => (
              <div key={index} className="flex items-start justify-between py-3 border-b border-gray-50 last:border-b-0">
                <div className="flex-1">
                  <p className="font-medium text-gray-800">{order.id}</p>
                  <p className="text-sm text-gray-600">{order.customer}</p>
                  <p className="text-xs text-gray-500 mt-1">{order.items}</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-800">{order.amount}</p>
                  <span className={`inline-block px-2 py-1 text-xs font-medium rounded-full mt-1 ${getStatusBadge(order.status)}`}>
                    {order.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Popular Items */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-800">Popular Items Today</h3>
            <button 
              onClick={() => navigate('/products')}
              className="text-orange-600 hover:text-orange-700 text-sm font-medium"
            >
              View All
            </button>
          </div>
          <div className="space-y-4">
            {popularItems.map((item, index) => (
              <div key={index} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-b-0">
                <div>
                  <p className="font-medium text-gray-800">{item.name}</p>
                  <p className="text-sm text-gray-600">{item.orders} orders</p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-gray-800">{item.revenue}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
