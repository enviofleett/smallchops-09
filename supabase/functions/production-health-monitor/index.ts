import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceKey) {
      throw new Error('Missing Supabase environment variables');
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Comprehensive production health check
    const healthChecks = {
      database_connectivity: false,
      payment_system_security: false,
      paystack_configuration: false,
      environment_setup: false,
      business_configuration: false,
      security_policies: false
    };

    const issues: string[] = [];
    const warnings: string[] = [];

    // 1. Database connectivity check
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .limit(1);
      
      if (!error) {
        healthChecks.database_connectivity = true;
      } else {
        issues.push(`Database connectivity failed: ${error.message}`);
      }
    } catch (error) {
      issues.push(`Database connectivity error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 2. Payment system security check
    try {
      const { data: safetyResult, error } = await supabase
        .rpc('check_production_payment_safety');
      
      if (!error && safetyResult) {
        const typedResult = safetyResult as any;
        healthChecks.payment_system_security = typedResult.is_safe;
        if (!typedResult.is_safe && typedResult.issues) {
          issues.push(...typedResult.issues);
        }
      } else {
        issues.push(`Payment safety check failed: ${error?.message || 'Unknown error'}`);
      }
    } catch (error) {
      issues.push(`Payment security check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 3. Paystack configuration check
    try {
      const { data: paystackData, error } = await supabase
        .from('payment_integrations')
        .select('provider, test_mode, test_public_key, live_public_key')
        .eq('provider', 'paystack')
        .eq('is_active', true)
        .maybeSingle();
      
      if (!error && paystackData) {
        healthChecks.paystack_configuration = true;
        if (paystackData.test_mode && !paystackData.test_public_key) {
          warnings.push('Test mode enabled but test keys may be missing');
        }
        if (!paystackData.test_mode && !paystackData.live_public_key) {
          issues.push('Live mode enabled but live keys are missing');
        }
      } else {
        issues.push('Paystack configuration not found or not active');
      }
    } catch (error) {
      issues.push(`Paystack config check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 4. Environment setup check
    try {
      const { data: envData, error } = await supabase
        .from('environment_config')
        .select('environment, live_mode')
        .limit(1);
      
      if (!error && envData && envData.length > 0) {
        healthChecks.environment_setup = true;
        const config = envData[0];
        if (config.live_mode && config.environment !== 'production') {
          warnings.push('Live mode enabled but environment is not set to production');
        }
      } else {
        warnings.push('Environment configuration not found');
      }
    } catch (error) {
      warnings.push(`Environment check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 5. Business configuration check
    try {
      const { data: businessData, error } = await supabase
        .from('business_settings')
        .select('name, allow_guest_checkout, default_vat_rate')
        .limit(1);
      
      if (!error && businessData && businessData.length > 0) {
        healthChecks.business_configuration = true;
        const business = businessData[0];
        if (!business.name) {
          warnings.push('Business name not configured');
        }
        if (business.default_vat_rate <= 0) {
          warnings.push('Default VAT rate not configured');
        }
      } else {
        issues.push('Business settings not configured');
      }
    } catch (error) {
      issues.push(`Business config check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // 6. Security policies check
    try {
      const { data: securityResult, error } = await supabase
        .rpc('run_security_audit');
      
      if (!error && securityResult) {
        const typedResult = securityResult as any;
        healthChecks.security_policies = typedResult.is_secure;
        if (!typedResult.is_secure && typedResult.issues) {
          if (typedResult.critical_issues > 0) {
            issues.push(...typedResult.issues.filter((issue: string) => issue.includes('CRITICAL')));
          }
          warnings.push(...typedResult.issues.filter((issue: string) => !issue.includes('CRITICAL')));
        }
      } else {
        warnings.push('Security audit could not be completed');
      }
    } catch (error) {
      warnings.push(`Security check error: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }

    // Calculate overall health score
    const passedChecks = Object.values(healthChecks).filter(Boolean).length;
    const totalChecks = Object.keys(healthChecks).length;
    const healthScore = Math.round((passedChecks / totalChecks) * 100);
    
    const isProductionReady = issues.length === 0 && healthScore >= 90;
    const status = isProductionReady ? 'ready' : 
                 issues.length === 0 ? 'needs_attention' : 'not_ready';

    // Log health check results for monitoring
    await supabase.from('audit_logs').insert({
      action: 'production_health_check',
      category: 'Production Monitoring',
      message: `Health check completed - Status: ${status}`,
      new_values: {
        health_score: healthScore,
        checks_passed: passedChecks,
        total_checks: totalChecks,
        issues_count: issues.length,
        warnings_count: warnings.length,
        is_production_ready: isProductionReady,
        timestamp: new Date().toISOString()
      }
    });

    return new Response(JSON.stringify({
      success: true,
      health_score: healthScore,
      is_production_ready: isProductionReady,
      status,
      checks: healthChecks,
      issues,
      warnings,
      summary: {
        total_checks: totalChecks,
        passed_checks: passedChecks,
        failed_checks: totalChecks - passedChecks,
        critical_issues: issues.length,
        warnings: warnings.length
      },
      timestamp: new Date().toISOString(),
      next_check_recommended: new Date(Date.now() + 15 * 60 * 1000).toISOString() // 15 minutes
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Production health monitor error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: 'Health monitoring service error',
      details: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});