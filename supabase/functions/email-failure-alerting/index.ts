import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AlertConfig {
  admin_email: string;
  slack_webhook_url?: string;
  failure_threshold: number;
  time_window_hours: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('🚨 Starting email failure alerting check...');

    // Get alert configuration from environment or defaults
    const alertConfig: AlertConfig = {
      admin_email: Deno.env.get('ADMIN_ALERT_EMAIL') ?? 'admin@startersmallchops.com',
      slack_webhook_url: Deno.env.get('SLACK_WEBHOOK_URL'),
      failure_threshold: parseInt(Deno.env.get('EMAIL_FAILURE_THRESHOLD') ?? '5'),
      time_window_hours: parseInt(Deno.env.get('EMAIL_FAILURE_WINDOW_HOURS') ?? '1'),
    };

    // Check for repeated failures in the time window
    const cutoffTime = new Date(Date.now() - alertConfig.time_window_hours * 60 * 60 * 1000).toISOString();
    
    const { data: recentFailures, error: failuresError } = await supabaseClient
      .from('communication_events')
      .select('recipient_email, error_message, created_at, retry_count')
      .eq('status', 'failed')
      .gte('created_at', cutoffTime)
      .order('created_at', { ascending: false });

    if (failuresError) {
      throw new Error(`Failed to fetch recent failures: ${failuresError.message}`);
    }

    // Group failures by recipient and error type
    const failuresByRecipient = new Map<string, any[]>();
    const failuresByError = new Map<string, any[]>();

    for (const failure of recentFailures || []) {
      // Group by recipient
      if (!failuresByRecipient.has(failure.recipient_email)) {
        failuresByRecipient.set(failure.recipient_email, []);
      }
      failuresByRecipient.get(failure.recipient_email)!.push(failure);

      // Group by error type
      const errorType = failure.error_message?.substring(0, 50) || 'Unknown error';
      if (!failuresByError.has(errorType)) {
        failuresByError.set(errorType, []);
      }
      failuresByError.get(errorType)!.push(failure);
    }

    // Check if we need to send alerts
    const alertsToSend = [];

    // Alert for recipients with multiple failures
    for (const [email, failures] of failuresByRecipient) {
      if (failures.length >= alertConfig.failure_threshold) {
        alertsToSend.push({
          type: 'recipient_failures',
          email,
          count: failures.length,
          failures
        });
      }
    }

    // Alert for recurring error patterns
    for (const [errorType, failures] of failuresByError) {
      if (failures.length >= alertConfig.failure_threshold) {
        alertsToSend.push({
          type: 'error_pattern',
          errorType,
          count: failures.length,
          affectedEmails: [...new Set(failures.map(f => f.recipient_email))].length
        });
      }
    }

    // Check SMTP provider health
    const { data: deliveryLogs, error: logsError } = await supabaseClient
      .from('email_delivery_logs')
      .select('provider, status, created_at')
      .gte('created_at', cutoffTime);

    if (!logsError && deliveryLogs) {
      const providerStats = new Map<string, { total: number; failed: number }>();
      
      for (const log of deliveryLogs) {
        if (!providerStats.has(log.provider)) {
          providerStats.set(log.provider, { total: 0, failed: 0 });
        }
        const stats = providerStats.get(log.provider)!;
        stats.total++;
        if (log.status === 'failed' || log.status === 'bounced') {
          stats.failed++;
        }
      }

      // Alert for provider issues
      for (const [provider, stats] of providerStats) {
        const failureRate = (stats.failed / stats.total) * 100;
        if (failureRate > 25 && stats.total >= 10) { // 25% failure rate with at least 10 emails
          alertsToSend.push({
            type: 'provider_issues',
            provider,
            failureRate: Math.round(failureRate),
            totalEmails: stats.total,
            failedEmails: stats.failed
          });
        }
      }
    }

    // Send alerts if any were triggered
    if (alertsToSend.length > 0) {
      console.log(`🚨 Sending ${alertsToSend.length} alerts...`);
      
      for (const alert of alertsToSend) {
        await sendAlert(supabaseClient, alertConfig, alert);
      }

      // Log the alert activity
      await supabaseClient
        .from('audit_logs')
        .insert({
          action: 'email_failure_alert',
          category: 'Email Monitoring',
          message: `Sent ${alertsToSend.length} failure alerts`,
          new_values: {
            alerts_sent: alertsToSend.length,
            alert_types: alertsToSend.map(a => a.type),
            threshold: alertConfig.failure_threshold,
            time_window: alertConfig.time_window_hours
          }
        });
    } else {
      console.log('✅ No failure alerts needed');
    }

    return new Response(
      JSON.stringify({
        success: true,
        alertsSent: alertsToSend.length,
        alertDetails: alertsToSend,
        totalFailures: recentFailures?.length || 0,
        timeWindow: `${alertConfig.time_window_hours} hours`
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Email failure alerting error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Internal server error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function sendAlert(supabase: any, config: AlertConfig, alert: any) {
  try {
    let subject = '';
    let message = '';

    switch (alert.type) {
      case 'recipient_failures':
        subject = `🚨 Multiple Email Failures for ${alert.email}`;
        message = `
          Recipient ${alert.email} has failed to receive ${alert.count} emails.
          
          This may indicate:
          - Invalid email address
          - Mailbox full
          - Aggressive spam filtering
          
          Consider adding this email to the suppression list if failures continue.
        `;
        break;

      case 'error_pattern':
        subject = `🚨 Recurring Email Error Pattern Detected`;
        message = `
          Error pattern "${alert.errorType}" has occurred ${alert.count} times.
          Affected ${alert.affectedEmails} unique email addresses.
          
          This may indicate:
          - SMTP configuration issues
          - Provider rate limiting
          - Authentication problems
          
          Review SMTP settings and provider status.
        `;
        break;

      case 'provider_issues':
        subject = `🚨 SMTP Provider ${alert.provider} Health Alert`;
        message = `
          Provider ${alert.provider} showing ${alert.failureRate}% failure rate.
          
          Failed: ${alert.failedEmails}/${alert.totalEmails} emails
          
          This may indicate:
          - Provider service issues
          - Account suspension
          - Rate limiting
          
          Check provider status and account health immediately.
        `;
        break;
    }

    // Send email alert
    const { error: emailError } = await supabase.functions.invoke('email-core', {
      body: {
        action: 'send_email',
        recipient: config.admin_email,
        subject,
        htmlContent: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <h2 style="color: #e74c3c;">${subject}</h2>
            <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; white-space: pre-line;">
              ${message}
            </div>
            <p style="margin-top: 20px; color: #7f8c8d; font-size: 12px;">
              Time: ${new Date().toISOString()}<br>
              System: Starters Small Chops Email Monitor
            </p>
          </div>
        `,
        textContent: `${subject}\n\n${message}\n\nTime: ${new Date().toISOString()}`,
        priority: 'high'
      }
    });

    if (emailError) {
      console.error('Failed to send email alert:', emailError);
    }

    // Send Slack alert if configured
    if (config.slack_webhook_url) {
      try {
        const slackMessage = {
          text: subject,
          attachments: [{
            color: 'danger',
            fields: [{
              title: 'Alert Details',
              value: message.trim(),
              short: false
            }],
            footer: 'Starters Small Chops Email Monitor',
            ts: Math.floor(Date.now() / 1000)
          }]
        };

        const response = await fetch(config.slack_webhook_url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(slackMessage)
        });

        if (!response.ok) {
          console.error('Failed to send Slack alert:', response.statusText);
        }
      } catch (slackError) {
        console.error('Slack alert error:', slackError);
      }
    }

  } catch (error) {
    console.error('Error sending alert:', error);
  }
}