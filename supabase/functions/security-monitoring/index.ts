import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SecurityAlert {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  metadata?: Record<string, any>;
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const alerts: SecurityAlert[] = [];

    // Check for failed authentication attempts (last hour)
    const { data: failedAuth } = await supabaseClient
      .from('security_incidents')
      .select('*')
      .eq('type', 'unauthorized_admin_access')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (failedAuth && failedAuth.length > 5) {
      alerts.push({
        type: 'multiple_failed_auth',
        severity: 'high',
        description: `${failedAuth.length} failed authentication attempts in the last hour`,
        metadata: { count: failedAuth.length, timeframe: '1 hour' }
      });
    }

    // Check for rate limit violations (last hour)
    const { data: rateLimits } = await supabaseClient
      .from('security_incidents')
      .select('*')
      .eq('type', 'rate_limit_exceeded')
      .gte('created_at', new Date(Date.now() - 60 * 60 * 1000).toISOString());

    if (rateLimits && rateLimits.length > 10) {
      alerts.push({
        type: 'excessive_rate_limits',
        severity: 'medium',
        description: `${rateLimits.length} rate limit violations in the last hour`,
        metadata: { count: rateLimits.length, timeframe: '1 hour' }
      });
    }

    // Check for unusual API access patterns
    const { data: apiLogs } = await supabaseClient
      .from('api_request_logs')
      .select('ip_address, endpoint, method')
      .gte('created_at', new Date(Date.now() - 30 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false });

    if (apiLogs) {
      // Group by IP address to detect suspicious activity
      const ipActivity: Record<string, number> = {};
      apiLogs.forEach(log => {
        const ip = log.ip_address;
        if (ip) {
          ipActivity[ip] = (ipActivity[ip] || 0) + 1;
        }
      });

      // Flag IPs with excessive requests (>100 in 30 minutes)
      const suspiciousIPs = Object.entries(ipActivity)
        .filter(([_, count]) => count > 100)
        .map(([ip, count]) => ({ ip, count }));

      if (suspiciousIPs.length > 0) {
        alerts.push({
          type: 'suspicious_api_activity',
          severity: 'high',
          description: `Detected ${suspiciousIPs.length} IP addresses with excessive API requests`,
          metadata: { suspicious_ips: suspiciousIPs, timeframe: '30 minutes' }
        });
      }
    }

    // Check for payment system anomalies
    const { data: paymentHealth } = await supabaseClient
      .rpc('get_payment_health_summary');

    if (paymentHealth && paymentHealth.success_rate < 85) {
      alerts.push({
        type: 'payment_system_degraded',
        severity: 'critical',
        description: `Payment success rate dropped to ${paymentHealth.success_rate}%`,
        metadata: { success_rate: paymentHealth.success_rate }
      });
    }

    // Check for database performance issues
    const { data: performanceIssues } = await supabaseClient
      .from('performance_analytics')
      .select('response_time_ms, endpoint')
      .gte('created_at', new Date(Date.now() - 15 * 60 * 1000).toISOString())
      .gt('response_time_ms', 5000); // Over 5 seconds

    if (performanceIssues && performanceIssues.length > 10) {
      alerts.push({
        type: 'performance_degradation',
        severity: 'medium',
        description: `${performanceIssues.length} slow API responses (>5s) in the last 15 minutes`,
        metadata: { slow_requests: performanceIssues.length, timeframe: '15 minutes' }
      });
    }

    // Store monitoring results
    const monitoringResult = {
      timestamp: new Date().toISOString(),
      alerts_count: alerts.length,
      severity_breakdown: {
        critical: alerts.filter(a => a.severity === 'critical').length,
        high: alerts.filter(a => a.severity === 'high').length,
        medium: alerts.filter(a => a.severity === 'medium').length,
        low: alerts.filter(a => a.severity === 'low').length,
      },
      alerts: alerts.slice(0, 20), // Limit to 20 most important alerts
      system_status: alerts.some(a => a.severity === 'critical') ? 'critical' : 
                    alerts.some(a => a.severity === 'high') ? 'degraded' : 'healthy'
    };

    // Log monitoring execution
    await supabaseClient.from('audit_logs').insert({
      action: 'security_monitoring_executed',
      category: 'Security',
      message: `Security monitoring completed - ${alerts.length} alerts generated`,
      new_values: {
        alerts_count: alerts.length,
        system_status: monitoringResult.system_status,
        execution_time: new Date().toISOString()
      }
    });

    // If critical alerts, also log as security incident
    if (alerts.some(a => a.severity === 'critical')) {
      await supabaseClient.from('security_incidents').insert({
        type: 'critical_system_alert',
        severity: 'critical',
        description: 'Critical security alerts detected during monitoring',
        request_data: { alerts: alerts.filter(a => a.severity === 'critical') },
        created_at: new Date().toISOString()
      });
    }

    return new Response(
      JSON.stringify(monitoringResult),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
    );

  } catch (error) {
    console.error('Security monitoring error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Security monitoring failed', 
        message: error.message,
        timestamp: new Date().toISOString()
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      },
    );
  }
});