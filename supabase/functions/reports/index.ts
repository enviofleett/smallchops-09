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

    console.log("Fetching dashboard analytics data");

    // Get total stats
    const [productsResult, ordersResult, customersResult] = await Promise.all([
      supabase.from('products').select('id', { count: 'exact', head: true }),
      supabase.from('orders').select('id, total_amount', { count: 'exact' }),
      supabase.from('customers').select('id', { count: 'exact', head: true })
    ]);

    const totalProducts = productsResult.count || 0;
    const totalOrders = ordersResult.count || 0;
    const totalCustomers = customersResult.count || 0;
    const totalRevenue = ordersResult.data?.reduce((sum, order) => sum + (order.total_amount || 0), 0) || 0;

    // Get revenue trends (last 7 days)
    const { data: revenueTrends } = await supabase
      .from('orders')
      .select('order_time, total_amount')
      .gte('order_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('order_time', { ascending: true });

    // Group revenue by date
    const revenueByDate = (revenueTrends || []).reduce((acc, order) => {
      const date = new Date(order.order_time).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + order.total_amount;
      return acc;
    }, {} as Record<string, number>);

    const revenueTrendsFormatted = Object.entries(revenueByDate).map(([date, revenue]) => ({
      date,
      revenue
    }));

    // Get order trends (last 7 days)
    const { data: orderTrends } = await supabase
      .from('orders')
      .select('order_time')
      .gte('order_time', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
      .order('order_time', { ascending: true });

    const ordersByDate = (orderTrends || []).reduce((acc, order) => {
      const date = new Date(order.order_time).toISOString().split('T')[0];
      acc[date] = (acc[date] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const orderTrendsFormatted = Object.entries(ordersByDate).map(([date, orders]) => ({
      date,
      orders
    }));

    // Get top customers by orders
    const { data: topCustomersByOrders } = await supabase
      .from('orders')
      .select('customer_name, customer_email')
      .limit(100);

    const customerOrderCounts = (topCustomersByOrders || []).reduce((acc, order) => {
      const key = `${order.customer_name}-${order.customer_email}`;
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    const topCustomersByOrdersFormatted = Object.entries(customerOrderCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([key, orders]) => {
        const [name, email] = key.split('-');
        return { customer_name: name, customer_email: email, orders };
      });

    // Get top customers by spending
    const { data: topCustomersBySpending } = await supabase
      .from('orders')
      .select('customer_name, customer_email, total_amount')
      .limit(100);

    const customerSpending = (topCustomersBySpending || []).reduce((acc, order) => {
      const key = `${order.customer_name}-${order.customer_email}`;
      acc[key] = (acc[key] || 0) + order.total_amount;
      return acc;
    }, {} as Record<string, number>);

    const topCustomersBySpendingFormatted = Object.entries(customerSpending)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([key, spending]) => {
        const [name, email] = key.split('-');
        return { customer_name: name, customer_email: email, spending };
      });

    // Get recent orders
    const { data: recentOrders } = await supabase
      .from('orders')
      .select('id, order_number, customer_name, total_amount, status, order_time')
      .order('order_time', { ascending: false })
      .limit(10);

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
      recentOrders: recentOrders || []
    };

    console.log("Dashboard data retrieved successfully");

    return new Response(JSON.stringify({ data: dashboardData }), {
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