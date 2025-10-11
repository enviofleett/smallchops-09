import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

serve(async (req) => {
  console.log(`Reports function called with method: ${req.method}`);
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Check authentication and admin role
    const authHeader = req.headers.get("authorization");
    if (!authHeader) {
      console.error("No authorization header");
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

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

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error("Missing environment variables");
      throw new Error("Missing Supabase environment variables");
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    // Verify user is admin
    const { data: userData, error: userError } = await supabase.auth.getUser(authHeader.replace('Bearer ', ''));
    if (userError || !userData.user) {
      console.error("Invalid token:", userError);
      return new Response(JSON.stringify({ error: "Invalid token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (!profile || profile.role !== 'admin') {
      console.error("User is not admin");
      return new Response(JSON.stringify({ error: "Admin access required" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    console.log(`Fetching analytics data for ${groupBy} grouping from ${startDate} to ${endDate}`);

    // Initialize default values for fallback
    let totalProducts = 0;
    let totalOrders = 0;
    let totalCustomers = 0;
    let totalRevenue = 0;

    try {
      // Get total stats with individual error handling - only production data
      const [productsResult, ordersResult, customersResult] = await Promise.allSettled([
        supabase.from('products').select('id', { count: 'exact', head: true }).not('name', 'ilike', '%test%'),
        supabase.from('orders').select('id, total_amount', { count: 'exact' }).eq('payment_status', 'paid'),
        supabase.from('customer_accounts').select('id', { count: 'exact', head: true })
      ]);

      // Handle products count
      if (productsResult.status === 'fulfilled' && !productsResult.value.error) {
        totalProducts = productsResult.value.count || 0;
        console.log(`Products count: ${totalProducts}`);
      } else {
        console.error("Products query failed:", productsResult.status === 'fulfilled' ? productsResult.value.error : productsResult.reason);
      }

      // Handle orders count and revenue - only PAID orders for production metrics
      if (ordersResult.status === 'fulfilled' && !ordersResult.value.error) {
        totalOrders = ordersResult.value.count || 0;
        totalRevenue = ordersResult.value.data?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
        console.log(`Paid orders count: ${totalOrders}, Actual revenue: ${totalRevenue}`);
      } else {
        console.error("Orders query failed:", ordersResult.status === 'fulfilled' ? ordersResult.value.error : ordersResult.reason);
      }

      // Handle customer accounts count (real customers only)
      if (customersResult.status === 'fulfilled' && !customersResult.value.error) {
        const authenticatedCustomers = customersResult.value.count || 0;
        
        // Add real guest customers from PAID orders only
        const { data: guestOrdersData } = await supabase
          .from('orders')
          .select('customer_email')
          .eq('payment_status', 'paid')
          .is('customer_id', null)
          .not('customer_email', 'is', null)
          .order('created_at', { ascending: false });
        
        const guestCustomersCount = new Set(guestOrdersData?.map(o => o.customer_email) || []).size;
        totalCustomers = authenticatedCustomers + guestCustomersCount;
        console.log(`Real customers count: ${totalCustomers} (${authenticatedCustomers} authenticated + ${guestCustomersCount} paying guests)`);
      } else {
        console.error("Customer accounts query failed:", customersResult.status === 'fulfilled' ? customersResult.value.error : customersResult.reason);
      }
    } catch (statsError) {
      console.error("Error fetching basic stats:", statsError);
    }

    // Get revenue and order trends with date range filtering and proper grouping
    let revenueSeries = [];
    let orderSeries = [];
    
    try {
      const { data: paidOrders, error: ordersError } = await supabase
        .from('orders')
        .select('order_time, total_amount')
        .eq('payment_status', 'paid')
        .gte('order_time', `${startDate}T00:00:00.000Z`)
        .lte('order_time', `${endDate}T23:59:59.999Z`)
        .order('order_time', { ascending: true });

      if (ordersError) {
        console.error("Paid orders query error:", ordersError);
      } else {
        // Group data by week or month
        const groupedData = (paidOrders || []).reduce((acc, order) => {
          const orderDate = new Date(order.order_time);
          let groupKey: string;
          let label: string;

          if (groupBy === 'month') {
            groupKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
            label = orderDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
          } else {
            // Week grouping - get Monday of the week
            const monday = new Date(orderDate);
            monday.setDate(orderDate.getDate() - orderDate.getDay() + 1);
            groupKey = `${monday.getFullYear()}-W${String(Math.ceil((monday.getTime() - new Date(monday.getFullYear(), 0, 1).getTime()) / (7 * 24 * 60 * 60 * 1000))).padStart(2, '0')}`;
            label = `Week of ${monday.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
          }

          if (!acc[groupKey]) {
            acc[groupKey] = { label, revenue: 0, orders: 0 };
          }
          acc[groupKey].revenue += order.total_amount || 0;
          acc[groupKey].orders += 1;
          return acc;
        }, {} as Record<string, { label: string; revenue: number; orders: number }>);

        // Convert to arrays for charts
        revenueSeries = Object.entries(groupedData)
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([_, data]) => data);
        
        orderSeries = [...revenueSeries]; // Same data structure
        
        console.log(`Revenue/Order series: ${revenueSeries.length} data points for ${groupBy} grouping`);
      }
    } catch (analyticsError) {
      console.error("Error fetching analytics data:", analyticsError);
    }

    // Get top customers by orders with error handling
    let topCustomersByOrdersFormatted = [];
    try {
      const { data: topCustomersByOrders, error: customersOrdersError } = await supabase
        .from('orders')
        .select('customer_name, customer_email')
        .limit(100);

      if (customersOrdersError) {
        console.error("Top customers by orders query error:", customersOrdersError);
      } else {
        const customerOrderCounts = (topCustomersByOrders || []).reduce((acc, order) => {
          const key = `${order.customer_name || 'Unknown'}-${order.customer_email || 'unknown@email.com'}`;
          acc[key] = (acc[key] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        topCustomersByOrdersFormatted = Object.entries(customerOrderCounts)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([key, orders]) => {
            const [name, email] = key.split('-');
            return { 
              id: email, 
              name, 
              email, 
              totalOrders: orders,
              totalSpent: 0
            };
          });
        console.log(`Top customers by orders: ${topCustomersByOrdersFormatted.length} customers`);
      }
    } catch (customersOrdersError) {
      console.error("Error fetching top customers by orders:", customersOrdersError);
    }

    // Get top customers by spending with error handling
    let topCustomersBySpendingFormatted = [];
    try {
      const { data: topCustomersBySpending, error: customersSpendingError } = await supabase
        .from('orders')
        .select('customer_name, customer_email, total_amount')
        .limit(100);

      if (customersSpendingError) {
        console.error("Top customers by spending query error:", customersSpendingError);
      } else {
        const customerSpending = (topCustomersBySpending || []).reduce((acc, order) => {
          const key = `${order.customer_name || 'Unknown'}-${order.customer_email || 'unknown@email.com'}`;
          acc[key] = (acc[key] || 0) + (order.total_amount || 0);
          return acc;
        }, {} as Record<string, number>);

        topCustomersBySpendingFormatted = Object.entries(customerSpending)
          .sort(([,a], [,b]) => b - a)
          .slice(0, 5)
          .map(([key, spending]) => {
            const [name, email] = key.split('-');
            return { 
              id: email, 
              name, 
              email, 
              totalOrders: 0,
              totalSpent: spending
            };
          });
        console.log(`Top customers by spending: ${topCustomersBySpendingFormatted.length} customers`);
      }
    } catch (customersSpendingError) {
      console.error("Error fetching top customers by spending:", customersSpendingError);
    }

    // Get recent orders with error handling
    let recentOrders = [];
    try {
      const { data: recentOrdersData, error: recentOrdersError } = await supabase
        .from('orders')
        .select('id, order_number, customer_name, total_amount, status, order_time')
        .order('order_time', { ascending: false })
        .limit(10);

      if (recentOrdersError) {
        console.error("Recent orders query error:", recentOrdersError);
      } else {
        recentOrders = recentOrdersData || [];
        console.log(`Recent orders: ${recentOrders.length} orders`);
      }
    } catch (recentOrdersError) {
      console.error("Error fetching recent orders:", recentOrdersError);
    }

    const dashboardData = {
      stats: {
        totalProducts,
        totalOrders,
        totalCustomers,
        totalRevenue
      },
      revenueSeries,
      orderSeries,
      topCustomersByOrders: topCustomersByOrdersFormatted,
      topCustomersBySpending: topCustomersBySpendingFormatted,
      recentOrders: recentOrders,
      dateRange: { startDate, endDate },
      groupBy
    };

    console.log("Dashboard data retrieved successfully:", {
      totalProducts,
      totalOrders,
      totalCustomers,
      totalRevenue,
      revenueSeriesCount: revenueSeries.length,
      orderSeriesCount: orderSeries.length,
      topCustomersByOrdersCount: topCustomersByOrdersFormatted.length,
      topCustomersBySpendingCount: topCustomersBySpendingFormatted.length,
      recentOrdersCount: recentOrders.length,
      groupBy,
      dateRange: `${startDate} to ${endDate}`
    });

    return new Response(JSON.stringify(dashboardData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Reports function critical error:", e.message || e);
    
    // Return fallback data structure to prevent frontend crashes
    const fallbackData = {
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
      dateRange: { startDate: new Date().toISOString().split('T')[0], endDate: new Date().toISOString().split('T')[0] },
      groupBy: 'week'
    };

    return new Response(JSON.stringify(fallbackData), {
      status: 200, // Return 200 with fallback data instead of 500
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});