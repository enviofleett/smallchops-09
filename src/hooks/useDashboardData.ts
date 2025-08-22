import { useState, useEffect } from 'react';
import { fetchReportsData } from '@/api/reports';
import { classifyError, logError, type ClassifiedError } from '@/utils/errorClassification';
import { useNetwork } from '@/components/network/NetworkProvider';

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
  id?: string;
  name?: string;
  customer_name?: string;
  email?: string;
  customer_email?: string;
  totalOrders?: number;
  orders?: number;
  totalSpent?: number;
  spending?: number;
}

export interface DashboardData {
  stats: DashboardStats;
  revenueTrends: TrendData[];
  orderTrends: TrendData[];
  topCustomersByOrders: DashboardCustomer[];
  topCustomersBySpending: DashboardCustomer[];
  recentOrders: any[];
}

export interface DashboardError {
  message: string;
  type: 'network' | 'auth' | 'server' | 'client' | 'timeout' | 'permission' | 'rate_limit' | 'unknown';
  severity: 'low' | 'medium' | 'high' | 'critical';
  actionable: boolean;
  retryable: boolean;
  suggestedActions: string[];
  errorId: string;
}

export const useDashboardData = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<DashboardError | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const { isOnline, apiAvailable, checkApiHealth } = useNetwork();

  const createFallbackData = (): DashboardData => ({
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

  const loadDashboardData = async (skipCache = false) => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('📊 Dashboard: Starting data fetch...', { retryCount, skipCache, isOnline, apiAvailable });
      
      // Check network conditions before attempting to fetch
      if (!isOnline) {
        throw new Error('No internet connection detected');
      }

      // Check API health if it was previously unavailable
      if (!apiAvailable) {
        console.log('🔍 Checking API health before data fetch...');
        await checkApiHealth();
      }
      
      // Progressive retry strategy with smarter retry limits
      const maxRetries = retryCount < 2 ? 3 : 1; // Reduce retries after initial failures
      const result = await fetchReportsData({ retryCount: maxRetries });
      
      // Validate the returned data structure
      if (result && typeof result === 'object') {
        console.log('✅ Dashboard: Data received successfully', {
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
      console.error('❌ Dashboard: Failed to fetch data:', err);
      setRetryCount(prev => prev + 1);
      
      // Use error classification system
      let classifiedError: ClassifiedError;
      
      if ((err as any)?.classified) {
        // Error was already classified in fetchReportsData
        classifiedError = (err as any).classified;
      } else {
        classifiedError = classifyError(err);
      }
      
      // Log the error with dashboard context
      logError(classifiedError, {
        component: 'useDashboardData',
        retryCount,
        hasData: !!data,
        isOnline,
        apiAvailable
      });
      
      // Create user-friendly error object
      const dashboardError: DashboardError = {
        message: classifiedError.userMessage,
        type: classifiedError.type,
        severity: classifiedError.severity,
        actionable: classifiedError.actionable,
        retryable: classifiedError.retryable,
        suggestedActions: classifiedError.suggestedActions,
        errorId: classifiedError.errorId
      };
      
      setError(dashboardError);
      
      // Set fallback data structure only if no previous data exists
      if (!data) {
        setData(createFallbackData());
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