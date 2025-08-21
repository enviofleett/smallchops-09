
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
      items_count: requestBody.items?.length,
      fulfillment_type: requestBody.fulfillment?.type
    });

    // Enhanced validation with clear error messages
    if (!requestBody.customer?.email || typeof requestBody.customer.email !== 'string' || requestBody.customer.email.trim() === '') {
      console.error('❌ Customer email validation failed:', {
        email: requestBody.customer?.email,
        type: typeof requestBody.customer?.email
      });
      throw new Error('Customer email is required and must be a valid string');
    }

    if (!requestBody.customer?.name || typeof requestBody.customer.name !== 'string' || requestBody.customer.name.trim() === '') {
      throw new Error('Customer name is required');
    }

    if (!requestBody.items || requestBody.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    if (!requestBody.fulfillment?.type) {
      throw new Error('Fulfillment type is required');
    }

    // Sanitize and prepare data
    const sanitizedEmail = requestBody.customer.email.trim().toLowerCase();
    const sanitizedName = requestBody.customer.name.trim();

    console.log('✅ Validation passed for customer:', {
      email: sanitizedEmail,
      name: sanitizedName,
      items_count: requestBody.items.length,
      fulfillment_type: requestBody.fulfillment.type
    });

    // RACE-SAFE CUSTOMER RESOLUTION
    let customerId;

    // Step 1: Try to find existing customer by email using maybeSingle for safer querying
    console.log('🔍 Searching for existing customer with email:', sanitizedEmail);
    const { data: existingCustomer, error: findError } = await supabaseAdmin
      .from('customer_accounts')
      .select('id, name, phone')
      .eq('email', sanitizedEmail)
      .maybeSingle();

    // Log find errors for debugging but don't fail the request unless critical
    if (findError) {
      console.warn('⚠️ Customer lookup error (non-blocking):', findError);
    }

    if (existingCustomer) {
      // PATH A: Customer exists, use existing ID
      customerId = existingCustomer.id;
      console.log('✅ Found existing customer:', {
        id: customerId,
        email: sanitizedEmail,
        existing_name: existingCustomer.name,
        existing_phone: existingCustomer.phone
      });

      // Optionally enrich existing customer data if provided data is more complete
      const shouldUpdateName = sanitizedName && sanitizedName !== existingCustomer.name;
      const shouldUpdatePhone = requestBody.customer.phone?.trim() && 
        requestBody.customer.phone.trim() !== existingCustomer.phone;

      if (shouldUpdateName || shouldUpdatePhone) {
        const updates = {};
        if (shouldUpdateName) {
          updates.name = sanitizedName;
          console.log('📝 Will update customer name from:', existingCustomer.name, 'to:', updates.name);
        }
        if (shouldUpdatePhone) {
          updates.phone = requestBody.customer.phone.trim();
          console.log('📝 Will update customer phone from:', existingCustomer.phone, 'to:', updates.phone);
        }

        try {
          await supabaseAdmin
            .from('customer_accounts')
            .update(updates)
            .eq('id', customerId);
          console.log('✅ Customer data enrichment successful');
        } catch (updateError) {
          console.warn('⚠️ Customer data enrichment failed (non-blocking):', updateError);
          // Don't fail the checkout for this
        }
      }
    } else {
      // PATH B: Customer doesn't exist, create new one with race-safe logic
      console.log('🆕 Creating new customer account for:', sanitizedEmail);
      try {
        const { data: newCustomer, error: customerError } = await supabaseAdmin
          .from('customer_accounts')
          .insert({
            name: sanitizedName,
            email: sanitizedEmail,
            phone: requestBody.customer.phone?.trim() || null,
            email_verified: false,
            phone_verified: false,
            profile_completion_percentage: 60
          })
          .select('id')
          .single();

        if (customerError) {
          console.error('❌ Customer creation failed:', customerError);
          throw customerError; // Will be caught by the outer try-catch
        }

        customerId = newCustomer.id;
        console.log('✅ Created new customer:', customerId);

      } catch (creationError) {
        // PATH C: Handle race condition - another process created the same customer
        if (creationError.code === '23505' && creationError.message?.includes('customer_accounts_email_key')) {
          console.log('🔄 Race condition detected - customer was created by another process, fetching existing customer...');
          
          // Another process created the customer, fetch the existing one
          const { data: raceCustomer, error: raceError } = await supabaseAdmin
            .from('customer_accounts')
            .select('id, name, phone')
            .eq('email', sanitizedEmail)
            .single();

          if (raceError || !raceCustomer) {
            console.error('❌ Failed to fetch customer after race condition:', raceError);
            throw new Error('Failed to resolve customer account after creation conflict');
          }

          customerId = raceCustomer.id;
          console.log('✅ Resolved race condition - using existing customer:', {
            id: customerId,
            email: sanitizedEmail,
            name: raceCustomer.name
          });
        } else {
          // Unexpected error
          console.error('❌ Unexpected customer creation error:', creationError);
          throw new Error('Failed to create customer account');
        }
      }
    }
    
    // ORDER CREATION
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
      p_guest_session_id: null, // Always null - guest mode discontinued
      p_items: orderItems
    });

    if (orderError) {
      console.error('❌ Order creation failed:', orderError);
      throw new Error(`Order creation failed: ${orderError.message}`);
    }

    console.log('✅ Order created successfully:', orderId);
    
    // Get the created order details
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, total_amount, customer_email')
      .eq('id', orderId)
      .single();

    if (fetchError || !order) {
      throw new Error('Failed to fetch created order');
    }

    console.log('💰 Order details:', {
      order_id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      customer_email: order.customer_email
    });
    
    // PAYMENT INITIALIZATION
    console.log('💳 Initializing payment via paystack-secure...');
    const { data: paymentData, error: paymentError } = await supabaseAdmin.functions.invoke('paystack-secure', {
      body: {
        action: 'initialize',
        email: order.customer_email,
        amount: order.total_amount,
        metadata: {
          order_id: order.id,
          customer_name: sanitizedName,
          order_number: order.order_number,
          fulfillment_type: requestBody.fulfillment.type,
          items_subtotal: order.total_amount,
          delivery_fee: 0,
          client_total: order.total_amount,
          authoritative_total: order.total_amount
        },
        callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-callback?reference=__REFERENCE__&order_id=${order.id}`
      }
    });

    if (paymentError) {
      console.error('❌ Payment initialization failed:', paymentError);
      throw new Error(`Payment initialization failed: ${paymentError.message}`);
    }

    console.log('✅ Payment initialized successfully via paystack-secure');

    // RETURN SUCCESS RESPONSE
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

/*
🛒 ENHANCED CHECKOUT PROCESSOR WITH RACE-SAFE CUSTOMER RESOLUTION
✅ Handles duplicate customer emails gracefully using 3-path resolution:
  - Path A: Customer exists → use existing ID
  - Path B: Customer doesn't exist → create new
  - Path C: Race condition (23505 error) → fetch existing and continue
✅ Enhanced validation and sanitization
✅ Customer data enrichment for existing accounts
✅ Guest mode completely disabled (guest_session_id always null)
✅ Comprehensive logging for debugging
✅ Backward-compatible response format
✅ Uses paystack-secure for payment initialization
✅ Production-ready error handling
*/
