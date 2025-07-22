
import React from 'react';
import { Package, ShoppingCart, Users, TrendingUp } from 'lucide-react';
import DashboardCard from '@/components/DashboardCard';
import RevenueChart from '@/components/charts/RevenueChart';
import OrdersChart from '@/components/charts/OrdersChart';
import TopCustomersChart from '@/components/customers/TopCustomersChart';
import DashboardHeader from '@/components/DashboardHeader';

const Dashboard = () => {
  return (
    <div className="space-y-6">
      <DashboardHeader />
      
      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <DashboardCard
          title="Total Products"
          value="156"
          change="+12%"
          icon={Package}
          trend="up"
        />
        <DashboardCard
          title="Total Orders"
          value="2,847"
          change="+8%"
          icon={ShoppingCart}
          trend="up"
        />
        <DashboardCard
          title="Total Customers"
          value="1,249"
          change="+15%"
          icon={Users}
          trend="up"
        />
        <DashboardCard
          title="Revenue"
          value="₦45,897"
          change="+23%"
          icon={TrendingUp}
          trend="up"
        />
      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Revenue Overview</h3>
          <RevenueChart />
        </div>
        
        <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Orders This Week</h3>
          <OrdersChart />
        </div>
      </div>

      {/* Additional Charts */}
      <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
        <h3 className="text-lg font-semibold text-gray-800 mb-4">Top Customers</h3>
        <TopCustomersChart />
      </div>
    </div>
  );
};

export default Dashboard;
