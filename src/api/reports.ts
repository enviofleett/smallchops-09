
import { supabase } from "@/integrations/supabase/client";
import { classifyError, logError, shouldRetry, calculateRetryDelay, type ClassifiedError } from "@/utils/errorClassification";
import { dashboardApiCircuitBreaker } from "@/utils/circuitBreaker";

/**
 * API utility for fetching analytics data from the Supabase reports Edge Function.
 * Enhanced with sophisticated retry logic, error classification, and circuit breaker for production use.
 */
export async function fetchReportsData(
  params: {
    groupBy?: 'week' | 'month';
    startDate?: string;
    endDate?: string;
    retryCount?: number;
  } = {}
): Promise<any> {
  const { groupBy = 'week', startDate, endDate, retryCount = 3 } = params;
  
  // Check circuit breaker before attempting request
  if (!dashboardApiCircuitBreaker.isAvailable()) {
    const stats = dashboardApiCircuitBreaker.getStats();
    throw new Error(`Dashboard API is temporarily unavailable (Circuit breaker is ${stats.state}). Next attempt available at ${new Date(stats.nextAttempt).toLocaleTimeString()}`);
  }

  // Execute request through circuit breaker
  return await dashboardApiCircuitBreaker.execute(async () => {
    let lastClassifiedError: ClassifiedError | null = null;
    
    for (let attempt = 1; attempt <= retryCount; attempt++) {
      try {
        console.log(`📊 Fetching reports data (attempt ${attempt}/${retryCount})...`);
        
        const { data, error } = await supabase.functions.invoke('reports', {
          method: 'POST',
          body: { groupBy, startDate, endDate }
        });
        
        if (error) {
          console.error(`Reports function error (attempt ${attempt}):`, error);
          throw new Error(error.message || 'Reports function failed');
        }
        
        console.log(`✅ Reports data received successfully (attempt ${attempt}):`, {
          hasData: !!data,
          dataKeys: data ? Object.keys(data) : []
        });
        
        // Extract nested data if wrapped in 'data' property
        const extractedData = data?.data || data;
        
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
        // Classify the error for better handling
        const classifiedError = classifyError(error);
        lastClassifiedError = classifiedError;
        
        // Log the error with context
        logError(classifiedError, {
          component: 'fetchReportsData',
          attempt,
          retryCount,
          params,
          circuitBreakerState: dashboardApiCircuitBreaker.getStats().state
        });
        
        console.error(`❌ Failed to fetch reports data (attempt ${attempt}/${retryCount}):`, {
          errorId: classifiedError.errorId,
          type: classifiedError.type,
          userMessage: classifiedError.userMessage
        });
        
        // Don't retry if error is not retryable or if this was the last attempt
        if (!shouldRetry(classifiedError, attempt - 1, retryCount) || attempt === retryCount) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = calculateRetryDelay(attempt - 1);
        console.log(`⏳ Waiting ${delay}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
    
    // If all retries failed, throw the classified error
    if (lastClassifiedError) {
      const enhancedError = new Error(lastClassifiedError.technicalMessage);
      (enhancedError as any).classified = lastClassifiedError;
      throw enhancedError;
    }
    
    throw new Error("Failed to fetch reports data after all retries");
  });
}
