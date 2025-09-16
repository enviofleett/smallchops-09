import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

/**
 * Comprehensive System Health Monitor
 * Runs automated health checks and cleanup operations
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

    console.log('🔍 Starting comprehensive system health check...')

    const results: any = {
      timestamp: new Date().toISOString(),
      overall_status: 'healthy',
      services: {}
    }

    // 1. Run communication event cleanup
    try {
      const { cleanupStuckEvents } = await import('../_shared/communication-utils.ts');
      const cleanedEvents = await cleanupStuckEvents(supabase);
      
      results.services.communication_cleanup = {
        status: 'completed',
        events_cleaned: cleanedEvents
      }
      
      console.log(`✅ Communication cleanup: ${cleanedEvents} events processed`)
    } catch (error: any) {
      results.services.communication_cleanup = {
        status: 'failed',
        error: error.message
      }
      results.overall_status = 'degraded'
    }

    // 2. Trigger dedicated cleanup service
    try {
      const cleanupResponse = await supabase.functions.invoke('communication-event-cleanup')
      
      results.services.dedicated_cleanup = {
        status: 'completed',
        response: cleanupResponse.data
      }
      
      console.log('✅ Dedicated cleanup service executed')
    } catch (error: any) {
      results.services.dedicated_cleanup = {
        status: 'failed',
        error: error.message
      }
    }

    // 3. Run production monitor
    try {
      const monitorResponse = await supabase.functions.invoke('production-monitor')
      
      results.services.production_monitor = {
        status: 'completed',
        health_report: monitorResponse.data?.health_report
      }
      
      console.log('✅ Production monitor executed')
    } catch (error: any) {
      results.services.production_monitor = {
        status: 'failed',
        error: error.message
      }
    }

    // 4. Check and reset circuit breakers if needed
    try {
      const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()
      
      const { data: recentFailures, error: failureError } = await supabase
        .from('audit_logs')
        .select('count(*)')
        .in('action', ['circuit_breaker_open', 'communication_event_failed', 'order_update_failed'])
        .gte('created_at', fiveMinutesAgo)

      if (!failureError && recentFailures && recentFailures.length > 0) {
        const failureCount = recentFailures[0].count || 0
        
        results.services.circuit_breaker_check = {
          status: failureCount > 5 ? 'warning' : 'ok',
          recent_failures: failureCount,
          message: failureCount > 5 ? 'High failure rate detected' : 'Failure rate normal'
        }
        
        if (failureCount > 5) {
          results.overall_status = 'warning'
        }
      }
    } catch (error: any) {
      results.services.circuit_breaker_check = {
        status: 'error',
        error: error.message
      }
    }

    // 5. Performance optimization - query database stats
    try {
      const { data: dbStats, error: statsError } = await supabase
        .from('communication_events')
        .select('status, count(*)')
        .group('status')

      if (!statsError && dbStats) {
        const stats = dbStats.reduce((acc: any, item: any) => {
          acc[item.status] = item.count
          return acc
        }, {})

        results.services.database_stats = {
          status: 'ok',
          communication_events: stats,
          total_events: Object.values(stats).reduce((sum: number, count: any) => sum + count, 0)
        }
      }
    } catch (error: any) {
      results.services.database_stats = {
        status: 'error',
        error: error.message
      }
    }

    // Log comprehensive health report
    await supabase
      .from('audit_logs')
      .insert({
        action: 'system_health_check_completed',
        category: 'System Monitoring',
        message: `Comprehensive system health check completed: ${results.overall_status}`,
        new_values: results
      })

    console.log(`🎯 System health check completed: ${results.overall_status}`)

    return new Response(JSON.stringify({
      success: true,
      health_status: results.overall_status,
      detailed_results: results,
      recommendations: generateRecommendations(results)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ System health check error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: 'System health check failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function generateRecommendations(results: any): string[] {
  const recommendations: string[] = []

  if (results.overall_status === 'warning' || results.overall_status === 'error') {
    recommendations.push('Review system logs for recent errors')
    recommendations.push('Consider scaling Edge Functions if performance issues persist')
  }

  if (results.services.communication_cleanup?.events_cleaned > 10) {
    recommendations.push('High number of stuck events detected - review communication system')
  }

  if (results.services.circuit_breaker_check?.recent_failures > 5) {
    recommendations.push('High failure rate detected - investigate root cause')
  }

  if (results.services.database_stats?.communication_events?.failed > 50) {
    recommendations.push('High failure rate in communication events - check email service configuration')
  }

  if (recommendations.length === 0) {
    recommendations.push('System is operating normally')
  }

  return recommendations
}