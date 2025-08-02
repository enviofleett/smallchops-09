import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log('🔄 Automated email processing cron started...')

    // 1. Process all queued emails
    const queuedResult = await processQueuedEmails(supabase)
    
    // 2. Retry failed emails that are eligible for retry
    const retryResult = await retryFailedEmails(supabase)
    
    // 3. Clean up old processed events
    const cleanupResult = await cleanupOldEvents(supabase)
    
    // 4. Update health metrics
    await updateHealthMetrics(supabase)

    // 5. Check for critical issues and alert if needed
    await checkCriticalIssues(supabase)

    const result = {
      timestamp: new Date().toISOString(),
      message: 'Automated email processing completed',
      results: {
        queued_processed: queuedResult,
        failed_retried: retryResult,
        old_events_cleaned: cleanupResult
      },
      next_run: new Date(Date.now() + 60000).toISOString() // Next minute
    }

    console.log('✅ Automated email processing completed:', result)

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Automated email processing error:', error)
    
    // Log critical error for monitoring
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    await supabase.from('audit_logs').insert({
      action: 'automated_email_cron_error',
      category: 'System Critical',
      message: `Automated email processing failed: ${error.message}`,
      new_values: { error: error.message, timestamp: new Date().toISOString() }
    })

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

async function processQueuedEmails(supabase: any) {
  try {
    // Get count of queued emails
    const { data: queuedEmails } = await supabase
      .from('communication_events')
      .select('id')
      .eq('status', 'queued')
      .lt('retry_count', 3)

    if (!queuedEmails || queuedEmails.length === 0) {
      console.log('📭 No queued emails to process')
      return { processed: 0, message: 'No queued emails found' }
    }

    console.log(`📧 Processing ${queuedEmails.length} queued emails...`)

    // Trigger instant email processor
    const { data, error } = await supabase.functions.invoke('instant-email-processor', {
      body: { automated_trigger: true }
    })

    if (error) {
      console.error('Error invoking email processor:', error)
      return { processed: 0, error: error.message }
    }

    return {
      processed: data?.successful || 0,
      failed: data?.failed || 0,
      total_found: queuedEmails.length,
      message: 'Queued emails processed successfully'
    }

  } catch (error) {
    console.error('Error processing queued emails:', error)
    return { processed: 0, error: error.message }
  }
}

async function retryFailedEmails(supabase: any) {
  try {
    // Find failed emails that should be retried (created within last 4 hours)
    const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
    
    const { data: failedEmails } = await supabase
      .from('communication_events')
      .select('id, retry_count, event_type')
      .eq('status', 'failed')
      .lt('retry_count', 3)
      .gte('created_at', fourHoursAgo)
      .limit(50) // Limit retries to prevent overwhelming

    if (!failedEmails || failedEmails.length === 0) {
      console.log('📭 No failed emails eligible for retry')
      return { retried: 0, message: 'No failed emails to retry' }
    }

    console.log(`🔄 Retrying ${failedEmails.length} failed emails...`)

    // Reset failed emails to queued for retry
    const { error: updateError } = await supabase
      .from('communication_events')
      .update({ 
        status: 'queued',
        error_message: 'Automated retry triggered'
      })
      .in('id', failedEmails.map(e => e.id))

    if (updateError) {
      console.error('Error updating failed emails:', updateError)
      return { retried: 0, error: updateError.message }
    }

    // Process the retried emails
    const { data, error } = await supabase.functions.invoke('instant-email-processor', {
      body: { retry_trigger: true }
    })

    if (error) {
      console.error('Error processing retried emails:', error)
      return { retried: 0, error: error.message }
    }

    return {
      retried: failedEmails.length,
      processed: data?.successful || 0,
      message: 'Failed emails retried successfully'
    }

  } catch (error) {
    console.error('Error retrying failed emails:', error)
    return { retried: 0, error: error.message }
  }
}

async function cleanupOldEvents(supabase: any) {
  try {
    // Clean up successful events older than 30 days
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    
    const { data, error } = await supabase
      .from('communication_events')
      .delete()
      .eq('status', 'sent')
      .lt('created_at', thirtyDaysAgo)

    if (error) {
      console.error('Error cleaning up old events:', error)
      return { cleaned: 0, error: error.message }
    }

    const cleanedCount = Array.isArray(data) ? data.length : 0
    console.log(`🧹 Cleaned up ${cleanedCount} old successful email events`)

    return {
      cleaned: cleanedCount,
      message: 'Old events cleaned successfully'
    }

  } catch (error) {
    console.error('Error during cleanup:', error)
    return { cleaned: 0, error: error.message }
  }
}

async function updateHealthMetrics(supabase: any) {
  try {
    const now = new Date()
    const hourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString()

    // Calculate hourly metrics
    const { data: hourlyEvents } = await supabase
      .from('communication_events')
      .select('status, event_type')
      .gte('created_at', hourAgo)

    const totalEvents = hourlyEvents?.length || 0
    const sentEvents = hourlyEvents?.filter(e => e.status === 'sent').length || 0
    const failedEvents = hourlyEvents?.filter(e => e.status === 'failed').length || 0
    const deliveryRate = totalEvents > 0 ? (sentEvents / totalEvents) * 100 : 100

    // Store metrics for monitoring
    await supabase.from('email_health_metrics').insert({
      timestamp: now.toISOString(),
      total_events: totalEvents,
      sent_events: sentEvents,
      failed_events: failedEvents,
      delivery_rate: deliveryRate,
      period: 'hourly'
    })

    console.log(`📊 Health metrics updated - Delivery rate: ${deliveryRate.toFixed(2)}%`)

  } catch (error) {
    console.error('Error updating health metrics:', error)
  }
}

async function checkCriticalIssues(supabase: any) {
  try {
    const hourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()

    // Check for critical issues
    const { data: recentEvents } = await supabase
      .from('communication_events')
      .select('status, event_type')
      .gte('created_at', hourAgo)

    const totalEvents = recentEvents?.length || 0
    const failedEvents = recentEvents?.filter(e => e.status === 'failed').length || 0
    const failureRate = totalEvents > 0 ? (failedEvents / totalEvents) * 100 : 0

    // Alert if failure rate is too high
    if (failureRate > 20 && totalEvents > 5) {
      console.log(`🚨 CRITICAL: High email failure rate detected: ${failureRate.toFixed(2)}%`)
      
      await supabase.from('audit_logs').insert({
        action: 'critical_email_failure_rate',
        category: 'System Alert',
        message: `Critical email failure rate detected: ${failureRate.toFixed(2)}% (${failedEvents}/${totalEvents})`,
        new_values: { 
          failure_rate: failureRate, 
          failed_count: failedEvents, 
          total_count: totalEvents,
          timestamp: new Date().toISOString()
        }
      })

      // Trigger immediate recovery
      await supabase.functions.invoke('email-production-monitor')
    }

    // Check for stale queued emails
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString()
    const { data: staleEmails } = await supabase
      .from('communication_events')
      .select('id')
      .eq('status', 'queued')
      .lt('created_at', tenMinutesAgo)

    if (staleEmails && staleEmails.length > 0) {
      console.log(`⚠️ Found ${staleEmails.length} stale queued emails - processing immediately`)
      await supabase.functions.invoke('instant-email-processor', {
        body: { stale_email_recovery: true }
      })
    }

  } catch (error) {
    console.error('Error checking critical issues:', error)
  }
}