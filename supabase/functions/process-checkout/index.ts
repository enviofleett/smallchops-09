import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Production-ready CORS configuration
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.supabase.co',
    'https://oknnklksdiqaifhxaccs.lovable.app',
    'http://localhost:3000',
    'http://localhost:5173'
  ];

  const customDomain = Deno.env.get('CUSTOM_DOMAIN');
  if (customDomain) {
    allowedOrigins.push(`https://${customDomain}`);
  }

  const isDev = Deno.env.get('DENO_ENV') === 'development';
  const isAllowed = origin && allowedOrigins.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (isDev ? '*' : allowedOrigins[0]),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS, PATCH',
    'Access-Control-Max-Age': '86400',
    'Access-Control-Allow-Credentials': 'true',
    'Vary': 'Origin'
  };
}

serve(async (req) => {
  // Get origin for CORS
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
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
    console.log('📥 Received checkout request:', JSON.stringify(requestBody, null, 2));

    // Get user context for debugging
    const authHeader = req.headers.get('authorization');
    const hasAuthHeader = !!authHeader;
    
    let authenticatedUser = null;
    if (hasAuthHeader) {
      try {
        const { data: { user } } = await supabaseClient.auth.getUser(authHeader.replace('Bearer ', ''));
        authenticatedUser = user;
      } catch (authError) {
        console.log('🔓 No authenticated user found (this is normal for guest checkout)');
      }
    }

    console.log('👤 User context analysis:', {
      hasUser: !!authenticatedUser,
      userId: authenticatedUser?.id,
      isGuest: !!requestBody.guest_session_id,
      guestSessionId: requestBody.guest_session_id
    });
    
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

    // Process guest session ID for database compatibility
    let processedGuestSessionId = null;
    if (guest_session_id) {
      console.log('🔍 Processing guest session ID:', guest_session_id);
      
      // Extract UUID from guest session ID if it has the "guest_" prefix
      if (typeof guest_session_id === 'string' && guest_session_id.startsWith('guest_')) {
        const extractedUuid = guest_session_id.replace('guest_', '');
        
        // Validate that the extracted part is a valid UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(extractedUuid)) {
          processedGuestSessionId = extractedUuid;
          console.log('✅ Successfully extracted UUID from guest session:', processedGuestSessionId);
        } else {
          console.error('❌ Invalid UUID format in guest session ID:', extractedUuid);
          // Continue without guest session ID rather than failing
          console.log('⚠️ Continuing checkout without guest session ID');
        }
      } else if (typeof guest_session_id === 'string') {
        // Check if it's already a valid UUID
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (uuidRegex.test(guest_session_id)) {
          processedGuestSessionId = guest_session_id;
          console.log('✅ Guest session ID is already a valid UUID:', processedGuestSessionId);
        } else {
          console.error('❌ Guest session ID is not a valid UUID format:', guest_session_id);
          console.log('⚠️ Continuing checkout without guest session ID');
        }
      } else {
        console.error('❌ Guest session ID is not a string:', typeof guest_session_id, guest_session_id);
        console.log('⚠️ Continuing checkout without guest session ID');
      }
    }

    // Find or create customer account
    let customerId: string | null = null;
    
    // Determine checkout type based on user authentication and guest session
    if (authenticatedUser) {
      console.log('🔍 Processing authenticated user checkout...');
      
      // Check if customer account exists for authenticated user
      const { data: existingCustomer } = await supabaseClient
        .from('customer_accounts')
        .select('id')
        .eq('email', customer_email)
        .single();

      if (existingCustomer) {
        customerId = existingCustomer.id;
        console.log('✅ Found existing customer account:', customerId);
      } else {
        // Create customer account for authenticated user
        const { data: newCustomer, error: customerError } = await supabaseClient
          .from('customer_accounts')
          .insert({
            name: customer_name,
            email: customer_email,
            phone: customer_phone,
            user_id: authenticatedUser.id,
            email_verified: true, // Assume verified if authenticated
            phone_verified: false
          })
          .select('id')
          .single();

        if (customerError) {
          console.error('❌ Failed to create customer account for authenticated user:', customerError);
          throw new Error('Failed to create customer account');
        }

        customerId = newCustomer.id;
        console.log('✅ Created customer account for authenticated user:', customerId);
      }
    } else {
      console.log('👤 Processing guest checkout, skipping customer account creation');
      // For guest checkout, we'll create customer account in the database function
      // Set customerId to null to indicate guest checkout
      customerId = null;
    }

    // Generate unique order number
    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    // For guest checkout, we need to create a customer account first since the database function requires one
    if (!customerId && guest_session_id) {
      console.log('🆕 Creating customer account for guest checkout...');
      
      const { data: guestCustomer, error: guestCustomerError } = await supabaseClient
        .from('customer_accounts')
        .insert({
          name: customer_name,
          email: customer_email,
          phone: customer_phone,
          user_id: null, // Guest users don't have auth user IDs
          email_verified: false,
          phone_verified: false
        })
        .select('id')
        .single();

      if (guestCustomerError) {
        console.error('❌ Failed to create customer account for guest:', guestCustomerError);
        throw new Error('Failed to create customer account for guest checkout');
      }

      customerId = guestCustomer.id;
      console.log('✅ Created customer account for guest:', customerId);
    }

    // Log the final data being sent to the database function
    console.log('📦 Creating order with data:', {
      customer_id: customerId,
      customer_email: customer_email,
      order_number: orderNumber,
      total_amount: total_amount,
      isGuest: !!guest_session_id,
      processedGuestSessionId: processedGuestSessionId
    });
    
    // Create order using the existing order creation function with processed items
    const { data: orderId, error: orderError } = await supabaseClient
      .rpc('create_order_with_items', {
        p_customer_id: customerId,
        p_fulfillment_type: fulfillment_type,
        p_delivery_address: fulfillment_type === 'delivery' ? delivery_address : null,
        p_pickup_point_id: fulfillment_type === 'pickup' ? pickup_point_id : null,
        p_delivery_zone_id: delivery_zone_id || null,
        p_guest_session_id: processedGuestSessionId, // Use the processed UUID
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

        // Extract authorization URL with robust parsing and fallbacks
        let authorizationUrl: string | null = null;
        let accessCode: string | null = null;

        // Some environments may return stringified JSON; normalize first
        let resp: any = response;
        if (typeof resp === 'string') {
          try { resp = JSON.parse(resp); } catch (_) {}
        }
        if (resp?.data && typeof resp.data === 'string') {
          try { resp.data = JSON.parse(resp.data); } catch (_) {}
        }

        // Prefer nested data, but support flat shape too
        const inner = resp?.data ?? resp;
        authorizationUrl = inner?.authorization_url ?? inner?.data?.authorization_url ?? null;
        accessCode = inner?.access_code ?? inner?.data?.access_code ?? null;

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