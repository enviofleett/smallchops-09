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
      
      const result = await fetchReportsData(3); // Retry up to 3 times
      
      // Validate the returned data structure
      if (result && typeof result === 'object') {
        setData(result);
      } else {
        throw new Error('Invalid data structure received from API');
      }
    } catch (err) {
      console.error('Failed to fetch dashboard data:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load dashboard data';
      setError(errorMessage);
      
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