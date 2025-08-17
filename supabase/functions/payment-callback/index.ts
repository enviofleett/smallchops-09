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

    // Step 2: Get order details BEFORE processing
    const { data: orderData, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_id,
          quantity,
          unit_price,
          product_name
        )
      `)
      .eq('payment_reference', reference)
      .single();

    if (orderError || !orderData) {
      console.error('❌ Order not found:', orderError);
      return createErrorResponse('Order not found', 404);
    }

    console.log(`📦 Processing ${orderData.order_type} order:`, orderData.id);

    // Step 3: Process based on fulfillment type
    let updateData = {
      status: 'confirmed',
      payment_status: 'paid',
      payment_verified_at: new Date().toISOString()
    };

    // Handle delivery-specific processing
    if (orderData.order_type === 'delivery') {
      console.log('🚚 Processing delivery order...');
      
      try {
        const deliveryUpdate = await processDeliveryOrder(orderData, supabase);
        updateData = { ...updateData, ...deliveryUpdate };
        console.log('✅ Delivery processing completed');
      } catch (deliveryError) {
        console.error('❌ Delivery processing failed:', deliveryError.message);
        // Don't fail the entire callback - continue with basic completion
        console.log('⚠️ Continuing with basic order completion despite delivery error');
      }
    } else {
      console.log('🏪 Processing pickup order...');
      // Pickup orders need minimal processing
      updateData.pickup_ready = true;
    }

    // Step 4: Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update(updateData)
      .eq('id', orderData.id);

    if (updateError) {
      console.error('❌ Order update failed:', updateError);
      return createErrorResponse(`Order update failed: ${updateError.message}`, 500);
    }

    // Step 5: Update payment transaction
    const { error: paymentError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'completed',
        verified_at: new Date().toISOString()
      })
      .eq('reference', reference);

    if (paymentError) {
      console.error('⚠️ Payment transaction update failed (non-blocking):', paymentError);
      // Don't fail callback for this
    }

    console.log('✅ Payment callback completed successfully');

    // Step 6: Redirect to success page
    const successUrl = `${Deno.env.get('FRONTEND_URL') || 'https://startersmallchops.com'}/checkout/success?ref=${reference}&order=${orderData.id}`;
    
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