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
  fulfillment_type: 'delivery' | 'pickup';
  delivery_address?: {
    address_line_1: string;
    address_line_2?: string;
    city: string;
    state: string;
    postal_code: string;
    landmark?: string;
  };
  pickup_point_id?: string;
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
  guest_session_id?: string;
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
      fulfillment_type,
      delivery_address, 
      pickup_point_id,
      order_items, 
      total_amount, 
      delivery_fee = 0, 
      delivery_zone_id,
      payment_method,
      guest_session_id
    }: CheckoutRequest = await req.json();

    console.log('Processing checkout for:', customer_email, 'fulfillment type:', fulfillment_type);
    console.log('Order items:', order_items.map(item => ({ 
      product_id: item.product_id, 
      quantity: item.quantity 
    })));

    // 1. Validate products exist before proceeding
    console.log('Validating products exist...');
    for (const item of order_items) {
      const { data: product, error: productError } = await supabaseAdmin
        .from('products')
        .select('id, name, price, status')
        .eq('id', item.product_id)
        .single();

      if (productError || !product) {
        console.error('Product validation failed:', item.product_id, productError);
        throw new Error(`Product not found: ${item.product_id}`);
      }

      if (product.status !== 'active') {
        console.error('Product not active:', product);
        throw new Error(`Product ${product.name} is not available`);
      }

      console.log('Product validated:', product.name, 'Price:', product.price);
    }

    // 2. Skip validation for now and proceed to order creation
    console.log('Products validated, proceeding to order creation...');

    // Initialize order variables at function scope
    let orderId = null;
    let orderNumber = null;

    // 3. Create order with enhanced error handling
    try {
      console.log('Preparing order data for database function...');
      
      // Ensure delivery address is properly formatted as JSONB
      let deliveryAddressJsonb = null;
      if (fulfillment_type === 'delivery' && delivery_address) {
        try {
          deliveryAddressJsonb = delivery_address;
          console.log('Delivery address prepared:', deliveryAddressJsonb);
        } catch (err) {
          console.error('Failed to prepare delivery address:', err);
          throw new Error('Invalid delivery address format');
        }
      }

      // Ensure order items are in correct format for database function
      const formattedOrderItems = order_items.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity,
        unit_price: item.unit_price,
        total_price: item.total_price
      }));

      console.log('Formatted order items:', formattedOrderItems);

      const orderParams = {
        p_customer_email: customer_email || '',
        p_customer_name: customer_name || '',
        p_customer_phone: customer_phone || '',
        p_order_items: formattedOrderItems,
        p_total_amount: Number(total_amount),
        p_fulfillment_type: fulfillment_type,
        p_delivery_address: deliveryAddressJsonb,
        p_pickup_point_id: fulfillment_type === 'pickup' ? pickup_point_id : null,
        p_delivery_fee: fulfillment_type === 'delivery' ? Number(delivery_fee || 0) : 0,
        p_delivery_zone_id: fulfillment_type === 'delivery' ? delivery_zone_id : null
      };

      console.log('Final order parameters:', {
        ...orderParams,
        p_order_items: `[${orderParams.p_order_items.length} items]`
      });

      // Add guest session ID if provided (ensure it's valid UUID format or null)
      if (guest_session_id && guest_session_id.trim()) {
        // Validate UUID format or generate a temporary ID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(guest_session_id)) {
          orderParams.p_guest_session_id = guest_session_id;
        } else {
          // Generate a temporary guest session ID
          orderParams.p_guest_session_id = crypto.randomUUID();
          console.log('Generated temporary guest session ID:', orderParams.p_guest_session_id);
        }
      }

      console.log('Calling create_order_with_items with parameters...');
      const { data: orderResult, error: orderError } = await supabaseAdmin
        .rpc('create_order_with_items', orderParams);

      if (orderError) {
        console.error('Order creation error details:', {
          code: orderError.code,
          message: orderError.message,
          details: orderError.details,
          hint: orderError.hint
        });
        console.error('Order parameters that failed:', orderParams);
        throw new Error(`Database function error: ${orderError.message} (Code: ${orderError.code})`);
      }

      if (!orderResult || !orderResult.success) {
        console.error('Order function returned failure:', orderResult);
        return new Response(
          JSON.stringify({
            success: false,
            error: orderResult?.error || 'unknown_error',
            message: orderResult?.message || 'Order creation failed'
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      // Assign order variables within the try block
      orderId = orderResult.order_id;
      orderNumber = orderResult.order_number;

      console.log('Order created successfully:', orderId, 'Number:', orderNumber);

    } catch (dbError) {
      console.error('Database operation failed:', {
        error: dbError,
        message: dbError.message,
        stack: dbError.stack
      });
      throw new Error(`Order creation failed: ${dbError.message}`);
    }

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
          transaction_type: 'purchase',
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
    }

    // 4. Send order confirmation email using template service
    if (payment_method !== 'paystack') {
      // For non-Paystack payments, send email immediately using templates
      try {
        await supabaseAdmin.functions.invoke('production-smtp-sender', {
          body: {
            to: customer_email,
            template_key: 'order_confirmation',
            variables: {
              customer_name: customer_name,
              customer_email: customer_email,
              order_number: orderNumber,
              order_total: `₦${total_amount.toLocaleString()}`,
              order_date: new Date().toLocaleDateString(),
              store_name: 'Your Store',
              store_url: 'https://your-store.com',
              support_email: 'support@your-store.com',
              delivery_address: fulfillment_type === 'delivery' ? JSON.stringify(delivery_address) : '',
              order_items: order_items.map(item => `${item.quantity}x ${item.product_id}`).join(', ')
            },
            priority: 'high'
          }
        });
        console.log('Order confirmation email sent via template to:', customer_email);
      } catch (emailError) {
        console.error('Failed to send order confirmation email:', emailError);
        // Don't fail the checkout for email issues
      }
    }

    // 5. Log successful checkout
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
          payment_method: payment_method,
          fulfillment_type: fulfillment_type,
          pickup_point_id: pickup_point_id
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