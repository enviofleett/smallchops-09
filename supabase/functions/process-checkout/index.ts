
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ✅ Updated CORS headers with allowed methods
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

// ✅ Validate environment variables before client creation
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    console.log("🛒 Processing checkout request...");

    // ✅ Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (parseError) {
      console.error("❌ Failed to parse request body:", parseError);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Invalid JSON in request body",
          code: "INVALID_JSON"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    console.log("📨 Checkout request received:", {
      customer_email: requestBody.customer?.email,
      items_count: requestBody.items?.length,
      fulfillment_type: requestBody.fulfillment?.type
    });

    // ✅ Comprehensive request validation
    const validationErrors = [];
    
    if (!requestBody.customer?.email) {
      validationErrors.push("Customer email is required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(requestBody.customer.email)) {
      validationErrors.push("Valid customer email is required");
    }
    
    if (!requestBody.customer?.name?.trim()) {
      validationErrors.push("Customer name is required");
    }
    
    if (!requestBody.items || !Array.isArray(requestBody.items) || requestBody.items.length === 0) {
      validationErrors.push("Order must contain at least one item");
    } else {
      // Validate each item
      requestBody.items.forEach((item, index) => {
        if (!item.product_id) validationErrors.push(`Item ${index + 1}: Product ID is required`);
        if (!item.product_name?.trim()) validationErrors.push(`Item ${index + 1}: Product name is required`);
        if (!item.quantity || item.quantity <= 0) validationErrors.push(`Item ${index + 1}: Valid quantity is required`);
        if (!item.unit_price || item.unit_price <= 0) validationErrors.push(`Item ${index + 1}: Valid unit price is required`);
      });
    }
    
    if (!requestBody.fulfillment?.type || !['delivery', 'pickup'].includes(requestBody.fulfillment.type)) {
      validationErrors.push("Valid fulfillment type (delivery or pickup) is required");
    }
    
    if (requestBody.fulfillment?.type === 'delivery' && !requestBody.fulfillment?.address) {
      validationErrors.push("Delivery address is required for delivery orders");
    }
    
    if (requestBody.fulfillment?.type === 'pickup' && !requestBody.fulfillment?.pickup_point_id) {
      validationErrors.push("Pickup point is required for pickup orders");
    }

    if (validationErrors.length > 0) {
      console.error("❌ Validation errors:", validationErrors);
      return new Response(
        JSON.stringify({
          success: false,
          error: "Validation failed",
          details: validationErrors,
          code: "VALIDATION_FAILED"
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const customerEmail = requestBody.customer.email.toLowerCase().trim();
    let customerId;

    // ✅ Database transaction for customer lookup/creation
    console.log("👤 Looking up customer by email:", customerEmail);
    
    try {
      const { data: existingCustomer, error: findError } = await supabaseAdmin
        .from("customer_accounts")
        .select("id, name")
        .eq("email", customerEmail)
        .maybeSingle();

      if (findError) {
        console.error("❌ Failed to check for existing customer:", findError);
        throw new Error(`Customer lookup failed: ${findError.message}`);
      }

      if (existingCustomer) {
        customerId = existingCustomer.id;
        console.log("👤 Using existing customer:", customerId);
      } else {
        // ✅ Create new customer with comprehensive error handling
        console.log("👤 Creating new customer account for:", customerEmail);

        const customerData = {
          name: requestBody.customer.name.trim(),
          email: customerEmail,
          phone: requestBody.customer.phone?.trim() || null,
          email_verified: false,
          phone_verified: false,
          profile_completion_percentage: 60,
        };

        const { data: newCustomer, error: createError } = await supabaseAdmin
          .from("customer_accounts")
          .insert(customerData)
          .select("id")
          .single();

        if (createError) {
          if (createError.code === "23505") {
            // Race condition - another request created the customer
            console.log("⚠️ Race condition detected. Refetching existing customer...");
            const { data: raceCustomer, error: raceError } = await supabaseAdmin
              .from("customer_accounts")
              .select("id, name")
              .eq("email", customerEmail)
              .maybeSingle();

            if (raceError || !raceCustomer) {
              console.error("❌ Failed to resolve race condition:", raceError);
              throw new Error("Failed to resolve customer account after race condition");
            }
            customerId = raceCustomer.id;
            console.log("👤 Resolved race condition, using customer:", customerId);
          } else {
            console.error("❌ Customer creation failed:", createError);
            throw new Error(`Customer creation failed: ${createError.message}`);
          }
        } else {
          customerId = newCustomer.id;
          console.log("👤 Successfully created new customer:", customerId);
        }
      }
    } catch (error) {
      console.error("❌ Customer processing error:", error);
      throw new Error(`Customer processing failed: ${error.message}`);
    }
    // ✅ Prepare and validate order items
    console.log("📝 Preparing order items...");
    const orderItems = [];
    let itemsSubtotal = 0;

    try {
      for (const item of requestBody.items) {
        // Additional item validation
        if (!item.product_id || typeof item.product_id !== 'string') {
          throw new Error(`Invalid product_id for item: ${item.product_name || 'Unknown'}`);
        }
        
        const quantity = parseInt(item.quantity);
        const unitPrice = parseFloat(item.unit_price);
        
        if (isNaN(quantity) || quantity <= 0) {
          throw new Error(`Invalid quantity for item: ${item.product_name}`);
        }
        
        if (isNaN(unitPrice) || unitPrice <= 0) {
          throw new Error(`Invalid unit price for item: ${item.product_name}`);
        }

        const processedItem = {
          product_id: item.product_id,
          product_name: item.product_name?.trim() || 'Unnamed Product',
          quantity: quantity,
          unit_price: unitPrice,
          customizations: item.customizations || null,
        };

        orderItems.push(processedItem);
        itemsSubtotal += quantity * unitPrice;
      }

      console.log(`📊 Items processed: ${orderItems.length}, Subtotal: ₦${itemsSubtotal}`);
    } catch (error) {
      console.error("❌ Item processing error:", error);
      throw new Error(`Item processing failed: ${error.message}`);
    }

    // ✅ Sanitize and validate delivery/pickup information
    let processedDeliveryAddress = null;
    let deliveryInstructions = null;
    let deliveryZoneId = null;

    if (requestBody.fulfillment.type === 'delivery') {
      if (!requestBody.fulfillment.address) {
        throw new Error("Delivery address is required for delivery orders");
      }

      // Validate delivery zone for delivery orders
      if (!requestBody.fulfillment.delivery_zone_id) {
        console.warn("⚠️ No delivery zone provided for delivery order, using default");
        // Try to get a default delivery zone
        const { data: defaultZone } = await supabaseAdmin
          .from("delivery_zones")
          .select("id")
          .eq("is_active", true)
          .limit(1)
          .maybeSingle();
        
        deliveryZoneId = defaultZone?.id || null;
        if (!deliveryZoneId) {
          throw new Error("Delivery orders must specify a delivery zone");
        }
      } else {
        deliveryZoneId = requestBody.fulfillment.delivery_zone_id;
      }

      processedDeliveryAddress = {
        ...requestBody.fulfillment.address,
        // Sanitize delivery instructions
        delivery_instructions: requestBody.delivery_instructions ? 
          requestBody.delivery_instructions.toString()
            .replace(/<[^>]*>/g, '') // Strip HTML
            .trim()
            .slice(0, 160) || null : null
      };

      deliveryInstructions = processedDeliveryAddress.delivery_instructions;
      console.log("🏠 Processed delivery address with zone:", deliveryZoneId);
    } else {
      console.log("📦 Pickup order - no delivery address needed");
    }

    // ✅ Validate promotion code if provided
    let promotionCode = null;
    if (requestBody.promotion?.code?.trim()) {
      promotionCode = requestBody.promotion.code.trim().toUpperCase();
      console.log("🎟️ Promotion code provided:", promotionCode);
    }

    // ✅ Create order via database function with comprehensive error handling
    console.log("💾 Creating order in database...");
    
    let orderId;
    try {
      const { data: orderResult, error: orderError } = await supabaseAdmin.rpc("create_order_with_items", {
        p_customer_id: customerId,
        p_fulfillment_type: requestBody.fulfillment.type,
        p_items: orderItems,
        p_delivery_address: processedDeliveryAddress,
        p_pickup_point_id: requestBody.fulfillment.pickup_point_id || null,
        p_delivery_zone_id: deliveryZoneId,
        p_guest_session_id: undefined,
        p_promotion_code: promotionCode,
        p_client_total: requestBody.client_calculated_total || null
      });

      if (orderError) {
        console.error("❌ Database function error:", orderError);
        throw new Error(`Order creation failed: ${orderError.message}`);
      }

      if (!orderResult) {
        console.error("❌ No result returned from database function");
        throw new Error("Order creation failed: No result returned");
      }

      // Handle new standardized return format
      const typedResult = orderResult as { success: boolean; order_id?: string; order_number?: string; error?: string };
      
      if (!typedResult.success) {
        console.error("❌ Order creation failed:", typedResult.error);
        throw new Error(`Order creation failed: ${typedResult.error || 'Unknown error'}`);
      }

      if (!typedResult.order_id) {
        console.error("❌ No order ID returned from database function");
        throw new Error("Order creation failed: No order ID returned");
      }

      orderId = typedResult.order_id;
      console.log("✅ Order created successfully with ID:", orderId, "Order Number:", typedResult.order_number);

    } catch (error) {
      console.error("❌ Order creation error:", error);
      
      // Enhanced error messages for common issues
      if (error.message.includes('column') && error.message.includes('does not exist')) {
        throw new Error("Database schema error: Missing required columns. Please contact support.");
      } else if (error.message.includes('violates foreign key')) {
        throw new Error("Invalid reference data provided. Please check product IDs and zone information.");
      } else if (error.message.includes('promotion')) {
        throw new Error("Invalid promotion code or promotion has expired.");
      } else {
        throw new Error(`Order creation failed: ${error.message}`);
      }
    }
    
    // ✅ Handle delivery schedule with improved error handling
    if (requestBody.delivery_schedule && orderId && typeof orderId === 'string') {
      console.log("📅 Saving delivery schedule for order:", orderId);
      try {
        // Validate orderId is a valid UUID before proceeding
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(orderId)) {
          console.error("❌ Invalid order ID format for delivery schedule:", orderId);
          throw new Error("Invalid order ID format");
        }

        const scheduleData = {
          order_id: orderId,
          delivery_date: requestBody.delivery_schedule.delivery_date,
          delivery_time_start: requestBody.delivery_schedule.delivery_time_start,
          delivery_time_end: requestBody.delivery_schedule.delivery_time_end,
          is_flexible: Boolean(requestBody.delivery_schedule.is_flexible),
          special_instructions: requestBody.delivery_schedule.special_instructions?.trim() || deliveryInstructions,
          requested_at: new Date().toISOString()
        };

        const { error: scheduleError } = await supabaseAdmin
          .from("order_delivery_schedule")
          .insert(scheduleData);

        if (scheduleError) {
          console.error("⚠️ Delivery schedule save failed:", scheduleError);
          // Non-blocking: Log but don't fail the order
        } else {
          console.log("✅ Delivery schedule saved successfully");
        }
      } catch (scheduleErr) {
        console.error("⚠️ Delivery schedule processing error:", scheduleErr);
        // Non-blocking: Don't fail the order for schedule issues
      }
    }

    // ✅ Fetch the created order with error handling
    console.log("📋 Fetching created order details...");
    let order;
    
    try {
      const { data: orderData, error: fetchError } = await supabaseAdmin
        .from("orders")
        .select(`
          id, 
          order_number, 
          total_amount, 
          customer_email, 
          customer_name,
          subtotal,
          delivery_fee,
          promotion_discount,
          status,
          fulfillment_type
        `)
        .eq("id", orderId)
        .single();

      if (fetchError || !orderData) {
        console.error("❌ Failed to fetch created order:", fetchError);
        throw new Error("Order was created but could not be retrieved. Please contact support with your email.");
      }

      order = orderData;
      console.log("📋 Order fetched successfully:", {
        id: order.id,
        order_number: order.order_number,
        total_amount: order.total_amount
      });

    } catch (fetchErr) {
      console.error("❌ Order fetch error:", fetchErr);
      throw new Error("Order creation completed but retrieval failed. Please contact support.");
    }

    // ✅ Initialize payment with comprehensive error handling and validation
    console.log("💳 Initializing secure payment...");
    
    let paymentData;
    try {
      // Validate payment amount
      const paymentAmount = Math.round(order.total_amount);
      if (paymentAmount <= 0) {
        throw new Error("Invalid payment amount: Order total must be greater than zero");
      }

      if (!order.customer_email) {
        throw new Error("Customer email missing for payment initialization");
      }

      console.log(`💰 Payment details: Amount=₦${paymentAmount}, Email=${order.customer_email}`);

      const paymentPayload = {
        action: "initialize",
        email: order.customer_email,
        amount: paymentAmount,
        metadata: {
          order_id: order.id,
          customer_name: order.customer_name || requestBody.customer.name,
          order_number: order.order_number,
          fulfillment_type: requestBody.fulfillment.type,
          items_subtotal: order.subtotal || paymentAmount,
          delivery_fee: order.delivery_fee || 0,
          promotion_discount: order.promotion_discount || 0,
          client_total: paymentAmount,
          authoritative_total: paymentAmount,
        }
      };

      const { data: paymentResponse, error: paymentError } = await supabaseAdmin.functions.invoke("paystack-secure", {
        headers: {
          Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
          "x-internal-caller": "process-checkout",
          "Content-Type": "application/json"
        },
        body: paymentPayload,
      });

      if (paymentError) {
        console.error("❌ Payment service error:", paymentError);
        throw new Error(`Payment initialization failed: ${paymentError.message}`);
      }

      if (!paymentResponse) {
        console.error("❌ No payment response received");
        throw new Error("Payment service did not respond. Please try again.");
      }

      paymentData = paymentResponse;
      console.log("🔍 Payment response received:", {
        has_data: !!paymentData?.data,
        has_reference: !!(paymentData?.data?.reference || paymentData?.reference),
        has_url: !!(paymentData?.data?.authorization_url || paymentData?.authorization_url)
      });

    } catch (paymentErr) {
      console.error("❌ Payment initialization error:", paymentErr);
      
      // Enhanced payment error handling
      if (paymentErr.message.includes('network') || paymentErr.message.includes('timeout')) {
        throw new Error("Payment service temporarily unavailable. Your order was created successfully. Please contact support for payment assistance.");
      } else if (paymentErr.message.includes('invalid') || paymentErr.message.includes('validation')) {
        throw new Error("Payment initialization failed due to invalid data. Please contact support.");
      } else {
        throw new Error(`Payment initialization failed: ${paymentErr.message}`);
      }
    }

    // ✅ Extract payment information safely
    const paymentReference = paymentData?.data?.reference || paymentData?.reference;
    const authorizationUrl = paymentData?.data?.authorization_url || paymentData?.authorization_url;

    if (!paymentReference || !authorizationUrl) {
      console.error("❌ Missing payment data:", { 
        reference: !!paymentReference, 
        url: !!authorizationUrl,
        raw_response: paymentData
      });
      throw new Error("Payment initialization incomplete. Please contact support with order number: " + order.order_number);
    }

    console.log("✅ Payment initialized successfully");
    console.log("💳 Payment reference:", paymentReference);
    console.log("🌐 Authorization URL length:", authorizationUrl.length);

    // ✅ Comprehensive success response
    return new Response(
      JSON.stringify({
        success: true,
        message: "Checkout completed successfully",
        order: {
          id: order.id,
          order_number: order.order_number,
          total_amount: order.total_amount,
          subtotal_amount: order.subtotal || order.total_amount,
          delivery_fee: order.delivery_fee || 0,
          promotion_discount: order.promotion_discount || 0,
          status: order.status || "pending",
          fulfillment_type: order.fulfillment_type || requestBody.fulfillment.type,
        },
        customer: {
          id: customerId,
          email: order.customer_email,
          name: order.customer_name,
        },
        payment: {
          authorization_url: authorizationUrl,
          reference: paymentReference,
          amount: order.total_amount,
        },
        metadata: {
          created_at: new Date().toISOString(),
          session_id: requestBody.session_id || null,
        }
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    // ✅ Enhanced error handling with logging and user-friendly messages
    const errorId = `ERR_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    
    console.error(`❌ Checkout processing error [${errorId}]:`, {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString(),
      request_data: {
        customer_email: requestBody?.customer?.email,
        fulfillment_type: requestBody?.fulfillment?.type,
        items_count: requestBody?.items?.length
      }
    });

    // Determine appropriate HTTP status code
    let statusCode = 400;
    let errorCode = "CHECKOUT_FAILED";
    
    if (error.message.includes('Authentication') || error.message.includes('authorization')) {
      statusCode = 401;
      errorCode = "AUTH_REQUIRED";
    } else if (error.message.includes('Validation') || error.message.includes('required')) {
      statusCode = 400;
      errorCode = "VALIDATION_ERROR";
    } else if (error.message.includes('network') || error.message.includes('timeout') || error.message.includes('service')) {
      statusCode = 503;
      errorCode = "SERVICE_UNAVAILABLE";
    } else if (error.message.includes('Database') || error.message.includes('schema')) {
      statusCode = 500;
      errorCode = "DATABASE_ERROR";
    }

    // User-friendly error message
    let userMessage = error.message;
    
    if (statusCode === 500) {
      userMessage = "A system error occurred while processing your order. Please try again or contact support.";
    } else if (statusCode === 503) {
      userMessage = "Our payment service is temporarily unavailable. Please try again in a few minutes.";
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: userMessage,
        error_code: errorCode,
        error_id: errorId,
        details: {
          timestamp: new Date().toISOString(),
          can_retry: statusCode < 500,
          contact_support: statusCode >= 500,
        },
        recovery_suggestions: statusCode < 500 ? [
          "Please verify all required information is provided",
          "Check your internet connection and try again",
          "Ensure promotion codes are valid and not expired"
        ] : [
          "Please contact our support team",
          "Provide error ID: " + errorId,
          "Try again in a few minutes"
        ]
      }),
      {
        status: statusCode,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
