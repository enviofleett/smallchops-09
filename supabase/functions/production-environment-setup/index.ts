import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getPaystackConfig, validatePaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    console.log('🚀 Production Environment Setup initiated');

    const envChecks = {
      essential_secrets: {} as Record<string, boolean>,
      paystack_config: {} as any,
      database_health: {} as any,
      webhook_config: {} as any,
      production_readiness: {} as any
    };

    // 1. Check essential environment variables
    const essentialVars = [
      'SUPABASE_URL',
      'SUPABASE_SERVICE_ROLE_KEY',
      'PAYSTACK_SECRET_KEY_LIVE',
      'PAYSTACK_PUBLIC_KEY_LIVE',
      'PAYSTACK_WEBHOOK_SECRET_LIVE'
    ];

    essentialVars.forEach(varName => {
      envChecks.essential_secrets[varName] = !!Deno.env.get(varName);
    });

    // 2. Validate Paystack configuration for production
    const paystackConfig = getPaystackConfig(req);
    const configValidation = validatePaystackConfig(paystackConfig);
    
    envChecks.paystack_config = {
      is_valid: configValidation.isValid,
      errors: configValidation.errors,
      environment: paystackConfig.environment,
      is_test_mode: paystackConfig.isTestMode,
      has_webhook_secret: !!paystackConfig.webhookSecret,
      key_format_correct: paystackConfig.environment === 'live' ? 
        paystackConfig.secretKey.startsWith('sk_live_') : 
        paystackConfig.secretKey.startsWith('sk_test_')
    };

    logPaystackConfigStatus(paystackConfig);

    // 3. Test Paystack API connectivity
    let paystackApiTest = { success: false, error: null };
    try {
      console.log('🔗 Testing Paystack API connectivity...');
      
      const testResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paystackConfig.secretKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'production-test@example.com',
          amount: 100000, // 1000 NGN in kobo
          reference: `prod_test_${Date.now()}`,
        })
      });

      const result = await testResponse.json();
      paystackApiTest = {
        success: testResponse.ok && result.status === true,
        error: result.message || null
      };
      
    } catch (error) {
      paystackApiTest = {
        success: false,
        error: error.message
      };
    }

    // 4. Check database configuration
    const { data: dbConfig, error: dbError } = await supabaseAdmin
      .from('environment_config')
      .select('*')
      .single();

    envChecks.database_health = {
      config_exists: !dbError && !!dbConfig,
      production_mode: dbConfig?.production_mode || false,
      error: dbError?.message || null
    };

    // 5. Webhook endpoint health check
    const { data: webhookTest, error: webhookError } = await supabaseAdmin.functions.invoke('enhanced-paystack-webhook', {
      body: { 
        test_mode: true,
        event: 'connection_test',
        data: { reference: 'test_connection' }
      }
    });

    envChecks.webhook_config = {
      endpoint_accessible: !webhookError,
      response_valid: webhookTest !== null,
      error: webhookError?.message || null
    };

    // 6. Production readiness assessment
    const criticalIssues = [];
    const warnings = [];

    // Check for critical production blockers
    if (!envChecks.essential_secrets['PAYSTACK_SECRET_KEY_LIVE']) {
      criticalIssues.push('Missing PAYSTACK_SECRET_KEY_LIVE environment variable');
    }
    if (!envChecks.essential_secrets['PAYSTACK_WEBHOOK_SECRET_LIVE']) {
      criticalIssues.push('Missing PAYSTACK_WEBHOOK_SECRET_LIVE environment variable');
    }
    if (!envChecks.paystack_config.is_valid) {
      criticalIssues.push(`Invalid Paystack configuration: ${envChecks.paystack_config.errors.join(', ')}`);
    }
    if (!paystackApiTest.success) {
      criticalIssues.push(`Paystack API connectivity failed: ${paystackApiTest.error}`);
    }
    
    // Check for warnings
    if (!envChecks.webhook_config.endpoint_accessible) {
      warnings.push('Webhook endpoint may not be accessible');
    }
    if (envChecks.paystack_config.is_test_mode) {
      warnings.push('Currently using TEST mode - ensure LIVE keys are configured for production');
    }

    const isProductionReady = criticalIssues.length === 0;

    envChecks.production_readiness = {
      is_ready: isProductionReady,
      critical_issues: criticalIssues,
      warnings: warnings,
      paystack_api_test: paystackApiTest,
      overall_score: calculateReadinessScore(envChecks)
    };

    // Log summary
    console.log('📊 Production Readiness Summary:', {
      ready: isProductionReady,
      critical_issues: criticalIssues.length,
      warnings: warnings.length,
      score: envChecks.production_readiness.overall_score
    });

    return new Response(JSON.stringify({
      success: true,
      production_ready: isProductionReady,
      environment_checks: envChecks,
      recommendations: generateRecommendations(envChecks),
      next_steps: isProductionReady ? 
        ['Deploy to production', 'Monitor payment transactions', 'Set up alerting'] :
        ['Fix critical issues', 'Re-run production setup check', 'Test payment flow']
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Production setup check failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      production_ready: false
    }, null, 2), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

function calculateReadinessScore(checks: any): number {
  let score = 0;
  let totalChecks = 0;

  // Essential secrets (40% weight)
  const essentialCount = Object.values(checks.essential_secrets).filter(Boolean).length;
  const totalEssential = Object.keys(checks.essential_secrets).length;
  score += (essentialCount / totalEssential) * 40;
  totalChecks += 40;

  // Paystack config (30% weight)
  if (checks.paystack_config.is_valid) score += 30;
  totalChecks += 30;

  // API connectivity (20% weight)
  if (checks.production_readiness.paystack_api_test?.success) score += 20;
  totalChecks += 20;

  // Webhook config (10% weight)
  if (checks.webhook_config.endpoint_accessible) score += 10;
  totalChecks += 10;

  return Math.round((score / totalChecks) * 100);
}

function generateRecommendations(checks: any): string[] {
  const recommendations = [];

  if (!checks.essential_secrets['PAYSTACK_SECRET_KEY_LIVE']) {
    recommendations.push('Add PAYSTACK_SECRET_KEY_LIVE to Supabase secrets');
  }
  
  if (!checks.paystack_config.is_valid) {
    recommendations.push('Fix Paystack configuration errors: ' + checks.paystack_config.errors.join(', '));
  }

  if (!checks.production_readiness.paystack_api_test?.success) {
    recommendations.push('Resolve Paystack API connectivity issues');
  }

  if (!checks.webhook_config.endpoint_accessible) {
    recommendations.push('Ensure webhook endpoint is accessible and properly configured');
  }

  if (checks.paystack_config.is_test_mode) {
    recommendations.push('Switch to LIVE Paystack keys for production deployment');
  }

  if (recommendations.length === 0) {
    recommendations.push('All checks passed! Ready for production deployment');
  }

  return recommendations;
}