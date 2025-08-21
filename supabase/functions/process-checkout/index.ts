
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type'
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '', 
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🛒 Processing checkout request...');
    
    // Parse request body
    const requestBody = await req.json();
    
    // Enhanced logging to debug the issue
    console.log('📨 Raw request body structure:', {
      hasCustomer: !!requestBody.customer,
      customerKeys: requestBody.customer ? Object.keys(requestBody.customer) : [],
      customerEmail: requestBody.customer?.email,
      customerEmailType: typeof requestBody.customer?.email,
      customerEmailLength: requestBody.customer?.email?.length,
      hasItems: !!requestBody.items,
      itemsLength: requestBody.items?.length,
      hasFulfillment: !!requestBody.fulfillment,
      fulfillmentType: requestBody.fulfillment?.type
    });

    // CRITICAL FIX: Force guest_session_id to NULL (guest mode discontinued)
    const processedRequest = {
      ...requestBody,
      guest_session_id: null // Always null - guest mode discontinued
    };

    console.log('🚫 Guest mode disabled - forcing guest_session_id to null');

    // Enhanced validation with better error messages
    if (!processedRequest.customer) {
      throw new Error('Customer information is required');
    }

    if (!processedRequest.customer.email || 
        typeof processedRequest.customer.email !== 'string' || 
        processedRequest.customer.email.trim() === '') {
      console.error('❌ Customer email validation failed:', {
        email: processedRequest.customer.email,
        type: typeof processedRequest.customer.email,
        trimmed: processedRequest.customer.email?.trim?.()
      });
      throw new Error('Customer email is required and must be a valid string');
    }

    if (!processedRequest.customer.name || 
        typeof processedRequest.customer.name !== 'string' || 
        processedRequest.customer.name.trim() === '') {
      throw new Error('Customer name is required');
    }

    if (!processedRequest.items || processedRequest.items.length === 0) {
      throw new Error('Order must contain at least one item');
    }

    if (!processedRequest.fulfillment?.type) {
      throw new Error('Fulfillment type is required');
    }

    // Sanitize email
    const sanitizedEmail = processedRequest.customer.email.trim().toLowerCase();
    
    console.log('✅ Validation passed for customer:', {
      email: sanitizedEmail,
      name: processedRequest.customer.name.trim(),
      items_count: processedRequest.items.length,
      fulfillment_type: processedRequest.fulfillment.type
    });

    // Create or get customer account
    let customerId;
    if (processedRequest.customer.id) {
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(processedRequest.customer.id)) {
        throw new Error('Invalid customer ID format');
      }
      customerId = processedRequest.customer.id;
      console.log('👤 Using existing customer ID:', customerId);
    } else {
      // Step 1: Try to find existing customer by email using maybeSingle for safer querying
      console.log('🔍 Searching for existing customer with email:', sanitizedEmail);
      const { data: existingCustomer, error: findError } = await supabaseAdmin
        .from('customer_accounts')
        .select('id, name, phone')
        .eq('email', sanitizedEmail)
        .maybeSingle();

      // Log find errors for debugging but don't fail the request
      if (findError) {
        console.warn('⚠️ Customer lookup error (non-blocking):', findError);
      }

      if (existingCustomer) {
        // Path A: Customer exists, use existing ID
        customerId = existingCustomer.id;
        console.log('✅ Found existing customer:', {
          id: customerId,
          email: sanitizedEmail,
          name: existingCustomer.name,
          phone: existingCustomer.phone
        });

        // Optionally enrich existing customer data if provided data is more complete
        const shouldUpdateName = processedRequest.customer.name?.trim() && 
          processedRequest.customer.name.trim() !== existingCustomer.name;
        const shouldUpdatePhone = processedRequest.customer.phone?.trim() && 
          processedRequest.customer.phone.trim() !== existingCustomer.phone;

        if (shouldUpdateName || shouldUpdatePhone) {
          const updates = {};
          if (shouldUpdateName) {
            updates.name = processedRequest.customer.name.trim();
            console.log('📝 Will update customer name from:', existingCustomer.name, 'to:', updates.name);
          }
          if (shouldUpdatePhone) {
            updates.phone = processedRequest.customer.phone.trim();
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
        // Path B: Customer doesn't exist, create new one with race-safe logic
        console.log('🆕 Creating new customer account for:', sanitizedEmail);
        try {
          const { data: newCustomer, error: customerError } = await supabaseAdmin
            .from('customer_accounts')
            .insert({
              name: processedRequest.customer.name.trim(),
              email: sanitizedEmail,
              phone: processedRequest.customer.phone?.trim() || null,
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
          // Path C: Handle race condition - another process created the same customer
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
    }

    console.log('📝 Creating order with items...')

    // Prepare items for order creation
    const orderItems = processedRequest.items.map(item => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      customizations: item.customizations
    }))

    // Create order using the database function
    const { data: orderId, error: orderError } = await supabaseAdmin
      .rpc('create_order_with_items', {
        p_customer_id: customerId,
        p_fulfillment_type: processedRequest.fulfillment.type,
        p_delivery_address: processedRequest.fulfillment.address || null,
        p_pickup_point_id: processedRequest.fulfillment.pickup_point_id || null,
        p_delivery_zone_id: processedRequest.fulfillment.delivery_zone_id || null,
        p_guest_session_id: null, // Always null
        p_items: orderItems
      })

    if (orderError) {
      console.error('❌ Order creation failed:', orderError)
      throw new Error(`Order creation failed: ${orderError.message}`)
    }

    console.log('✅ Order created successfully:', orderId)

    // Get the created order details
    const { data: order, error: fetchError } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, total_amount, customer_email')
      .eq('id', orderId)
      .single()

    if (fetchError || !order) {
      throw new Error('Failed to fetch created order')
    }

    console.log('💰 Order details:', {
      order_id: order.id,
      order_number: order.order_number,
      total_amount: order.total_amount,
      customer_email: order.customer_email
    })

    // Initialize payment using paystack-secure
    console.log('💳 Initializing payment via paystack-secure...');
    const { data: paymentData, error: paymentError } = await supabaseAdmin.functions.invoke('paystack-secure', {
      body: {
        action: 'initialize',
        email: order.customer_email,
        amount: order.total_amount,
        metadata: {
          order_id: order.id,
          customer_name: processedRequest.customer.name.trim(),
          order_number: order.order_number,
          fulfillment_type: processedRequest.fulfillment.type,
          items_subtotal: order.total_amount,
          delivery_fee: 0,
          client_total: order.total_amount,
          authoritative_total: order.total_amount
        },
        callback_url: `${Deno.env.get('SUPABASE_URL')}/functions/v1/payment-callback?reference=__REFERENCE__&order_id=${order.id}`
      }
    });

    if (paymentError) {
      console.error('❌ Payment initialization failed:', paymentError)
      throw new Error(`Payment initialization failed: ${paymentError.message}`)
    }

    console.log('✅ Payment initialized successfully via paystack-secure')

    // Return success response
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
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Checkout processing error:', error);
    
    // Enhanced error response with more debugging info
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Checkout processing failed',
      details: {
        timestamp: new Date().toISOString(),
        error_type: error.constructor.name,
        stack: error.stack // Include stack trace for debugging
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
🛒 PRODUCTION CHECKOUT PROCESSOR
✅ Guest mode completely disabled (guest_session_id always null)
✅ Robust UUID validation for customer IDs
✅ Uses paystack-secure for all payment initialization
✅ Comprehensive error handling and logging
✅ Idempotent order creation with database function
✅ Production-ready error responses

🔧 USAGE:
POST /functions/v1/process-checkout
{
  "customer": {
    "id": "uuid-optional",
    "name": "Customer Name",
    "email": "customer@email.com",
    "phone": "+234..."
  },
  "items": [
    {
      "product_id": "uuid",
      "product_name": "Product Name",
      "quantity": 2,
      "unit_price": 1000
    }
  ],
  "fulfillment": {
    "type": "delivery",
    "address": {...}
  }
}

📊 RESPONSE:
{
  "success": true,
  "order": {
    "id": "uuid",
    "order_number": "ORD-...",
    "total_amount": 2000,
    "status": "pending"
  },
  "payment": {
    "authorization_url": "https://checkout.paystack.com/...",
    "reference": "txn_..."
  }
}
*/
