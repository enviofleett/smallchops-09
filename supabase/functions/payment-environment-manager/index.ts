import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EnvironmentConfig {
  environment: string;
  isLiveMode: boolean;
  paystackLivePublicKey?: string;
  paystackLiveSecretKey?: string;
  paystackTestPublicKey?: string;
  paystackTestSecretKey?: string;
  webhookUrl?: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Verify authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('No authorization header');
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !user) {
      throw new Error('Authentication failed');
    }

    // Check admin role
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profileError || profile?.role !== 'admin') {
      throw new Error('Admin access required');
    }

    if (req.method === 'GET') {
      // Get current environment configuration
      const { data: envConfig, error: envError } = await supabaseClient
        .from('environment_config')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (envError) {
        console.error('Error fetching environment config:', envError);
        throw new Error('Failed to fetch environment configuration');
      }

      // Get payment integration settings
      const { data: paymentConfig, error: paymentError } = await supabaseClient
        .from('payment_integrations')
        .select('*')
        .eq('provider', 'paystack')
        .eq('connection_status', 'connected')
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (paymentError) {
        console.error('Error fetching payment config:', paymentError);
        throw new Error('Failed to fetch payment configuration');
      }

      return new Response(
        JSON.stringify({
          success: true,
          data: {
            environment: envConfig,
            paymentIntegration: paymentConfig,
            activeKeys: paymentConfig ? {
              publicKey: envConfig?.is_live_mode 
                ? (paymentConfig.live_public_key || paymentConfig.public_key)
                : paymentConfig.public_key,
              testMode: !envConfig?.is_live_mode,
              environment: envConfig?.environment || 'development'
            } : null
          }
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (req.method === 'POST') {
      const body = await req.json();
      const config: EnvironmentConfig = body;

      // Validate required fields
      if (!config.environment) {
        throw new Error('Environment is required');
      }

      // Update environment configuration
      const { data: envData, error: envError } = await supabaseClient
        .from('environment_config')
        .upsert({
          environment: config.environment,
          is_live_mode: config.isLiveMode,
          paystack_live_public_key: config.paystackLivePublicKey,
          paystack_live_secret_key: config.paystackLiveSecretKey,
          paystack_test_public_key: config.paystackTestPublicKey,
          paystack_test_secret_key: config.paystackTestSecretKey,
          webhook_url: config.webhookUrl,
          updated_at: new Date().toISOString()
        })
        .select()
        .single();

      if (envError) {
        console.error('Error updating environment config:', envError);
        throw new Error('Failed to update environment configuration');
      }

      // Update payment integration if keys provided
      if (config.paystackLivePublicKey || config.paystackLiveSecretKey || 
          config.paystackTestPublicKey || config.paystackTestSecretKey) {
        
        const updateData: any = {};
        if (config.paystackLivePublicKey) updateData.live_public_key = config.paystackLivePublicKey;
        if (config.paystackLiveSecretKey) updateData.live_secret_key = config.paystackLiveSecretKey;
        if (config.paystackTestPublicKey) updateData.public_key = config.paystackTestPublicKey;
        if (config.paystackTestSecretKey) updateData.secret_key = config.paystackTestSecretKey;
        updateData.environment = config.isLiveMode ? 'live' : 'test';
        updateData.test_mode = !config.isLiveMode;

        const { error: paymentError } = await supabaseClient
          .from('payment_integrations')
          .update(updateData)
          .eq('provider', 'paystack');

        if (paymentError) {
          console.error('Error updating payment integration:', paymentError);
          // Don't throw here, environment config was successful
        }
      }

      // Log the environment change
      await supabaseClient
        .from('audit_logs')
        .insert({
          user_id: user.id,
          action: 'UPDATE',
          category: 'Environment Management',
          entity_type: 'environment_config',
          entity_id: envData.id,
          message: `Environment switched to ${config.environment} (Live: ${config.isLiveMode})`,
          new_values: config
        });

      return new Response(
        JSON.stringify({
          success: true,
          data: envData,
          message: 'Environment configuration updated successfully'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    throw new Error('Method not allowed');

  } catch (error) {
    console.error('Environment manager error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message
      }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});