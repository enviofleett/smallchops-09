import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface HealthCheckResult {
  component: string;
  status: 'healthy' | 'warning' | 'critical';
  message: string;
  details?: any;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
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
    const healthChecks: HealthCheckResult[] = [];

    // 1. Check Paystack Secret Key Configuration
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    const paystackWebhookSecret = Deno.env.get('PAYSTACK_WEBHOOK_SECRET');
    
    if (!paystackSecretKey) {
      healthChecks.push({
        component: 'Edge Function Secrets',
        status: 'critical',
        message: 'PAYSTACK_SECRET_KEY not configured in edge functions'
      });
    } else if (paystackSecretKey.startsWith('sk_test_')) {
      healthChecks.push({
        component: 'Edge Function Secrets',
        status: 'critical',
        message: 'Edge functions still using TEST secret key',
        details: { keyPrefix: paystackSecretKey.substring(0, 8) + '...' }
      });
    } else if (paystackSecretKey.startsWith('sk_live_')) {
      healthChecks.push({
        component: 'Edge Function Secrets',
        status: 'healthy',
        message: 'Live secret key configured correctly',
        details: { keyPrefix: paystackSecretKey.substring(0, 8) + '...' }
      });
    } else {
      healthChecks.push({
        component: 'Edge Function Secrets',
        status: 'warning',
        message: 'Unexpected secret key format',
        details: { keyPrefix: paystackSecretKey.substring(0, 8) + '...' }
      });
    }

    if (!paystackWebhookSecret) {
      healthChecks.push({
        component: 'Webhook Configuration',
        status: 'critical',
        message: 'PAYSTACK_WEBHOOK_SECRET not configured'
      });
    } else {
      healthChecks.push({
        component: 'Webhook Configuration',
        status: 'healthy',
        message: 'Webhook secret configured'
      });
    }

    // 2. Test Paystack API Connectivity with Live Key
    if (paystackSecretKey && paystackSecretKey.startsWith('sk_live_')) {
      try {
        const response = await fetch('https://api.paystack.co/bank', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json'
          }
        });

        if (response.ok) {
          healthChecks.push({
            component: 'Paystack API Connectivity',
            status: 'healthy',
            message: 'Live API connection successful',
            details: { status: response.status }
          });
        } else {
          healthChecks.push({
            component: 'Paystack API Connectivity',
            status: 'warning',
            message: `API responded with status ${response.status}`,
            details: { status: response.status, statusText: response.statusText }
          });
        }
      } catch (error) {
        healthChecks.push({
          component: 'Paystack API Connectivity',
          status: 'critical',
          message: 'Failed to connect to Paystack API',
          details: { error: error.message }
        });
      }
    }

    // 3. Check Database Configuration
    const { data: paymentIntegration, error: integrationError } = await supabase
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .single();

    if (integrationError) {
      healthChecks.push({
        component: 'Database Configuration',
        status: 'critical',
        message: 'Failed to read payment integration config',
        details: { error: integrationError.message }
      });
    } else {
      const dbIsLive = !paymentIntegration.test_mode && paymentIntegration.environment === 'live';
      
      healthChecks.push({
        component: 'Database Configuration',
        status: dbIsLive ? 'healthy' : 'warning',
        message: dbIsLive ? 'Database configured for live mode' : 'Database not in live mode',
        details: {
          testMode: paymentIntegration.test_mode,
          environment: paymentIntegration.environment,
          connectionStatus: paymentIntegration.connection_status
        }
      });
    }

    // 4. Check Environment Configuration
    const { data: envConfig, error: envError } = await supabase
      .from('environment_config')
      .select('*')
      .limit(1)
      .single();

    if (envError) {
      healthChecks.push({
        component: 'Environment Configuration',
        status: 'warning',
        message: 'No environment configuration found',
        details: { error: envError.message }
      });
    } else {
      const envIsLive = envConfig.is_live_mode && envConfig.environment === 'production';
      
      healthChecks.push({
        component: 'Environment Configuration',
        status: envIsLive ? 'healthy' : 'warning',
        message: envIsLive ? 'Environment set to production' : 'Environment not in production mode',
        details: {
          isLiveMode: envConfig.is_live_mode,
          environment: envConfig.environment
        }
      });
    }

    // 5. Overall Health Assessment
    const criticalIssues = healthChecks.filter(check => check.status === 'critical').length;
    const warningIssues = healthChecks.filter(check => check.status === 'warning').length;
    const healthyComponents = healthChecks.filter(check => check.status === 'healthy').length;

    let overallStatus: 'ready' | 'needs_attention' | 'not_ready';
    let overallMessage: string;

    if (criticalIssues > 0) {
      overallStatus = 'not_ready';
      overallMessage = `${criticalIssues} critical issue(s) must be resolved before going live`;
    } else if (warningIssues > 0) {
      overallStatus = 'needs_attention';
      overallMessage = `${warningIssues} warning(s) should be addressed for optimal production setup`;
    } else {
      overallStatus = 'ready';
      overallMessage = 'All systems ready for production deployment';
    }

    // Log the health check
    await supabase.from('audit_logs').insert({
      action: 'paystack_production_health_check',
      category: 'Production Readiness',
      message: `Production health check completed: ${overallStatus}`,
      new_values: {
        overallStatus,
        criticalIssues,
        warningIssues,
        healthyComponents,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        production_readiness: {
          overall_status: overallStatus,
          overall_message: overallMessage,
          summary: {
            healthy: healthyComponents,
            warnings: warningIssues,
            critical: criticalIssues,
            total_checks: healthChecks.length
          },
          detailed_checks: healthChecks,
          timestamp: new Date().toISOString(),
          recommendations: criticalIssues > 0 ? [
            'Update edge function secrets to use live Paystack keys',
            'Ensure all database configurations are synced to live mode',
            'Test payment flow end-to-end before processing real transactions'
          ] : warningIssues > 0 ? [
            'Review warning messages and optimize configuration',
            'Consider running a small test transaction to verify complete flow'
          ] : [
            'System is production ready',
            'Monitor first few live transactions closely',
            'Ensure webhook endpoint is accessible from Paystack servers'
          ]
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );

  } catch (error) {
    console.error('Production health check error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Production health check failed',
        details: error.message,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      }
    );
  }
});