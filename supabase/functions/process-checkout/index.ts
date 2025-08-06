import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface CheckoutRequest {
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  order_items: Array<{
    product_id: string;
    quantity: number;
    price?: number;
    unit_price?: number;
    total_price?: number;
    discount_amount?: number;
  }>;
  total_amount?: number;
  delivery_fee?: number;
  delivery_zone_id?: string;
  fulfillment_type: 'delivery' | 'pickup';
  delivery_address?: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    country: string;
    phone?: string;
    delivery_instructions?: string;
  };
  pickup_point_id?: string;
  guest_session_id?: string;
  payment_method: 'bank_transfer' | 'cash_on_delivery' | 'paystack';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const checkoutData: CheckoutRequest = await req.json();
    console.log('Processing checkout request:', JSON.stringify(checkoutData, null, 2));

    // Validate required fields
    if (!checkoutData.customer_email || !checkoutData.customer_name || !checkoutData.order_items || checkoutData.order_items.length === 0) {
      console.error('Missing required fields:', { 
        hasEmail: !!checkoutData.customer_email, 
        hasName: !!checkoutData.customer_name,
        hasItems: !!(checkoutData.order_items && checkoutData.order_items.length > 0)
      });
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: corsHeaders }
      );
    }

    // Validate order items structure
    for (const item of checkoutData.order_items) {
      if (!item.product_id || !item.quantity || item.quantity <= 0) {
        console.error('Invalid item structure:', item);
        return new Response(
          JSON.stringify({ error: 'Each item must have product_id and positive quantity' }),
          { status: 400, headers: corsHeaders }
        );
      }
    }

    // Transform order items to match database function expectations
    const transformedItems = checkoutData.order_items.map(item => ({
      product_id: item.product_id,
      quantity: item.quantity,
      unit_price: item.unit_price || item.price || 0,
      discount_amount: item.discount_amount || 0
    }));

    // Convert items to JSONB for database function
    const itemsJsonb = JSON.stringify(transformedItems);
    
    console.log('Transformed items:', transformedItems);
    console.log('Items as JSONB:', itemsJsonb);
    
    console.log('Calling create_order_with_items with:', {
      p_customer_email: checkoutData.customer_email,
      p_customer_name: checkoutData.customer_name,
      p_items: itemsJsonb,
      p_customer_phone: checkoutData.customer_phone || '',
      p_fulfillment_type: checkoutData.fulfillment_type,
      p_delivery_address: checkoutData.delivery_address || null,
      p_guest_session_id: checkoutData.guest_session_id || '',
      p_payment_method: checkoutData.payment_method,
      p_delivery_zone_id: checkoutData.delivery_zone_id || null,
      p_delivery_fee: checkoutData.delivery_fee || 0,
      p_total_amount: checkoutData.total_amount || 0
    });

    // Create order using the enhanced RPC function with all parameters
    const { data: orderResult, error: orderError } = await supabaseClient
      .rpc('create_order_with_items', {
        p_customer_email: checkoutData.customer_email,
        p_customer_name: checkoutData.customer_name,
        p_items: itemsJsonb,
        p_customer_phone: checkoutData.customer_phone || '',
        p_fulfillment_type: checkoutData.fulfillment_type,
        p_delivery_address: checkoutData.delivery_address || null,
        p_guest_session_id: checkoutData.guest_session_id || '',
        p_payment_method: checkoutData.payment_method,
        p_delivery_zone_id: checkoutData.delivery_zone_id || null,
        p_delivery_fee: checkoutData.delivery_fee || 0,
        p_total_amount: checkoutData.total_amount || 0
      });

    if (orderError) {
      console.error('Error creating order:', orderError);
      return new Response(
        JSON.stringify({ 
          error: 'Failed to create order', 
          details: orderError.message,
          hint: orderError.hint 
        }),
        { status: 500, headers: corsHeaders }
      );
    }

    console.log('Order creation result:', orderResult);

    // Extract order ID from the returned JSON
    const orderId = orderResult?.order_id;
    const subtotal = orderResult?.subtotal || 0;

    if (!orderId) {
      console.error('No order ID returned from function');
      return new Response(
        JSON.stringify({ error: 'Failed to get order ID' }),
        { status: 500, headers: corsHeaders }
      );
    }

    // Handle payment processing
    if (checkoutData.payment_method === 'paystack') {
      console.log('Processing Paystack payment for amount:', subtotal);
      
      // Generate unique reference for payment transaction
      const paymentReference = `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      
      // Insert payment transaction record
      const { data: paymentTransaction, error: paymentError } = await supabaseClient
        .from('payment_transactions')
        .insert({
          order_id: orderResult.order_id,
          customer_email: checkoutData.customer_email,
          customer_name: checkoutData.customer_name,
          amount: checkoutData.total_amount || orderResult.subtotal, // Use total amount including delivery fee
          currency: 'NGN',
          payment_method: 'paystack',
          status: 'pending',
          provider_reference: paymentReference,
          transaction_type: 'charge'
        })
        .select()
        .single();

      if (paymentError) {
        console.error('Error creating payment transaction:', paymentError);
        return new Response(
          JSON.stringify({ error: 'Failed to create payment transaction' }),
          { status: 500, headers: corsHeaders }
        );
      }

      console.log('💾 Payment transaction created:', paymentTransaction.id);

      // Use paystack-secure function to initialize payment
      console.log('🚀 Initializing Paystack payment...');
      
      // Ensure we have a valid total amount
      const paymentAmount = checkoutData.total_amount || orderResult.subtotal || subtotal;
      if (!paymentAmount || paymentAmount <= 0) {
        console.error('❌ Invalid payment amount:', paymentAmount);
        return new Response(
          JSON.stringify({ error: 'Invalid payment amount' }),
          { status: 400, headers: corsHeaders }
        );
      }

      console.log('💰 Payment amount (NGN):', paymentAmount, '→ Kobo:', paymentAmount * 100);

      const { data: paystackData, error: paystackError } = await supabaseClient.functions.invoke('paystack-secure', {
        body: {
          action: 'initialize',
          email: checkoutData.customer_email,
          amount: Math.round(paymentAmount * 100), // Convert to kobo and ensure integer
          reference: paymentReference,
          channels: ['card', 'bank', 'ussd', 'mobile_money'],
          metadata: {
            order_id: orderResult.order_id,
            order_number: orderResult.order_number,
            customer_name: checkoutData.customer_name,
            customer_email: checkoutData.customer_email,
            total_amount: paymentAmount,
            custom_fields: [
              {
                display_name: "Order ID",
                variable_name: "order_id", 
                value: orderResult.order_id
              },
              {
                display_name: "Order Number",
                variable_name: "order_number",
                value: orderResult.order_number
              }
            ]
          }
        }
      });

      if (paystackError || !paystackData?.status) {
        console.error('❌ Paystack initialization failed:');
        console.error('- Error:', JSON.stringify(paystackError, null, 2));
        console.error('- Data:', JSON.stringify(paystackData, null, 2));
        
        return new Response(
          JSON.stringify({ 
            success: false,
            error: 'Payment initialization failed',
            details: paystackError?.message || paystackData?.error || 'Unknown payment gateway error',
            debug: {
              paystackError: paystackError,
              paystackData: paystackData,
              amount: paymentAmount,
              amountInKobo: Math.round(paymentAmount * 100)
            }
          }),
          { status: 500, headers: corsHeaders }
        );
      }

      console.log('✅ Paystack initialization successful');

      return new Response(
        JSON.stringify({
          success: true,
          order_id: orderResult.order_id,
          order_number: orderResult.order_number,
          payment: {
            payment_url: paystackData.data.authorization_url,
            reference: paymentReference,
            message: 'Redirecting to payment gateway...'
          }
        }),
        { status: 200, headers: corsHeaders }
      );
    } else {
      // For other payment methods, trigger order confirmation email
      await supabaseClient.functions.invoke('enhanced-email-processor', {
        body: {
          event_type: 'order_confirmation',
          recipient_email: checkoutData.customer_email,
          order_id: orderId,
          priority: 'high'
        }
      });
    }

    // Log checkout completion
    await supabaseClient
      .from('audit_logs')
      .insert({
        action: 'checkout_completed',
        category: 'Order Management',
        message: `Checkout completed for order ${orderId}`,
        new_values: {
          order_id: orderId,
          customer_email: checkoutData.customer_email,
          payment_method: checkoutData.payment_method,
          subtotal: subtotal
        }
      });

    // Trigger enhanced email processor
    await supabaseClient.functions.invoke('enhanced-email-processor', {
      body: {
        event_type: 'order_created',
        recipient_email: checkoutData.customer_email,
        order_id: orderId
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        subtotal: subtotal,
        message: 'Order created successfully'
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error('Checkout processing error:', error);
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});