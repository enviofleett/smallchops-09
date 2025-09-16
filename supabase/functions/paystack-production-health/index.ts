import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getPaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('🏥 Starting production health check...')

    // Get Paystack configuration
    const paystackConfig = getPaystackConfig(req)
    logPaystackConfigStatus(paystackConfig)

    // Get live payment status from database function
    const { data: paymentStatus, error: statusError } = await supabase
      .rpc('get_live_payment_status')

    if (statusError) {
      console.error('❌ Error getting payment status:', statusError)
    }

    // Check recent payment transactions
    const { data: recentPayments, error: paymentsError } = await supabase
      .from('payment_transactions')
      .select('id, status, amount, created_at, provider_reference')
      .order('created_at', { ascending: false })
      .limit(10)

    // Check system health metrics
    const { data: healthMetrics, error: metricsError } = await supabase
      .from('production_health_metrics')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(5)

    // Check order completion rates
    const { data: orderStats, error: orderError } = await supabase
      .from('orders')
      .select('status, created_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

    let orderCompletionRate = 0
    if (orderStats && orderStats.length > 0) {
      const completedOrders = orderStats.filter(order => 
        ['delivered', 'completed'].includes(order.status)
      ).length
      orderCompletionRate = Math.round((completedOrders / orderStats.length) * 100)
    }

    // Compile health report
    const healthReport = {
      timestamp: new Date().toISOString(),
      environment: paystackConfig.environment,
      paystack_mode: paystackConfig.isTestMode ? 'test' : 'live',
      status: 'healthy',
      metrics: {
        payment_status: paymentStatus || { error: statusError?.message },
        recent_payments_count: recentPayments?.length || 0,
        recent_payments: recentPayments?.slice(0, 5) || [],
        order_completion_rate: orderCompletionRate,
        total_orders_24h: orderStats?.length || 0,
        health_metrics: healthMetrics || []
      },
      configuration: {
        has_live_keys: !paystackConfig.secretKey.startsWith('sk_test_'),
        webhook_url: 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/enhanced-paystack-webhook',
        force_live_mode: Deno.env.get('FORCE_LIVE_MODE') === 'true'
      },
      errors: {
        status_error: statusError?.message,
        payments_error: paymentsError?.message,
        metrics_error: metricsError?.message,
        order_error: orderError?.message
      }
    }

    // Log production metric
    try {
      await supabase.rpc('log_production_metric', {
        p_metric_name: 'health_check_success',
        p_metric_value: 1,
        p_metric_type: 'counter',
        p_dimensions: { environment: paystackConfig.environment }
      })
    } catch (logError) {
      console.error('⚠️ Failed to log health metric:', logError)
    }

    console.log('✅ Production health check completed successfully')

    return new Response(
      JSON.stringify(healthReport),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('🚨 Production health check failed:', error)
    
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
        status: 'unhealthy'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})