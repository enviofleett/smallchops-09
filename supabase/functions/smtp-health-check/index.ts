import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SMTPHealthCheck {
  component: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: any;
}

// Basic SMTP validation functions
function validateSMTPConfig(host: string, user: string, pass: string): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  if (!host || host.length < 3) {
    errors.push('Invalid SMTP host');
  }
  
  if (!user || user.length < 3) {
    errors.push('Invalid SMTP user');
  }
  
  if (!pass || pass.length < 6) {
    errors.push('Invalid SMTP password (too short)');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    
    const healthChecks: SMTPHealthCheck[] = [];
    let overallStatus = 'ready';

    // Check SMTP environment variables
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpSender = Deno.env.get('SMTP_SENDER_EMAIL');

    if (!smtpHost || !smtpUser || !smtpPass || !smtpSender) {
      healthChecks.push({
        component: 'SMTP Environment Variables',
        status: 'fail',
        message: 'Missing required SMTP environment variables',
        details: {
          smtp_host: !!smtpHost,
          smtp_user: !!smtpUser,
          smtp_pass: !!smtpPass,
          smtp_sender: !!smtpSender
        }
      });
      overallStatus = 'not_ready';
    } else {
      // Validate SMTP configuration
      const validation = validateSMTPConfig(smtpHost, smtpUser, smtpPass);
      
      if (validation.isValid) {
        healthChecks.push({
          component: 'SMTP Configuration',
          status: 'pass',
          message: 'SMTP configuration is valid',
          details: {
            host: smtpHost,
            user_length: smtpUser.length,
            password_length: smtpPass.length
          }
        });
      } else {
        healthChecks.push({
          component: 'SMTP Configuration',
          status: 'fail',
          message: 'SMTP configuration validation failed',
          details: {
            errors: validation.errors
          }
        });
        overallStatus = 'not_ready';
      }
    }

    // Check database communication settings
    const { data: commSettings, error: commError } = await supabase
      .from('communication_settings')
      .select('*')
      .limit(1)
      .single();

    if (commError || !commSettings) {
      healthChecks.push({
        component: 'Database Settings',
        status: 'warning',
        message: 'No communication settings found in database',
        details: { error: commError?.message }
      });
    } else {
      healthChecks.push({
        component: 'Database Settings',
        status: commSettings.use_smtp ? 'pass' : 'warning',
        message: commSettings.use_smtp ? 'SMTP enabled in database' : 'SMTP not enabled in database',
        details: {
          use_smtp: commSettings.use_smtp,
          email_provider: commSettings.email_provider,
          sender_email: commSettings.sender_email
        }
      });
    }

    // Check recent email failures
    const { data: recentFailures, error: failureError } = await supabase
      .from('communication_events')
      .select('id')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (!failureError && recentFailures) {
      const failureCount = recentFailures.length;
      if (failureCount > 5) {
        healthChecks.push({
          component: 'Email Delivery',
          status: 'warning',
          message: `${failureCount} email failures in last 24 hours`,
          details: { failure_count: failureCount }
        });
        if (overallStatus === 'ready') overallStatus = 'needs_attention';
      } else {
        healthChecks.push({
          component: 'Email Delivery',
          status: 'pass',
          message: `Low failure rate: ${failureCount} failures in last 24 hours`,
          details: { failure_count: failureCount }
        });
      }
    }

    // Generate recommendations
    const recommendations: string[] = [];
    const criticalIssues = healthChecks.filter(check => check.status === 'fail');
    const warnings = healthChecks.filter(check => check.status === 'warning');

    if (criticalIssues.length > 0) {
      recommendations.push('Configure all required SMTP environment variables');
      recommendations.push('Verify SMTP credentials with your email provider');
    }

    if (warnings.length > 0) {
      recommendations.push('Enable SMTP in communication settings');
      recommendations.push('Monitor email delivery success rates');
    }

    if (criticalIssues.length === 0 && warnings.length === 0) {
      recommendations.push('SMTP configuration is healthy - ready for production');
    }

    // Log the health check
    await supabase.from('audit_logs').insert({
      action: 'smtp_health_check',
      category: 'Email System',
      message: `SMTP health check completed - Status: ${overallStatus}`,
      new_values: {
        overall_status: overallStatus,
        checks_passed: healthChecks.filter(c => c.status === 'pass').length,
        checks_failed: healthChecks.filter(c => c.status === 'fail').length,
        checks_warned: healthChecks.filter(c => c.status === 'warning').length
      }
    });

    const response = {
      success: true,
      timestamp: new Date().toISOString(),
      overall_status: overallStatus,
      health_checks: healthChecks,
      recommendations,
      summary: {
        total_checks: healthChecks.length,
        passed: healthChecks.filter(c => c.status === 'pass').length,
        failed: healthChecks.filter(c => c.status === 'fail').length,
        warnings: healthChecks.filter(c => c.status === 'warning').length
      },
      ready_for_production: overallStatus === 'ready'
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });

  } catch (error) {
    console.error('SMTP health check failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
};

serve(handler);