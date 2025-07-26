import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsRequest {
  startDate?: string;
  endDate?: string;
  groupBy?: 'day' | 'week' | 'month';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'No authorization header' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Invalid token' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const body: AnalyticsRequest = req.method === 'POST' ? await req.json() : {};
    const { startDate, endDate, groupBy = 'day' } = body;

    // Get analytics data
    const analyticsQuery = supabaseClient
      .from('transaction_analytics')
      .select('*');

    if (startDate) {
      analyticsQuery.gte('date', startDate);
    }
    if (endDate) {
      analyticsQuery.lte('date', endDate);
    }

    const { data: analytics, error: analyticsError } = await analyticsQuery
      .order('date', { ascending: true });

    if (analyticsError) {
      throw new Error(analyticsError.message);
    }

    // Get overall statistics
    const { data: overallStats, error: statsError } = await supabaseClient
      .from('payment_transactions')
      .select(`
        status,
        amount,
        fees,
        channel,
        created_at,
        currency
      `);

    if (statsError) {
      throw new Error(statsError.message);
    }

    // Calculate summary statistics
    const summary = {
      totalTransactions: overallStats.length,
      successfulTransactions: overallStats.filter(t => t.status === 'success').length,
      failedTransactions: overallStats.filter(t => t.status === 'failed').length,
      totalRevenue: overallStats
        .filter(t => t.status === 'success')
        .reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0),
      totalFees: overallStats
        .filter(t => t.status === 'success')
        .reduce((sum, t) => sum + parseFloat(t.fees || '0'), 0),
      successRate: overallStats.length > 0 
        ? (overallStats.filter(t => t.status === 'success').length / overallStats.length) * 100
        : 0,
      channelBreakdown: overallStats.reduce((acc, t) => {
        const channel = t.channel || 'unknown';
        acc[channel] = (acc[channel] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      currencyBreakdown: overallStats.reduce((acc, t) => {
        const currency = t.currency || 'NGN';
        acc[currency] = (acc[currency] || 0) + parseFloat(t.amount || '0');
        return acc;
      }, {} as Record<string, number>)
    };

    // Get recent transactions
    const { data: recentTransactions, error: recentError } = await supabaseClient
      .from('payment_transactions')
      .select(`
        id,
        amount,
        status,
        channel,
        customer_email,
        created_at,
        provider_reference
      `)
      .order('created_at', { ascending: false })
      .limit(10);

    if (recentError) {
      throw new Error(recentError.message);
    }

    // Get top customers by transaction volume
    const topCustomersQuery = `
      SELECT 
        customer_email,
        COUNT(*) as transaction_count,
        SUM(amount) as total_spent,
        MAX(created_at) as last_transaction
      FROM payment_transactions 
      WHERE status = 'success' AND customer_email IS NOT NULL
      GROUP BY customer_email 
      ORDER BY total_spent DESC 
      LIMIT 10
    `;

    const { data: topCustomers, error: customersError } = await supabaseClient
      .rpc('exec_sql', { query: topCustomersQuery });

    return new Response(JSON.stringify({
      status: true,
      data: {
        summary,
        analytics: analytics || [],
        recentTransactions: recentTransactions || [],
        topCustomers: topCustomers || []
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Analytics error:', error);
    return new Response(JSON.stringify({
      status: false,
      error: error.message || 'Failed to fetch analytics'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});