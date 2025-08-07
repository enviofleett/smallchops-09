import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Paystack secure function called');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const requestBody = await req.json();
    console.log('📨 Request payload:', JSON.stringify(requestBody));
    
    const { action, ...requestData } = requestBody;

    if (action === 'initialize') {
      return await initializePayment(supabaseClient, requestData);
    } else if (action === 'verify') {
      return await verifyPayment(supabaseClient, requestData);
    } else {
      return new Response(
        JSON.stringify({
          status: false,
          error: 'Invalid action specified'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

  } catch (error) {
    console.error('Paystack secure operation error:', error);
    
    return new Response(
      JSON.stringify({
        status: false,
        error: 'Operation failed',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function initializePayment(supabaseClient: any, requestData: any) {
  try {
    const { email, amount, reference, channels, metadata } = requestData;

    // Input validation
    if (!email || !amount) {
      throw new Error('Email and amount are required');
    }

    if (amount < 100) {
      throw new Error('Minimum amount is 1 NGN (100 kobo)');
    }

    // Get Paystack configuration
    console.log('🔍 Fetching Paystack configuration...');
    const { data: config, error: configError } = await supabaseClient
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();

    console.log('⚙️ Config result:', { config: config ? 'found' : 'not found', error: configError });

    if (configError || !config) {
      console.error('Paystack configuration error:', configError);
      throw new Error('Paystack not configured properly');
    }

    // Use test or live secret key based on environment
    const secretKey = config.test_mode ? config.secret_key : (config.live_secret_key || config.secret_key);
    
    if (!secretKey) {
      throw new Error('Paystack secret key not configured');
    }

    console.log('🔑 Using secret key type:', config.test_mode ? 'test' : 'live');

    // Generate reference if not provided
    const transactionRef = reference || `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('Initializing Paystack payment:', { email, amount, reference: transactionRef });

    // Prepare Paystack payload according to API spec
    // CRITICAL: Paystack expects metadata as STRINGIFIED JSON, not a plain object
    const paystackPayload = {
      email,
      amount: Math.round(amount).toString(), // Paystack requires amount as STRING in kobo (integers only)
      currency: 'NGN',
      reference: transactionRef,
      channels: channels || ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      metadata: JSON.stringify(metadata || {}) // MUST be stringified JSON
    };

    console.log('🚀 Sending to Paystack:', JSON.stringify(paystackPayload, null, 2));

    // Initialize payment with Paystack
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload)
    });

    console.log('📡 Paystack response status:', paystackResponse.status);
    
    if (!paystackResponse.ok) {
      const errorText = await paystackResponse.text();
      console.error('❌ Paystack HTTP error:', paystackResponse.status, errorText);
      
      // Parse the error response if possible
      let errorDetails = errorText;
      try {
        const errorJson = JSON.parse(errorText);
        errorDetails = errorJson.message || errorJson.error || errorText;
      } catch (e) {
        // Use raw text if JSON parsing fails
      }
      
      throw new Error(`Paystack API error (${paystackResponse.status}): ${errorDetails}`);
    }

    const paystackData = await paystackResponse.json();
    console.log('📦 Paystack response data:', JSON.stringify(paystackData, null, 2));

    if (!paystackData.status) {
      console.error('❌ Paystack initialization failed:', paystackData);
      throw new Error(paystackData.message || 'Failed to initialize payment');
    }

    console.log('Paystack payment initialized successfully:', paystackData.data.reference);

    // Validate response structure before returning
    if (!paystackData.data || !paystackData.data.authorization_url) {
      console.error('❌ Invalid Paystack response structure:', paystackData);
      throw new Error('Paystack returned invalid response structure - missing authorization_url');
    }

    // Additional validation for required fields
    if (!paystackData.data.access_code || !paystackData.data.reference) {
      console.error('❌ Incomplete Paystack response:', paystackData);
      throw new Error('Paystack response missing required fields (access_code or reference)');
    }

    const responseData = {
      status: true,
      data: {
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference
      }
    };

    console.log('✅ Validated response structure:', JSON.stringify(responseData, null, 2));

    return new Response(
      JSON.stringify(responseData),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Payment initialization error:', error);
    
    return new Response(
      JSON.stringify({
        status: false,
        error: error.message || 'Failed to initialize payment'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}

async function verifyPayment(supabaseClient: any, requestData: any) {
  try {
    const { reference } = requestData;

    if (!reference) {
      throw new Error('Payment reference is required');
    }

    // Get Paystack configuration
    const { data: config, error: configError } = await supabaseClient
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();

    if (configError || !config) {
      throw new Error('Paystack not configured properly');
    }

    // Use test or live secret key based on environment
    const secretKey = config.test_mode ? config.secret_key : (config.live_secret_key || config.secret_key);
    
    if (!secretKey) {
      throw new Error('Paystack secret key not configured');
    }

    console.log('Verifying Paystack payment:', reference);

    // Verify payment with Paystack
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      }
    });

    if (!paystackResponse.ok) {
      const errorText = await paystackResponse.text();
      console.error('❌ Paystack verification HTTP error:', paystackResponse.status, errorText);
      throw new Error(`Paystack verification failed (${paystackResponse.status}): ${errorText}`);
    }

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error('Paystack verification failed:', paystackData);
      throw new Error(paystackData.message || 'Failed to verify payment');
    }

    console.log('Paystack payment verified successfully:', reference);

    return new Response(
      JSON.stringify({
        status: true,
        data: {
          status: paystackData.data.status,
          amount: paystackData.data.amount,
          currency: paystackData.data.currency,
          customer: paystackData.data.customer,
          metadata: paystackData.data.metadata,
          paid_at: paystackData.data.paid_at,
          channel: paystackData.data.channel,
          gateway_response: paystackData.data.gateway_response
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Payment verification error:', error);
    
    return new Response(
      JSON.stringify({
        status: false,
        error: error.message || 'Failed to verify payment'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}