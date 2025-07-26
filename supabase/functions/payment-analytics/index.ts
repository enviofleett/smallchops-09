import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE',
};

interface AnalyticsRequest {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Authorization required' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Check if user is admin
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { startDate, endDate, groupBy }: AnalyticsRequest = await req.json().catch(() => ({}));

    // Get analytics data from transaction_analytics table
    const { data: analyticsData, error: analyticsError } = await supabaseClient
      .from('transaction_analytics')
      .select('*')
      .order('date', { ascending: false })
      .limit(100);

    if (analyticsError) {
      console.error('Analytics error:', analyticsError);
    }

    // Get overall statistics from payment_transactions
    const { data: transactionStats, error: statsError } = await supabaseClient
      .from('payment_transactions')
      .select('status, amount, fees, channel, currency, created_at');

    if (statsError) {
      console.error('Stats error:', statsError);
    }

    // Calculate summary statistics
    const totalTransactions = transactionStats?.length || 0;
    const successfulTransactions = transactionStats?.filter(t => t.status === 'success').length || 0;
    const failedTransactions = transactionStats?.filter(t => t.status === 'failed').length || 0;
    const totalRevenue = transactionStats?.filter(t => t.status === 'success')
      .reduce((sum, t) => sum + (parseFloat(t.amount?.toString() || '0')), 0) || 0;
    const totalFees = transactionStats?.filter(t => t.status === 'success')
      .reduce((sum, t) => sum + (parseFloat(t.fees?.toString() || '0')), 0) || 0;
    const successRate = totalTransactions > 0 ? (successfulTransactions / totalTransactions) * 100 : 0;

    // Channel breakdown
    const channelBreakdown = transactionStats?.reduce((acc: any, t) => {
      if (t.status === 'success' && t.channel) {
        acc[t.channel] = (acc[t.channel] || 0) + 1;
      }
      return acc;
    }, {}) || {};

    // Currency breakdown
    const currencyBreakdown = transactionStats?.reduce((acc: any, t) => {
      if (t.status === 'success' && t.currency) {
        acc[t.currency] = (acc[t.currency] || 0) + parseFloat(t.amount?.toString() || '0');
      }
      return acc;
    }, {}) || {};

    // Get recent transactions
    const { data: recentTransactions, error: recentError } = await supabaseClient
      .from('payment_transactions')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      console.error('Recent transactions error:', recentError);
    }

    // Get top customers by total spent
    const { data: topCustomersData, error: customersError } = await supabaseClient
      .from('payment_transactions')
      .select('customer_email, amount')
      .eq('status', 'success');

    let topCustomers: any[] = [];
    if (topCustomersData && !customersError) {
      const customerTotals = topCustomersData.reduce((acc: any, t) => {
        if (t.customer_email) {
          acc[t.customer_email] = (acc[t.customer_email] || 0) + parseFloat(t.amount?.toString() || '0');
        }
        return acc;
      }, {});

      topCustomers = Object.entries(customerTotals)
        .map(([email, total]) => ({ customer_email: email, total_spent: total }))
        .sort((a, b) => (b.total_spent as number) - (a.total_spent as number))
        .slice(0, 10);
    }

    const response = {
      summary: {
        totalTransactions,
        successfulTransactions,
        failedTransactions,
        totalRevenue,
        totalFees,
        successRate,
        channelBreakdown,
        currencyBreakdown
      },
      analytics: analyticsData || [],
      recentTransactions: recentTransactions || [],
      topCustomers: topCustomers || []
    };

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Payment analytics error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});