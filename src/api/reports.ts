
import { supabase } from "@/integrations/supabase/client";

/**
 * API utility for fetching daily analytics data from the Supabase analytics-dashboard Edge Function.
 */
export async function fetchDailyAnalytics(
  params: {
    startDate?: string;
    endDate?: string;
    retryCount?: number;
  } = {}
) {
  const { 
    startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0], 
    endDate = new Date().toISOString().split('T')[0],
    retryCount = 3 
  } = params;
  
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`Fetching daily analytics (attempt ${attempt}/${retryCount})...`);
      
      // Get the Supabase client session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error('No active session');
      }

      // Call the edge function with the path parameter
      const { data: functionData } = await supabase.functions.invoke('analytics-dashboard', {
        body: null,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      // Since we can't directly pass the path in invoke, we'll use a workaround
      // by calling the endpoint directly via fetch
      const supabaseUrl = (supabase as any).supabaseUrl || import.meta.env.VITE_SUPABASE_URL;
      const response = await fetch(`${supabaseUrl}/functions/v1/analytics-dashboard/daily-analytics?startDate=${startDate}&endDate=${endDate}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      
      console.log(`Daily analytics data received successfully (attempt ${attempt})`);
      
      return data || {
        dailyData: [],
        summary: {
          totalDays: 0,
          totalRevenue: 0,
          totalOrders: 0,
          totalCustomers: 0,
          averageDailyRevenue: 0,
          averageDailyOrders: 0
        },
        dateRange: { startDate, endDate }
      };
      
    } catch (error) {
      lastError = error as Error;
      console.error(`Failed to fetch daily analytics (attempt ${attempt}/${retryCount}):`, error);
      
      if (attempt === retryCount) {
        break;
      }
      
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }
  
  console.warn('Daily analytics API failed after all retries, returning fallback data');
  
  return {
    dailyData: [],
    summary: {
      totalDays: 0,
      totalRevenue: 0,
      totalOrders: 0,
      totalCustomers: 0,
      averageDailyRevenue: 0,
      averageDailyOrders: 0
    },
    dateRange: { startDate, endDate },
    _fallback: true
  };
}

/**
 * API utility for fetching analytics data from the Supabase reports Edge Function.
 * Enhanced with retry logic and better error handling for production use.
 */
export async function fetchReportsData(
  params: {
    groupBy?: 'week' | 'month';
    startDate?: string;
    endDate?: string;
    retryCount?: number;
  } = {}
) {
  const { groupBy = 'week', startDate, endDate, retryCount = 3 } = params;
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`Fetching reports data (attempt ${attempt}/${retryCount})...`);
      
      // Use Supabase client to call the function directly instead of raw fetch
      console.log('Calling reports function via Supabase client...');
      
      const { data, error } = await supabase.functions.invoke('reports', {
        method: 'POST',
        body: { groupBy, startDate, endDate }
      });
      
      if (error) {
        console.error(`Reports function error (attempt ${attempt}):`, error);
        throw new Error(error.message || 'Reports function failed');
      }
      
      console.log(`Reports data received successfully (attempt ${attempt}):`, {
        hasData: !!data,
        dataKeys: data ? Object.keys(data) : []
      });
      
      // Extract nested data if wrapped in 'data' property (fix for edge function format)
      const extractedData = data?.data || data;
      
      console.log('Processed data structure:', {
        hasStats: !!extractedData?.stats,
        statsKeys: extractedData?.stats ? Object.keys(extractedData.stats) : [],
        dataType: typeof extractedData
      });
      
      // Return the properly extracted data with fallback structure
      return extractedData || {
        stats: { totalProducts: 0, totalOrders: 0, totalCustomers: 0, totalRevenue: 0 },
        revenueSeries: [],
        orderSeries: [],
        topCustomersByOrders: [],
        topCustomersBySpending: [],
        recentOrders: [],
        dateRange: { startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] },
        groupBy: 'week'
      };
      
    } catch (error) {
      lastError = error as Error;
      console.error(`Failed to fetch reports data (attempt ${attempt}/${retryCount}):`, error);
      
      // Don't retry on client errors or if this was the last attempt
      if (attempt === retryCount || (error as any)?.message?.includes('not retrying')) {
        break;
      }
      
      // Wait before retrying (exponential backoff)
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }
  
  // If all retries failed, return fallback data instead of throwing
  console.warn('Reports API failed after all retries, returning fallback data');
  
  return {
    stats: { 
      totalProducts: 0, 
      totalOrders: 0, 
      totalCustomers: 0, 
      totalRevenue: 0 
    },
    revenueSeries: [],
    orderSeries: [],
    topCustomersByOrders: [],
    topCustomersBySpending: [],
    recentOrders: [],
    dateRange: { 
      startDate: new Date().toISOString().split('T')[0], 
      endDate: new Date().toISOString().split('T')[0] 
    },
    groupBy: 'week' as const,
    _fallback: true // Flag to indicate this is fallback data
  };
}
