import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getPaystackConfig, validatePaystackConfig } from '../_shared/paystack-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
}

interface HealthCheckResult {
  overall_status: 'healthy' | 'warning' | 'critical'
  timestamp: string
  environment: {
    detected: 'test' | 'live'
    keys_configured: boolean
    key_format_valid: boolean
  }
  paystack_api: {
    connectivity: boolean
    response_time_ms: number | null
    error?: string
  }
  database: {
    connectivity: boolean
    payment_transactions_count: number
    recent_payments_24h: number
    pending_payments: number
  }
  system_metrics: {
    success_rate_7d: number
    avg_processing_time_ms: number | null
    failed_payments_24h: number
  }
  issues: string[]
  recommendations: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const healthCheck: HealthCheckResult = {
      overall_status: 'healthy',
      timestamp: new Date().toISOString(),
      environment: {
        detected: 'test',
        keys_configured: false,
        key_format_valid: false
      },
      paystack_api: {
        connectivity: false,
        response_time_ms: null
      },
      database: {
        connectivity: false,
        payment_transactions_count: 0,
        recent_payments_24h: 0,
        pending_payments: 0
      },
      system_metrics: {
        success_rate_7d: 0,
        avg_processing_time_ms: null,
        failed_payments_24h: 0
      },
      issues: [],
      recommendations: []
    }

    // Test Paystack configuration
    try {
      const paystackConfig = getPaystackConfig(req)
      const validation = validatePaystackConfig(paystackConfig)
      
      healthCheck.environment.detected = paystackConfig.environment
      healthCheck.environment.keys_configured = !!paystackConfig.secretKey
      healthCheck.environment.key_format_valid = validation.isValid

      if (!validation.isValid) {
        healthCheck.issues.push(`Paystack configuration invalid: ${validation.errors.join(', ')}`)
        healthCheck.overall_status = 'critical'
      }

      // Test Paystack API connectivity
      if (paystackConfig.secretKey) {
        const apiStartTime = Date.now()
        try {
          const testResponse = await fetch('https://api.paystack.co/bank', {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${paystackConfig.secretKey}`,
              'Content-Type': 'application/json',
            },
          })

          healthCheck.paystack_api.response_time_ms = Date.now() - apiStartTime
          healthCheck.paystack_api.connectivity = testResponse.ok

          if (!testResponse.ok) {
            healthCheck.issues.push(`Paystack API error: ${testResponse.status}`)
            healthCheck.overall_status = 'critical'
          }
        } catch (apiError) {
          healthCheck.paystack_api.error = apiError.message
          healthCheck.issues.push(`Paystack API connectivity failed: ${apiError.message}`)
          healthCheck.overall_status = 'critical'
        }
      }
    } catch (configError) {
      healthCheck.issues.push(`Configuration error: ${configError.message}`)
      healthCheck.overall_status = 'critical'
    }

    // Test database connectivity and metrics
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      )

      // Test basic connectivity
      const { data: testData, error: testError } = await supabase
        .from('payment_transactions')
        .select('id')
        .limit(1)

      if (!testError) {
        healthCheck.database.connectivity = true

        // Get payment transaction metrics
        const { data: totalCount } = await supabase
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true })

        healthCheck.database.payment_transactions_count = totalCount || 0

        // Recent payments (24h)
        const { data: recentPayments } = await supabase
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true })
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        healthCheck.database.recent_payments_24h = recentPayments || 0

        // Pending payments
        const { data: pendingPayments } = await supabase
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')

        healthCheck.database.pending_payments = pendingPayments || 0

        // Success rate (7 days)
        const { data: weeklyStats, error: statsError } = await supabase
          .from('payment_transactions')
          .select('status')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())

        if (!statsError && weeklyStats && weeklyStats.length > 0) {
          const successful = weeklyStats.filter(p => p.status === 'paid' || p.status === 'completed').length
          healthCheck.system_metrics.success_rate_7d = Math.round((successful / weeklyStats.length) * 100)
        }

        // Failed payments (24h)
        const { data: failedPayments } = await supabase
          .from('payment_transactions')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'failed')
          .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())

        healthCheck.system_metrics.failed_payments_24h = failedPayments || 0

      } else {
        healthCheck.issues.push(`Database connectivity failed: ${testError.message}`)
        healthCheck.overall_status = 'critical'
      }
    } catch (dbError) {
      healthCheck.issues.push(`Database error: ${dbError.message}`)
      healthCheck.overall_status = 'critical'
    }

    // Generate recommendations
    if (healthCheck.database.pending_payments > 10) {
      healthCheck.recommendations.push('High number of pending payments - investigate payment processing delays')
      if (healthCheck.overall_status === 'healthy') healthCheck.overall_status = 'warning'
    }

    if (healthCheck.system_metrics.success_rate_7d < 95 && healthCheck.system_metrics.success_rate_7d > 0) {
      healthCheck.recommendations.push('Payment success rate below 95% - review failed payments')
      if (healthCheck.overall_status === 'healthy') healthCheck.overall_status = 'warning'
    }

    if (healthCheck.database.recent_payments_24h === 0) {
      healthCheck.recommendations.push('No payments processed in last 24 hours - verify payment flow')
      if (healthCheck.overall_status === 'healthy') healthCheck.overall_status = 'warning'
    }

    if (healthCheck.system_metrics.failed_payments_24h > 5) {
      healthCheck.recommendations.push('High number of failed payments in 24h - investigate payment issues')
      if (healthCheck.overall_status === 'healthy') healthCheck.overall_status = 'warning'
    }

    if (!healthCheck.paystack_api.connectivity) {
      healthCheck.recommendations.push('Configure Paystack API credentials and test connectivity')
    }

    return new Response(
      JSON.stringify(healthCheck),
      {
        status: healthCheck.overall_status === 'critical' ? 503 : 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )

  } catch (error) {
    console.error('Health check error:', error)
    
    return new Response(
      JSON.stringify({
        overall_status: 'critical',
        timestamp: new Date().toISOString(),
        error: error.message,
        issues: ['Health check function failed to execute']
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})

/*
🏥 PAYMENT SYSTEM HEALTH CHECK
- ✅ Tests Paystack configuration and API connectivity
- ✅ Verifies database connectivity and metrics
- ✅ Calculates success rates and system performance
- ✅ Provides actionable recommendations
- ✅ Environment-aware health checks

🔧 USAGE:
GET /functions/v1/payment-health-check

📊 RESPONSE:
{
  "overall_status": "healthy|warning|critical",
  "environment": { ... },
  "paystack_api": { ... },
  "database": { ... },
  "system_metrics": { ... },
  "issues": [...],
  "recommendations": [...]
}
*/