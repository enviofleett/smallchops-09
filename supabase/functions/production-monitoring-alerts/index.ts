import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[MONITORING] Starting production monitoring check...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const alerts = []
    const now = new Date()
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000)
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000)

    // 1. Payment Success Rate Monitoring
    console.log('[MONITORING] Checking payment success rate...')
    
    try {
      const { data: paymentStats, error: paymentError } = await supabase
        .from('payment_transactions')
        .select('status, created_at')
        .gte('created_at', oneHourAgo.toISOString())

      if (paymentError) {
        throw new Error(`Payment stats query failed: ${paymentError.message}`)
      }

      if (paymentStats && paymentStats.length > 0) {
        const totalPayments = paymentStats.length
        const successfulPayments = paymentStats.filter(p => p.status === 'completed').length
        const successRate = (successfulPayments / totalPayments) * 100

        if (successRate < 85) { // Alert if success rate below 85%
          alerts.push({
            type: 'critical',
            category: 'payment_success_rate',
            title: 'Low Payment Success Rate',
            message: `Payment success rate is ${successRate.toFixed(1)}% (${successfulPayments}/${totalPayments}) in the last hour`,
            impact: 'High',
            action_required: 'Check payment gateway status and investigate failed transactions',
            metrics: {
              success_rate: successRate,
              total_payments: totalPayments,
              successful_payments: successfulPayments,
              time_period: '1 hour'
            }
          })
        }
      }
    } catch (error) {
      console.error('[MONITORING] Payment stats check failed:', error)
      alerts.push({
        type: 'warning',
        category: 'monitoring_system',
        title: 'Payment Monitoring Failed',
        message: `Could not check payment success rate: ${error.message}`,
        impact: 'Medium',
        action_required: 'Check database connectivity and payment_transactions table'
      })
    }

    // 2. Failed Payment Count
    console.log('[MONITORING] Checking failed payment count...')
    
    try {
      const { data: failedPayments, error: failedError } = await supabase
        .from('payment_transactions')
        .select('id, reference, created_at, gateway_response')
        .eq('status', 'failed')
        .gte('created_at', oneHourAgo.toISOString())

      if (failedError) {
        throw new Error(`Failed payments query failed: ${failedError.message}`)
      }

      if (failedPayments && failedPayments.length >= 5) { // Alert if 5+ failures in an hour
        alerts.push({
          type: 'warning',
          category: 'failed_payments',
          title: 'High Failed Payment Count',
          message: `${failedPayments.length} failed payments in the last hour`,
          impact: 'Medium',
          action_required: 'Review failed payment reasons and check payment gateway status',
          metrics: {
            failed_count: failedPayments.length,
            time_period: '1 hour'
          }
        })
      }
    } catch (error) {
      console.error('[MONITORING] Failed payments check failed:', error)
    }

    // 3. Webhook Delivery Monitoring
    console.log('[MONITORING] Checking webhook delivery status...')
    
    try {
      const { data: webhookLogs, error: webhookError } = await supabase
        .from('webhook_logs')
        .select('id, provider, event_type, created_at, processed_at')
        .gte('created_at', oneHourAgo.toISOString())

      if (webhookError) {
        throw new Error(`Webhook logs query failed: ${webhookError.message}`)
      }

      if (webhookLogs && webhookLogs.length > 0) {
        const unprocessedWebhooks = webhookLogs.filter(w => !w.processed_at)
        
        if (unprocessedWebhooks.length > 0) {
          alerts.push({
            type: 'warning',
            category: 'webhook_delivery',
            title: 'Unprocessed Webhooks Detected',
            message: `${unprocessedWebhooks.length} webhooks have not been processed`,
            impact: 'Medium',
            action_required: 'Check webhook processing function and retry failed webhooks',
            metrics: {
              unprocessed_count: unprocessedWebhooks.length,
              total_webhooks: webhookLogs.length
            }
          })
        }
      }
    } catch (error) {
      console.error('[MONITORING] Webhook monitoring failed:', error)
    }

    // 4. Order Processing Health
    console.log('[MONITORING] Checking order processing health...')
    
    try {
      const { data: stuckOrders, error: orderError } = await supabase
        .from('orders')
        .select('id, order_number, status, created_at, updated_at')
        .eq('status', 'pending')
        .lt('created_at', oneDayAgo.toISOString())

      if (orderError) {
        throw new Error(`Stuck orders query failed: ${orderError.message}`)
      }

      if (stuckOrders && stuckOrders.length > 0) {
        alerts.push({
          type: 'warning',
          category: 'order_processing',
          title: 'Stuck Orders Detected',
          message: `${stuckOrders.length} orders have been pending for over 24 hours`,
          impact: 'Medium',
          action_required: 'Review and update stuck orders, check payment verification process',
          metrics: {
            stuck_orders_count: stuckOrders.length
          }
        })
      }
    } catch (error) {
      console.error('[MONITORING] Order health check failed:', error)
    }

    // 5. Communication Events Health
    console.log('[MONITORING] Checking email delivery health...')
    
    try {
      const { data: emailEvents, error: emailError } = await supabase
        .from('communication_events')
        .select('id, status, event_type, created_at, last_error')
        .gte('created_at', oneHourAgo.toISOString())

      if (emailError) {
        throw new Error(`Email events query failed: ${emailError.message}`)
      }

      if (emailEvents && emailEvents.length > 0) {
        const failedEmails = emailEvents.filter(e => e.status === 'failed')
        
        if (failedEmails.length > 5) { // Alert if 5+ email failures
          alerts.push({
            type: 'warning',
            category: 'email_delivery',
            title: 'High Email Failure Rate',
            message: `${failedEmails.length} email notifications failed in the last hour`,
            impact: 'Medium',
            action_required: 'Check email provider configuration and SMTP settings',
            metrics: {
              failed_emails: failedEmails.length,
              total_emails: emailEvents.length
            }
          })
        }
      }
    } catch (error) {
      console.error('[MONITORING] Email health check failed:', error)
    }

    // 6. Database Performance Check
    console.log('[MONITORING] Checking database performance...')
    
    try {
      const startTime = Date.now()
      await supabase.from('orders').select('id').limit(1)
      const queryTime = Date.now() - startTime
      
      if (queryTime > 5000) { // Alert if query takes more than 5 seconds
        alerts.push({
          type: 'critical',
          category: 'database_performance',
          title: 'Slow Database Response',
          message: `Database query took ${queryTime}ms (threshold: 5000ms)`,
          impact: 'High',
          action_required: 'Check database performance and connection pool',
          metrics: {
            query_time_ms: queryTime,
            threshold_ms: 5000
          }
        })
      }
    } catch (error) {
      console.error('[MONITORING] Database performance check failed:', error)
      alerts.push({
        type: 'critical',
        category: 'database_connectivity',
        title: 'Database Connection Failed',
        message: `Cannot connect to database: ${error.message}`,
        impact: 'Critical',
        action_required: 'Check database availability and connection string'
      })
    }

    // 7. System Resource Monitoring
    console.log('[MONITORING] Checking system resources...')
    
    // Check Edge Function response times by testing a simple function
    try {
      const functionStartTime = Date.now()
      // Self-test by calling a lightweight function
      const functionTestResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/production-monitoring-alerts`, {
        method: 'OPTIONS',
        headers: { 'Origin': 'https://test.com' }
      })
      const functionResponseTime = Date.now() - functionStartTime
      
      if (functionResponseTime > 10000) { // Alert if function takes more than 10 seconds
        alerts.push({
          type: 'warning',
          category: 'function_performance',
          title: 'Slow Edge Function Response',
          message: `Edge function response time: ${functionResponseTime}ms`,
          impact: 'Medium',
          action_required: 'Check Edge Function performance and scaling'
        })
      }
    } catch (error) {
      console.error('[MONITORING] Function performance check failed:', error)
    }

    // Generate Alert Summary
    const criticalAlerts = alerts.filter(a => a.type === 'critical')
    const warningAlerts = alerts.filter(a => a.type === 'warning')
    
    const summary = {
      timestamp: now.toISOString(),
      total_alerts: alerts.length,
      critical_alerts: criticalAlerts.length,
      warning_alerts: warningAlerts.length,
      system_health: criticalAlerts.length === 0 ? 'healthy' : 'degraded',
      monitoring_status: 'active'
    }

    // Log monitoring results
    await supabase.from('audit_logs').insert({
      action: 'production_monitoring_check',
      category: 'System Health',
      message: `Production monitoring completed: ${alerts.length} alerts generated`,
      new_values: {
        monitoring_summary: summary,
        alerts_generated: alerts.length,
        critical_issues: criticalAlerts.length,
        warnings: warningAlerts.length
      }
    })

    // Send critical alerts to admin if configured
    if (criticalAlerts.length > 0) {
      try {
        const { data: businessSettings } = await supabase
          .from('business_settings')
          .select('admin_notification_email')
          .single()

        if (businessSettings?.admin_notification_email) {
          await supabase.from('communication_events').insert({
            event_type: 'system_alert',
            recipient_email: businessSettings.admin_notification_email,
            template_key: 'critical_system_alert',
            template_variables: {
              alert_count: criticalAlerts.length,
              alerts: criticalAlerts.map(a => `${a.title}: ${a.message}`).join('\n'),
              timestamp: now.toISOString()
            },
            status: 'queued',
            priority: 'critical'
          })
          
          console.log('[MONITORING] Critical alert email queued for admin')
        }
      } catch (alertError) {
        console.error('[MONITORING] Failed to send critical alert email:', alertError)
      }
    }

    console.log(`[MONITORING] Monitoring check completed: ${alerts.length} alerts generated`)
    
    return new Response(JSON.stringify({
      success: true,
      summary,
      alerts,
      recommendations: alerts.length === 0 ? 
        ['System is healthy - continue monitoring'] : 
        ['Review and address alerts', 'Monitor system health regularly', 'Set up automated monitoring']
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('[MONITORING] ERROR:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Production monitoring failed',
      details: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})