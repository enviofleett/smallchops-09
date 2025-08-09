import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
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
    const { email, amount, reference, channels, metadata, callback_url } = requestData;

    // Input validation
    if (!email || !amount) {
      throw new Error('Email and amount are required');
    }

    if (amount < 100) {
      throw new Error('Minimum amount is 1 NGN (100 kobo)');
    }

    // Get Paystack configuration via centralized RPC (environment-aware)
    console.log('🔍 Fetching Paystack configuration...');
    const { data: cfg, error: cfgErr } = await supabaseClient.rpc('get_active_paystack_config');

    if (cfgErr || !cfg) {
      console.error('Paystack configuration error:', cfgErr);
      throw new Error('Paystack not configured properly');
    }

    const effective = Array.isArray(cfg) ? cfg[0] : cfg;

    // Resolve secret key with safe fallback (prefer DB/RPC; fall back to ENV only if missing)
    let secretKey = effective.secret_key as string | undefined;
    let keySource = 'db';
    if (!secretKey) {
      const envKey = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
      if (envKey) {
        secretKey = envKey;
        keySource = 'env';
      }
    }
    
    if (!secretKey) {
      throw new Error('Paystack secret key not configured');
    }

    console.log(`🔑 Using secret key type: ${effective.test_mode ? 'test' : 'live'} | source: ${keySource}`);

    // Generate reference if not provided
    const transactionRef = reference || `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    console.log('Initializing Paystack payment:', { email, amount, reference: transactionRef });

    // Prepare Paystack payload according to API spec
    // CRITICAL: Paystack expects metadata as STRINGIFIED JSON, not a plain object
    const paystackPayload: Record<string, any> = {
      email,
      amount: Math.round(amount).toString(), // Paystack requires amount as STRING in kobo (integers only)
      currency: 'NGN',
      reference: transactionRef,
      channels: channels || ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      metadata: JSON.stringify(metadata || {}), // MUST be stringified JSON
      ...(callback_url ? { callback_url } : {})
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
      
      // Handle duplicate reference by retrying ONCE with a fresh reference
      let parsed: any = null;
      try {
        parsed = JSON.parse(errorText);
      } catch {}

      const isDuplicate =
        paystackResponse.status === 400 &&
        (parsed?.code === 'duplicate_reference' ||
         (typeof parsed?.message === 'string' && parsed.message.toLowerCase().includes('duplicate transaction reference')));

      if (isDuplicate) {
        const newRef = `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        paystackPayload.reference = newRef;
        console.warn('♻️ Duplicate reference detected. Retrying with new reference:', newRef);

        const retryResponse = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(paystackPayload)
        });

        if (!retryResponse.ok) {
          const retryText = await retryResponse.text();
          console.error('❌ Paystack retry HTTP error:', retryResponse.status, retryText);
          throw new Error(`Paystack API error (${retryResponse.status}): ${retryText}`);
        }

        const retriedData = await retryResponse.json();
        if (!retriedData?.status) {
          throw new Error(retriedData?.message || 'Failed to initialize payment after retry');
        }

        // Ensure the response contains the new reference
        retriedData.data = { ...(retriedData.data || {}), reference: newRef };

        return new Response(
          JSON.stringify({ status: true, data: retriedData.data }),
          { 
            status: 200, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }
      
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

    // Get Paystack configuration via centralized RPC (environment-aware)
    const { data: cfg, error: cfgErr } = await supabaseClient.rpc('get_active_paystack_config');
    if (cfgErr || !cfg) {
      throw new Error('Paystack not configured properly');
    }
    const effective = Array.isArray(cfg) ? cfg[0] : cfg;

    // Resolve secret key with safe fallback (prefer DB/RPC; fall back to ENV only if missing)
    let secretKey = effective.secret_key as string | undefined;
    let keySource = 'db';
    if (!secretKey) {
      const envKey = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
      if (envKey) {
        secretKey = envKey;
        keySource = 'env';
      }
    }
    
    if (!secretKey) {
      throw new Error('Paystack secret key not configured');
    }

    console.log(`🔍 Mode: ${effective.test_mode ? 'test' : 'live'} | key source: ${keySource}`);
    console.log('Verifying Paystack payment:', reference);

    // Helper: retry wrapper for Paystack verify (3 attempts, backoff)
    const fetchWithRetries = async (url: string, opts: RequestInit, retries = 3) => {
      let lastErr: any = null;
      for (let i = 1; i <= retries; i++) {
        try {
          const res = await fetch(url, opts);
          if (!res.ok) {
            const txt = await res.text();
            throw new Error(`HTTP ${res.status}: ${txt}`);
          }
          return await res.json();
        } catch (e) {
          lastErr = e;
          const delay = Math.min(5000, 1000 * Math.pow(2, i - 1));
          console.warn(`Paystack verify attempt ${i} failed, retrying in ${delay}ms...`, String(e));
          if (i < retries) await new Promise(r => setTimeout(r, delay));
        }
      }
      throw lastErr;
    };

    // Verify payment with Paystack (robust retries)
    const paystackData = await fetchWithRetries(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json',
        }
      },
      3
    );

    if (!paystackData?.status) {
      console.error('Paystack verification failed:', paystackData);
      throw new Error(paystackData?.message || 'Failed to verify payment');
    }

    console.log('Paystack payment verified successfully:', reference);

    // Attempt to persist successful payments to the database
    const tx = paystackData.data || {};
    const isSuccess = tx.status === 'success';

    if (isSuccess) {
      // Normalize metadata (it may be returned as a string)
      let metadataObj: any = {};
      try {
        metadataObj = typeof tx.metadata === 'string' ? JSON.parse(tx.metadata) : (tx.metadata || {});
      } catch (e) {
        console.warn('Could not parse Paystack metadata string. Using raw value.');
        metadataObj = tx.metadata || {};
      }

      let orderId: string | null = metadataObj.order_id || metadataObj.orderId || null;
      const orderNumber: string | null = metadataObj.order_number || metadataObj.orderNumber || metadataObj.order?.number || null;
      const paidAt = tx.paid_at || new Date().toISOString();
      const channel = tx.channel || 'online';
      const gatewayResponse = tx.gateway_response || null;
      const customerEmail = tx?.customer?.email || null;
      const amount = typeof tx.amount === 'number' ? tx.amount / 100 : null;

      // Try to resolve order id by reference or order number if missing
      if (!orderId) {
        try {
          const { data: foundByRef, error: findRefErr } = await supabaseClient
            .from('orders')
            .select('id')
            .or(`payment_reference.eq.${requestData.reference},id.eq.${requestData.reference}`)
            .maybeSingle();
          if (!findRefErr && foundByRef?.id) orderId = foundByRef.id;
        } catch (_) {}
      }
      if (!orderId && orderNumber) {
        try {
          const { data: foundByNumber } = await supabaseClient
            .from('orders')
            .select('id')
            .eq('order_number', orderNumber)
            .maybeSingle();
          if (foundByNumber?.id) orderId = foundByNumber.id;
        } catch (_) {}
      }

      // Upsert/seed transaction BEFORE RPC so it can find it
      try {
        const baseTx: any = {
          provider_reference: requestData.reference,
          transaction_type: 'charge',
          status: 'paid',
          amount,
          currency: tx.currency || 'NGN',
          channel,
          gateway_response: gatewayResponse,
          paid_at: new Date(paidAt).toISOString(),
          customer_email: customerEmail,
          processed_at: new Date().toISOString(),
          provider_response: tx || null,
        };
        const txRow = orderId ? { ...baseTx, order_id: orderId } : baseTx;
        const { error: upsertErr } = await supabaseClient
          .from('payment_transactions')
          .upsert(txRow, { onConflict: 'provider_reference' });
        if (upsertErr) console.warn('Pre-RPC upsert failed:', upsertErr);
      } catch (e) {
        console.warn('Pre-RPC upsert crashed:', e);
      }

      // Call production RPC for full processing (card save, analytics, triggers)
      try {
        const { error: rpcError } = await supabaseClient.rpc('handle_successful_payment', {
          p_reference: requestData.reference,
          p_paid_at: paidAt,
          p_gateway_response: gatewayResponse,
          p_fees: tx.fees ?? 0,
          p_channel: channel,
          p_authorization_code: tx?.authorization?.authorization_code ?? null,
          p_card_type: tx?.authorization?.card_type ?? null,
          p_last4: tx?.authorization?.last4 ?? null,
          p_exp_month: tx?.authorization?.exp_month ?? null,
          p_exp_year: tx?.authorization?.exp_year ?? null,
          p_bank: tx?.authorization?.bank ?? null,
        });
        if (rpcError) console.warn('handle_successful_payment RPC returned error:', rpcError);
      } catch (e) {
        console.warn('handle_successful_payment RPC crashed:', e);
      }

      // Ensure order is marked paid/confirmed even if RPC didn’t update it
      if (orderId) {
        try {
          const { error: orderErr } = await supabaseClient
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'confirmed',
              payment_reference: requestData.reference,
              paid_at: new Date(paidAt).toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('id', orderId);
          if (orderErr) console.error('Order update failed:', orderErr);
        } catch (e) {
          console.error('Order update crashed:', e);
        }
      } else {
        console.warn('Could not resolve order id for reference:', requestData.reference);
      }

      // Audit log for successful verification
      try {
        await supabaseClient.from('audit_logs').insert({
          action: 'payment_verified',
          category: 'Payment',
          message: `Paystack verified and persisted: ${requestData.reference}`,
          new_values: { reference: requestData.reference, order_id: orderId, amount, channel, gateway_response }
        });
      } catch (_) {}
    }

    // Return normalized verification payload for frontend compatibility
    return new Response(
      JSON.stringify({
        status: true,
        success: isSuccess,
        data: {
          status: tx.status,
          amount: typeof tx.amount === 'number' ? Math.round(tx.amount) / 100 : null,
          currency: tx.currency,
          customer: tx.customer,
          metadata: tx.metadata,
          paid_at: tx.paid_at,
          channel: tx.channel,
          gateway_response: tx.gateway_response,
        }
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Payment verification error:', error);

    // Audit error path
    try {
      await supabaseClient.from('audit_logs').insert({
        action: 'payment_verification_failed',
        category: 'Payment',
        message: `Verification failed: ${requestData?.reference || 'unknown'}`,
        new_values: { error: String((error as any)?.message || error) }
      });
    } catch (_) {
      // ignore audit errors
    }
    
    return new Response(
      JSON.stringify({
        status: false,
        success: false,
        error: (error as any)?.message || 'Failed to verify payment'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
}
