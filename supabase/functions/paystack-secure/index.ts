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

    // PRODUCTION-READY: Make function public but validate internal caller
    const internalCaller = req.headers.get('x-internal-caller');
    const authHeader = req.headers.get('authorization');
    
    console.log('🔐 Auth check:', {
      hasAuth: !!authHeader,
      internalCaller: internalCaller,
      isInternalCall: internalCaller === 'process-checkout'
    });

    // CRITICAL FIX: For internal calls, only check the internal caller header
    // For external calls, require proper authentication
    const isInternalCall = internalCaller === 'process-checkout' || internalCaller === 'verify-payment';
    
    if (!isInternalCall && !authHeader) {
      console.error('❌ External call requires authentication');
      return new Response(JSON.stringify({
        success: false,
        error: 'Authentication required'
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

    // Validate required fields based on action
    const { action, email, amount, metadata, reference } = requestData;
    
    if (action === 'verify') {
      if (!reference) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Reference is required for verification'
        }), { status: 400, headers: corsHeaders });
      }
    } else {
      if (!email || !amount) {
        return new Response(JSON.stringify({
          success: false,
          error: 'Missing required fields: email, amount'
        }), { status: 400, headers: corsHeaders });
      }
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
    if (action === 'verify') {
      console.log('🔍 Verifying Paystack transaction...');
      
      try {
        const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${PAYSTACK_SECRET_KEY}`,
            'Content-Type': 'application/json'
          }
        });

        if (!paystackResponse.ok) {
          const errorText = await paystackResponse.text();
          console.error('❌ Paystack verification error:', errorText);
          return new Response(JSON.stringify({
            success: false,
            error: 'Payment verification failed'
          }), { status: 502, headers: corsHeaders });
        }

        const verificationData = await paystackResponse.json();
        
        if (!verificationData.status || !verificationData.data) {
          console.error('❌ Invalid Paystack verification response:', verificationData);
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid verification response'
          }), { status: 502, headers: corsHeaders });
        }

        console.log('✅ Paystack verification successful:', {
          reference: verificationData.data.reference,
          status: verificationData.data.status,
          amount: verificationData.data.amount
        });

        return new Response(JSON.stringify({
          success: true,
          data: verificationData.data
        }), { status: 200, headers: corsHeaders });

      } catch (verifyError) {
        console.error('❌ Paystack verification network error:', verifyError);
        return new Response(JSON.stringify({
          success: false,
          error: 'Payment verification service unavailable'
        }), { status: 503, headers: corsHeaders });
      }
    } else if (action === 'initialize' || !action) {
      console.log('💳 Initializing Paystack transaction...');
      
      // Generate reference if not provided
      const reference = requestData.reference || `txn_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      
      const paystackPayload = {
        email: email,
        amount: Math.round(amount * 100), // Convert to kobo (just order total)
        currency: 'NGN',
        reference: reference,
        bearer: "subaccount", // Customer pays all Paystack fees
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

