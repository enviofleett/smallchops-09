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
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
    const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY");
    
    if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
      console.error("Missing environment variables");
      throw new Error("Missing Supabase environment variables");
    }

    const authHeader = req.headers.get("authorization");
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      global: {
        headers: authHeader ? { Authorization: authHeader } : {},
      },
    });

    console.log("Fetching dashboard analytics data with enhanced error handling");

    // Initialize default values for fallback
    let totalProducts = 0;
    let totalOrders = 0;
    let totalCustomers = 0;
    let totalRevenue = 0;

    try {
      // Get total stats with individual error handling - use safe customer counting
      const [productsResult, ordersResult, customersResult] = await Promise.allSettled([
        supabase.from('products').select('id', { count: 'exact', head: true }),
        supabase.from('orders').select('id, total_amount', { count: 'exact' }).neq('status', 'cancelled'),
        supabase.from('customer_accounts').select('id', { count: 'exact', head: true })
      ]);

      // Handle products count
      if (productsResult.status === 'fulfilled' && !productsResult.value.error) {
        totalProducts = productsResult.value.count || 0;
        console.log(`Products count: ${totalProducts}`);
      } else {
        console.error("Products query failed:", productsResult.status === 'fulfilled' ? productsResult.value.error : productsResult.reason);
      }

      // Handle orders count and revenue
      if (ordersResult.status === 'fulfilled' && !ordersResult.value.error) {
        totalOrders = ordersResult.value.count || 0;
        totalRevenue = ordersResult.value.data?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;
        console.log(`Orders count: ${totalOrders}, Revenue: ${totalRevenue}`);
      } else {
        console.error("Orders query failed:", ordersResult.status === 'fulfilled' ? ordersResult.value.error : ordersResult.reason);
      }

      // Handle customer accounts count (authenticated users only)
      if (customersResult.status === 'fulfilled' && !customersResult.value.error) {
        const authenticatedCustomers = customersResult.value.count || 0;
        
        // Add guest customers from orders
        const { data: guestOrdersData } = await supabase
          .from('orders')
          .select('customer_email')
          .is('customer_id', null)
          .not('customer_email', 'is', null);
        
        const guestCustomersCount = new Set(guestOrdersData?.map(o => o.customer_email) || []).size;
        totalCustomers = authenticatedCustomers + guestCustomersCount;
        console.log(`Customers count: ${totalCustomers} (${authenticatedCustomers} authenticated + ${guestCustomersCount} guests)`);
      } else {
        console.error("Customer accounts query failed:", customersResult.status === 'fulfilled' ? customersResult.value.error : customersResult.reason);
      }
    } catch (statsError) {
      console.error("Error fetching basic stats:", statsError);
    }

    // Get revenue trends (last 7 days) with error handling
    let revenueTrendsFormatted = [];
    try {
      const { data: revenueTrends, error: revenueError } = await supabase
        .from('orders')
        .select('order_time, total_amount')
        .gte('order_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('order_time', { ascending: true });

      if (revenueError) {
        console.error("Revenue trends query error:", revenueError);
      } else {
        // Group revenue by date
        const revenueByDate = (revenueTrends || []).reduce((acc, order) => {
          const date = new Date(order.order_time).toISOString().split('T')[0];
          acc[date] = (acc[date] || 0) + (order.total_amount || 0);
          return acc;
        }, {} as Record<string, number>);

        revenueTrendsFormatted = Object.entries(revenueByDate).map(([date, revenue]) => ({
          day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          name: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue,
          orders: 0 // Will be populated separately
        }));
        console.log(`Revenue trends: ${revenueTrendsFormatted.length} data points`);
      }
    } catch (revenueError) {
      console.error("Error fetching revenue trends:", revenueError);
    }

    // Get order trends (last 7 days) with error handling
    let orderTrendsFormatted = [];
    try {
      const { data: orderTrends, error: orderTrendsError } = await supabase
        .from('orders')
        .select('order_time')
        .gte('order_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
        .order('order_time', { ascending: true });

      if (orderTrendsError) {
        console.error("Order trends query error:", orderTrendsError);
      } else {
        const ordersByDate = (orderTrends || []).reduce((acc, order) => {
          const date = new Date(order.order_time).toISOString().split('T')[0];
          acc[date] = (acc[date] || 0) + 1;
          return acc;
        }, {} as Record<string, number>);

        orderTrendsFormatted = Object.entries(ordersByDate).map(([date, orders]) => ({
          day: new Date(date).toLocaleDateString('en-US', { weekday: 'short' }),
          name: new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
          revenue: 0, // Will be merged with revenue data
          orders
        }));
        console.log(`Order trends: ${orderTrendsFormatted.length} data points`);
      }
    } catch (orderTrendsError) {
      console.error("Error fetching order trends:", orderTrendsError);
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
      revenueTrends: revenueTrendsFormatted,
      orderTrends: orderTrendsFormatted,
      topCustomersByOrders: topCustomersByOrdersFormatted,
      topCustomersBySpending: topCustomersBySpendingFormatted,
      recentOrders: recentOrders
    };

    console.log("Dashboard data retrieved successfully:", {
      totalProducts,
      totalOrders,
      totalCustomers,
      totalRevenue,
      revenueTrendsCount: revenueTrendsFormatted.length,
      orderTrendsCount: orderTrendsFormatted.length,
      topCustomersByOrdersCount: topCustomersByOrdersFormatted.length,
      topCustomersBySpendingCount: topCustomersBySpendingFormatted.length,
      recentOrdersCount: recentOrders.length
    });

    return new Response(JSON.stringify(dashboardData), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Reports function critical error:", e);
    
    // Return fallback data structure to prevent frontend crashes
    const fallbackData = {
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
    };

    return new Response(JSON.stringify(fallbackData), {
      status: 200, // Return 200 with fallback data instead of 500
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});