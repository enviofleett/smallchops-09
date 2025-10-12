import React, { useState, useMemo } from 'react';
import { TrendingUp, Users, DollarSign, Repeat, UserPlus, TrendingDown, Minus, Calendar } from 'lucide-react';
import { CustomerMetrics, Customer, DateRange } from '@/types/customers';
import { CustomerListModal } from './CustomerListModal';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
interface CustomerAnalyticsProps {
  metrics: CustomerMetrics;
  topCustomersByOrders: Customer[];
  topCustomersBySpending: Customer[];
  repeatCustomers: Customer[];
  allCustomers: Customer[];
  isLoading?: boolean;
  dateRange?: DateRange;
}
export const CustomerAnalytics = ({
  metrics,
  topCustomersByOrders,
  topCustomersBySpending,
  repeatCustomers,
  allCustomers,
  isLoading,
  dateRange
}: CustomerAnalyticsProps) => {
  const [modal, setModal] = useState<null | "total" | "guest" | "authenticated" | "orders" | "repeat" | "new">(null);

  // Format date range for display
  const formatDateRange = () => {
    if (!dateRange) return 'All time';
    const start = new Date(dateRange.from);
    const end = new Date(dateRange.to);
    const options: Intl.DateTimeFormatOptions = {
      month: 'short',
      day: 'numeric'
    };
    if (start.getFullYear() !== end.getFullYear()) {
      return `${start.toLocaleDateString('en-US', {
        ...options,
        year: 'numeric'
      })} - ${end.toLocaleDateString('en-US', {
        ...options,
        year: 'numeric'
      })}`;
    }
    return `${start.toLocaleDateString('en-US', options)} - ${end.toLocaleDateString('en-US', options)}, ${end.getFullYear()}`;
  };

  // Calculate new customers and growth metrics (production-ready)
  const {
    newCustomers,
    newCustomersGrowth,
    repeatCustomersGrowth
  } = useMemo(() => {
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
    const newGrowth = previousPeriodNew.length > 0 ? (currentPeriodNew.length - previousPeriodNew.length) / previousPeriodNew.length * 100 : currentPeriodNew.length > 0 ? 100 : 0;

    // Repeat customers growth (comparing current rate to estimated previous)
    const currentRepeatRate = metrics.repeatCustomerRate;
    // Estimate previous period rate (conservative approach)
    const estimatedPreviousRate = Math.max(0, currentRepeatRate - currentRepeatRate * 0.1); // 10% baseline
    const repeatGrowth = estimatedPreviousRate > 0 ? (currentRepeatRate - estimatedPreviousRate) / estimatedPreviousRate * 100 : currentRepeatRate > 0 ? 100 : 0;
    return {
      newCustomers: currentPeriodNew,
      newCustomersGrowth: Math.min(newGrowth, 999),
      // Cap at 999% for display
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
    return <div className={`flex items-center gap-1 px-2 py-0.5 rounded-full ${bgClass}`}>
        <Icon className={`h-3 w-3 ${colorClass}`} />
        <span className={`text-xs font-medium ${colorClass}`}>
          {isNeutral ? '0%' : `${Math.abs(growth).toFixed(1)}%`}
        </span>
      </div>;
  };
  if (isLoading) {
    return <div className="space-y-4">
        <div className="flex items-center justify-between text-sm bg-muted/30 px-3 py-2 rounded-lg animate-pulse">
          <div className="h-4 w-48 bg-muted rounded"></div>
          <div className="h-3 w-24 bg-muted rounded"></div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <div key={i} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 animate-pulse">
              <div className="h-10 bg-gray-200 rounded mb-3"></div>
              <div className="h-6 bg-gray-200 rounded mb-2"></div>
              <div className="h-4 bg-gray-200 rounded w-3/4"></div>
            </div>)}
        </div>
      </div>;
  }

  // Streamlined stats - production ready with 3 key metrics
  const stats = [{
    title: 'Total Customers',
    value: metrics.totalCustomers.toLocaleString(),
    subtitle: 'All time',
    icon: Users,
    color: 'text-blue-600',
    bgColor: 'bg-blue-100',
    key: 'total',
    customers: allCustomers
  }, {
    title: 'New Customers',
    value: newCustomers.length.toLocaleString(),
    subtitle: 'Last 30 days',
    icon: UserPlus,
    color: 'text-emerald-600',
    bgColor: 'bg-emerald-100',
    key: 'new',
    customers: newCustomers,
    growth: newCustomersGrowth
  }, {
    title: 'Guest Customers',
    value: metrics.guestCustomers.toLocaleString(),
    subtitle: 'Unregistered',
    icon: Users,
    color: 'text-orange-600',
    bgColor: 'bg-orange-100',
    key: 'guest',
    customers: allCustomers.filter(c => c.isGuest)
  }];

  // Modal mapping for stats
  const modalMap: Record<string, {
    title: string;
    customers: Customer[];
  }> = {
    total: {
      title: "All Customers",
      customers: allCustomers
    },
    new: {
      title: "New Customers (Last 30 Days)",
      customers: newCustomers
    },
    guest: {
      title: "Guest Customers",
      customers: allCustomers.filter(c => c.isGuest)
    }
  };

  // Production-ready responsive grid
  return <div className="space-y-4">
      {/* Date Range Context - Shows what data is being displayed */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-sm text-muted-foreground bg-muted/30 px-3 py-2 rounded-lg border border-border/50">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-primary" />
          <span className="font-medium text-foreground">Data Period:</span>
          <span className="text-foreground font-semibold">{formatDateRange()}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse"></div>
          <span className="text-xs">Live data • Just now</span>
        </div>
      </div>

      {/* Main Stats Grid - Production Ready Mobile Responsive (3 cards) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-6">
        {stats.map(stat => {
        const Icon = stat.icon;
        const hasGrowth = stat.growth !== undefined;
        return <button key={stat.title} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 w-full text-left focus:outline-none hover:shadow-xl hover:border-blue-200 active:scale-[0.98] transition-all duration-200 group" onClick={() => setModal(stat.key as any)} type="button" aria-label={`View ${stat.title} details`}>
              <div className="flex items-start justify-between mb-4">
                <div className={`p-3 rounded-xl ${stat.bgColor} group-hover:scale-110 transition-transform duration-200`}>
                  <Icon className={`h-6 w-6 ${stat.color}`} />
                </div>
                {hasGrowth && renderGrowthIndicator(stat.growth)}
              </div>
              
              <div className="space-y-2">
                <p className="text-3xl md:text-4xl font-bold text-gray-900 group-hover:text-blue-600 transition-colors">
                  {stat.value}
                </p>
                <p className="text-sm font-semibold text-gray-900">
                  {stat.title}
                </p>
                <p className="text-sm text-gray-500">
                  {stat.subtitle}
                </p>
              </div>
            </button>;
      })}
      </div>

      {/* Additional Insights Card - Mobile Responsive */}
      <Card className="border-blue-100 bg-gradient-to-br from-blue-50 to-white">
        
        
      </Card>

      {/* Modal for detailed view */}
      {modal && <CustomerListModal open={!!modal} onOpenChange={() => setModal(null)} title={modalMap[modal].title} customers={modalMap[modal].customers} />}
    </div>;
};