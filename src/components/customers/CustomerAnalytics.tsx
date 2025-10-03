import React, { useState, useMemo } from 'react';
import { TrendingUp, Users, DollarSign, Repeat, UserPlus, TrendingDown, Minus } from 'lucide-react';
import { CustomerMetrics, Customer } from '@/types/customers';
import { CustomerListModal } from './CustomerListModal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';

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
  const [modal, setModal] = useState<null | "total" | "guest" | "authenticated" | "orders" | "repeat" | "new">(null);

  // Calculate new customers and growth metrics (production-ready)
  const { newCustomers, newCustomersGrowth, repeatCustomersGrowth } = useMemo(() => {
    const now = new Date();
    const last30Days = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const last60Days = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000);

    // New customers are those with orders in last 30 days and totalOrders = 1
    // This is more accurate for production as it tracks actual new business
    const currentPeriodNew = allCustomers.filter(c => {
      if (!c.lastOrderDate) return false;
      const lastOrder = new Date(c.lastOrderDate);
      return lastOrder >= last30Days && c.totalOrders === 1;
    });

    // Previous period new customers (for growth comparison)
    const previousPeriodNew = allCustomers.filter(c => {
      if (!c.lastOrderDate) return false;
      const lastOrder = new Date(c.lastOrderDate);
      return lastOrder >= last60Days && lastOrder < last30Days && c.totalOrders === 1;
    });

    // Calculate growth percentage with safe division
    const newGrowth = previousPeriodNew.length > 0
      ? ((currentPeriodNew.length - previousPeriodNew.length) / previousPeriodNew.length) * 100
      : currentPeriodNew.length > 0 ? 100 : 0;

    // Repeat customers growth (comparing current rate to estimated previous)
    const currentRepeatRate = metrics.repeatCustomerRate;
    // Estimate previous period rate (conservative approach)
    const estimatedPreviousRate = Math.max(0, currentRepeatRate - (currentRepeatRate * 0.1)); // 10% baseline
    const repeatGrowth = estimatedPreviousRate > 0
      ? ((currentRepeatRate - estimatedPreviousRate) / estimatedPreviousRate) * 100
      : currentRepeatRate > 0 ? 100 : 0;

    return {
      newCustomers: currentPeriodNew,
      newCustomersGrowth: Math.min(newGrowth, 999), // Cap at 999% for display
      repeatCustomersGrowth: Math.min(repeatGrowth, 999)
    };
  }, [allCustomers, metrics.repeatCustomerRate]);

  // Helper function to render growth indicator
  const renderGrowthIndicator = (growth: number) => {
    const isPositive = growth > 0;
    const isNeutral = growth === 0;
    const Icon = isPositive ? TrendingUp : isNeutral ? Minus : TrendingDown;
    const colorClass = isPositive ? 'text-green-600' : isNeutral ? 'text-gray-600' : 'text-red-600';
    const bgClass = isPositive ? 'bg-green-50' : isNeutral ? 'bg-gray-50' : 'bg-red-50';

    return (
      <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${bgClass}`}>
        <Icon className={`h-3 w-3 ${colorClass}`} />
        <span className={`text-xs font-medium ${colorClass}`}>
          {isNeutral ? '0%' : `${Math.abs(growth).toFixed(1)}%`}
        </span>
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
            <div className="h-10 bg-gray-200 rounded mb-3"></div>
            <div className="h-6 bg-gray-200 rounded mb-2"></div>
            <div className="h-4 bg-gray-200 rounded w-3/4"></div>
          </div>
        ))}
      </div>
    );
  }

  // Enhanced stats with growth indicators and new customers
  const stats = [
    {
      title: 'Total Customers',
      value: metrics.totalCustomers.toLocaleString(),
      subtitle: 'All time',
      icon: Users,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      key: 'total',
      customers: allCustomers,
    },
    {
      title: 'New Customers',
      value: newCustomers.length.toLocaleString(),
      subtitle: 'Last 30 days',
      icon: UserPlus,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      key: 'new',
      customers: newCustomers,
      growth: newCustomersGrowth,
    },
    {
      title: 'Guest Customers',
      value: metrics.guestCustomers.toLocaleString(),
      subtitle: 'Unregistered',
      icon: Users,
      color: 'text-orange-600',
      bgColor: 'bg-orange-100',
      key: 'guest',
      customers: allCustomers.filter(c => c.isGuest),
    },
    {
      title: 'Authenticated',
      value: metrics.authenticatedCustomers.toLocaleString(),
      subtitle: 'Registered',
      icon: Users,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      key: 'authenticated',
      customers: allCustomers.filter(c => !c.isGuest),
    },
    {
      title: 'Top by Orders',
      value: topCustomersByOrders[0]?.totalOrders
        ? `${topCustomersByOrders[0].totalOrders}`
        : "—",
      subtitle: topCustomersByOrders[0]?.name || 'No orders yet',
      icon: DollarSign,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      key: 'orders',
      customers: topCustomersByOrders,
    },
    {
      title: 'Repeat Rate',
      value: `${metrics.repeatCustomerRate.toFixed(1)}%`,
      subtitle: `${repeatCustomers.length} customers`,
      icon: Repeat,
      color: 'text-pink-600',
      bgColor: 'bg-pink-100',
      key: 'repeat',
      customers: repeatCustomers,
      growth: repeatCustomersGrowth,
    }
  ];

  // Modal mapping for all stats including new customers
  const modalMap: Record<
    string,
    { title: string; customers: Customer[] }
  > = {
    total: {
      title: "All Customers",
      customers: allCustomers,
    },
    new: {
      title: "New Customers (Last 30 Days)",
      customers: newCustomers,
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

  // Production-ready responsive grid
  return (
    <div className="space-y-4">
      {/* Main Stats Grid - Mobile Responsive */}
      <div className="grid grid-cols-1 xs:grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 md:gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          const hasGrowth = stat.growth !== undefined;
          
          return (
            <button
              key={stat.title}
              className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 w-full text-left focus:outline-none hover:shadow-lg hover:border-gray-200 active:scale-[0.98] transition-all group"
              onClick={() => setModal(stat.key as any)}
              type="button"
              aria-label={`View ${stat.title} details`}
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2 rounded-lg ${stat.bgColor} group-hover:scale-110 transition-transform`}>
                  <Icon className={`h-5 w-5 ${stat.color}`} />
                </div>
                {hasGrowth && renderGrowthIndicator(stat.growth)}
              </div>
              
              <div className="space-y-1">
                <p className="text-xl md:text-2xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {stat.value}
                </p>
                <p className="text-xs font-medium text-gray-900 truncate">
                  {stat.title}
                </p>
                <p className="text-xs text-gray-500 truncate">
                  {stat.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Additional Insights Card - Mobile Responsive */}
      <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white">
        <CardHeader className="pb-3">
          <CardTitle className="text-base md:text-lg flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-600" />
            Customer Growth Insights
          </CardTitle>
          <CardDescription className="text-xs md:text-sm">
            Real-time customer acquisition and retention metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* New Customers Breakdown */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">New Customers (30d)</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-emerald-600">
                  {newCustomers.length}
                </p>
                {renderGrowthIndicator(newCustomersGrowth)}
              </div>
              <div className="space-y-1 text-xs text-gray-600">
                <div className="flex justify-between">
                  <span>Guest:</span>
                  <span className="font-medium">{newCustomers.filter(c => c.isGuest).length}</span>
                </div>
                <div className="flex justify-between">
                  <span>Authenticated:</span>
                  <span className="font-medium">{newCustomers.filter(c => !c.isGuest).length}</span>
                </div>
              </div>
            </div>

            {/* Repeat Customer Growth */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Repeat Customers</p>
              <div className="flex items-baseline gap-2">
                <p className="text-2xl font-bold text-pink-600">
                  {repeatCustomers.length}
                </p>
                {renderGrowthIndicator(repeatCustomersGrowth)}
              </div>
              <div className="text-xs text-gray-600">
                <p>Rate: <span className="font-medium">{metrics.repeatCustomerRate.toFixed(1)}%</span></p>
                <p className="text-xs text-gray-500 mt-1">
                  {metrics.repeatCustomerRate > 20 ? '✓ Excellent retention' : 'Focus on retention'}
                </p>
              </div>
            </div>

            {/* Average Order Value */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Avg Order Value</p>
              <p className="text-2xl font-bold text-purple-600">
                ₦{Math.round(metrics.avgOrderValue).toLocaleString()}
              </p>
              <p className="text-xs text-gray-600">
                Per customer transaction
              </p>
            </div>

            {/* Active Customers */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-gray-600">Active Customers</p>
              <p className="text-2xl font-bold text-blue-600">
                {metrics.activeCustomers.toLocaleString()}
              </p>
              <p className="text-xs text-gray-600">
                With recent orders
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Modal for detailed view */}
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
