import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VERSION = "v2025-08-17-fixed";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

serve(async (req) => {
  console.log(`🔄 Paystack secure function called [${VERSION}]`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // FIX: Use ANON_KEY instead of SERVICE_ROLE_KEY for standard operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_ANON_KEY') ?? '', 
      {
        auth: { persistSession: false }
      }
    );

    const requestBody = await req.json();
    console.log('📨 Request payload:', JSON.stringify(requestBody, null, 2));

    const { action, ...requestData } = requestBody;

    if (action === 'initialize') {
      return await initializePayment(supabaseClient, requestData);
    } else if (action === 'verify') {
      return await verifyPayment(supabaseClient, requestData);
    } else {
      return new Response(JSON.stringify({
        status: false,
        error: 'Invalid action specified'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Paystack secure operation error:', error);
    return new Response(JSON.stringify({
      status: false,
      error: 'Operation failed',
      message: error.message,
      version: VERSION
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function initializePayment(supabaseClient, requestData) {
  try {
    const { email, customer_email, amount, reference, metadata, channels, order_id, order_number } = requestData;

    // Normalize email input - accept both email and customer_email
    const customerEmail = email || customer_email;
    console.log('📧 Email normalization:', { email, customer_email, resolved: customerEmail });

    console.log('🔍 Fetching Paystack configuration...');
    
    // Get authoritative amount and transaction reference from order
    let authoritativeAmount = amount;
    let orderId = order_id;
    let transactionRef;
    
    // Create service client for database operations
    const serviceClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );
    
    if (order_id || order_number) {
      let orderQuery = serviceClient.from('orders').select('id, total_amount, payment_reference');
      
      if (order_id) {
        orderQuery = orderQuery.eq('id', order_id);
      } else if (order_number) {
        orderQuery = orderQuery.eq('order_number', order_number);
      }
      
      const { data: order, error: orderError } = await orderQuery.single();
      
      if (orderError || !order) {
        console.error('❌ Order not found:', { order_id, order_number, error: orderError });
        throw new Error('Order not found');
      }
      
      authoritativeAmount = order.total_amount;
      orderId = order.id;
      
      // Use existing transaction reference if valid, otherwise generate new one
      if (order.payment_reference && order.payment_reference.startsWith('txn_')) {
        transactionRef = order.payment_reference;
        console.log('🔄 Using existing transaction reference:', transactionRef);
      } else {
        transactionRef = `txn_${Date.now()}_${crypto.randomUUID()}`;
        console.log('🆕 Generated new transaction reference:', transactionRef);
        
        // Update order with new payment reference
        const { error: updateError } = await serviceClient.rpc('update_order_with_payment_reference', {
          order_uuid: orderId,
          new_payment_reference: transactionRef
        });
        
        if (updateError) {
          console.error('⚠️ Failed to update order payment reference:', updateError);
        } else {
          console.log('✅ Order payment reference updated successfully');
        }
      }
      
      // Security check: log if client amount differs from DB amount
      if (amount && Math.abs(parseFloat(amount) - authoritativeAmount) > 0.01) {
        console.error('🚨 SECURITY ALERT: Amount mismatch detected!', {
          client_amount: amount,
          db_amount: authoritativeAmount,
          order_id: orderId,
          email: customerEmail
        });
        
        // Log security incident but don't fail - use authoritative amount
        try {
          await serviceClient.from('security_incidents').insert({
            type: 'payment_amount_mismatch',
            description: `Client attempted to pay different amount than order total`,
            severity: 'high',
            reference: transactionRef,
            expected_amount: authoritativeAmount,
            received_amount: parseFloat(amount),
            created_at: new Date().toISOString()
          });
        } catch (e) {
          console.error('Failed to log security incident:', e);
        }
      }
      
      console.log('💰 Using authoritative amount from DB:', authoritativeAmount, 'for order:', orderId);
    } else {
      // Generate transaction reference for non-order payments
      transactionRef = `txn_${Date.now()}_${crypto.randomUUID()}`;
      console.log('🆕 Generated transaction reference for standalone payment:', transactionRef);
    }

    // Input validation
    if (!customerEmail) {
      throw new Error('Customer email is required');
    }
    
    if (!authoritativeAmount) {
      throw new Error('Unable to determine amount from order');
    }

    // Amount validation and conversion (single scaling point)
    const amountInKobo = Math.round(parseFloat(authoritativeAmount) * 100);
    if (isNaN(amountInKobo) || amountInKobo < 100) {
      throw new Error('Amount must be a number equal to or greater than ₦1.00');
    }

    console.log('💰 Amount processing:', {
      authoritative_amount_naira: authoritativeAmount,
      amount_in_kobo: amountInKobo,
      client_provided_amount: amount,
      using_authoritative: true,
      transaction_reference: transactionRef
    })

    console.log(`💳 Initializing payment: ${transactionRef} for ${customerEmail}, amount: ₦${amountInKobo/100}`);

    // Get Paystack configuration
    const { getPaystackConfig } = await import('../_shared/paystack-config.ts');
    const config = getPaystackConfig();
    
    if (!config.secretKey) {
      console.error('❌ No Paystack secret key found');
      throw new Error('Paystack secret key not configured');
    }

    console.log('⚙️ Config result:', { config: 'found', error: null });
    console.log('🔑 Using secret key type:', config.isTestMode ? 'test' : 'live');

    // Use provided callback_url or default to frontend success page
    const callbackUrl = requestData.callback_url || `${Deno.env.get('FRONTEND_URL') || 'https://startersmallchops.com'}/checkout/success`;

    // Prepare Paystack payload
    const paystackPayload = {
      email: customerEmail,
      amount: amountInKobo.toString(),
      currency: 'NGN',
      reference: transactionRef,
      channels: channels || ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
      metadata: JSON.stringify({
        order_id: orderId,
        customer_name: metadata?.customer_name,
        order_number: metadata?.order_number,
        ...metadata
      })
    };

    console.log('🚀 Sending to Paystack:', JSON.stringify(paystackPayload, null, 2));

    // Initialize payment with Paystack
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(paystackPayload)
    });

    console.log('📡 Paystack response status:', paystackResponse.status);

    if (!paystackResponse.ok) {
      const errorText = await paystackResponse.text();
      console.error('❌ Paystack HTTP error:', paystackResponse.status, errorText);
      
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

    // FIX: Validate required fields before returning
    if (!paystackData.data?.authorization_url || !paystackData.data?.access_code) {
      console.error('❌ Missing required fields in Paystack response');
      throw new Error('Missing authorization_url or access_code from Paystack');
    }

    console.log('✅ Paystack payment initialized successfully:', paystackData.data.reference);

    // Create payment transaction record using service role client
    try {
      const { error: transactionError } = await serviceClient
        .from('payment_transactions')
        .upsert({
          provider_reference: transactionRef, // Use our transaction reference
          order_id: orderId,
          amount: authoritativeAmount, // Store in naira
          status: 'pending',
          provider: 'paystack',
          customer_email: customerEmail, // Use normalized email
          authorization_url: paystackData.data.authorization_url,
          access_code: paystackData.data.access_code,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'provider_reference'
        })
      
      if (transactionError) {
        console.error('⚠️ Failed to create payment transaction record:', transactionError)
      } else {
        console.log('✅ Payment transaction record created successfully')
      }
    } catch (dbError) {
      console.error('⚠️ Database error creating transaction record:', dbError)
      // Non-blocking - payment initialization should still succeed
    }

    return new Response(JSON.stringify({
      status: true,
      data: {
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: transactionRef // Return our consistent transaction reference
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Payment initialization error:', error);
    return new Response(JSON.stringify({
      status: false,
      error: error.message || 'Failed to initialize payment'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function verifyPayment(supabaseClient, requestData) {
  try {
    const { reference } = requestData;

    if (!reference) {
      throw new Error('Payment reference is required');
    }

    console.log('🔍 Verifying payment:', reference);

    // Get Paystack configuration
    const { getPaystackConfig } = await import('../_shared/paystack-config.ts');
    const config = getPaystackConfig();
    
    if (!config.secretKey) {
      throw new Error('Paystack secret key not configured');
    }

    // Verify payment with Paystack
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!paystackResponse.ok) {
      const errorText = await paystackResponse.text();
      console.error('❌ Paystack verification HTTP error:', paystackResponse.status, errorText);
      throw new Error(`Paystack verification failed (${paystackResponse.status}): ${errorText}`);
    }

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      console.error('❌ Paystack verification failed:', paystackData);
      throw new Error(paystackData.message || 'Failed to verify payment');
    }

    console.log('✅ Paystack payment verified successfully:', reference);

    // Update database records after successful verification using service role
    if (paystackData.data.status === 'success') {
      try {
        const serviceClient = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
          { auth: { persistSession: false } }
        )

        // Update payment transaction
        const { error: transactionUpdateError } = await serviceClient
          .from('payment_transactions')
          .update({ 
            status: 'completed',
            verified_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('provider_reference', reference)

        if (transactionUpdateError) {
          console.error('⚠️ Failed to update payment transaction:', transactionUpdateError)
        }

        // Update order status
        const { error: orderUpdateError } = await serviceClient
          .from('orders')
          .update({ 
            status: 'confirmed',
            paid_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('payment_reference', reference)

        if (orderUpdateError) {
          console.error('⚠️ Failed to update order status:', orderUpdateError)
        } else {
          console.log('✅ Database records updated after verification')
        }
      } catch (dbError) {
        console.error('⚠️ Failed to update database after verification:', dbError)
        // Don't fail the verification response
      }
    }

    return new Response(JSON.stringify({
      status: true,
      data: {
        status: paystackData.data.status,
        amount: paystackData.data.amount,
        currency: paystackData.data.currency,
        customer: paystackData.data.customer,
        metadata: paystackData.data.metadata,
        paid_at: paystackData.data.paid_at,
        channel: paystackData.data.channel,
        gateway_response: paystackData.data.gateway_response,
        reference: reference
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Payment verification error:', error);
    return new Response(JSON.stringify({
      status: false,
      error: error.message || 'Failed to verify payment'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}