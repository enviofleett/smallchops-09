import { useState, useEffect } from 'react';
import { fetchReportsData } from '@/api/reports';

export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
}

export interface TrendData {
  day: string;
  name: string;
  revenue: number;
  orders: number;
}

export interface DashboardCustomer {
  id: string;
  name: string;
  email: string;
  totalOrders: number;
  totalSpent: number;
}

export interface DashboardData {
  stats: DashboardStats;
  revenueTrends: TrendData[];
  orderTrends: TrendData[];
  topCustomersByOrders: DashboardCustomer[];
  topCustomersBySpending: DashboardCustomer[];
  recentOrders: any[];
}

export const useDashboardData = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboardData = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Dashboard: Starting data fetch...');
      const result = await fetchReportsData(3); // Retry up to 3 times
      
      // Validate the returned data structure
      if (result && typeof result === 'object') {
        console.log('Dashboard: Data received successfully', {
          hasStats: !!result.stats,
          statsKeys: result.stats ? Object.keys(result.stats) : [],
          customersCount: result.topCustomersByOrders?.length || 0
        });
        setData(result);
      } else {
        throw new Error('Invalid data structure received from API');
      }
    } catch (err) {
      console.error('Dashboard: Failed to fetch data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(`Data Access Error: ${errorMessage}. This might be due to insufficient permissions or database connectivity issues.`);
      
      // Set fallback data structure with user-friendly message
      setData({
        stats: {
          totalProducts: 0,
          totalOrders: 0,
          totalCustomers: 0,
          totalRevenue: 0
        },
        revenueTrends: [],
        orderTrends: [],
        topCustomersByOrders: [],
        topCustomersBySpending: [],
        recentOrders: []
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const refresh = () => {
    loadDashboardData();
  };

  return {
    data,
    isLoading,
    error,
    refresh
  };
};