import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CheckoutRequest {
  customer_email: string;
  customer_name: string;
  customer_phone: string;
  delivery_address: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    landmark?: string;
  };
  order_items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
    total_price: number;
  }>;
  total_amount: number;
  delivery_fee?: number;
  delivery_zone_id?: string;
  payment_method: 'paystack' | 'bank_transfer' | 'cash_on_delivery';
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create Supabase client with service role for database operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { 
      customer_email, 
      customer_name, 
      customer_phone, 
      delivery_address, 
      order_items, 
      total_amount, 
      delivery_fee = 0, 
      delivery_zone_id,
      payment_method 
    }: CheckoutRequest = await req.json();

    console.log('Processing checkout for:', customer_email);

    // 1. Validate order data
    const { data: validationResult, error: validationError } = await supabaseAdmin
      .rpc('validate_order_data', {
        p_customer_email: customer_email,
        p_order_items: order_items,
        p_total_amount: total_amount
      });

    if (validationError) {
      throw new Error(`Validation error: ${validationError.message}`);
    }

    if (!validationResult.valid) {
      return new Response(
        JSON.stringify({
          success: false,
          errors: validationResult.errors,
          message: 'Order validation failed'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // 2. Create order with items
    const { data: orderResult, error: orderError } = await supabaseAdmin
      .rpc('create_order_with_items', {
        p_customer_email: customer_email,
        p_customer_name: customer_name,
        p_customer_phone: customer_phone,
        p_delivery_address: delivery_address,
        p_order_items: order_items,
        p_total_amount: total_amount,
        p_delivery_fee: delivery_fee,
        p_delivery_zone_id: delivery_zone_id
      });

    if (orderError) {
      throw new Error(`Order creation error: ${orderError.message}`);
    }

    if (!orderResult.success) {
      return new Response(
        JSON.stringify({
          success: false,
          error: orderResult.error,
          message: orderResult.message
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    const orderId = orderResult.order_id;
    const orderNumber = orderResult.order_number;

    console.log('Order created successfully:', orderId);

    // 3. Handle payment processing based on method
    let paymentResult = null;
    
    if (payment_method === 'paystack') {
      // Create payment transaction record
      const { data: paymentData, error: paymentError } = await supabaseAdmin
        .from('payment_transactions')
        .insert({
          order_id: orderId,
          amount: total_amount,
          currency: 'NGN',
          payment_method: 'paystack',
          status: 'pending'
        })
        .select()
        .single();

      if (paymentError) {
        console.error('Payment transaction creation error:', paymentError);
        throw new Error(`Payment setup error: ${paymentError.message}`);
      }

      // Initialize Paystack payment
      const paystackResponse = await supabaseAdmin.functions.invoke('paystack-initialize', {
        body: {
          email: customer_email,
          amount: total_amount * 100, // Convert to kobo
          order_id: orderId,
          callback_url: `${req.headers.get('origin')}/payment-callback`,
          metadata: {
            order_number: orderNumber,
            customer_name: customer_name,
            payment_transaction_id: paymentData.id
          }
        }
      });

      if (paystackResponse.error) {
        throw new Error(`Paystack initialization error: ${paystackResponse.error.message}`);
      }

      paymentResult = {
        payment_url: paystackResponse.data.authorization_url,
        payment_reference: paystackResponse.data.reference,
        payment_method: 'paystack'
      };

      // Update payment transaction with reference
      await supabaseAdmin
        .from('payment_transactions')
        .update({ 
          provider_reference: paystackResponse.data.reference,
          provider_response: paystackResponse.data
        })
        .eq('id', paymentData.id);

    } else if (payment_method === 'bank_transfer') {
      // For bank transfer, provide bank details
      const { data: bankDetails } = await supabaseAdmin
        .from('business_settings')
        .select('bank_details')
        .single();

      paymentResult = {
        payment_method: 'bank_transfer',
        bank_details: bankDetails?.bank_details || {
          bank_name: 'Please contact support for bank details',
          account_number: '',
          account_name: ''
        },
        payment_instructions: `Please transfer ₦${total_amount.toLocaleString()} to the provided bank account and send proof of payment.`
      };

    } else if (payment_method === 'cash_on_delivery') {
      // Update order status for COD
      await supabaseAdmin
        .rpc('update_order_status', {
          p_order_id: orderId,
          p_new_status: 'confirmed'
        });

      paymentResult = {
        payment_method: 'cash_on_delivery',
        message: 'Order confirmed. Please prepare cash for delivery.'
      };
    }

    // 4. Log successful checkout
    await supabaseAdmin
      .from('audit_logs')
      .insert({
        action: 'checkout_completed',
        category: 'Order Management',
        entity_type: 'order',
        entity_id: orderId,
        message: `Checkout completed for order ${orderNumber}`,
        new_values: {
          order_id: orderId,
          order_number: orderNumber,
          customer_email: customer_email,
          total_amount: total_amount,
          payment_method: payment_method
        }
      });

    console.log('Checkout process completed successfully');

    return new Response(
      JSON.stringify({
        success: true,
        order_id: orderId,
        order_number: orderNumber,
        message: 'Checkout completed successfully',
        payment: paymentResult
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Checkout processing error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to process checkout'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});