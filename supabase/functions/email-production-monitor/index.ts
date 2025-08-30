import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface HealthMetrics {
  registration_success_rate: number
  email_delivery_rate: number
  immediate_processing_rate: number
  system_uptime: number
  critical_issues: string[]
  recommendations: string[]
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔍 Starting production health monitoring...')

    const timeframe = '24h'
    const cutoffTime = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()

    // 1. Check registration success rate
    const registrationMetrics = await checkRegistrationHealth(supabase, cutoffTime)
    
    // 2. Check email delivery health
    const emailMetrics = await checkEmailDeliveryHealth(supabase, cutoffTime)
    
    // 3. Check immediate processing capabilities
    const processingMetrics = await checkProcessingHealth(supabase)
    
    // 4. Check system uptime and errors
    const systemMetrics = await checkSystemHealth(supabase, cutoffTime)

    // 5. Calculate overall health score
    const healthScore = calculateHealthScore(registrationMetrics, emailMetrics, processingMetrics, systemMetrics)

    // 6. Auto-trigger recovery if needed
    if (healthScore < 85) {
      await triggerAutoRecovery(supabase, healthScore)
    }

    // 7. Check for immediate processing of queued emails
    await checkAndProcessQueuedEmails(supabase)

    const response = {
      timestamp: new Date().toISOString(),
      health_score: healthScore,
      status: healthScore >= 95 ? 'excellent' : healthScore >= 85 ? 'good' : healthScore >= 70 ? 'warning' : 'critical',
      metrics: {
        registration: registrationMetrics,
        email_delivery: emailMetrics,
        processing: processingMetrics,
        system: systemMetrics
      },
      recommendations: generateRecommendations(healthScore, registrationMetrics, emailMetrics),
      auto_recovery_triggered: healthScore < 85
    }

    return new Response(JSON.stringify(response), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Production monitoring error:', error)
    return new Response(JSON.stringify({ 
      error: error.message,
      status: 'error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

async function checkRegistrationHealth(supabase: any, cutoffTime: string) {
  try {
    // Check registration success rate
    const { data: auditLogs } = await supabase
      .from('audit_logs')
      .select('action, new_values')
      .ilike('action', '%customer%')
      .gte('event_time', cutoffTime)

    const registrationAttempts = auditLogs?.filter(log => 
      log.action.includes('created') || log.action.includes('creation_failed')
    ) || []

    const successfulRegistrations = auditLogs?.filter(log => 
      log.action.includes('created') && !log.action.includes('failed')
    ) || []

    const successRate = registrationAttempts.length > 0 
      ? (successfulRegistrations.length / registrationAttempts.length) * 100 
      : 100

    return {
      success_rate: Math.round(successRate * 100) / 100,
      total_attempts: registrationAttempts.length,
      successful: successfulRegistrations.length,
      failed: registrationAttempts.length - successfulRegistrations.length,
      status: successRate >= 95 ? 'excellent' : successRate >= 85 ? 'good' : 'needs_attention'
    }
  } catch (error) {
    console.error('Error checking registration health:', error)
    return { success_rate: 0, status: 'error', error: error.message }
  }
}

async function checkEmailDeliveryHealth(supabase: any, cutoffTime: string) {
  try {
    const { data: events } = await supabase
      .from('communication_events')
      .select('status, event_type, created_at, sent_at')
      .gte('created_at', cutoffTime)

    const totalEvents = events?.length || 0
    const sentEvents = events?.filter(e => e.status === 'sent') || []
    const failedEvents = events?.filter(e => e.status === 'failed') || []
    const queuedEvents = events?.filter(e => e.status === 'queued') || []

    const deliveryRate = totalEvents > 0 ? (sentEvents.length / totalEvents) * 100 : 100

    // Check immediate processing capability
    const welcomeEmails = events?.filter(e => 
      e.event_type === 'customer_welcome' || e.event_type === 'welcome_email'
    ) || []
    
    const immediatelyProcessed = welcomeEmails.filter(e => {
      if (!e.sent_at || !e.created_at) return false
      const processingTime = new Date(e.sent_at).getTime() - new Date(e.created_at).getTime()
      return processingTime < 5 * 60 * 1000 // Less than 5 minutes
    })

    const immediateProcessingRate = welcomeEmails.length > 0 
      ? (immediatelyProcessed.length / welcomeEmails.length) * 100 
      : 100

    return {
      delivery_rate: Math.round(deliveryRate * 100) / 100,
      immediate_processing_rate: Math.round(immediateProcessingRate * 100) / 100,
      total_events: totalEvents,
      sent: sentEvents.length,
      failed: failedEvents.length,
      queued: queuedEvents.length,
      welcome_emails_processed_immediately: immediatelyProcessed.length,
      total_welcome_emails: welcomeEmails.length,
      status: deliveryRate >= 90 && immediateProcessingRate >= 80 ? 'excellent' : 
              deliveryRate >= 80 ? 'good' : 'needs_attention'
    }
  } catch (error) {
    console.error('Error checking email delivery health:', error)
    return { delivery_rate: 0, immediate_processing_rate: 0, status: 'error', error: error.message }
  }
}

async function checkProcessingHealth(supabase: any) {
  try {
    // Check if email processors are responding
    const processorHealthChecks = await Promise.allSettled([
      supabase.functions.invoke('instant-email-processor', { body: { health_check: true } }),
      supabase.functions.invoke('process-communication-events-enhanced', { body: { health_check: true } }),
      supabase.functions.invoke('unified-smtp-sender', { body: { health_check: true } })
    ])

    const healthyProcessors = processorHealthChecks.filter(result => 
      result.status === 'fulfilled' && !result.value.error
    ).length

    const processorHealth = (healthyProcessors / processorHealthChecks.length) * 100

    return {
      processor_health: Math.round(processorHealth * 100) / 100,
      healthy_processors: healthyProcessors,
      total_processors: processorHealthChecks.length,
      status: processorHealth >= 90 ? 'excellent' : processorHealth >= 70 ? 'good' : 'needs_attention'
    }
  } catch (error) {
    console.error('Error checking processing health:', error)
    return { processor_health: 0, status: 'error', error: error.message }
  }
}

async function checkSystemHealth(supabase: any, cutoffTime: string) {
  try {
    // Check for critical errors in logs
    const { data: errorLogs } = await supabase
      .from('audit_logs')
      .select('action, message, new_values')
      .ilike('message', '%error%')
      .gte('event_time', cutoffTime)
      .limit(100)

    const criticalErrors = errorLogs?.filter(log => 
      log.message?.toLowerCase().includes('critical') || 
      log.message?.toLowerCase().includes('failed') ||
      log.action?.includes('failed')
    ) || []

    const systemUptime = criticalErrors.length === 0 ? 100 : 
                        Math.max(0, 100 - (criticalErrors.length * 2))

    return {
      uptime_percentage: Math.round(systemUptime * 100) / 100,
      critical_errors: criticalErrors.length,
      total_errors: errorLogs?.length || 0,
      recent_critical_errors: criticalErrors.slice(0, 5).map(e => e.message),
      status: systemUptime >= 95 ? 'excellent' : systemUptime >= 85 ? 'good' : 'needs_attention'
    }
  } catch (error) {
    console.error('Error checking system health:', error)
    return { uptime_percentage: 0, status: 'error', error: error.message }
  }
}

function calculateHealthScore(registration: any, email: any, processing: any, system: any): number {
  const weights = {
    registration: 0.3,
    email: 0.4,
    processing: 0.2,
    system: 0.1
  }

  const scores = {
    registration: registration.success_rate || 0,
    email: ((email.delivery_rate || 0) + (email.immediate_processing_rate || 0)) / 2,
    processing: processing.processor_health || 0,
    system: system.uptime_percentage || 0
  }

  return Math.round(
    (scores.registration * weights.registration +
     scores.email * weights.email +
     scores.processing * weights.processing +
     scores.system * weights.system) * 100
  ) / 100
}

async function triggerAutoRecovery(supabase: any, healthScore: number) {
  console.log(`🚨 Health score ${healthScore} below threshold. Triggering auto-recovery...`)
  
  try {
    // 1. Process all queued emails immediately
    await supabase.functions.invoke('instant-email-processor')
    
    // 2. Retry failed welcome emails from last hour
    await supabase.rpc('requeue_failed_welcome_emails')
    
    // 3. Log recovery action
    await supabase.from('audit_logs').insert({
      action: 'auto_recovery_triggered',
      category: 'System Health',
      message: `Auto-recovery triggered due to health score: ${healthScore}`,
      new_values: { health_score: healthScore, timestamp: new Date().toISOString() }
    })
    
    console.log('✅ Auto-recovery completed')
  } catch (error) {
    console.error('❌ Auto-recovery failed:', error)
  }
}

async function checkAndProcessQueuedEmails(supabase: any) {
  try {
    const { data: queuedCount } = await supabase
      .from('communication_events')
      .select('id', { count: 'exact' })
      .eq('status', 'queued')
      .lt('retry_count', 3)

    if (queuedCount && queuedCount.length > 0) {
      console.log(`📧 Found ${queuedCount.length} queued emails. Processing immediately...`)
      await supabase.functions.invoke('instant-email-processor')
    }
  } catch (error) {
    console.error('Error checking queued emails:', error)
  }
}

function generateRecommendations(healthScore: number, registration: any, email: any): string[] {
  const recommendations = []

  if (healthScore < 85) {
    recommendations.push('Overall system health needs attention - consider implementing monitoring alerts')
  }

  if (registration.success_rate < 95) {
    recommendations.push('Registration success rate is below optimal - review error handling and validation')
  }

  if (email.delivery_rate < 90) {
    recommendations.push('Email delivery rate needs improvement - check SMTP configuration and reputation')
  }

  if (email.immediate_processing_rate < 80) {
    recommendations.push('Immediate email processing is slow - consider setting up automated triggers or cron jobs')
  }

  if (email.queued > 10) {
    recommendations.push('Too many emails in queue - enable real-time processing for better user experience')
  }

  if (recommendations.length === 0) {
    recommendations.push('System is performing well - maintain current monitoring and optimization practices')
  }

  return recommendations
}