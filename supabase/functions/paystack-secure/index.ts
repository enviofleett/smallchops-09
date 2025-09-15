import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-caller',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

// Initialize Supabase client
const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const supabase = createClient(supabaseUrl, supabaseServiceKey);

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🚀 Paystack Secure Payment Initialization');
    console.log('📊 Request method:', req.method);
    console.log('📊 Request headers:', Object.fromEntries(req.headers.entries()));

    if (req.method !== 'POST') {
      throw new Error('Only POST method allowed');
    }

    const requestData = await req.json();
    console.log('📦 Request data:', {
      action: requestData.action,
      email: requestData.email,
      amount: requestData.amount,
      has_metadata: !!requestData.metadata,
      has_callback_url: !!requestData.callback_url
    });

    const { action, email, amount, metadata, callback_url } = requestData;

    if (action !== 'initialize') {
      throw new Error('Invalid action. Only "initialize" is supported');
    }

    if (!email || !amount || amount <= 0) {
      throw new Error('Email and valid amount are required');
    }

    // Get Paystack configuration from environment
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      console.error('❌ PAYSTACK_SECRET_KEY not found in environment');
      
      // List available environment variables for debugging
      const availableKeys = Object.keys(Deno.env.toObject()).filter(key => 
        key.includes('PAYSTACK') || key.includes('SECRET')
      );
      console.log('🔍 Available keys:', availableKeys);
      
      throw new Error('Payment system configuration error. Please contact support.');
    }

    // Detect environment and select appropriate key
    const isTestKey = paystackSecretKey.startsWith('sk_test_');
    const isLiveKey = paystackSecretKey.startsWith('sk_live_');
    
    if (!isTestKey && !isLiveKey) {
      throw new Error('Invalid Paystack secret key format');
    }

    console.log('🔑 Using', isTestKey ? 'TEST' : 'LIVE', 'Paystack environment');
    console.log('🔑 Key prefix:', paystackSecretKey.substring(0, 10) + '...');

    // Convert amount to kobo (Paystack uses kobo, not naira)
    const amountInKobo = Math.round(amount * 100);
    
    console.log('💰 Payment details:', {
      email,
      amount_naira: amount,
      amount_kobo: amountInKobo,
      order_id: metadata?.order_id
    });

    // Initialize payment with Paystack
    const paystackPayload = {
      email,
      amount: amountInKobo,
      callback_url: callback_url,
      metadata: {
        ...metadata,
        custom_fields: [
          {
            display_name: "Order Number",
            variable_name: "order_number",
            value: metadata?.order_number || "N/A"
          }
        ]
      }
    };

    console.log('🔗 Calling Paystack API...');
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(paystackPayload)
    });

    const paystackData = await paystackResponse.json();
    console.log('📤 Paystack API response status:', paystackResponse.status);
    console.log('📤 Paystack API response:', {
      status: paystackData.status,
      message: paystackData.message,
      has_data: !!paystackData.data,
      reference: paystackData.data?.reference
    });

    if (!paystackResponse.ok || !paystackData.status) {
      console.error('❌ Paystack API error:', paystackData);
      throw new Error(`Paystack API error: ${paystackData.message || 'Unknown error'}`);
    }

    // Log successful payment initialization
    try {
      await supabase.from('audit_logs').insert({
        action: 'paystack_payment_initialized',
        category: 'Payment Processing',
        message: `Payment initialized for order ${metadata?.order_id}`,
        new_values: {
          reference: paystackData.data.reference,
          amount: amount,
          email: email,
          order_id: metadata?.order_id,
          environment: isTestKey ? 'test' : 'live'
        }
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log payment initialization:', logError);
      // Don't fail the payment for logging issues
    }

    console.log('✅ Payment initialization successful');
    
    return new Response(JSON.stringify({
      success: true,
      data: paystackData.data,
      reference: paystackData.data.reference,
      authorization_url: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('❌ Paystack Secure Error:', {
      error: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    });

    // Log error for monitoring
    try {
      await supabase.from('audit_logs').insert({
        action: 'paystack_payment_error',
        category: 'Payment Processing',
        message: `Payment initialization failed: ${error.message}`,
        new_values: {
          error: error.message,
          timestamp: new Date().toISOString()
        }
      });
    } catch (logError) {
      console.warn('⚠️ Failed to log error:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      code: 'PAYMENT_INITIALIZATION_FAILED'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});