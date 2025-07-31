
import React, { useState } from 'react';
import { TrendingUp, Users, DollarSign, Repeat } from 'lucide-react';
import { CustomerMetrics, Customer } from '@/types/customers';
import { CustomerListModal } from './CustomerListModal';

interface CustomerAnalyticsProps {
  metrics: CustomerMetrics;
  topCustomersByOrders: Customer[];
  topCustomersBySpending: Customer[];
  repeatCustomers: Customer[];
  allCustomers: Customer[];
  isLoading?: boolean;
}

export const CustomerAnalytics = ({
  metrics,
  topCustomersByOrders,
  topCustomersBySpending,
  repeatCustomers,
  allCustomers,
  isLoading
}: CustomerAnalyticsProps) => {
  const [modal, setModal] = useState<null | "total" | "guest" | "authenticated" | "orders" | "repeat">(null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-6">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 animate-pulse">
            <div className="h-12 bg-gray-200 rounded mb-4"></div>
            <div className="h-8 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded"></div>
          </div>
        ))}
      </div>
    );
  }

  // Updated stats to include guest and authenticated customer counts
  const stats = [
    {
      title: 'Total Customers',
      value: metrics.totalCustomers.toLocaleString(),
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      key: 'total',
      customers: allCustomers,
    },
    {
      title: 'Guest Customers',
      value: metrics.guestCustomers.toLocaleString(),
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      key: 'guest',
      customers: allCustomers.filter(c => c.isGuest),
    },
    {
      title: 'Authenticated',
      value: metrics.authenticatedCustomers.toLocaleString(),
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      key: 'authenticated',
      customers: allCustomers.filter(c => !c.isGuest),
    },
    {
      title: 'Top by Orders',
      value: topCustomersByOrders[0]?.totalOrders
        ? `${topCustomersByOrders[0].totalOrders} Orders`
        : "—",
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      key: 'orders',
      customers: topCustomersByOrders,
    },
    {
      title: 'Repeat Customers',
      value: `${metrics.repeatCustomerRate.toFixed(1)}%`,
      icon: Repeat,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
      key: 'repeat',
      customers: repeatCustomers,
    }
  ];

  // Modal mapping for all 5 stats
  const modalMap: Record<
    string,
    { title: string; customers: Customer[] }
  > = {
    total: {
      title: "All Customers",
      customers: allCustomers,
    },
    guest: {
      title: "Guest Customers",
      customers: allCustomers.filter(c => c.isGuest),
    },
    authenticated: {
      title: "Authenticated Customers",
      customers: allCustomers.filter(c => !c.isGuest),
    },
    orders: {
      title: "Top Customers by Orders",
      customers: topCustomersByOrders,
    },
    repeat: {
      title: "Repeat Customers",
      customers: repeatCustomers,
    }
  };

  // Display all 5 cards; grid adjusts responsively
  return (
    <div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6 mb-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <button
              key={stat.title}
              className={`bg-white rounded-2xl shadow-sm border border-gray-100 p-6 w-full text-left focus:outline-none hover:shadow-md active:scale-95 transition-transform group`}
              onClick={() => setModal(stat.key as any)}
              type="button"
            >
              <div className="flex items-center justify-between">
                <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
              </div>
              <div className="mt-4">
                <p className="text-2xl font-bold text-gray-800 group-hover:text-blue-600 transition">{stat.value}</p>
                <p className="text-gray-600 text-sm mt-1">{stat.title}</p>
                {/* For Top by Orders/Spending, show top customer name under value */}
                {(stat.key === "orders" || stat.key === "spending") && stat.customers[0] && (
                  <span className="block mt-2 text-xs font-medium text-gray-500">{stat.customers[0].name}</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
      {modal && (
        <CustomerListModal
          open={!!modal}
          onOpenChange={() => setModal(null)}
          title={modalMap[modal].title}
          customers={modalMap[modal].customers}
        />
      )}
    </div>
  );
};
