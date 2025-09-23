import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-caller',
  'Content-Type': 'application/json'
};

serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    console.log('🔒 Paystack secure function called');

    if (req.method !== 'POST') {
      return new Response(JSON.stringify({
        success: false,
        error: 'Method not allowed'
      }), { status: 405, headers: corsHeaders });
    }

    // FIXED: Enhanced authentication for both external and internal calls
    const authHeader = req.headers.get('authorization');
    const apiKey = req.headers.get('apikey');
    const internalCaller = req.headers.get('x-internal-caller');
    
    console.log('🔐 Auth check:', {
      hasAuth: !!authHeader,
      hasApiKey: !!apiKey,
      internalCaller: internalCaller
    });

    // FIXED: Allow internal calls from other Edge Functions
    const isInternalCall = internalCaller === 'process-checkout' || internalCaller === 'verify-payment';
    const hasServiceRoleKey = apiKey === Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!isInternalCall && !authHeader && !apiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
      }), { status: 401, headers: corsHeaders });
    }

    // FIXED: Validate service role key for internal calls
    if (isInternalCall && !hasServiceRoleKey) {
      console.error('❌ Internal call without proper service role key');
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid service credentials for internal call'
      }), { status: 401, headers: corsHeaders });
    }

    console.log('✅ Authentication passed:', isInternalCall ? 'internal' : 'external');

    // Parse request body
    let requestData;
    try {
      requestData = await req.json();
    } catch (parseError) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid JSON in request body'
      }), { status: 400, headers: corsHeaders });
    }

    console.log('📝 Payment request:', {
      action: requestData.action,
      email: requestData.email,
      amount: requestData.amount
    });

    // Validate required fields
    const { action, email, amount, metadata } = requestData;
    
    if (!email || !amount) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Missing required fields: email, amount'
      }), { status: 400, headers: corsHeaders });
    }

    // Get Paystack secret key
    const PAYSTACK_SECRET_KEY = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!PAYSTACK_SECRET_KEY) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment service not configured'
      }), { status: 500, headers: corsHeaders });
    }

    // Handle different actions
    if (action === 'initialize' || !action) {
      console.log('💳 Initializing Paystack transaction...');
      
      // Generate reference if not provided
      const reference = requestData.reference || `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const paystackPayload = {
        email: email,
        amount: Math.round(amount * 100), // Convert to kobo
        currency: 'NGN',
        reference: reference,
        callback_url: requestData.callback_url || `${Deno.env.get('SITE_URL')}/payment/callback`,
        metadata: metadata || {}
      };

      try {
        const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(paystackPayload)
        });

        if (!paystackResponse.ok) {
          const errorText = await paystackResponse.text();
          console.error('❌ Paystack API error:', errorText);
          return new Response(JSON.stringify({
            success: false,
            error: 'Payment service error'
          }), { status: 502, headers: corsHeaders });
        }

        const paystackData = await paystackResponse.json();
        
        if (!paystackData.status || !paystackData.data) {
          console.error('❌ Invalid Paystack response:', paystackData);
          return new Response(JSON.stringify({
            success: false,
            error: 'Payment initialization failed'
          }), { status: 502, headers: corsHeaders });
        }

        console.log('✅ Paystack transaction initialized:', {
          reference: paystackData.data.reference,
          access_code: paystackData.data.access_code?.substring(0, 10) + '...'
        });

        return new Response(JSON.stringify({
          success: true,
          message: 'Payment initialized successfully',
          data: {
            authorization_url: paystackData.data.authorization_url,
            access_code: paystackData.data.access_code,
            reference: paystackData.data.reference
          },
          reference: paystackData.data.reference,
          authorization_url: paystackData.data.authorization_url
        }), { status: 200, headers: corsHeaders });

      } catch (paystackError) {
        console.error('❌ Paystack network error:', paystackError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Payment service unavailable'
        }), { status: 503, headers: corsHeaders });
      }
    } else {
      return new Response(JSON.stringify({
        success: false,
        error: `Unknown action: ${action}`
      }), { status: 400, headers: corsHeaders });
    }

  } catch (globalError) {
    console.error('❌ Global paystack-secure error:', globalError);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), { status: 500, headers: corsHeaders });
  }
});

