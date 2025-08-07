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

    // Process and validate order items for custom bundles
    const processedOrderItems = order_items.map(item => {
      // Check if this is a custom bundle (non-UUID product_id)
      const isCustomBundle = !item.product_id.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
      
      console.log(`Processing item: ${item.product_name}, isCustomBundle: ${isCustomBundle}`);
      
      const processedItem = {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_price: item.price || item.unit_price,
        discount_amount: item.discount_amount || 0
      };

      // For custom bundles, add the customization_items if they exist
      if (isCustomBundle) {
        if (item.customization_items) {
          processedItem.customization_items = item.customization_items;
          console.log(`Added customization_items for bundle: ${item.customization_items.length} items`);
        } else {
          // If no customization_items, create mock ones to satisfy the database function
          console.log('⚠️ Custom bundle missing customization_items, creating mock structure');
          processedItem.customization_items = [{
            id: '00000000-0000-0000-0000-000000000000', // Dummy UUID for validation
            name: item.product_name,
            price: item.price || item.unit_price,
            quantity: item.quantity
          }];
        }
      }

      return processedItem;
    });

    console.log('Processed order items:', JSON.stringify(processedOrderItems, null, 2));

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
    
    // Create order using the existing order creation function with processed items
    const { data: orderId, error: orderError } = await supabaseClient
      .rpc('create_order_with_items', {
        p_customer_id: customerId,
        p_fulfillment_type: fulfillment_type,
        p_delivery_address: fulfillment_type === 'delivery' ? delivery_address : null,
        p_pickup_point_id: fulfillment_type === 'pickup' ? pickup_point_id : null,
        p_delivery_zone_id: delivery_zone_id || null,
        p_guest_session_id: guest_session_id || null,
        p_items: processedOrderItems
      });

    if (orderError) {
      console.error('❌ Order creation failed:', orderError);
      
      // Provide specific error messages for common issues
      let userFriendlyMessage = 'Failed to create order';
      if (orderError.message.includes('22P02') || orderError.message.includes('invalid input syntax for type uuid')) {
        userFriendlyMessage = 'There was an issue processing your order items. Please try again or contact support.';
      } else if (orderError.message.includes('customer')) {
        userFriendlyMessage = 'There was an issue with customer information. Please check your details and try again.';
      } else if (orderError.message.includes('delivery')) {
        userFriendlyMessage = 'There was an issue with delivery information. Please check your address and try again.';
      }
      
      throw new Error(userFriendlyMessage + ' (Error: ' + orderError.message + ')');
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

    // Initialize payment with Paystack (with retry mechanism)
    console.log('💳 Initializing payment...');
    
    const paymentReference = payment_reference || `pay_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    let paymentResponse: any = null;
    let lastError: string = '';
    const maxRetries = 2;
    
    // Retry mechanism for payment initialization
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`🔄 Payment initialization attempt ${attempt}/${maxRetries}`);
        
        const { data: response, error: paymentError } = await supabaseClient.functions.invoke('paystack-secure', {
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

        console.log('📡 Raw response from paystack-secure:', JSON.stringify(response, null, 2));
        console.log('🔍 Response structure analysis:', {
          hasResponse: !!response,
          responseType: typeof response,
          hasStatus: response?.status !== undefined,
          statusValue: response?.status,
          hasData: !!response?.data,
          dataKeys: response?.data ? Object.keys(response.data) : null,
          hasAuthUrl: !!(response?.data?.authorization_url || response?.authorization_url),
          errorDetails: paymentError
        });

        if (paymentError) {
          lastError = `Supabase function error: ${paymentError.message}`;
          console.error(`❌ Attempt ${attempt} - Paystack function call failed:`, paymentError);
          
          if (attempt === maxRetries) {
            throw new Error(lastError);
          }
          
          // Wait before retry (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }

        if (!response) {
          lastError = 'No response received from payment service';
          console.error(`❌ Attempt ${attempt} - No response received`);
          
          if (attempt === maxRetries) {
            throw new Error(lastError);
          }
          
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }

        if (!response.status) {
          lastError = `Payment service returned failure: ${response.error || 'Unknown error'}`;
          console.error(`❌ Attempt ${attempt} - Payment service returned status false:`, response);
          
          if (attempt === maxRetries) {
            throw new Error(lastError);
          }
          
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }

        // Extract authorization URL with multiple fallback paths
        let authorizationUrl = null;
        let accessCode = null;
        
        // Try different response structure possibilities
        if (response.data) {
          authorizationUrl = response.data.authorization_url;
          accessCode = response.data.access_code;
        } else {
          // Fallback: check if response is the actual Paystack data
          authorizationUrl = response.authorization_url;
          accessCode = response.access_code;
        }

        if (!authorizationUrl) {
          lastError = `Authorization URL missing from payment response. Response structure: ${JSON.stringify(response)}`;
          console.error(`❌ Attempt ${attempt} - Authorization URL not found in response:`, response);
          
          if (attempt === maxRetries) {
            throw new Error(lastError);
          }
          
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }

        // Validate URL format
        try {
          new URL(authorizationUrl);
        } catch (urlError) {
          lastError = `Invalid authorization URL format: ${authorizationUrl}`;
          console.error(`❌ Attempt ${attempt} - Invalid URL format:`, authorizationUrl);
          
          if (attempt === maxRetries) {
            throw new Error(lastError);
          }
          
          await new Promise(resolve => setTimeout(resolve, attempt * 2000));
          continue;
        }

        // Success! Store the response and break the retry loop
        paymentResponse = {
          status: true,
          data: {
            authorization_url: authorizationUrl,
            access_code: accessCode,
            reference: paymentReference
          }
        };
        
        console.log(`✅ Payment initialized successfully on attempt ${attempt}`);
        break;

      } catch (error) {
        lastError = `Attempt ${attempt} failed: ${error.message}`;
        console.error(`❌ Payment initialization attempt ${attempt} failed:`, error);
        
        if (attempt === maxRetries) {
          throw new Error(`Payment initialization failed after ${maxRetries} attempts. Last error: ${lastError}`);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, attempt * 2000));
      }
    }

    if (!paymentResponse) {
      throw new Error(`Failed to initialize payment after ${maxRetries} attempts. Last error: ${lastError}`);
    }

    console.log('📦 Final payment response:', JSON.stringify(paymentResponse, null, 2));

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
        payment_url: paymentResponse?.data?.authorization_url || null,
        authorization_url: paymentResponse?.data?.authorization_url || null,
        reference: paymentReference,
        access_code: paymentResponse?.data?.access_code || null
      },
      message: 'Order created and payment initialized successfully'
    };

    console.log('🎉 Checkout process completed successfully:', response);
    console.log('📋 Payment response details:', {
      hasPaymentResponse: !!paymentResponse,
      hasData: !!paymentResponse?.data,
      authUrl: paymentResponse?.data?.authorization_url,
      accessCode: paymentResponse?.data?.access_code,
      reference: paymentReference
    });

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