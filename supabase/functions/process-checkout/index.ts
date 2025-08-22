
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders
    });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );
    
    console.log('🛒 Processing checkout request...');
    const requestBody = await req.json();

    console.log('📨 Checkout request received:', {
      customer_email: requestBody.customer?.email,
      items_count: requestBody.items?.length
    });

    // Validate request
    if (!requestBody.customer?.email) {
      throw new Error('Customer email is required');
    }
    if (!requestBody.items || requestBody.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }
    if (!requestBody.fulfillment?.type) {
      throw new Error('Fulfillment type is required');
    }

    let customerId;
    const customerEmail = requestBody.customer.email.toLowerCase();

    // Race-safe customer resolution: Check if customer exists
    console.log('👤 Looking up customer by email:', customerEmail);
    const { data: existingCustomer, error: findError } = await supabaseAdmin
      .from('customer_accounts')
      .select('id, name')
      .eq('email', customerEmail)
      .maybeSingle();
    
    if (findError) {
      console.error('❌ Failed to check for existing customer:', findError);
      throw new Error('Failed to find customer account');
    }

    if (existingCustomer) {
      // Customer exists, use their ID
      customerId = existingCustomer.id;
      console.log('👤 Using existing customer:', customerId, 'Name:', existingCustomer.name);
    } else {
      // Customer doesn't exist, create new account with race condition handling
      console.log('👤 Creating new customer account for:', customerEmail);
      const { data: newCustomer, error: createError } = await supabaseAdmin
        .from('customer_accounts')
        .insert({
          name: requestBody.customer.name,
          email: customerEmail,
          phone: requestBody.customer.phone,
          email_verified: false,
          phone_verified: false,
          profile_completion_percentage: 60
        })
        .select('id')
        .maybeSingle();
      
      if (createError) {
        // Handle potential race condition - another process might have created the customer
        if (createError.code === '23505') { // Unique constraint violation
          console.log('⚠️ Customer creation race condition detected, fetching existing customer');
          const { data: raceCustomer, error: raceError } = await supabaseAdmin
            .from('customer_accounts')
            .select('id, name')
            .eq('email', customerEmail)
            .maybeSingle();
            
          if (raceError || !raceCustomer) {
            console.error('❌ Failed to resolve customer after race condition:', raceError);
            throw new Error('Failed to resolve customer account');
          }
          
          customerId = raceCustomer.id;
          console.log('👤 Resolved race condition, using existing customer:', customerId);
        } else {
          console.error('❌ Customer creation failed:', createError);
          throw new Error('Failed to create customer account');
        }
      } else if (!newCustomer) {
        throw new Error('Customer creation returned no data');
      } else {
        customerId = newCustomer.id;
        console.log('👤 Created new customer:', customerId);
      }
    }
    
    // The rest of the logic remains unchanged, using the determined customerId
    console.log('📝 Creating order with items...');
    
    const orderItems = requestBody.items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      customizations: item.customizations
    }));

    // Create order using the database function
    const { data: orderId, error: orderError } = await supabaseAdmin.rpc('create_order_with_items', {
      p_customer_id: customerId,
      p_fulfillment_type: requestBody.fulfillment.type,
      p_delivery_address: requestBody.fulfillment.address || null,
      p_pickup_point_id: requestBody.fulfillment.pickup_point_id || null,
      p_delivery_zone_id: requestBody.fulfillment.delivery_zone_id || null,
      p_guest_session_id: null,
      p_items: orderItems
    });

    if (orderError) {
      console.error('❌ Order creation failed:', orderError);
      throw new Error(`Order creation failed: ${orderError.message}`);
    }

    console.log('✅ Order created successfully:', orderId);
    
    // Compute delivery fee if delivery order
    let deliveryFee = 0;
    if (requestBody.fulfillment.type === 'delivery' && requestBody.fulfillment.delivery_zone_id) {
      console.log('💰 Computing delivery fee for zone:', requestBody.fulfillment.delivery_zone_id);
      
      const { data: deliveryZone, error: zoneError } = await supabaseAdmin
        .from('delivery_zones')
        .select('delivery_fee')
        .eq('id', requestBody.fulfillment.delivery_zone_id)
        .maybeSingle();
      
      if (zoneError) {
        console.error('⚠️ Failed to fetch delivery zone fee:', zoneError);
      } else if (deliveryZone) {
        deliveryFee = deliveryZone.delivery_fee || 0;
        console.log('💰 Delivery fee for zone:', deliveryFee);
      }
    }
    
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, total_amount, customer_email')
      .eq('id', orderId)
      .maybeSingle();

    if (fetchError) {
      console.error('❌ Failed to fetch order:', fetchError);
      throw new Error('Failed to fetch created order');
    }
    
    if (!order) {
      console.error('❌ Order not found after creation:', orderId);
      throw new Error('Order not found after creation');
    }

    // Update order with delivery fee
    if (deliveryFee > 0) {
      console.log('💰 Updating order with delivery fee:', deliveryFee);
      
      const newTotalAmount = order.total_amount + deliveryFee;
      
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          delivery_fee: deliveryFee,
          total_amount: newTotalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (updateError) {
        console.error('⚠️ Failed to update order with delivery fee:', updateError);
      } else {
        console.log('✅ Order updated with delivery fee. New total:', newTotalAmount);
        order.total_amount = newTotalAmount;
      }
    }

    console.log('💰 Order details:', {
      order_id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      customer_email: order.customer_email
    });
    
    // Construct callback URL and log for debugging
    const callbackUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-callback?order_id=${order.id}`;
    console.log('🔗 Payment callback URL:', callbackUrl);
    
    console.log('💳 Initializing payment via paystack-secure...');
    const { data: paymentData, error: paymentError } = await supabaseAdmin.functions.invoke('paystack-secure', {
      body: {
        action: 'initialize',
        email: order.customer_email,
        amount: order.total_amount,
        metadata: {
          order_id: order.id,
          customer_name: requestBody.customer.name,
          order_number: order.order_number,
          fulfillment_type: requestBody.fulfillment.type,
          items_subtotal: order.total_amount - deliveryFee,
          delivery_fee: deliveryFee,
          client_total: order.total_amount,
          authoritative_total: order.total_amount
        },
        callback_url: callbackUrl
      }
    });

    if (paymentError) {
      console.error('❌ Payment initialization failed:', paymentError);
      throw new Error(`Payment initialization failed: ${paymentError.message}`);
    }

    // Log payment reference for debugging
    const paymentReference = paymentData.data?.reference || paymentData.reference;
    console.log('✅ Payment initialized successfully via paystack-secure');
    console.log('💳 Payment reference:', paymentReference);
    console.log('🌐 Authorization URL:', paymentData.data?.authorization_url || paymentData.authorization_url);

    return new Response(JSON.stringify({
      success: true,
      order: {
        id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount,
        status: 'pending'
      },
      customer: {
        id: customerId,
        email: order.customer_email
      },
      payment: {
        authorization_url: paymentData.data?.authorization_url || paymentData.authorization_url,
        reference: paymentData.data?.reference || paymentData.reference
      }
    }), {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });

  } catch (error) {
    console.error('❌ Checkout processing error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Checkout processing failed',
      details: {
        timestamp: new Date().toISOString(),
        error_type: error.constructor.name
      }
    }), {
      status: 400,
      headers: {
        ...corsHeaders,
        'Content-Type': 'application/json'
      }
    });
  }
});
