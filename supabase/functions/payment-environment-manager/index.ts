import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0/dist/module/index.js'
import { getPaystackConfig, validatePaystackConfig, logPaystackConfigStatus, detectEnvironment } from '../_shared/paystack-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EnvironmentCheckResult {
  paystack_configured: boolean
  secret_key_format: 'test' | 'live' | 'invalid' | 'missing'
  database_connectivity: boolean
  edge_functions_accessible: boolean
  recommended_actions: string[]
  critical_issues: string[]
  warnings: string[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[ENV-MANAGER] Starting environment audit')
    
    const result: EnvironmentCheckResult = {
      paystack_configured: false,
      secret_key_format: 'missing',
      database_connectivity: false,
      edge_functions_accessible: false,
      recommended_actions: [],
      critical_issues: [],
      warnings: []
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Test database connectivity
    try {
      const { data, error } = await supabase
        .from('orders')
        .select('id')
        .limit(1)

      if (!error) {
        result.database_connectivity = true
        console.log('[ENV-MANAGER] Database connectivity: OK')
      } else {
        result.critical_issues.push('Database connectivity failed')
        console.error('[ENV-MANAGER] Database error:', error)
      }
    } catch (dbError) {
      result.critical_issues.push('Database connection error')
      console.error('[ENV-MANAGER] Database connection error:', dbError)
    }

    // Check environment detection
    const envDetection = detectEnvironment();
    console.log('[ENV-MANAGER] Environment detection result:', envDetection);
    
    // Check Paystack configuration using environment detection
    let paystackConfig;
    try {
      paystackConfig = getPaystackConfig();
      const validation = validatePaystackConfig(paystackConfig);
      
      logPaystackConfigStatus(paystackConfig);
      
      if (validation.isValid) {
        result.paystack_configured = true;
        result.secret_key_format = paystackConfig.isTestMode ? 'test' : 'live';
        
        if (paystackConfig.isTestMode) {
          result.warnings.push('Using test Paystack key - ensure this is correct for your environment');
          console.log('[ENV-MANAGER] Paystack test key detected');
        } else {
          console.log('[ENV-MANAGER] Paystack live key detected');
        }
        
        result.recommended_actions.push(`Environment: ${paystackConfig.environment} mode configured correctly`);
      } else {
        result.secret_key_format = 'invalid';
        result.critical_issues.push(`Paystack configuration invalid: ${validation.errors.join(', ')}`);
      }
    } catch (configError) {
      console.error('[ENV-MANAGER] Config error:', configError);
      result.secret_key_format = 'missing';
      result.critical_issues.push('No valid Paystack configuration found');
      result.recommended_actions.push('Configure environment-specific keys: PAYSTACK_SECRET_KEY_TEST and PAYSTACK_SECRET_KEY_LIVE');
    }

    // Test Paystack API connectivity
    if (result.paystack_configured && result.secret_key_format !== 'invalid' && paystackConfig) {
      try {
        const testResponse = await fetch('https://api.paystack.co/bank', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${paystackConfig.secretKey}`,
            'Content-Type': 'application/json',
          }
        })

        if (testResponse.ok) {
          console.log('[ENV-MANAGER] Paystack API connectivity: OK')
          result.recommended_actions.push(`Paystack API connectivity verified (${paystackConfig.environment} mode)`)
        } else {
          result.critical_issues.push(`Paystack API authentication failed (${paystackConfig.environment} mode)`)
          console.error('[ENV-MANAGER] Paystack API error:', testResponse.status)
        }
      } catch (apiError) {
        result.warnings.push('Could not verify Paystack API connectivity')
        console.error('[ENV-MANAGER] Paystack API test error:', apiError)
      }
    }

    // Check edge functions accessibility
    try {
      const functionsCheck = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-environment-manager`, {
        method: 'OPTIONS',
        headers: {
          'apikey': Deno.env.get('SUPABASE_ANON_KEY') ?? ''
        }
      })

      if (functionsCheck.ok) {
        result.edge_functions_accessible = true
        console.log('[ENV-MANAGER] Edge functions accessibility: OK')
      }
    } catch (funcError) {
      result.warnings.push('Could not verify edge functions accessibility')
      console.error('[ENV-MANAGER] Edge functions check error:', funcError)
    }

    // Generate recommendations
    if (result.critical_issues.length === 0 && result.secret_key_format !== 'missing') {
      result.recommended_actions.push('Environment appears healthy for payment processing')
      
      if (result.secret_key_format === 'test') {
        result.recommended_actions.push('Consider switching to live keys for production')
      }
    }

    if (result.database_connectivity && result.paystack_configured) {
      result.recommended_actions.push('Run payment flow health check to verify end-to-end functionality')
    }

    // Log environment audit results
    try {
      await supabase
        .from('audit_logs')
        .insert({
          action: 'environment_audit',
          category: 'Payment Configuration',
          message: 'Payment environment audit completed',
          new_values: result
        })
      
      console.log('[ENV-MANAGER] Audit results logged to database')
    } catch (logError) {
      console.error('[ENV-MANAGER] Failed to log audit results:', logError)
    }

    console.log('[ENV-MANAGER] Environment audit completed:', result)

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: new Date().toISOString(),
        environment_status: result,
        overall_health: result.critical_issues.length === 0 ? 'healthy' : 'critical',
        ready_for_payments: result.paystack_configured && 
                           result.database_connectivity && 
                           result.secret_key_format !== 'invalid' && 
                           result.secret_key_format !== 'missing'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[ENV-MANAGER] Environment audit error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Environment audit failed',
        code: 'AUDIT_ERROR',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})