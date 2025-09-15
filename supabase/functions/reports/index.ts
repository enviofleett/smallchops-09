import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

serve(async (req) => {
  console.log(`Reports function called with method: ${req.method}`);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // ✅ PRODUCTION-READY: Extract authorization header
    const authHeader = req.headers.get("authorization");
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("Missing or invalid authorization header");
      return new Response(JSON.stringify({ 
        error: "Unauthorized: Missing or invalid authentication token",
        code: "AUTH_TOKEN_MISSING" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ Authorization header validated");

    // Parse request body for parameters
    let requestBody = {};
    if (req.method === "POST") {
      try {
        requestBody = await req.json();
      } catch (e) {
        console.log("No JSON body provided, using defaults");
      }
    }

    const { 
      groupBy = 'week', 
      startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      endDate = new Date().toISOString().split('T')[0]
    } = requestBody as { groupBy?: 'week' | 'month'; startDate?: string; endDate?: string };

    console.log(`Reports parameters: groupBy=${groupBy}, startDate=${startDate}, endDate=${endDate}`);

    // ✅ PRODUCTION-READY: Use authenticated Supabase client
    // Since verify_jwt = true, the user is automatically authenticated by Supabase
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Missing environment variables");
      throw new Error("Missing Supabase environment variables");
    }

    // Create client with user's JWT (automatically validated by verify_jwt = true)
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: {
          Authorization: authHeader,
        },
      },
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Get authenticated user (JWT already validated by Supabase)
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      console.error("Authentication failed:", userError);
      return new Response(JSON.stringify({ 
        error: "Authentication failed. Please log in again.",
        code: "AUTH_FAILED" 
      }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ User authenticated:", user.id);

    // Verify user is admin using service role for reliable access
    const serviceSupabase = createClient(
      SUPABASE_URL, 
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ''
    );

    const { data: profile, error: profileError } = await serviceSupabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || !profile || profile.role !== 'admin') {
      console.error("User is not admin:", profileError);
      return new Response(JSON.stringify({ 
        error: "Admin access required",
        code: "ADMIN_ACCESS_REQUIRED" 
      }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log("✅ Admin access verified for user:", user.id);

    // Generate date range for grouping
    const start = new Date(startDate);
    const end = new Date(endDate);
    
    console.log(`Generating reports from ${start.toISOString()} to ${end.toISOString()}`);

    // ✅ PRODUCTION-OPTIMIZED: Fetch aggregated data efficiently
    const { data: ordersData, error: ordersError } = await serviceSupabase
      .from('orders')
      .select(`
        id,
        created_at,
        total_amount,
        status,
        payment_status,
        order_type,
        customer_id
      `)
      .gte('created_at', start.toISOString())
      .lte('created_at', end.toISOString())
      .order('created_at', { ascending: true });

    if (ordersError) {
      console.error("Error fetching orders:", ordersError);
      throw new Error(`Failed to fetch orders data: ${ordersError.message}`);
    }

    console.log(`✅ Fetched ${ordersData?.length || 0} orders for analysis`);

    // ✅ PRODUCTION-OPTIMIZED: Process data efficiently
    const reports = generateReports(ordersData || [], groupBy, start, end);

    return new Response(JSON.stringify({
      success: true,
      data: reports,
      metadata: {
        total_orders: ordersData?.length || 0,
        date_range: { startDate, endDate },
        groupBy,
        generated_at: new Date().toISOString()
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("Reports function error:", error);
    
    return new Response(JSON.stringify({
      error: "Internal server error",
      message: error.message || "Failed to generate reports",
      code: "REPORTS_GENERATION_FAILED"
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

// ✅ PRODUCTION-OPTIMIZED: Efficient report generation
function generateReports(
  orders: any[], 
  groupBy: 'week' | 'month', 
  startDate: Date, 
  endDate: Date
) {
  const reports: any[] = [];
  const current = new Date(startDate);
  
  while (current <= endDate) {
    const periodEnd = new Date(current);
    
    if (groupBy === 'week') {
      periodEnd.setDate(current.getDate() + 6);
    } else {
      periodEnd.setMonth(current.getMonth() + 1);
      periodEnd.setDate(0); // Last day of month
    }
    
    // Filter orders for this period
    const periodOrders = orders.filter(order => {
      const orderDate = new Date(order.created_at);
      return orderDate >= current && orderDate <= periodEnd;
    });
    
    // Calculate metrics
    const totalRevenue = periodOrders
      .filter(order => order.payment_status === 'paid')
      .reduce((sum, order) => sum + (order.total_amount || 0), 0);
    
    const totalOrders = periodOrders.length;
    const paidOrders = periodOrders.filter(order => order.payment_status === 'paid').length;
    const deliveryOrders = periodOrders.filter(order => order.order_type === 'delivery').length;
    const pickupOrders = periodOrders.filter(order => order.order_type === 'pickup').length;
    
    // Get unique customers
    const uniqueCustomers = new Set(
      periodOrders
        .filter(order => order.customer_id)
        .map(order => order.customer_id)
    ).size;
    
    reports.push({
      period: formatPeriod(current, periodEnd, groupBy),
      period_start: current.toISOString().split('T')[0],
      period_end: periodEnd.toISOString().split('T')[0],
      metrics: {
        total_orders: totalOrders,
        paid_orders: paidOrders,
        total_revenue: totalRevenue,
        average_order_value: totalOrders > 0 ? totalRevenue / paidOrders : 0,
        delivery_orders: deliveryOrders,
        pickup_orders: pickupOrders,
        unique_customers: uniqueCustomers,
        conversion_rate: totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0
      }
    });
    
    // Move to next period
    if (groupBy === 'week') {
      current.setDate(current.getDate() + 7);
    } else {
      current.setMonth(current.getMonth() + 1);
      current.setDate(1);
    }
  }
  
  return reports;
}

function formatPeriod(start: Date, end: Date, groupBy: 'week' | 'month'): string {
  if (groupBy === 'week') {
    return `Week of ${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
  } else {
    return start.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
  }
}