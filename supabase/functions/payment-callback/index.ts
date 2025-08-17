import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VERSION = "v2025-08-17-production-ready";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

serve(async (req) => {
  console.log(`[payment-callback ${VERSION}] 🔄 Callback function called`);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Extract reference from multiple possible sources
    const url = new URL(req.url);
    let reference = url.searchParams.get('reference') || 
                   url.searchParams.get('trxref') || 
                   url.searchParams.get('txref');

    // For POST requests, also check body
    if (!reference && (req.method === 'POST' || req.method === 'PUT')) {
      try {
        const body = await req.json();
        reference = body.reference || body.trxref || body.txref;
      } catch (e) {
        console.log(`[payment-callback ${VERSION}] ⚠️ Could not parse request body`);
      }
    }

    console.log(`[payment-callback ${VERSION}] 📋 Processing reference: ${reference}`);

    if (!reference) {
      console.error(`[payment-callback ${VERSION}] ❌ No payment reference provided`);
      return createErrorRedirect('Missing payment reference');
    }

    // Use SERVICE_ROLE_KEY for secure operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Step 1: Verify payment with Paystack
    console.log(`[payment-callback ${VERSION}] 🔍 Verifying with Paystack...`);
    const verificationResult = await verifyPaymentWithPaystack(reference);
    
    if (!verificationResult.success) {
      console.error(`[payment-callback ${VERSION}] ❌ Paystack verification failed:`, verificationResult.error);
      return createErrorRedirect(`Payment verification failed: ${verificationResult.error}`);
    }

    console.log(`[payment-callback ${VERSION}] ✅ Paystack verification successful`);
    
    // Get payment amount from Paystack for verification
    const paystackAmount = verificationResult.data?.amount ? verificationResult.data.amount / 100 : null;

    // Step 2: Use secure RPC to verify and update payment status
    console.log(`[payment-callback ${VERSION}] 🔧 Calling secure RPC for order update...`);
    const { data: orderResult, error: rpcError } = await supabase
      .rpc('verify_and_update_payment_status', {
        payment_ref: reference,
        new_status: 'confirmed',
        payment_amount: paystackAmount,
        payment_gateway_response: verificationResult.data
      });

    if (rpcError) {
      console.error(`[payment-callback ${VERSION}] ❌ RPC verification failed:`, rpcError);
      return createErrorRedirect(`Order processing failed: ${rpcError.message}`);
    }

    if (!orderResult || orderResult.length === 0) {
      console.error(`[payment-callback ${VERSION}] ❌ No order data returned from RPC`);
      return createErrorRedirect('Order not found or already processed');
    }

    const orderData = orderResult[0];
    console.log(`[payment-callback ${VERSION}] ✅ Order ${orderData.order_number} confirmed via secure RPC`);

    // Step 3: Update payment_status to 'paid' explicitly (RPC handles 'status' but we need payment_status)
    try {
      await supabase
        .from('orders')
        .update({ payment_status: 'paid' })
        .eq('id', orderData.order_id);
      
      console.log(`[payment-callback ${VERSION}] ✅ Payment status updated to 'paid'`);
    } catch (paymentStatusError) {
      console.error(`[payment-callback ${VERSION}] ⚠️ Payment status update failed (non-blocking):`, paymentStatusError);
      // Continue - don't fail callback for this
    }

    // Step 4: Optional non-blocking operations (don't fail callback on these)
    try {
      // Update payment transaction record if it exists
      await supabase
        .from('payment_transactions')
        .upsert({
          reference: reference,
          provider_reference: reference,
          amount: paystackAmount || orderData.amount,
          currency: 'NGN',
          status: 'completed',
          gateway_response: JSON.stringify(verificationResult.data),
          verified_at: new Date().toISOString(),
          order_id: orderData.order_id
        }, {
          onConflict: 'reference'
        });
      
      console.log(`[payment-callback ${VERSION}] ✅ Payment transaction record updated`);
    } catch (txnError) {
      console.error(`[payment-callback ${VERSION}] ⚠️ Payment transaction update failed (non-blocking):`, txnError);
      // Continue - this shouldn't fail the callback
    }

    console.log(`[payment-callback ${VERSION}] ✅ Payment callback completed successfully for order ${orderData.order_number}`);

    // Step 5: Always redirect to success page (302)
    const successUrl = `${Deno.env.get('FRONTEND_URL') || 'https://startersmallchops.com'}/payment/callback?reference=${reference}&status=success&order_id=${orderData.order_id}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': successUrl
      }
    });

  } catch (error) {
    console.error(`[payment-callback ${VERSION}] ❌ Unexpected error:`, error);
    return createErrorRedirect(`Callback processing failed: ${error.message}`);
  }
});

async function verifyPaymentWithPaystack(reference: string) {
  try {
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY') ||
                     Deno.env.get('PAYSTACK_SECRET_KEY_TEST') || 
                     Deno.env.get('PAYSTACK_SECRET_KEY_LIVE');
    
    if (!secretKey) {
      return { success: false, error: 'Paystack secret key not configured' };
    }

    console.log(`[payment-callback ${VERSION}] 🔍 Verifying with Paystack API...`);

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[payment-callback ${VERSION}] ❌ Paystack API error:`, response.status, errorText);
      return { success: false, error: `Paystack API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    
    if (!data.status || data.data.status !== 'success') {
      console.error(`[payment-callback ${VERSION}] ❌ Payment not successful:`, data);
      return { success: false, error: `Payment not successful: ${data.message || 'Unknown error'}` };
    }

    console.log(`[payment-callback ${VERSION}] ✅ Paystack verification successful for ${reference}`);
    return { success: true, data: data.data };

  } catch (error) {
    console.error(`[payment-callback ${VERSION}] ❌ Paystack verification error:`, error);
    return { success: false, error: error.message };
  }
}

function createErrorRedirect(message: string) {
  console.error(`[payment-callback ${VERSION}] ❌ Creating error redirect: ${message}`);
  
  // Always redirect to error page instead of returning JSON (prevents 4xx/5xx)
  const errorUrl = `${Deno.env.get('FRONTEND_URL') || 'https://startersmallchops.com'}/payment/callback?status=error&message=${encodeURIComponent(message)}`;
  
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': errorUrl
    }
  });
}