
import { supabase } from "@/integrations/supabase/client";

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
        productPerformance: {
          topProducts: [],
          categoryPerformance: [],
          revenueByProduct: []
        },
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
    productPerformance: {
      topProducts: [],
      categoryPerformance: [],
      revenueByProduct: []
    },
    dateRange: { 
      startDate: new Date().toISOString().split('T')[0], 
      endDate: new Date().toISOString().split('T')[0] 
    },
    groupBy: 'week' as const,
    _fallback: true // Flag to indicate this is fallback data
  };
}
