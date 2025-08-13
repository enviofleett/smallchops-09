import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

interface HealthCheckResult {
  paystack_configured: boolean
  environment_health: 'healthy' | 'warning' | 'critical'
  database_connectivity: boolean
  payment_flow_health: {
    recent_success_rate: number
    total_recent_payments: number
    failed_payments: number
  }
  configuration_issues: string[]
  recommendations: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[HEALTH-CHECK] Starting payment system health check')
    
    const result: HealthCheckResult = {
      paystack_configured: false,
      environment_health: 'critical',
      database_connectivity: false,
      payment_flow_health: {
        recent_success_rate: 0,
        total_recent_payments: 0,
        failed_payments: 0
      },
      configuration_issues: [],
      recommendations: []
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Test database connectivity
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .limit(1)

      if (!error) {
        result.database_connectivity = true
        console.log('[HEALTH-CHECK] Database connectivity: OK')
      } else {
        result.configuration_issues.push('Database connectivity failed')
        console.error('[HEALTH-CHECK] Database error:', error)
      }
    } catch (dbError) {
      result.configuration_issues.push('Database connection error')
      console.error('[HEALTH-CHECK] Database connection error:', dbError)
    }

    // Check Paystack configuration
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    
    if (!paystackSecretKey) {
      result.configuration_issues.push('PAYSTACK_SECRET_KEY environment variable not set')
      result.recommendations.push('Set PAYSTACK_SECRET_KEY in Supabase Edge Functions secrets')
    } else {
      result.paystack_configured = true
      
      if (paystackSecretKey.startsWith('sk_test_')) {
        result.recommendations.push('Using test Paystack key - ensure this is correct for your environment')
        console.log('[HEALTH-CHECK] Paystack test key detected')
      } else if (paystackSecretKey.startsWith('sk_live_')) {
        console.log('[HEALTH-CHECK] Paystack live key detected')
      } else {
        result.configuration_issues.push('Invalid PAYSTACK_SECRET_KEY format - must start with sk_test_ or sk_live_')
      }
    }

    // Test Paystack API connectivity
    if (result.paystack_configured && !result.configuration_issues.find(issue => issue.includes('Invalid PAYSTACK_SECRET_KEY'))) {
      try {
        const testResponse = await fetch('https://api.paystack.co/bank', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          }
        })

        if (testResponse.ok) {
          console.log('[HEALTH-CHECK] Paystack API connectivity: OK')
        } else {
          result.configuration_issues.push('Paystack API authentication failed')
          console.error('[HEALTH-CHECK] Paystack API error:', testResponse.status)
        }
      } catch (apiError) {
        result.configuration_issues.push('Could not verify Paystack API connectivity')
        console.error('[HEALTH-CHECK] Paystack API test error:', apiError)
      }
    }

    // Analyze recent payment performance
    if (result.database_connectivity) {
      try {
        const { data: recentOrders } = await supabase
          .from('orders')
          .select('id, payment_status, status')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        if (recentOrders) {
          const totalRecent = recentOrders.length
          const successfulPayments = recentOrders.filter(order => order.payment_status === 'paid').length
          const failedPayments = recentOrders.filter(order => 
            order.payment_status === 'failed' || order.status === 'failed'
          ).length

          result.payment_flow_health = {
            recent_success_rate: totalRecent > 0 ? (successfulPayments / totalRecent) * 100 : 0,
            total_recent_payments: totalRecent,
            failed_payments: failedPayments
          }

          if (result.payment_flow_health.recent_success_rate < 80 && totalRecent > 5) {
            result.configuration_issues.push(`Low payment success rate: ${result.payment_flow_health.recent_success_rate.toFixed(1)}%`)
          }
        }
      } catch (analyticsError) {
        console.error('[HEALTH-CHECK] Analytics error:', analyticsError)
      }
    }

    // Determine overall health status
    if (result.configuration_issues.length === 0) {
      result.environment_health = 'healthy'
    } else if (result.paystack_configured && result.database_connectivity) {
      result.environment_health = 'warning'
    } else {
      result.environment_health = 'critical'
    }

    // Generate recommendations
    if (result.environment_health === 'healthy') {
      result.recommendations.push('Payment system is operating normally')
    }

    if (result.database_connectivity && result.paystack_configured) {
      result.recommendations.push('Run end-to-end payment test to verify full functionality')
    }

    console.log('[HEALTH-CHECK] Health check completed:', result)

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        health_status: result,
        ready_for_payments: result.paystack_configured && 
                           result.database_connectivity && 
                           result.configuration_issues.length === 0
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[HEALTH-CHECK] Health check error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Health check failed',
        code: 'HEALTH_CHECK_ERROR',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})