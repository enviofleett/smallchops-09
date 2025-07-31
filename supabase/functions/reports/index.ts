
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Environment-aware CORS headers for production security
function getCorsHeaders(origin: string | null): Record<string, string> {
  // Allow any Lovable project domain for development/preview
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.lovableproject.com', // Production
    /^https:\/\/[\w-]+\.lovableproject\.com$/, // Dev/Preview domains
    /^https:\/\/[\w-]+\.lovable\.dev$/ // lovable.dev domains
  ];
  
  const isAllowed = origin && allowedOrigins.some(allowed => 
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin)
  );
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : 'https://oknnklksdiqaifhxaccs.lovableproject.com',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
}

serve(async (req) => {
  console.log(`Reports function called with method: ${req.method}, URL: ${req.url}`);
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Missing environment variables");
      throw new Error("Missing Supabase environment variables");
    }

    // Get authorization header for authenticated requests
    const authHeader = req.headers.get("authorization");
    console.log("Authorization header present:", !!authHeader);

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    console.log("Calling get_dashboard_data function");
    
    // Call the enhanced database function
    const { data, error } = await supabase.rpc("get_dashboard_data");

    if (error) {
      console.error("Database function error:", error);
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("Dashboard data retrieved successfully:", data);

    // The data is already in the correct format from the enhanced function
    const transformedData = {
      kpiStats: data?.kpiStats || {
        todaysRevenue: 0,
        ordersToday: 0,
        pendingOrders: 0,
        completedOrders: 0
      },
      revenueTrends: data?.revenueTrends || [],
      orderTrends: data?.orderTrends || [],
      recentOrders: data?.recentOrders || [],
      popularItems: data?.popularItems || []
    };

    return new Response(JSON.stringify({ data: transformedData }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Reports function error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
