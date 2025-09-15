// Production-ready SMTP health check with enhanced user validation
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';
import { getCorsHeaders } from '../_shared/cors.ts';
import { validateSMTPUser, isValidSMTPConfig, maskSMTPConfig, getProviderSpecificSettings } from '../_shared/smtp-config.ts';

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔍 SMTP Health Check Started');

    // Check Function Secrets first (production)
    const secretHost = Deno.env.get('SMTP_HOST');
    const secretPort = Deno.env.get('SMTP_PORT') || '587';
    const secretUser = Deno.env.get('SMTP_USER');
    const secretPass = Deno.env.get('SMTP_PASS');

    let healthResult = {
      configured: false,
      connection_healthy: false,
      user_type: 'unknown',
      provider: 'unknown',
      source: 'none',
      validation_errors: [] as string[],
      suggestions: [] as string[],
      provider_settings: {} as any
    };

    if (secretHost && secretUser && secretPass) {
      console.log('✅ Function Secrets SMTP configuration found');
      
      // Validate configuration
      const validation = isValidSMTPConfig(secretHost, secretPort, secretUser, secretPass);
      const userValidation = validateSMTPUser(secretUser, secretHost);
      
      healthResult = {
        configured: true,
        connection_healthy: validation.isValid,
        user_type: userValidation.userType,
        provider: userValidation.provider || 'unknown',
        source: 'function_secrets',
        validation_errors: validation.errors,
        suggestions: validation.suggestions,
        provider_settings: userValidation.provider ? 
          getProviderSpecificSettings(userValidation.provider, userValidation.userType) : {}
      };

      console.log('📧 SMTP Config Analysis:', {
        host: secretHost,
        port: secretPort,
        userType: userValidation.userType,
        provider: userValidation.provider,
        isValid: validation.isValid,
        errors: validation.errors.length
      });

    } else {
      // Check database configuration as fallback
      console.log('⚠️ No Function Secrets found, checking database configuration');
      
      const { data: config } = await supabase
        .from('communication_settings')
        .select('*')
        .eq('use_smtp', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (config?.smtp_host && config?.smtp_user) {
        const validation = isValidSMTPConfig(
          config.smtp_host,
          (config.smtp_port || 587).toString(),
          config.smtp_user,
          config.smtp_pass || ''
        );
        const userValidation = validateSMTPUser(config.smtp_user, config.smtp_host);

        healthResult = {
          configured: true,
          connection_healthy: validation.isValid,
          user_type: userValidation.userType,
          provider: userValidation.provider || 'unknown',
          source: 'database',
          validation_errors: validation.errors,
          suggestions: validation.suggestions,
          provider_settings: userValidation.provider ? 
            getProviderSpecificSettings(userValidation.provider, userValidation.userType) : {}
        };

        console.log('📧 Database SMTP Config Analysis:', {
          host: config.smtp_host,
          port: config.smtp_port || 587,
          userType: userValidation.userType,
          provider: userValidation.provider,
          isValid: validation.isValid
        });
      }
    }

    // Log health check results
    await supabase.from('audit_logs').insert({
      action: 'smtp_health_check',
      category: 'Email System',
      message: `SMTP health check completed - ${healthResult.configured ? 'configured' : 'not configured'}`,
      new_values: {
        configured: healthResult.configured,
        healthy: healthResult.connection_healthy,
        user_type: healthResult.user_type,
        provider: healthResult.provider,
        source: healthResult.source,
        validation_errors_count: healthResult.validation_errors.length
      }
    });

    return new Response(JSON.stringify({
      success: true,
      smtp_health: healthResult,
      timestamp: new Date().toISOString(),
      recommendations: healthResult.validation_errors.length === 0 
        ? ['SMTP configuration appears valid']
        : healthResult.suggestions
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ SMTP health check error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      smtp_health: {
        configured: false,
        connection_healthy: false,
        user_type: 'unknown',
        provider: 'unknown',
        source: 'none',
        validation_errors: ['Health check failed'],
        suggestions: ['Check SMTP configuration and Function Secrets']
      }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});