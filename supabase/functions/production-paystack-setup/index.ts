import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SetupRequest {
  action: 'configure_paystack' | 'verify_setup' | 'fix_orders' | 'get_status';
  paystack_secret_key?: string;
  force_cleanup?: boolean;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Initialize Supabase clients
  const supabaseService = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  const supabaseAuth = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  );

  try {
    // Verify admin access
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response('Authorization required', { status: 401, headers: corsHeaders });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: userError } = await supabaseAuth.auth.getUser(token);
    
    if (userError || !userData?.user) {
      return new Response('Invalid token', { status: 401, headers: corsHeaders });
    }

    // Check admin status
    const { data: profile } = await supabaseService
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response('Admin access required', { status: 403, headers: corsHeaders });
    }

    const { action, paystack_secret_key, force_cleanup }: SetupRequest = await req.json();

    switch (action) {
      case 'configure_paystack':
        return await configurePaystack(supabaseService, paystack_secret_key);
      
      case 'verify_setup':
        return await verifySetup();
      
      case 'fix_orders':
        return await fixOrders(supabaseService, force_cleanup);
      
      case 'get_status':
        return await getProductionStatus(supabaseService);
      
      default:
        return new Response('Invalid action', { status: 400, headers: corsHeaders });
    }

  } catch (error) {
    console.error('Production setup error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

async function configurePaystack(supabase: any, secretKey?: string): Promise<Response> {
  try {
    if (!secretKey) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'PAYSTACK_SECRET_KEY is required',
          instructions: 'Please provide your Paystack secret key (starts with sk_test_ or sk_live_)'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate secret key format
    if (!secretKey.startsWith('sk_test_') && !secretKey.startsWith('sk_live_')) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid secret key format. Must start with sk_test_ or sk_live_'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Test the secret key with Paystack API
    const testResponse = await fetch('https://api.paystack.co/transaction', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!testResponse.ok) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid Paystack secret key - API test failed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update payment integrations table
    const { error: updateError } = await supabase
      .from('payment_integrations')
      .update({
        secret_key: secretKey,
        is_active: true,
        test_mode: secretKey.startsWith('sk_test_'),
        updated_at: new Date().toISOString()
      })
      .eq('provider', 'paystack');

    if (updateError) {
      throw updateError;
    }

    // Log the configuration
    await supabase.from('audit_logs').insert({
      action: 'paystack_configured',
      category: 'Payment Configuration',
      message: `Paystack ${secretKey.startsWith('sk_test_') ? 'test' : 'live'} mode configured`,
      new_values: {
        provider: 'paystack',
        test_mode: secretKey.startsWith('sk_test_'),
        configured_at: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Paystack configuration updated successfully',
        test_mode: secretKey.startsWith('sk_test_'),
        next_steps: [
          'Environment variable PAYSTACK_SECRET_KEY needs to be set in Supabase Secrets',
          'Test webhook processing',
          'Fix existing payment-order linkages'
        ]
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Paystack configuration error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function verifySetup(): Promise<Response> {
  try {
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    
    const checks = {
      environment_variable: !!secretKey,
      secret_key_format: secretKey ? (secretKey.startsWith('sk_test_') || secretKey.startsWith('sk_live_')) : false,
      paystack_api_access: false
    };

    // Test Paystack API access
    if (secretKey) {
      try {
        const testResponse = await fetch('https://api.paystack.co/transaction', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${secretKey}`,
            'Content-Type': 'application/json'
          }
        });
        checks.paystack_api_access = testResponse.ok;
      } catch (error) {
        console.error('Paystack API test failed:', error);
      }
    }

    const allChecksPass = Object.values(checks).every(check => check === true);

    return new Response(
      JSON.stringify({ 
        success: allChecksPass,
        checks,
        message: allChecksPass 
          ? 'All Paystack setup checks passed'
          : 'Some setup checks failed - see details',
        instructions: !allChecksPass ? [
          !checks.environment_variable && 'Set PAYSTACK_SECRET_KEY in Supabase Edge Functions Secrets',
          !checks.secret_key_format && 'Ensure secret key format is correct (sk_test_* or sk_live_*)',
          !checks.paystack_api_access && 'Verify secret key has API access'
        ].filter(Boolean) : []
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Setup verification error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function fixOrders(supabase: any, forceCleanup = false): Promise<Response> {
  try {
    const results = {
      linked_orders: 0,
      updated_statuses: 0,
      created_profiles: 0,
      errors: []
    };

    // Fix 1: Link payment transactions to orders
    const { data: unlinkedTransactions } = await supabase
      .from('payment_transactions')
      .select('id, provider_reference, metadata, status')
      .is('order_id', null)
      .eq('status', 'paid');

    for (const transaction of unlinkedTransactions || []) {
      try {
        // Try to find order by payment reference
        const { data: order } = await supabase
          .from('orders')
          .select('id')
          .eq('payment_reference', transaction.provider_reference)
          .maybeSingle();

        if (order) {
          await supabase
            .from('payment_transactions')
            .update({ 
              order_id: order.id,
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.id);
          
          results.linked_orders++;
        }
      } catch (error) {
        results.errors.push(`Failed to link transaction ${transaction.id}: ${error.message}`);
      }
    }

    // Fix 2: Update order statuses for paid transactions
    const { data: paidTransactions } = await supabase
      .from('payment_transactions')
      .select('order_id')
      .eq('status', 'paid')
      .not('order_id', 'is', null);

    for (const transaction of paidTransactions || []) {
      try {
        const { data: order } = await supabase
          .from('orders')
          .select('payment_status, status')
          .eq('id', transaction.order_id)
          .single();

        if (order && order.payment_status !== 'paid') {
          await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              status: order.status === 'pending' ? 'confirmed' : order.status,
              paid_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', transaction.order_id);
          
          results.updated_statuses++;
        }
      } catch (error) {
        results.errors.push(`Failed to update order status: ${error.message}`);
      }
    }

    // Log the cleanup operation
    await supabase.from('audit_logs').insert({
      action: 'production_data_cleanup',
      category: 'System Maintenance',
      message: `Fixed ${results.linked_orders} order linkages and ${results.updated_statuses} statuses`,
      new_values: results
    });

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Order fixes completed',
        results
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Order fix error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}

async function getProductionStatus(supabase: any): Promise<Response> {
  try {
    // Get payment statistics
    const { data: paymentStats } = await supabase
      .from('payment_transactions')
      .select('status, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const totalPayments = paymentStats?.length || 0;
    const successfulPayments = paymentStats?.filter(p => p.status === 'paid').length || 0;
    const successRate = totalPayments > 0 ? ((successfulPayments / totalPayments) * 100).toFixed(2) : '0';

    // Get webhook processing statistics
    const { data: webhookStats } = await supabase
      .from('webhook_events')
      .select('processed, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const totalWebhooks = webhookStats?.length || 0;
    const processedWebhooks = webhookStats?.filter(w => w.processed).length || 0;
    const webhookSuccessRate = totalWebhooks > 0 ? ((processedWebhooks / totalWebhooks) * 100).toFixed(2) : '0';

    // Get order completion statistics
    const { data: orderStats } = await supabase
      .from('orders')
      .select('payment_status, status, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const totalOrders = orderStats?.length || 0;
    const paidOrders = orderStats?.filter(o => o.payment_status === 'paid').length || 0;
    const completedOrders = orderStats?.filter(o => o.status === 'completed').length || 0;

    const status = {
      environment_check: {
        paystack_secret_configured: !!Deno.env.get('PAYSTACK_SECRET_KEY'),
        supabase_configured: true
      },
      payment_metrics: {
        total_payments_24h: totalPayments,
        successful_payments_24h: successfulPayments,
        payment_success_rate: `${successRate}%`
      },
      webhook_metrics: {
        total_webhooks_24h: totalWebhooks,
        processed_webhooks_24h: processedWebhooks,
        webhook_success_rate: `${webhookSuccessRate}%`
      },
      order_metrics: {
        total_orders_24h: totalOrders,
        paid_orders_24h: paidOrders,
        completed_orders_24h: completedOrders,
        order_completion_rate: totalOrders > 0 ? `${((completedOrders / totalOrders) * 100).toFixed(2)}%` : '0%'
      },
      production_ready: false
    };

    // Determine if system is production ready
    status.production_ready = 
      status.environment_check.paystack_secret_configured &&
      parseFloat(status.webhook_metrics.webhook_success_rate) > 80 &&
      parseFloat(status.payment_metrics.payment_success_rate) > 70;

    return new Response(
      JSON.stringify({ 
        success: true,
        status,
        recommendations: status.production_ready ? [] : [
          !status.environment_check.paystack_secret_configured && 'Configure PAYSTACK_SECRET_KEY environment variable',
          parseFloat(status.webhook_metrics.webhook_success_rate) <= 80 && 'Improve webhook processing reliability',
          parseFloat(status.payment_metrics.payment_success_rate) <= 70 && 'Investigate payment processing issues'
        ].filter(Boolean)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Production status error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
}