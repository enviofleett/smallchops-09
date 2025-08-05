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
      // Comprehensive data validation and conversion
      const numericAmount = Number(total_amount);
      const validOrderId = orderId?.toString?.() || orderId;
      const cleanEmail = customer_email?.toLowerCase?.()?.trim?.() || customer_email;
      
      console.log('=== COMPREHENSIVE PAYMENT TRANSACTION DEBUG ===');
      console.log('Raw total_amount:', total_amount, 'Type:', typeof total_amount);
      console.log('Converted numericAmount:', numericAmount, 'Type:', typeof numericAmount);
      console.log('Is amount valid number?', !isNaN(numericAmount) && numericAmount > 0);
      console.log('Order ID:', validOrderId, 'Type:', typeof validOrderId);
      console.log('Order ID length:', validOrderId?.length);
      console.log('Customer Email:', cleanEmail, 'Type:', typeof cleanEmail);
      console.log('Email format valid?', /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail));
      console.log('=== FINAL INSERT DATA ===');
      
      const insertData = {
        order_id: validOrderId,
        customer_email: cleanEmail,
        amount: numericAmount,
        currency: 'NGN',
        payment_method: 'paystack',
        transaction_type: 'charge',
        status: 'pending'
      };
      
      console.log('Insert data object:', JSON.stringify(insertData, null, 2));
      Object.entries(insertData).forEach(([key, value]) => {
        console.log(`${key}: ${value} (type: ${typeof value}, length: ${value?.length || 'N/A'})`);
      });
      console.log('=== END COMPREHENSIVE DEBUG ===');

      // Validate data before insert
      if (!validOrderId || typeof validOrderId !== 'string') {
        throw new Error(`Invalid order_id: ${validOrderId} (type: ${typeof validOrderId})`);
      }
      if (!cleanEmail || typeof cleanEmail !== 'string' || !cleanEmail.includes('@')) {
        throw new Error(`Invalid customer_email: ${cleanEmail} (type: ${typeof cleanEmail})`);
      }
      if (isNaN(numericAmount) || numericAmount <= 0) {
        throw new Error(`Invalid amount: ${numericAmount} (type: ${typeof numericAmount})`);
      }

      // STEP 1: Try minimal insert first to isolate the issue
      console.log('=== STEP 1: Testing minimal insert ===');
      const { data: minimalTest, error: minimalError } = await supabaseAdmin
        .rpc('minimal_payment_test_insert', {
          p_order_id: validOrderId,
          p_amount: numericAmount
        });
      
      console.log('Minimal test result:', minimalTest);
      if (minimalError) {
        console.error('Minimal insert failed:', minimalError);
      }

      // STEP 2: Try debug function with full validation
      console.log('=== STEP 2: Testing with debug function ===');
      const { data: debugResult, error: debugError } = await supabaseAdmin
        .rpc('debug_payment_transaction_insert', {
          p_order_id: validOrderId,
          p_customer_email: cleanEmail,
          p_amount: numericAmount,
          p_currency: 'NGN',
          p_payment_method: 'paystack',
          p_transaction_type: 'charge',
          p_status: 'pending'
        });

      console.log('Debug function result:', debugResult);
      if (debugError) {
        console.error('Debug function error:', debugError);
      }

      // STEP 3: If debug function succeeded, we know the data is valid
      let paymentData = null;
      let paymentError = null;

      if (debugResult?.success) {
        console.log('Debug function succeeded, attempting regular insert...');
        const insertResult = await supabaseAdmin
          .from('payment_transactions')
          .insert(insertData)
          .select()
          .single();
        
        paymentData = insertResult.data;
        paymentError = insertResult.error;
      } else {
        // If debug function failed, use its detailed error message
        const errorDetails = debugResult || { error: 'unknown', message: 'Debug function failed' };
        console.error('=== DETAILED CONSTRAINT VIOLATION ANALYSIS ===');
        console.error('Error type:', errorDetails.error);
        console.error('Field causing issue:', errorDetails.field || 'unknown');
        console.error('Error message:', errorDetails.message);
        console.error('SQL state:', errorDetails.sqlstate);
        console.error('SQL error:', errorDetails.sqlerrm);
        console.error('=== END ANALYSIS ===');
        
        throw new Error(`Payment validation failed: ${errorDetails.message} (Field: ${errorDetails.field || 'unknown'})`);
      }

      if (paymentError) {
        console.error('Payment transaction creation error:', paymentError);
        throw new Error(`Payment setup error: ${paymentError.message}`);
      }

      // Initialize Paystack payment directly
      console.log('=== PAYSTACK INITIALIZATION ===');
      
      // Get Paystack configuration
      const { data: paystackConfig, error: configError } = await supabaseAdmin
        .from('payment_integrations')
        .select('secret_key, public_key')
        .eq('provider', 'paystack')
        .eq('is_active', true)
        .single();

      if (configError || !paystackConfig || !paystackConfig.secret_key) {
        console.error('Paystack config error:', configError);
        throw new Error('Paystack not configured properly');
      }

      console.log('Paystack config found, initializing payment...');
      console.log('Amount for Paystack (in kobo):', total_amount * 100);
      console.log('Customer email:', customer_email);

      // Generate unique reference
      const paymentReference = `checkout_${orderId}_${Date.now()}`;
      
      // Initialize payment with Paystack API directly
      const paystackApiResponse = await fetch('https://api.paystack.co/transaction/initialize', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${paystackConfig.secret_key}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: customer_email,
          amount: Math.round(total_amount * 100), // Convert to kobo and ensure integer
          currency: 'NGN',
          reference: paymentReference,
          callback_url: `${req.headers.get('origin')}/payment-callback`,
          metadata: {
            order_id: orderId,
            order_number: orderNumber,
            customer_name: customer_name,
            payment_transaction_id: paymentData.id
          },
          channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
        })
      });

      console.log('Paystack API response status:', paystackApiResponse.status);
      
      if (!paystackApiResponse.ok) {
        const errorText = await paystackApiResponse.text();
        console.error('Paystack API error response:', errorText);
        throw new Error(`Paystack API error (${paystackApiResponse.status}): ${errorText}`);
      }

      const paystackData = await paystackApiResponse.json();
      console.log('Paystack response data:', paystackData);

      if (!paystackData.status) {
        console.error('Paystack initialization failed:', paystackData);
        throw new Error(paystackData.message || 'Failed to initialize payment with Paystack');
      }

      paymentResult = {
        payment_url: paystackData.data.authorization_url,
        payment_reference: paystackData.data.reference,
        payment_method: 'paystack'
      };

      // Update payment transaction with Paystack reference
      await supabaseAdmin
        .from('payment_transactions')
        .update({ 
          provider_reference: paystackData.data.reference,
          provider_response: paystackData,
          status: 'initialized'
        })
        .eq('id', paymentData.id);
        
      console.log('=== PAYSTACK INITIALIZATION COMPLETE ===');
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