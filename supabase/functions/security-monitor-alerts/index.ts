import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecurityAlert {
  type: string;
  severity: 'critical' | 'warning' | 'info';
  description: string;
  details: any;
  timestamp: string;
}

// Alert configuration
const ALERT_CONFIG = {
  FAILED_LOGIN_THRESHOLD: 3,
  FAILED_LOGIN_WINDOW_MINUTES: 5,
  PAYMENT_FAILURE_THRESHOLD: 5,
  PAYMENT_FAILURE_WINDOW_MINUTES: 30,
  DATA_ACCESS_THRESHOLD: 100,
  DATA_ACCESS_WINDOW_MINUTES: 5,
  COOLDOWN_MINUTES: 60, // Don't send duplicate alerts within this timeframe
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🛡️ Starting security monitoring scan...');
    const alerts: SecurityAlert[] = [];

    // 1. Check for multiple failed login attempts
    const failedLoginCheck = await supabaseClient
      .from('audit_logs')
      .select('ip_address, created_at, message')
      .like('action', '%login_failed%')
      .gte('created_at', new Date(Date.now() - ALERT_CONFIG.FAILED_LOGIN_WINDOW_MINUTES * 60 * 1000).toISOString());

    if (failedLoginCheck.data) {
      const ipGroups = failedLoginCheck.data.reduce((acc: any, log: any) => {
        const ip = log.ip_address || 'unknown';
        if (!acc[ip]) acc[ip] = [];
        acc[ip].push(log);
        return acc;
      }, {});

      Object.entries(ipGroups).forEach(([ip, logs]: [string, any]) => {
        if (logs.length >= ALERT_CONFIG.FAILED_LOGIN_THRESHOLD) {
          alerts.push({
            type: 'multiple_failed_logins',
            severity: 'critical',
            description: `${logs.length} failed login attempts detected from IP ${ip}`,
            details: {
              ip_address: ip,
              attempt_count: logs.length,
              timeframe: `${ALERT_CONFIG.FAILED_LOGIN_WINDOW_MINUTES} minutes`,
              first_attempt: logs[0].created_at,
              last_attempt: logs[logs.length - 1].created_at
            },
            timestamp: new Date().toISOString()
          });
        }
      });
    }

    // 2. Check for privilege escalation attempts (real violations only)
    const privilegeEscalation = await supabaseClient
      .from('audit_logs')
      .select('*')
      .eq('action', 'security_violation_detected')
      .eq('category', 'Security')
      .not('message', 'like', '%system%')
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString());

    if (privilegeEscalation.data && privilegeEscalation.data.length > 0) {
      privilegeEscalation.data.forEach((violation: any) => {
        alerts.push({
          type: 'privilege_escalation',
          severity: 'critical',
          description: `Privilege escalation attempt detected: ${violation.message}`,
          details: {
            user_id: violation.user_id,
            ip_address: violation.ip_address,
            message: violation.message,
            old_values: violation.old_values,
            new_values: violation.new_values
          },
          timestamp: violation.created_at
        });
      });
    }

    // 3. Check for unusual admin IP addresses
    const recentAdminLogins = await supabaseClient
      .from('audit_logs')
      .select('user_id, ip_address, created_at')
      .like('action', '%login%')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(50);

    if (recentAdminLogins.data) {
      for (const login of recentAdminLogins.data) {
        if (login.user_id && login.ip_address) {
          // Check if this IP is known
          const { data: knownIP } = await supabaseClient
            .from('admin_ip_history')
            .select('*')
            .eq('user_id', login.user_id)
            .eq('ip_address', login.ip_address)
            .single();

          if (!knownIP) {
            // New IP detected - update history and alert
            await supabaseClient.from('admin_ip_history').insert({
              user_id: login.user_id,
              ip_address: login.ip_address,
              first_seen_at: login.created_at,
              last_seen_at: login.created_at,
              is_trusted: false
            });

            alerts.push({
              type: 'new_admin_ip',
              severity: 'warning',
              description: `Admin login from new IP address detected`,
              details: {
                user_id: login.user_id,
                ip_address: login.ip_address,
                login_time: login.created_at
              },
              timestamp: new Date().toISOString()
            });
          } else {
            // Update last seen time
            await supabaseClient
              .from('admin_ip_history')
              .update({ last_seen_at: new Date().toISOString() })
              .eq('user_id', login.user_id)
              .eq('ip_address', login.ip_address);
          }
        }
      }
    }

    // 4. Check for high payment failure rate
    const paymentFailures = await supabaseClient
      .from('audit_logs')
      .select('*')
      .eq('category', 'Payment Security')
      .like('message', '%failed%')
      .gte('created_at', new Date(Date.now() - ALERT_CONFIG.PAYMENT_FAILURE_WINDOW_MINUTES * 60 * 1000).toISOString());

    if (paymentFailures.data && paymentFailures.data.length >= ALERT_CONFIG.PAYMENT_FAILURE_THRESHOLD) {
      alerts.push({
        type: 'high_payment_failure_rate',
        severity: 'warning',
        description: `${paymentFailures.data.length} payment failures in the last ${ALERT_CONFIG.PAYMENT_FAILURE_WINDOW_MINUTES} minutes`,
        details: {
          failure_count: paymentFailures.data.length,
          timeframe: `${ALERT_CONFIG.PAYMENT_FAILURE_WINDOW_MINUTES} minutes`
        },
        timestamp: new Date().toISOString()
      });
    }

    // 5. Check for unusual data access patterns
    const dataAccessLogs = await supabaseClient
      .from('audit_logs')
      .select('user_id, entity_id, created_at')
      .eq('action', 'SELECT')
      .not('user_id', 'is', null)
      .gte('created_at', new Date(Date.now() - ALERT_CONFIG.DATA_ACCESS_WINDOW_MINUTES * 60 * 1000).toISOString());

    if (dataAccessLogs.data) {
      const userAccessCount: Record<string, Set<string>> = {};
      
      dataAccessLogs.data.forEach((log: any) => {
        if (!userAccessCount[log.user_id]) {
          userAccessCount[log.user_id] = new Set();
        }
        if (log.entity_id) {
          userAccessCount[log.user_id].add(log.entity_id);
        }
      });

      Object.entries(userAccessCount).forEach(([userId, entities]) => {
        if (entities.size >= ALERT_CONFIG.DATA_ACCESS_THRESHOLD) {
          alerts.push({
            type: 'unusual_data_access',
            severity: 'warning',
            description: `User accessed ${entities.size} unique records in ${ALERT_CONFIG.DATA_ACCESS_WINDOW_MINUTES} minutes`,
            details: {
              user_id: userId,
              entity_count: entities.size,
              timeframe: `${ALERT_CONFIG.DATA_ACCESS_WINDOW_MINUTES} minutes`
            },
            timestamp: new Date().toISOString()
          });
        }
      });
    }

    // Send email alerts for critical and warning alerts
    if (alerts.length > 0) {
      console.log(`⚠️ Found ${alerts.length} security alerts`);

      // Get admin email from business settings
      const { data: businessSettings } = await supabaseClient
        .from('business_settings')
        .select('admin_notification_email')
        .single();

      const adminEmail = businessSettings?.admin_notification_email;

      if (adminEmail) {
        // Group alerts by severity
        const criticalAlerts = alerts.filter(a => a.severity === 'critical');
        const warningAlerts = alerts.filter(a => a.severity === 'warning');

        // Send critical alerts immediately
        if (criticalAlerts.length > 0) {
          await sendAlertEmail(supabaseClient, adminEmail, criticalAlerts, 'critical');
        }

        // Send warning alerts (daily digest would be better in production)
        if (warningAlerts.length > 0) {
          await sendAlertEmail(supabaseClient, adminEmail, warningAlerts, 'warning');
        }
      }

      // Log all alerts to alert_notifications table
      for (const alert of alerts) {
        await supabaseClient.from('alert_notifications').insert({
          alert_rule_id: null, // Manual detection, not rule-based
          severity: alert.severity,
          message: alert.description,
          webhook_url: null,
          delivery_status: adminEmail ? 'delivered' : 'no_recipient',
          response_body: JSON.stringify(alert.details),
          delivered_at: new Date().toISOString()
        });
      }
    }

    // Log monitoring execution
    await supabaseClient.from('audit_logs').insert({
      action: 'security_monitoring_executed',
      category: 'Security',
      message: `Security monitoring completed - ${alerts.length} alerts generated`,
      new_values: {
        alerts_count: alerts.length,
        critical_count: alerts.filter(a => a.severity === 'critical').length,
        warning_count: alerts.filter(a => a.severity === 'warning').length,
        execution_time: new Date().toISOString()
      }
    });

    console.log(`✅ Security monitoring completed: ${alerts.length} alerts`);

    return new Response(
      JSON.stringify({
        success: true,
        alerts_count: alerts.length,
        alerts: alerts,
        timestamp: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('❌ Security monitoring error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Security monitoring failed', 
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

// Helper function to send alert emails
async function sendAlertEmail(
  supabaseClient: any,
  adminEmail: string,
  alerts: SecurityAlert[],
  severity: 'critical' | 'warning'
) {
  const subject = severity === 'critical' 
    ? '🚨 CRITICAL SECURITY ALERT - Immediate Action Required'
    : '⚠️ Security Warning - Review Required';

  const alertsList = alerts.map(alert => `
    <div style="border-left: 4px solid ${severity === 'critical' ? '#ef4444' : '#f59e0b'}; padding: 12px; margin: 12px 0; background: #f9fafb;">
      <h3 style="margin: 0 0 8px 0; color: #1f2937;">${alert.type.replace(/_/g, ' ').toUpperCase()}</h3>
      <p style="margin: 4px 0;"><strong>Description:</strong> ${alert.description}</p>
      <p style="margin: 4px 0;"><strong>Time:</strong> ${new Date(alert.timestamp).toLocaleString()}</p>
      <p style="margin: 4px 0;"><strong>Details:</strong> ${JSON.stringify(alert.details, null, 2)}</p>
    </div>
  `).join('');

  const emailHtml = `
    <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: ${severity === 'critical' ? '#ef4444' : '#f59e0b'}; color: white; padding: 20px; border-radius: 8px 8px 0 0; }
          .content { background: white; padding: 20px; border: 1px solid #e5e7eb; border-radius: 0 0 8px 8px; }
          .footer { text-align: center; margin-top: 20px; color: #6b7280; font-size: 12px; }
          .button { display: inline-block; padding: 12px 24px; background: #3b82f6; color: white; text-decoration: none; border-radius: 6px; margin: 12px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1 style="margin: 0;">${subject}</h1>
          </div>
          <div class="content">
            <p>Dear Admin,</p>
            <p>${severity === 'critical' ? 'Critical security events have been detected' : 'Security warnings have been triggered'} on your Starters Small Chops system:</p>
            
            ${alertsList}
            
            <p style="margin-top: 24px;">
              <strong>Action Required:</strong><br>
              ${severity === 'critical' 
                ? '1. Review the audit logs immediately<br>2. Verify this activity is legitimate<br>3. Take corrective action if unauthorized'
                : '1. Review the details above<br>2. Verify this is normal activity<br>3. Contact support if you need assistance'
              }
            </p>
            
            <a href="https://startersmallchops.com/audit-logs" class="button">View Audit Logs</a>
            
            <p style="margin-top: 24px; color: #6b7280; font-size: 14px;">
              This is an automated security alert. Do not reply to this email.
            </p>
          </div>
          <div class="footer">
            <p>Starters Small Chops Security Monitoring System</p>
          </div>
        </div>
      </body>
    </html>
  `;

  // Queue email via communication_events
  await supabaseClient.from('communication_events').insert({
    event_type: 'security_alert',
    recipient_email: adminEmail,
    template_key: 'security_alert',
    template_variables: {
      subject: subject,
      html: emailHtml
    },
    status: 'queued',
    priority: severity === 'critical' ? 'high' : 'normal',
    channel: 'email'
  });
}
