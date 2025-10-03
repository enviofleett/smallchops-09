
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
      console.log(`[Analytics API] Fetching daily analytics (attempt ${attempt}/${retryCount})...`, { startDate, endDate });
      
      // Get the Supabase client session for authentication with enhanced error handling
      const { data: { session }, error: sessionError } = await supabase.auth.getSession();
      
      if (sessionError) {
        console.error('[Auth Error] Session retrieval failed:', sessionError);
        // Check for specific auth errors
        if (sessionError.message?.includes('session') || sessionError.name === 'AuthSessionMissingError') {
          throw new Error('Your session has expired. Please refresh the page or log in again.');
        }
        throw new Error(`Session error: ${sessionError.message}`);
      }
      
      if (!session) {
        console.warn('[Auth Warning] No active session found');
        throw new Error('No active session. Please log in to view analytics.');
      }

      console.log('[Analytics API] Session validated successfully');

      // Call the endpoint directly via fetch with proper error handling
      const supabaseUrl = 'https://oknnklksdiqaifhxaccs.supabase.co';
      const url = `${supabaseUrl}/functions/v1/analytics-dashboard/daily-analytics?startDate=${encodeURIComponent(startDate)}&endDate=${encodeURIComponent(endDate)}`;
      
      console.log('[Analytics API] Calling endpoint:', { url, startDate, endDate });
      
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`,
          'Content-Type': 'application/json',
          'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9rbm5rbGtzZGlxYWlmaHhhY2NzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTMxOTA5MTQsImV4cCI6MjA2ODc2NjkxNH0.3X0OFCvuaEnf5BUxaCyYDSf1xE1uDBV4P0XBWjfy0IA'
        },
      });

      console.log('[Analytics API] Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text().catch(() => 'Unknown error');
        console.error('[Analytics API] Error response:', { status: response.status, errorText });
        
        // Provide more helpful error messages based on status code
        if (response.status === 401) {
          throw new Error('Authentication failed. Please log in again.');
        } else if (response.status === 403) {
          throw new Error('Access denied. You may not have permission to view analytics.');
        } else if (response.status >= 500) {
          throw new Error(`Server error (${response.status}). Please try again later.`);
        }
        
        throw new Error(`Analytics API error (${response.status}): ${errorText}`);
      }

      const data = await response.json();
      console.log('[Analytics API] Received data structure:', {
        hasDailyData: !!data?.dailyData,
        dailyDataLength: data?.dailyData?.length,
        hasSummary: !!data?.summary,
        hasError: !!data?.error
      });
      
      // Validate response structure
      if (!data || typeof data !== 'object') {
        throw new Error('Invalid response format from analytics API');
      }
      
      console.log(`Daily analytics data received successfully (attempt ${attempt}):`, {
        hasDailyData: Array.isArray(data.dailyData),
        dataCount: data.dailyData?.length || 0
      });
      
      // Return with proper structure and defaults
      return {
        dailyData: Array.isArray(data.dailyData) ? data.dailyData : [],
        summary: data.summary || {
          totalDays: 0,
          totalRevenue: 0,
          totalOrders: 0,
          totalCustomers: 0,
          averageDailyRevenue: 0,
          averageDailyOrders: 0
        },
        dateRange: data.dateRange || { startDate, endDate }
      };
      
    } catch (error) {
      lastError = error as Error;
      console.error(`Failed to fetch daily analytics (attempt ${attempt}/${retryCount}):`, {
        error: error instanceof Error ? error.message : String(error),
        attempt,
        retryCount
      });
      
      if (attempt === retryCount) {
        break;
      }
      
      // Exponential backoff: 1s, 2s, 4s
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt - 1) * 1000));
    }
  }
  
  // All retries failed - return fallback data
  console.warn('Daily analytics API failed after all retries, returning fallback data', {
    lastError: lastError?.message,
    retryCount
  });
  
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
    error: lastError?.message || 'Failed to fetch analytics data',
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
