import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const VERSION = "v2025-08-17-hotfix-complete-payment-data";

// Production-ready CORS configuration - restrict to production domains
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = [
    'https://startersmallchops.com',
    'https://www.startersmallchops.com'
  ];
  
  // Allow Lovable preview domains for development
  if (origin && (origin.includes('lovableproject.com') || origin.includes('lovable.app'))) {
    allowedOrigins.push(origin);
  }

  const isAllowed = origin && allowedOrigins.includes(origin);

  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
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
    console.log('🔄 Process checkout function called (v2025-08-17-production-fix-final)');
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const requestBody = await req.json();
    const sanitized = {
      ...requestBody,
      customer_email: requestBody?.customer_email ? String(requestBody.customer_email).replace(/(^.).+(@.*$)/, '$1***$2') : undefined,
      customer_phone: requestBody?.customer_phone ? String(requestBody.customer_phone).replace(/\d(?=\d{2})/g, '*') : undefined,
      order_items: Array.isArray(requestBody?.order_items) ? `items[x${requestBody.order_items.length}]` : requestBody?.order_items
    };
    console.log('📥 Received checkout request:', JSON.stringify(sanitized, null, 2));

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

    // NEW: Enforce allow_guest_checkout from business settings
    console.log('⚙️ Fetching business settings for guest checkout enforcement...');
    const { data: settingsRow, error: settingsErr } = await supabaseClient
      .from('business_settings')
      .select('allow_guest_checkout')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const allowGuest = settingsRow?.allow_guest_checkout !== false; // default to true if missing
    if (settingsErr) {
      console.warn('⚠️ Could not fetch business settings; defaulting allow_guest_checkout to true', settingsErr);
    } else {
      console.log('✅ Business settings loaded:', { allow_guest_checkout: allowGuest });
    }

    if (!allowGuest && !authenticatedUser) {
      console.log('🚫 Guest checkout is disabled and user is not authenticated. Blocking request.');
      return new Response(JSON.stringify({
        success: false,
        error: 'Guest checkout is currently disabled. Please sign in to continue.',
        requires_auth: true
      }), { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });
    }
    
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
      payment_reference,
      delivery_schedule
    } = requestBody;

    // 🚨 CRITICAL: Block frontend-generated payment references
    if (payment_reference && payment_reference.startsWith('pay_')) {
      console.error('🚨 FRONTEND REFERENCE BLOCKED:', payment_reference);
      return new Response(JSON.stringify({ 
        error: 'Frontend-generated references are not allowed. Backend must generate all references.',
        code: 'INVALID_REFERENCE_FORMAT',
        blocked_reference: payment_reference 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

    // Ensure only txn_ references are accepted
    if (payment_reference && !payment_reference.startsWith('txn_')) {
      console.error('🚨 INVALID REFERENCE FORMAT:', payment_reference);
      return new Response(JSON.stringify({ 
        error: 'Reference must start with txn_',
        code: 'INVALID_REFERENCE_PREFIX',
        received_reference: payment_reference 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      });
    }

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

    // Validate delivery schedule for all fulfillment types
    if (delivery_schedule) {
      console.log('📅 Validating delivery schedule:', delivery_schedule);
      
      if (!delivery_schedule.delivery_date || !delivery_schedule.delivery_time_start || !delivery_schedule.delivery_time_end) {
        throw new Error('Delivery schedule must include delivery_date, delivery_time_start, and delivery_time_end');
      }

      // Validate date format (YYYY-MM-DD)
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(delivery_schedule.delivery_date)) {
        throw new Error('delivery_date must be in YYYY-MM-DD format');
      }

      // Validate time format (HH:mm)
      const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
      if (!timeRegex.test(delivery_schedule.delivery_time_start) || !timeRegex.test(delivery_schedule.delivery_time_end)) {
        throw new Error('delivery_time_start and delivery_time_end must be in HH:mm format');
      }

      // Validate that start time is before end time
      const startTime = delivery_schedule.delivery_time_start;
      const endTime = delivery_schedule.delivery_time_end;
      if (startTime >= endTime) {
        throw new Error('delivery_time_start must be before delivery_time_end');
      }

      // Check that delivery date is not in the past
      const deliveryDate = new Date(delivery_schedule.delivery_date);
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of day for comparison
      
      if (deliveryDate < today) {
        throw new Error('delivery_date cannot be in the past');
      }

      console.log('✅ Delivery schedule validation passed');
    } else if (fulfillment_type === 'delivery') {
      throw new Error('delivery_schedule is required for delivery orders');
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

    // Use guest_session_id directly as TEXT (no UUID parsing)
    let processedGuestSessionId: string | null = null;
    if (typeof guest_session_id === 'string' && guest_session_id.trim().length > 0) {
      processedGuestSessionId = guest_session_id.trim();
      console.log('✅ Using guest session ID as text:', processedGuestSessionId);
    } else {
      console.log('ℹ️ No valid guest_session_id provided; continuing without it');
    }

    // Find or create customer account
    let customerId: string | null = null;
    
    if (authenticatedUser) {
      console.log('🔍 Processing authenticated user checkout...');
      
      // Check if customer account exists for authenticated user (by email)
      const { data: existingCustomer } = await supabaseClient
        .from('customer_accounts')
        .select('id')
        .eq('email', customer_email)
        .maybeSingle();

      if (existingCustomer?.id) {
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
            email_verified: true,
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
      console.log('👤 Processing guest checkout, resolving customer account by email');
      // Resolve existing customer by email or create a new guest customer
      const { data: existingGuestCustomer, error: findGuestErr } = await supabaseClient
        .from('customer_accounts')
        .select('id')
        .eq('email', customer_email)
        .maybeSingle();

      if (findGuestErr) {
        console.warn('⚠️ Error checking existing guest customer (continuing):', findGuestErr);
      }

      if (existingGuestCustomer?.id) {
        customerId = existingGuestCustomer.id;
        console.log('✅ Found existing customer account for guest:', customerId);
      } else {
        console.log('🆕 Creating customer account for guest checkout...');
        const { data: guestCustomer, error: guestCustomerError } = await supabaseClient
          .from('customer_accounts')
          .insert({
            name: customer_name,
            email: customer_email,
            phone: customer_phone,
            user_id: null,
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
    }

    // Generate unique order number
    const orderNumber = `ORD-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${Math.floor(Math.random() * 10000).toString().padStart(4, '0')}`;
    
    // 🔧 BACKEND GENERATES SINGLE SOURCE OF TRUTH REFERENCE
    const authoritativePaymentReference = `txn_${Date.now()}_${crypto.randomUUID()}`;
    
    console.log('🔧 Backend-generated authoritative reference:', authoritativePaymentReference);
    
    // Log the final data being sent to the database function
    console.log('📦 Creating order with data:', {
      customer_id: customerId,
      customer_email: customer_email,
      order_number: orderNumber,
      total_amount: total_amount,
      isGuest: !authenticatedUser,
      processedGuestSessionId: processedGuestSessionId,
      paymentReference: authoritativePaymentReference
    });
    
    // Create order using the existing order creation function with processed items
    const { data: orderId, error: orderError } = await supabaseClient
      .rpc('create_order_with_items', {
        p_customer_id: customerId,
        p_fulfillment_type: fulfillment_type,
        p_delivery_address: fulfillment_type === 'delivery' ? delivery_address : null,
        p_pickup_point_id: fulfillment_type === 'pickup' ? pickup_point_id : null,
        p_delivery_zone_id: delivery_zone_id || null,
        p_guest_session_id: processedGuestSessionId, // Pass TEXT session ID now
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

    // Insert delivery schedule if provided
    let scheduleId: string | null = null;
    if (delivery_schedule) {
      try {
        console.log('📅 Inserting delivery schedule for order:', orderId);
        
        const scheduleData = {
          order_id: orderId,
          delivery_date: delivery_schedule.delivery_date,
          delivery_time_start: delivery_schedule.delivery_time_start,
          delivery_time_end: delivery_schedule.delivery_time_end,
          is_flexible: delivery_schedule.is_flexible || false,
          special_instructions: delivery_schedule.special_instructions || null,
          requested_at: new Date().toISOString()
        };

        const { data: scheduleRecord, error: scheduleError } = await supabaseClient
          .from('order_delivery_schedule')
          .insert(scheduleData)
          .select('id')
          .single();

        if (scheduleError) {
          console.error('❌ Failed to insert delivery schedule:', scheduleError);
          
          // Log to payment_processing_logs
          await supabaseClient
            .from('payment_processing_logs')
            .insert({
              order_id: orderId,
              payment_reference: authoritativePaymentReference,
              processing_stage: 'schedule_insert_failed',
              error_message: scheduleError.message,
              metadata: {
                schedule_data: scheduleData,
                error_code: scheduleError.code
              }
            });

          // Log to audit_logs
          await supabaseClient
            .from('audit_logs')
            .insert({
              action: 'delivery_schedule_insert_failed',
              category: 'Order Management',
              message: `Failed to insert delivery schedule for order ${orderDetails.order_number}`,
              entity_id: orderId,
              old_values: null,
              new_values: scheduleData,
              user_id: null
            });

          throw new Error('Failed to save delivery schedule: ' + scheduleError.message);
        }

        scheduleId = scheduleRecord.id;
        console.log('✅ Delivery schedule inserted:', scheduleId);

        // Log success
        await supabaseClient
          .from('audit_logs')
          .insert({
            action: 'delivery_schedule_inserted',
            category: 'Order Management',
            message: `Delivery schedule created for order ${orderDetails.order_number}: ${delivery_schedule.delivery_date} ${delivery_schedule.delivery_time_start}-${delivery_schedule.delivery_time_end}`,
            entity_id: orderId,
            old_values: null,
            new_values: scheduleData,
            user_id: null
          });

        // Insert success metric
        await supabaseClient
          .from('api_metrics')
          .insert({
            endpoint: 'process-checkout',
            metric_type: 'schedule_persisted',
            metric_value: 1,
            dimensions: {
              fulfillment_type: fulfillment_type,
              has_special_instructions: !!delivery_schedule.special_instructions
            }
          });

      } catch (scheduleError: any) {
        console.error('❌ Delivery schedule insertion failed:', scheduleError);
        
        // Insert failure metric
        await supabaseClient
          .from('api_metrics')
          .insert({
            endpoint: 'process-checkout',
            metric_type: 'schedule_persist_failed',
            metric_value: 1,
            dimensions: {
              fulfillment_type: fulfillment_type,
              error_type: scheduleError.name || 'unknown'
            }
          });

        // Re-throw to prevent order from proceeding to payment without schedule
        throw scheduleError;
      }
    }

    // Initialize payment with Paystack (with retry mechanism)
    console.log('💳 Initializing payment...');
    
    // 🔧 CRITICAL: Use standardized reference for payment initialization
    let paymentResponse: any = null;
    let finalAuthUrl: string | null = null;
    let finalAccessCode: string | null = null;
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
            amount: total_amount, // Amount already in naira from database
            reference: authoritativePaymentReference, // 🔧 Use backend-generated reference
            callback_url: `https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/payment-callback?reference=${authoritativePaymentReference}&order_id=${orderId}`,
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

        console.log('🔍 Raw paystack-secure response:', JSON.stringify(response, null, 2));

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
        
        console.log('🔍 Extracted values:', { authorizationUrl, accessCode, reference: inner?.reference });

        // Build fallback URL from access_code if authorization_url is missing
        if (!authorizationUrl && accessCode) {
          authorizationUrl = `https://checkout.paystack.com/${accessCode}`;
          console.log('🔧 Built fallback authorization URL from access_code:', authorizationUrl);
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
            reference: authoritativePaymentReference
          }
        };
        finalAuthUrl = authorizationUrl;
        finalAccessCode = accessCode;
        
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

    // 📌 Use the backend-generated authoritative reference 
    const effectiveReference = authoritativePaymentReference;

    // Persist the effective reference on the order for reliable reconciliation
    try {
      await supabaseClient
        .from('orders')
        .update({
          payment_reference: effectiveReference,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
    } catch (e) {
      console.warn('⚠️ Failed to update order with payment_reference:', e);
    }

    // NEW: Mark any previous pending initializations as superseded so the latest reference is the canonical one
    let pendingCount = 0;
    try {
      const { count } = await supabaseClient
        .from('payment_transactions')
        .select('id', { count: 'exact', head: true })
        .eq('order_id', orderId)
        .eq('status', 'pending');

      pendingCount = count ?? 0;
      console.log('🔁 Existing pending transactions for this order before insert:', pendingCount);

      if (pendingCount > 0) {
        const { error: supersedeErr } = await supabaseClient
          .from('payment_transactions')
          .update({
            status: 'superseded',
            updated_at: new Date().toISOString(),
            metadata: {
              superseded_by_reference: effectiveReference,
              superseded_at: new Date().toISOString(),
              order_number: orderDetails.order_number,
              note: 'Superseded by newer initialization'
            }
          })
          .eq('order_id', orderId)
          .eq('status', 'pending');

        if (supersedeErr) {
          console.warn('⚠️ Could not mark previous pending transactions as superseded:', supersedeErr);
        } else {
          console.log('✅ Marked previous pending transactions as superseded');
        }
      }
    } catch (supersedeCatch) {
      console.warn('⚠️ Supersede step skipped:', supersedeCatch);
    }

    // Create payment transaction record for the latest/canonical reference
    const { error: transactionError } = await supabaseClient
      .from('payment_transactions')
      .insert({
        order_id: orderId,
        provider: 'paystack',
        provider_reference: effectiveReference,
        amount: total_amount,
        currency: 'NGN',
        status: 'pending',
        metadata: {
          customer_id: customerId,
          user_id: customerId,
          order_number: orderDetails.order_number,
          init_version: (pendingCount ?? 0) + 1, // 1 for first init, 2 for second, etc.
          canonical_reference: effectiveReference
        }
      });

    if (transactionError) {
      console.error('⚠️ Failed to create payment transaction record:', transactionError);
      // Don't throw error here as the order and payment initialization succeeded
    }

    // ✅ CRITICAL FIX: Ensure complete payment response with fallback URL construction
    console.log('📦 Building enhanced payment response...');
    
    let responsePaymentUrl = finalAuthUrl;
    
    // FALLBACK: If authorization_url is missing but access_code exists, build the URL
    if (!responsePaymentUrl && finalAccessCode) {
      responsePaymentUrl = `https://checkout.paystack.com/${finalAccessCode}`;
      console.log('🔧 Built payment URL from access_code:', responsePaymentUrl);
    }
    
    if (!responsePaymentUrl) {
      console.error('❌ CRITICAL: No payment URL available after all attempts');
      throw new Error('Payment URL could not be generated - please try again');
    }
    
    const response = {
      success: true,
      version: VERSION,
      order_id: orderId,
      order_number: orderDetails.order_number,
      total_amount: total_amount,
      payment: {
        payment_url: responsePaymentUrl, // CRITICAL: Always include this
        authorization_url: responsePaymentUrl, // Duplicate for compatibility
        access_code: finalAccessCode,
        reference: authoritativePaymentReference // Always use server txn_ reference
      },
      schedule: scheduleId ? {
        schedule_id: scheduleId,
        delivery_date: delivery_schedule?.delivery_date,
        delivery_time_start: delivery_schedule?.delivery_time_start,
        delivery_time_end: delivery_schedule?.delivery_time_end,
        is_flexible: delivery_schedule?.is_flexible || false,
        special_instructions: delivery_schedule?.special_instructions
      } : null,
      message: 'Order created and payment initialized successfully'
    };

    console.log(`✅ Final response being sent [${VERSION}]:`, JSON.stringify(response, null, 2));
    console.log('🎉 Checkout process completed successfully');

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
        error: (error as Error)?.message || 'Checkout process failed',
        message: (error as Error)?.message || 'An error occurred during checkout'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});
