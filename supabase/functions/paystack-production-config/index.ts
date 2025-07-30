import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Production environment configuration for Paystack
const corsHeaders = {
  'Access-Control-Allow-Origin': process.env.NODE_ENV === 'production' 
    ? 'https://your-production-domain.com' 
    : 'http://localhost:5173',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400'
};

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

    // Authenticate admin user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        error: 'Authentication required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(JSON.stringify({
        error: 'Invalid authentication'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    // Verify admin permissions
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', userData.user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({
        error: 'Admin access required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }

    if (req.method === 'GET') {
      // Get current production configuration
      const { data: config } = await supabaseClient
        .from('environment_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const { data: paystackConfig } = await supabaseClient
        .from('payment_integrations')
        .select('*')
        .eq('provider', 'paystack')
        .single();

      return new Response(JSON.stringify({
        success: true,
        data: {
          environment: config,
          paystack: paystackConfig ? {
            provider: paystackConfig.provider,
            connection_status: paystackConfig.connection_status,
            test_mode: paystackConfig.test_mode,
            supported_methods: paystackConfig.supported_methods,
            // Never expose sensitive keys
            has_live_keys: !!(paystackConfig.live_public_key && paystackConfig.live_secret_key),
            has_test_keys: !!(paystackConfig.public_key && paystackConfig.secret_key),
            has_webhook_secret: !!paystackConfig.webhook_secret
          } : null
        }
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const { action, ...data } = body;

      switch (action) {
        case 'update_environment':
          // Update environment configuration
          const { environment, is_live_mode, webhook_url } = data;
          
          const { error: envError } = await supabaseClient
            .from('environment_config')
            .upsert({
              environment,
              is_live_mode,
              webhook_url,
              updated_at: new Date()
            });

          if (envError) {
            throw new Error('Failed to update environment configuration');
          }

          return new Response(JSON.stringify({
            success: true,
            message: 'Environment configuration updated'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });

        case 'validate_production_setup':
          // Comprehensive production readiness check
          const validationResults = await validateProductionSetup(supabaseClient);
          
          return new Response(JSON.stringify({
            success: true,
            data: validationResults
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200,
          });

        case 'switch_to_production':
          // Switch to production mode with safety checks
          const switchResult = await switchToProduction(supabaseClient);
          
          return new Response(JSON.stringify(switchResult), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: switchResult.success ? 200 : 400,
          });

        default:
          return new Response(JSON.stringify({
            error: 'Invalid action'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 400,
          });
      }
    }

    return new Response(JSON.stringify({
      error: 'Method not allowed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });

  } catch (error) {
    console.error('Production config error:', error);
    return new Response(JSON.stringify({
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

async function validateProductionSetup(supabaseClient: any) {
  const issues = [];
  const warnings = [];
  let score = 100;

  try {
    // Check Paystack configuration
    const { data: paystackConfig } = await supabaseClient
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .single();

    if (!paystackConfig) {
      issues.push('Paystack integration not configured');
      score -= 50;
    } else {
      if (!paystackConfig.live_public_key || !paystackConfig.live_secret_key) {
        issues.push('Live Paystack API keys not configured');
        score -= 30;
      }
      
      if (!paystackConfig.webhook_secret) {
        issues.push('Paystack webhook secret not configured');
        score -= 20;
      }
      
      if (paystackConfig.test_mode) {
        warnings.push('Currently in test mode - switch to live mode for production');
        score -= 10;
      }
    }

    // Check environment configuration
    const { data: envConfig } = await supabaseClient
      .from('environment_config')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!envConfig) {
      issues.push('Environment configuration not set');
      score -= 20;
    } else {
      if (!envConfig.webhook_url) {
        warnings.push('Webhook URL not configured');
        score -= 5;
      }
      
      if (envConfig.environment !== 'production') {
        warnings.push('Environment not set to production');
        score -= 10;
      }
    }

    // Check security settings
    const { data: functions } = await supabaseClient
      .from('functions')
      .select('name, verify_jwt')
      .like('name', 'paystack-%');

    if (functions) {
      const publicFunctions = functions.filter((f: any) => f.verify_jwt === false);
      if (publicFunctions.length > 1) {
        warnings.push(`${publicFunctions.length} functions are public (verify_jwt=false)`);
        score -= 5;
      }
    }

    // Check rate limiting
    const { count: rateLimitCount } = await supabaseClient
      .from('enhanced_rate_limits')
      .select('*', { count: 'exact' });

    if (rateLimitCount === 0) {
      warnings.push('No rate limiting data found - ensure rate limiting is working');
      score -= 5;
    }

    // Check error logging
    const { count: errorLogCount } = await supabaseClient
      .from('payment_error_logs')
      .select('*', { count: 'exact' })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    const { count: securityIncidentCount } = await supabaseClient
      .from('security_incidents')
      .select('*', { count: 'exact' })
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (securityIncidentCount > 10) {
      issues.push(`High number of security incidents in last 24h: ${securityIncidentCount}`);
      score -= 15;
    }

    return {
      score: Math.max(0, score),
      issues,
      warnings,
      ready_for_production: issues.length === 0 && score >= 80,
      recommendations: [
        'Ensure all live API keys are configured correctly',
        'Test webhook endpoints thoroughly',
        'Monitor security incidents dashboard',
        'Set up production domain CORS restrictions',
        'Configure proper SSL certificates',
        'Set up monitoring and alerting'
      ]
    };

  } catch (error) {
    console.error('Validation error:', error);
    return {
      score: 0,
      issues: [`Validation failed: ${error.message}`],
      warnings: [],
      ready_for_production: false,
      recommendations: ['Fix validation errors and try again']
    };
  }
}

async function switchToProduction(supabaseClient: any) {
  try {
    // Run validation first
    const validation = await validateProductionSetup(supabaseClient);
    
    if (!validation.ready_for_production) {
      return {
        success: false,
        error: 'Production readiness check failed',
        issues: validation.issues,
        score: validation.score
      };
    }

    // Update environment to production
    const { error: envError } = await supabaseClient
      .from('environment_config')
      .upsert({
        environment: 'production',
        is_live_mode: true,
        updated_at: new Date()
      });

    if (envError) {
      throw new Error('Failed to update environment to production');
    }

    // Switch Paystack to live mode
    const { error: paystackError } = await supabaseClient
      .from('payment_integrations')
      .update({
        test_mode: false,
        updated_at: new Date()
      })
      .eq('provider', 'paystack');

    if (paystackError) {
      throw new Error('Failed to switch Paystack to live mode');
    }

    // Log the production switch
    await supabaseClient.from('audit_logs').insert({
      action: 'SWITCH_TO_PRODUCTION',
      category: 'System',
      message: 'System switched to production mode',
      new_values: { environment: 'production', live_mode: true }
    });

    return {
      success: true,
      message: 'Successfully switched to production mode',
      validation_score: validation.score
    };

  } catch (error) {
    console.error('Production switch error:', error);
    return {
      success: false,
      error: error.message
    };
  }
}