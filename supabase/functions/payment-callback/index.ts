import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VERSION = "v2025-08-17-delivery-fix";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS, PUT, DELETE'
};

serve(async (req) => {
  console.log(`🔄 Payment callback function called [${VERSION}]`);
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const txref = url.searchParams.get('txref');
    const reference = url.searchParams.get('reference') || txref;
    
    console.log(`📋 Processing callback for reference: ${reference}`);

    if (!reference) {
      console.error('❌ No payment reference provided');
      return createErrorResponse('Missing payment reference', 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    );

    // Step 1: Verify payment with Paystack
    const verificationResult = await verifyPaymentWithPaystack(reference);
    
    if (!verificationResult.success) {
      console.error('❌ Payment verification failed:', verificationResult.error);
      return createErrorResponse(`Payment verification failed: ${verificationResult.error}`, 400);
    }

    console.log('✅ Payment verified successfully with Paystack');
    
    // Get payment amount from Paystack for verification
    const paystackAmount = verificationResult.data?.amount ? verificationResult.data.amount / 100 : null;

    // Step 2: Use secure RPC to verify and update payment status
    const { data: orderResult, error: rpcError } = await supabase
      .rpc('verify_and_update_payment_status', {
        payment_ref: reference,
        new_status: 'confirmed',
        payment_amount: paystackAmount,
        payment_gateway_response: verificationResult.data
      });

    if (rpcError) {
      console.error('❌ RPC verification failed:', rpcError);
      return createErrorResponse(`Payment verification failed: ${rpcError.message}`, 500);
    }

    if (!orderResult || orderResult.length === 0) {
      console.error('❌ No order data returned from RPC');
      return createErrorResponse('Order processing failed', 500);
    }

    const orderData = orderResult[0];
    console.log(`✅ Order ${orderData.order_number} confirmed via secure RPC`);

    // Step 3: Optional non-blocking operations (don't fail callback on these)
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
    } catch (txnError) {
      console.error('⚠️ Payment transaction update failed (non-blocking):', txnError);
      // Continue - this shouldn't fail the callback
    }

    console.log('✅ Payment callback completed successfully');

    // Step 4: Always redirect to success page (302)
    const successUrl = `${Deno.env.get('FRONTEND_URL') || 'https://startersmallchops.com'}/checkout/success?ref=${reference}&order=${orderData.order_id}`;
    
    return new Response(null, {
      status: 302,
      headers: {
        ...corsHeaders,
        'Location': successUrl
      }
    });

  } catch (error) {
    console.error('❌ Payment callback error:', error);
    return createErrorResponse(`Callback processing failed: ${error.message}`, 500);
  }
});

async function processDeliveryOrder(orderData, supabase) {
  console.log('🚚 Starting delivery-specific processing...');
  
  const deliveryUpdate = {};

  try {
    // Validate delivery address
    if (!orderData.delivery_address || typeof orderData.delivery_address !== 'object') {
      console.log('⚠️ Missing or invalid delivery address');
      deliveryUpdate.delivery_address = orderData.delivery_address || { address_line_1: 'Address to be confirmed' };
    }

    // Set delivery status
    deliveryUpdate.delivery_status = 'pending';
    deliveryUpdate.estimated_delivery_date = calculateDeliveryDate();

    // Handle delivery fee validation
    if (orderData.delivery_fee === null || orderData.delivery_fee === undefined) {
      console.log('⚠️ Missing delivery fee - calculating...');
      deliveryUpdate.delivery_fee = await calculateDeliveryFee(orderData, supabase);
    }

    // Create delivery record if needed
    const deliveryAddress = typeof orderData.delivery_address === 'object' 
      ? `${orderData.delivery_address.address_line_1 || ''}, ${orderData.delivery_address.city || ''}`.trim()
      : orderData.delivery_address || 'Address to be confirmed';

    const { error: deliveryError } = await supabase
      .from('deliveries')
      .upsert({
        order_id: orderData.id,
        delivery_address: deliveryAddress,
        delivery_fee: deliveryUpdate.delivery_fee || orderData.delivery_fee || 0,
        status: 'scheduled',
        estimated_delivery: deliveryUpdate.estimated_delivery_date,
        created_at: new Date().toISOString()
      }, {
        onConflict: 'order_id'
      });

    if (deliveryError) {
      console.error('⚠️ Delivery record creation failed (non-blocking):', deliveryError);
      // Don't throw - this shouldn't fail the payment
    }

    console.log('✅ Delivery processing completed:', deliveryUpdate);
    return deliveryUpdate;

  } catch (error) {
    console.error('❌ Delivery processing error:', error);
    // Return minimal update to prevent callback failure
    return {
      delivery_status: 'pending',
      estimated_delivery_date: calculateDeliveryDate()
    };
  }
}

async function verifyPaymentWithPaystack(reference) {
  try {
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY_TEST') || 
                     Deno.env.get('PAYSTACK_SECRET_KEY_LIVE');
    
    if (!secretKey) {
      return { success: false, error: 'Paystack secret key not configured' };
    }

    console.log('🔍 Verifying payment with Paystack:', reference);

    const response = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      const errorText = await response.text();
      return { success: false, error: `Paystack API error: ${response.status} - ${errorText}` };
    }

    const data = await response.json();
    
    if (!data.status || data.data.status !== 'success') {
      return { success: false, error: `Payment not successful: ${data.message || 'Unknown error'}` };
    }

    return { success: true, data: data.data };

  } catch (error) {
    return { success: false, error: error.message };
  }
}

function calculateDeliveryDate() {
  const now = new Date();
  // Add 2-3 business days for delivery
  const deliveryDate = new Date(now.getTime() + (2 * 24 * 60 * 60 * 1000));
  return deliveryDate.toISOString();
}

async function calculateDeliveryFee(orderData, supabase) {
  try {
    // Get delivery zones or use default fee
    const { data: deliveryZone } = await supabase
      .from('delivery_zones')
      .select('base_fee')
      .ilike('name', `%${orderData.delivery_city || 'default'}%`)
      .single();

    return deliveryZone?.base_fee || 2000; // Default ₦20 delivery fee
  } catch (error) {
    console.log('⚠️ Could not calculate delivery fee, using default');
    return 2000; // Default delivery fee
  }
}

function createErrorResponse(message, status = 500) {
  console.error(`❌ Creating error response: ${message} (${status})`);
  
  // For payment callbacks, redirect to error page instead of returning JSON
  const errorUrl = `${Deno.env.get('FRONTEND_URL') || 'https://startersmallchops.com'}/checkout/error?message=${encodeURIComponent(message)}`;
  
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': errorUrl
    }
  });
}