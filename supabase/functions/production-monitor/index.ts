import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Production Monitoring and Health Check Service
 * Monitors system health and alerts on critical issues
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    console.log('🔍 Starting production health check...')

    const healthReport: any = {
      timestamp: new Date().toISOString(),
      status: 'healthy',
      checks: {}
    }

    // 1. Check communication events health
    const { data: commStats, error: commError } = await supabase
      .from('communication_events')
      .select('status, count(*)')
      .group('status')

    if (!commError && commStats) {
      const stats = commStats.reduce((acc: any, item: any) => {
        acc[item.status] = item.count
        return acc
      }, {})

      healthReport.checks.communication_events = {
        status: 'ok',
        stats,
        queued: stats.queued || 0,
        processing: stats.processing || 0,
        failed: stats.failed || 0,
        sent: stats.sent || 0
      }

      // Alert if too many failed events
      if (stats.failed > 50) {
        healthReport.status = 'warning'
        healthReport.checks.communication_events.status = 'warning'
        healthReport.checks.communication_events.alert = `High failure rate: ${stats.failed} failed events`
      }

      // Alert if events stuck in processing
      if (stats.processing > 20) {
        healthReport.status = 'warning'
        healthReport.checks.communication_events.status = 'warning'
        healthReport.checks.communication_events.alert = `Many events stuck processing: ${stats.processing}`
      }
    } else {
      healthReport.status = 'error'
      healthReport.checks.communication_events = {
        status: 'error',
        error: commError?.message
      }
    }

    // 2. Check recent errors in audit logs
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    
    const { data: recentErrors, error: auditError } = await supabase
      .from('audit_logs')
      .select('action, count(*)')
      .ilike('action', '%failed%')
      .gte('created_at', oneHourAgo)
      .group('action')

    if (!auditError && recentErrors) {
      const errorCount = recentErrors.reduce((sum: number, item: any) => sum + item.count, 0)
      
      healthReport.checks.recent_errors = {
        status: errorCount > 10 ? 'warning' : 'ok',
        count: errorCount,
        details: recentErrors
      }

      if (errorCount > 10) {
        healthReport.status = 'warning'
        healthReport.checks.recent_errors.alert = `High error rate: ${errorCount} errors in last hour`
      }
    }

    // 3. Check order processing health
    const { data: orderStats, error: orderError } = await supabase
      .from('orders')
      .select('status, count(*)')
      .gte('created_at', oneHourAgo)
      .group('status')

    if (!orderError && orderStats) {
      const orders = orderStats.reduce((acc: any, item: any) => {
        acc[item.status] = item.count
        return acc
      }, {})

      healthReport.checks.orders = {
        status: 'ok',
        recent_orders: orders,
        total_recent: orderStats.reduce((sum: number, item: any) => sum + item.count, 0)
      }
    }

    // 4. Check circuit breaker status by examining recent errors
    const { data: circuitErrors, error: circuitError } = await supabase
      .from('audit_logs')
      .select('count(*)')
      .eq('action', 'circuit_breaker_open')
      .gte('created_at', oneHourAgo)

    if (!circuitError && circuitErrors && circuitErrors.length > 0) {
      const circuitCount = circuitErrors[0].count || 0
      if (circuitCount > 0) {
        healthReport.status = 'warning'
        healthReport.checks.circuit_breaker = {
          status: 'warning',
          trips_last_hour: circuitCount,
          alert: 'Circuit breaker has tripped recently'
        }
      }
    }

    // Log health report
    await supabase
      .from('audit_logs')
      .insert({
        action: 'production_health_check',
        category: 'System Monitoring',
        message: `Production health check completed: ${healthReport.status}`,
        new_values: healthReport
      })

    console.log(`🎯 Health check completed: ${healthReport.status}`)

    return new Response(JSON.stringify({
      success: true,
      health_report: healthReport
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Health check error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Health check failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})