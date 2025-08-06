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
  const [retryCount, setRetryCount] = useState(0);

  const loadDashboardData = async (skipCache = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Dashboard: Starting data fetch...', { retryCount, skipCache });
      
      // Progressive retry strategy
      const maxRetries = retryCount < 2 ? 3 : 1; // Reduce retries after initial failures
      const result = await fetchReportsData(maxRetries);
      
      // Validate the returned data structure
      if (result && typeof result === 'object') {
        console.log('Dashboard: Data received successfully', {
          hasStats: !!result.stats,
          statsKeys: result.stats ? Object.keys(result.stats) : [],
          customersCount: result.topCustomersByOrders?.length || 0
        });
        setData(result);
        setRetryCount(0); // Reset retry count on success
      } else {
        throw new Error('Invalid data structure received from API');
      }
    } catch (err) {
      console.error('Dashboard: Failed to fetch data:', err);
      setRetryCount(prev => prev + 1);
      
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      
      // More user-friendly error messages
      if (errorMessage.includes('401') || errorMessage.includes('unauthorized')) {
        setError('Authentication required. Please log in again to view dashboard data.');
      } else if (errorMessage.includes('403') || errorMessage.includes('forbidden')) {
        setError('Access denied. You may not have permission to view this data.');
      } else if (errorMessage.includes('timeout') || errorMessage.includes('network')) {
        setError('Connection timeout. Please check your internet connection and try again.');
      } else {
        setError(`Unable to load dashboard data: ${errorMessage}`);
      }
      
      // Set fallback data structure only if no previous data exists
      if (!data) {
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
      }
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, []);

  const refresh = (force = false) => {
    if (force) {
      setRetryCount(0); // Reset retry count for manual refresh
    }
    loadDashboardData(force);
  };

  return {
    data,
    isLoading,
    error,
    refresh
  };
};