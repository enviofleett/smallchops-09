
import { supabase } from "@/integrations/supabase/client";

/**
 * API utility for fetching analytics data from the Supabase reports Edge Function.
 * Enhanced with retry logic and better error handling for production use.
 */
export async function fetchReportsData(retryCount = 3) {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= retryCount; attempt++) {
    try {
      console.log(`Fetching reports data (attempt ${attempt}/${retryCount})...`);
      
      // Get the current session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      
      // Add authorization header if user is authenticated
      if (session?.access_token) {
        headers.authorization = `Bearer ${session.access_token}`;
        console.log("Adding authorization header");
      } else {
        console.warn("No session found, proceeding without authentication");
      }
      
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30s timeout
      
      const res = await fetch("https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/reports", {
        method: "GET",
        headers,
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      console.log(`Response status (attempt ${attempt}):`, res.status);
      
      if (!res.ok) {
        const errorText = await res.text();
        console.error(`Reports API error (attempt ${attempt}):`, res.status, errorText);
        
        // Don't retry on client errors (4xx)
        if (res.status >= 400 && res.status < 500) {
          throw new Error(`HTTP ${res.status}: ${errorText || "Client error - not retrying"}`);
        }
        
        throw new Error(`HTTP ${res.status}: ${errorText || "Server error"}`);
      }
      
      const json = await res.json();
      console.log(`Reports data received successfully (attempt ${attempt}):`, {
        hasData: !!json.data,
        hasError: !!json.error,
        dataKeys: json.data ? Object.keys(json.data) : []
      });
      
      // Handle graceful degradation - return partial data even if there's an error message
      if (json.error && !json.data) {
        console.error("Reports API returned error:", json.error);
        throw new Error(json.error);
      }
      
      // Return the data, even if there's a warning/error message
      return json.data || {
        stats: { totalProducts: 0, totalOrders: 0, totalCustomers: 0, totalRevenue: 0 },
        revenueTrends: [],
        orderTrends: [],
        topCustomersByOrders: [],
        topCustomersBySpending: [],
        recentOrders: []
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
  
  // If all retries failed, throw the last error
  throw lastError || new Error("Failed to fetch reports data after all retries");
}
