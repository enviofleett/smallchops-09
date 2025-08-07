import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('🔄 Process checkout function called');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const requestBody = await req.json();
    console.log('📨 Checkout request:', JSON.stringify(requestBody, null, 2));
    
    const {
      customer_email,
      customer_name,
      customer_phone,
      fulfillment_type,
      delivery_address,
      pickup_point_id,
      order_items,
      total_amount,
      delivery_fee,
      delivery_zone_id,
      payment_method,
      guest_session_id,
      payment_reference
    } = requestBody;

    // Validate required fields
    if (!customer_email || !customer_name || !order_items || order_items.length === 0 || !total_amount) {
      throw new Error('Missing required fields: customer_email, customer_name, order_items, or total_amount');
    }

    if (!fulfillment_type || !['delivery', 'pickup'].includes(fulfillment_type)) {
      throw new Error('fulfillment_type must be either "delivery" or "pickup"');
    }

    if (fulfillment_type === 'delivery' && !delivery_address) {
      throw new Error('delivery_address is required for delivery orders');
    }

    if (fulfillment_type === 'pickup' && !pickup_point_id) {
      throw new Error('pickup_point_id is required for pickup orders');
    }

    console.log('✅ Validation passed, creating order...');

    // Find or create customer account
    let customerId: string | null = null;
    
    // Check if customer exists
    const { data: existingCustomer } = await supabaseClient
      .from('customer_accounts')
      .select('id')
      .eq('email', customer_email)
      .single();

    if (existingCustomer) {
      customerId = existingCustomer.id;
      console.log('🔍 Found existing customer:', customerId);
    } else {
      // Create new customer account
      const { data: newCustomer, error: customerError } = await supabaseClient
        .from('customer_accounts')
        .insert({
          name: customer_name,
          email: customer_email,
          phone: customer_phone,
          email_verified: false,
          phone_verified: false
        })
        .select('id')
        .single();

      if (customerError) {
        console.error('❌ Failed to create customer:', customerError);
        throw new Error('Failed to create customer account');
      }

      customerId = newCustomer.id;
      console.log('✅ Created new customer:', customerId);
    }

    // Generate unique order number
    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    // Create order using the existing order creation function
    const { data: orderId, error: orderError } = await supabaseClient
      .rpc('create_order_with_items', {
        p_customer_id: customerId,
        p_fulfillment_type: fulfillment_type,
        p_delivery_address: fulfillment_type === 'delivery' ? delivery_address : null,
        p_pickup_point_id: fulfillment_type === 'pickup' ? pickup_point_id : null,
        p_delivery_zone_id: delivery_zone_id || null,
        p_guest_session_id: guest_session_id || null,
        p_items: order_items
      });

    if (orderError) {
      console.error('❌ Order creation failed:', orderError);
      throw new Error('Failed to create order: ' + orderError.message);
    }

    console.log('✅ Order created successfully:', orderId);

    // Get the created order details
    const { data: orderDetails } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (!orderDetails) {
      throw new Error('Failed to retrieve created order');
    }

    // Initialize payment with Paystack
    console.log('💳 Initializing payment...');
    
    const paymentReference = payment_reference || `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    const { data: paymentResponse, error: paymentError } = await supabaseClient.functions.invoke('paystack-secure', {
      body: {
        action: 'initialize',
        email: customer_email,
        amount: Math.round(total_amount * 100), // Convert to kobo
        reference: paymentReference,
        metadata: {
          order_id: orderId,
          customer_name: customer_name,
          order_number: orderDetails.order_number,
          fulfillment_type: fulfillment_type
        }
      }
    });

    if (paymentError) {
      console.error('❌ Payment initialization failed:', paymentError);
      throw new Error('Failed to initialize payment: ' + paymentError.message);
    }

    if (!paymentResponse || !paymentResponse.status) {
      console.error('❌ Payment response invalid:', paymentResponse);
      throw new Error('Payment initialization failed: ' + (paymentResponse?.error || 'Invalid response'));
    }

    console.log('✅ Payment initialized successfully');
    console.log('📦 Payment response data:', JSON.stringify(paymentResponse, null, 2));

    // Validate payment response structure
    if (!paymentResponse.data || !paymentResponse.data.authorization_url) {
      console.error('❌ Payment response missing required fields:', paymentResponse);
      throw new Error('Payment response missing authorization URL');
    }

    // Create payment transaction record
    const { error: transactionError } = await supabaseClient
      .from('payment_transactions')
      .insert({
        order_id: orderId,
        provider: 'paystack',
        provider_reference: paymentReference,
        amount: total_amount,
        currency: 'NGN',
        status: 'pending',
        metadata: {
          customer_id: customerId,
          user_id: customerId,
          order_number: orderDetails.order_number
        }
      });

    if (transactionError) {
      console.error('⚠️ Failed to create payment transaction record:', transactionError);
      // Don't throw error here as the order and payment initialization succeeded
    }

    // Return success response
    const response = {
      success: true,
      order_id: orderId,
      order_number: orderDetails.order_number,
      total_amount: total_amount,
      payment: {
        payment_url: paymentResponse.data.authorization_url,
        reference: paymentReference,
        access_code: paymentResponse.data.access_code
      },
      message: 'Order created and payment initialized successfully'
    };

    console.log('🎉 Checkout process completed successfully:', response);

    return new Response(
      JSON.stringify(response),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('💥 Checkout process error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Checkout process failed',
        message: error.message || 'An error occurred during checkout'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});