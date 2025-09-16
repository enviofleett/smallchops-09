
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { getCorsHeaders, handleCorsPreflightResponse } from '../_shared/cors.ts';

// ✅ Validate environment variables before client creation
const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error("Missing Supabase environment variables");
}

const supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Validate and process discount codes with centralized validation
async function validateAndApplyDiscount(supabase: any, discountCode: string, orderAmount: number, customerEmail: string, isNewCustomer: boolean = false) {
  console.log(`🎟️ Validating discount code: ${discountCode} for amount: ${orderAmount}`);
  
  try {
    const { data, error } = await supabase.functions.invoke('validate-discount-code', {
      body: {
        code: discountCode.trim().toUpperCase(),
        customer_email: customerEmail,
        order_amount: orderAmount,
        is_new_customer: isNewCustomer
      }
    });

    if (error) {
      console.error('❌ Discount validation error:', error);
      return { valid: false, error: error.message || 'Failed to validate discount code' };
    }

    if (!data || !data.valid) {
      console.log('❌ Discount code invalid:', data?.error || 'Unknown error');
      return { valid: false, error: data?.error || 'Invalid discount code' };
    }

    console.log('✅ Discount code validated successfully:', data);
    return {
      valid: true,
      discount_amount: data.discount_amount,
      final_amount: data.final_amount,
      discount_code_id: data.discount_code_id,
      discount_type: data.discount_type
    };
  } catch (error) {
    console.error('❌ Discount validation exception:', error);
    return { valid: false, error: 'Discount validation service error' };
  }
}

serve(async (req) => {
  // Get origin and generate CORS headers per-request
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return handleCorsPreflightResponse(origin);
  }

  try {
    // Enhanced authentication and guest session validation
    const authHeader = req.headers.get("Authorization");
    const guestSessionId = req.headers.get("x-guest-session-id");
    
    console.log("🔐 Authentication debug:", {
      hasAuthHeader: !!authHeader,
      hasGuestSession: !!guestSessionId,
      authHeaderPrefix: authHeader ? authHeader.substring(0, 20) + '...' : 'none',
      authHeaderLength: authHeader?.length || 0,
      guestSessionLength: guestSessionId?.length || 0
    });
    
    // Allow either authenticated users OR guest sessions
    if (!authHeader && !guestSessionId) {
      console.log("❌ No authentication method provided - checkout requires either JWT or guest session");
      return new Response(
        JSON.stringify({
          success: false,
          error: "Authentication required for checkout. Please log in or continue as guest.",
          code: "REQUIRES_AUTH",
          details: {
            missing_auth: !authHeader,
            missing_guest: !guestSessionId,
            suggestion: "Login or use guest checkout"
          }
        }),
        {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    // For authenticated users, validate the JWT with enhanced error handling
    if (authHeader) {
      try {
        // Extract JWT and validate format first
        const jwt = authHeader.replace('Bearer ', '');
        
        // Basic JWT format validation - must have 3 parts separated by dots
        const jwtParts = jwt.split('.');
        if (jwtParts.length !== 3) {
          console.log("❌ Invalid JWT format: JWT must have 3 parts (header.payload.signature)");
          return new Response(
            JSON.stringify({
              success: false,
              error: "Invalid authentication token format",
              code: "INVALID_JWT_FORMAT",
              details: { reason: "JWT must have 3 parts separated by dots" }
            }),
            {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Try to decode payload to check for required claims before calling Supabase
        try {
          const payload = JSON.parse(atob(jwtParts[1]));
          if (!payload.sub) {
            console.log("❌ JWT missing required 'sub' claim");
            return new Response(
              JSON.stringify({
                success: false,
                error: "Authentication token missing required claims",
                code: "JWT_MISSING_SUB_CLAIM",
                details: { reason: "Token does not contain user identification" }
              }),
              {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          
          // Check token expiration
          if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
            console.log("❌ JWT token has expired");
            return new Response(
              JSON.stringify({
                success: false,
                error: "Authentication token has expired",
                code: "JWT_EXPIRED",
                details: { reason: "Please refresh your session and try again" }
              }),
              {
                status: 401,
                headers: { ...corsHeaders, "Content-Type": "application/json" },
              }
            );
          }
          
          console.log("✅ JWT format and claims validation passed for user:", payload.sub);
        } catch (decodeError) {
          console.log("❌ Failed to decode JWT payload:", decodeError);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Malformed authentication token",
              code: "JWT_DECODE_ERROR",
              details: { reason: "Token payload cannot be decoded" }
            }),
            {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }

        // Now validate with Supabase (should succeed since we pre-validated)
        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(jwt);
        
        if (authError || !user) {
          console.log("❌ Supabase JWT validation failed:", authError);
          return new Response(
            JSON.stringify({
              success: false,
              error: "Authentication validation failed with auth service",
              code: "SUPABASE_AUTH_ERROR",
              details: { 
                authError: authError?.message,
                suggestion: "Please refresh your session and try again"
              }
            }),
            {
              status: 401,
              headers: { ...corsHeaders, "Content-Type": "application/json" },
            }
          );
        }
        
        console.log("✅ Full JWT validation successful for user:", user.id);
      } catch (authValidationError) {
        console.log("❌ JWT validation caught unexpected error:", authValidationError);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Authentication validation failed",
            code: "AUTH_VALIDATION_ERROR",
            details: { 
              error: authValidationError.message,
              suggestion: "Please refresh your session and try again"
            }
          }),
          {
            status: 401,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          }
        );
      }
    }
    
    // For guest sessions, validate the session exists and is valid
    if (guestSessionId && !authHeader) {
      console.log("🎭 Processing guest checkout with session:", guestSessionId);
      // For now, we'll allow guest sessions - in production you might want to validate
      // the guest session ID against a guest_sessions table
    }
    
    console.log("🛒 Processing checkout request...");

    const requestBody = await req.json();

    console.log("📨 Checkout request received:", {
      customer_email: requestBody.customer?.email,
      items_count: requestBody.items?.length,
      has_discount: !!requestBody.discount,
      discount_code: requestBody.discount?.code,
      cart_total: requestBody.cart_totals?.final_total,
    });

    // ✅ Validate request
    if (!requestBody.customer?.email) throw new Error("Customer email is required");
    if (!requestBody.items || requestBody.items.length === 0) throw new Error("Order must contain at least one item");
    if (!requestBody.fulfillment?.type) throw new Error("Fulfillment type is required");

    const customerEmail = requestBody.customer.email.toLowerCase();
    let customerId;

    // ✅ Look up existing customer
    console.log("👤 Looking up customer by email:", customerEmail);
    const { data: existingCustomer, error: findError } = await supabaseAdmin
      .from("customer_accounts")
      .select("id, name")
      .eq("email", customerEmail)
      .maybeSingle();

    if (findError) {
      console.error("❌ Failed to check for existing customer:", findError);
      throw new Error("Failed to find customer account");
    }

    if (existingCustomer) {
      customerId = existingCustomer.id;
      console.log("👤 Using existing customer:", customerId);
    } else {
      // ✅ Create new customer safely
      console.log("👤 Creating new customer account for:", customerEmail);

      const { data: newCustomer, error: createError } = await supabaseAdmin
        .from("customer_accounts")
        .insert({
          name: requestBody.customer.name,
          email: customerEmail,
          phone: requestBody.customer.phone,
          email_verified: false,
          phone_verified: false,
          profile_completion_percentage: 60,
        })
        .select("id")
        .single(); // ✅ FIX: use .single()

      if (createError) {
        if (createError.code === "23505") {
          console.log("⚠️ Race condition detected. Fetching existing customer...");
          const { data: raceCustomer, error: raceError } = await supabaseAdmin
            .from("customer_accounts")
            .select("id, name")
            .eq("email", customerEmail)
            .maybeSingle();

          if (raceError || !raceCustomer) {
            console.error("❌ Failed to resolve customer after race condition:", raceError);
            throw new Error("Failed to resolve customer account");
          }
          customerId = raceCustomer.id;
          console.log("👤 Resolved race condition, using existing customer:", customerId);
        } else {
          console.error("❌ Customer creation failed:", createError);
          throw new Error("Failed to create customer account");
        }
      } else {
        customerId = newCustomer.id;
        console.log("👤 Created new customer:", customerId);
      }
    }
    // ✅ Prepare order items
    console.log("📝 Creating order with items...");
    const orderItems = requestBody.items.map((item) => ({
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_price: item.unit_price,
      customizations: item.customizations,
    }));

    // Sanitize delivery instructions (max 160 chars, strip HTML)
    const delivery_instructions = requestBody.delivery_instructions ? 
      requestBody.delivery_instructions.toString().replace(/<[^>]*>/g, '').trim().slice(0, 160) || null : null;
    
    // Add delivery instructions to delivery address if provided
    const enhanced_delivery_address = requestBody.fulfillment.address ? {
      ...requestBody.fulfillment.address,
      delivery_instructions: delivery_instructions
    } : null;

    // ✅ Call database function
    const { data: orderId, error: orderError } = await supabaseAdmin.rpc("create_order_with_items", {
      p_customer_id: customerId,
      p_fulfillment_type: requestBody.fulfillment.type,
      p_delivery_address: enhanced_delivery_address,
      p_pickup_point_id: requestBody.fulfillment.pickup_point_id || null,
      p_delivery_zone_id: requestBody.fulfillment.delivery_zone_id || null,
      p_guest_session_id: null,
      p_items: orderItems,
    });

    if (orderError) {
      console.error("❌ Order creation failed:", orderError);
      throw new Error(`Order creation failed: ${orderError.message}`);
    }

    console.log("✅ Order created successfully:", orderId);
    
    // ✅ Save delivery schedule atomically if provided
    if (requestBody.delivery_schedule && orderId) {
      console.log("📅 Saving delivery schedule for order:", orderId);
      try {
        const { error: scheduleError } = await supabaseAdmin
          .from("order_delivery_schedule")
          .insert({
            order_id: orderId,
            delivery_date: requestBody.delivery_schedule.delivery_date,
            delivery_time_start: requestBody.delivery_schedule.delivery_time_start,
            delivery_time_end: requestBody.delivery_schedule.delivery_time_end,
            is_flexible: requestBody.delivery_schedule.is_flexible || false,
            special_instructions: requestBody.delivery_schedule.special_instructions || delivery_instructions,
            requested_at: new Date().toISOString()
          });

        if (scheduleError) {
          console.error("⚠️ Failed to save delivery schedule:", scheduleError);
          // Don't fail the entire order creation, but log the error
        } else {
          console.log("✅ Delivery schedule saved successfully");
        }
      } catch (error) {
        console.error("⚠️ Delivery schedule save error:", error);
        // Don't fail the entire order creation
      }
    }

    // ✅ Fetch the created order
    const { data: order, error: fetchError } = await supabaseAdmin
      .from("orders")
      .select("id, order_number, total_amount, customer_email")
      .eq("id", orderId)
      .maybeSingle();

    if (fetchError || !order) {
      console.error("❌ Failed to fetch created order:", fetchError);
      throw new Error("Order not found after creation");
    }

    // ✅ Compute delivery fee if delivery order
    let deliveryFee = 0;
    if (requestBody.fulfillment.type === 'delivery' && requestBody.fulfillment.delivery_zone_id) {
      console.log('💰 Computing delivery fee for zone:', requestBody.fulfillment.delivery_zone_id);
      
      const { data: deliveryZone, error: zoneError } = await supabaseAdmin
        .from('delivery_zones')
        .select('base_fee, name')
        .eq('id', requestBody.fulfillment.delivery_zone_id)
        .eq('is_active', true)
        .maybeSingle();
      
      if (zoneError) {
        console.error('⚠️ Failed to fetch delivery zone fee:', zoneError);
      } else if (deliveryZone) {
        deliveryFee = deliveryZone.base_fee || 0;
        console.log('💰 Delivery fee for zone:', deliveryZone.name, '- Fee:', deliveryFee);
      }
    }

    // ✅ Update order with delivery fee if applicable
    if (deliveryFee > 0) {
      console.log('💰 Updating order with delivery fee:', deliveryFee);
      
      const newTotalAmount = order.total_amount + deliveryFee;
      
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          delivery_fee: deliveryFee,
          total_amount: newTotalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (updateError) {
        console.error('⚠️ Failed to update order with delivery fee:', updateError);
      } else {
        console.log('✅ Order updated with delivery fee. New total:', newTotalAmount);
        // CRITICAL: Update the order object to reflect the new total
        order.total_amount = newTotalAmount;
      }
    }

    // 🔧 CRITICAL: Apply discount with centralized backend validation
    let finalAmount = order.total_amount;
    let discountApplied = 0;
    let validatedDiscountDetails = null;
    
    console.log('💰 Backend amount calculation:', {
      subtotal: requestBody.cart_totals?.subtotal,
      discount_amount: requestBody.cart_totals?.discount_amount,
      delivery_fee: deliveryFee,
      client_final_total: requestBody.cart_totals?.final_total
    });

    // ✅ Recalculate on backend to ensure accuracy
    const backendSubtotal = requestBody.items.reduce(
      (sum, item) => sum + (item.unit_price * item.quantity), 0
    );

    let backendDiscountAmount = 0;
    if (requestBody.discount?.code && requestBody.cart_totals?.discount_code) {
      console.log('💸 Centralizing discount validation via validate-discount-code function:', {
        code: requestBody.discount.code,
        customer_email: customerEmail,
        order_amount: backendSubtotal,
        client_discount_amount: requestBody.discount.discount_amount
      });
      
      try {
        // ✅ Call centralized discount validation function
        const discountValidation = await validateAndApplyDiscount(
          supabaseAdmin,
          requestBody.discount.code,
          backendSubtotal,
          customerEmail,
          !existingCustomer // isNewCustomer
        );
        
        if (discountValidation.valid) {
          backendDiscountAmount = discountValidation.discount_amount;
          validatedDiscountDetails = {
            discount_code_id: discountValidation.discount_code_id,
            discount_type: discountValidation.discount_type,
            final_amount: discountValidation.final_amount
          };
          console.log('✅ Centralized discount validation successful:', discountValidation);
        } else {
          console.warn('⚠️ Centralized discount validation failed:', discountValidation.error);
          // Don't fail checkout, but log the issue
          backendDiscountAmount = 0;
        }
      } catch (discountError) {
        console.error('❌ Discount validation service error:', discountError);
        // Fallback: validate discount directly from database
        const { data: discount, error: dbError } = await supabaseAdmin
          .from('discount_codes')
          .select('*')
          .eq('code', requestBody.discount.code.toUpperCase())
          .eq('is_active', true)
          .single();
          
        if (discount && !dbError) {
          if (discount.type === 'percentage') {
            backendDiscountAmount = backendSubtotal * (discount.value / 100);
          } else if (discount.type === 'fixed') {
            backendDiscountAmount = Math.min(discount.value, backendSubtotal);
          }
          console.log('✅ Fallback discount validation successful:', {
            backend_discount: backendDiscountAmount,
            discount_type: discount.type
          });
        } else {
          console.warn('⚠️ Both centralized and fallback discount validation failed');
          backendDiscountAmount = 0;
        }
      }
    }

    const backendTotalAmount = backendSubtotal - backendDiscountAmount;
    const backendFinalTotal = backendTotalAmount + deliveryFee;

    // ✅ Validate client calculation matches backend (allow small rounding differences)
    const amountDifference = Math.abs(backendFinalTotal - (requestBody.cart_totals?.final_total || 0));
    if (amountDifference > 0.01 && requestBody.cart_totals?.final_total) {
      console.warn('⚠️ Amount mismatch detected - using secure backend calculation:', {
        client_final: requestBody.cart_totals.final_total,
        backend_final: backendFinalTotal,
        difference: amountDifference
      });
      
      // Use backend calculation for security
      finalAmount = backendFinalTotal;
      discountApplied = backendDiscountAmount;
    } else {
      // Client calculation is accurate, use it
      finalAmount = requestBody.cart_totals?.final_total || backendFinalTotal;
      discountApplied = backendDiscountAmount; // Always use backend-validated discount
    }

    // Update the order with final amounts and track discount usage
    if (requestBody.discount?.code && discountApplied > 0 && validatedDiscountDetails) {
      const { error: discountUpdateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          total_amount: finalAmount,
          discount_amount: discountApplied,
          discount_code: requestBody.discount.code.toUpperCase(),
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
      
      if (discountUpdateError) {
        console.error('⚠️ Failed to update order with discount:', discountUpdateError);
      } else {
        console.log('✅ Order updated with validated amounts. Final amount:', finalAmount);
        order.total_amount = finalAmount;
        
        // ✅ Track discount usage for compliance and analytics
        try {
          const { error: usageError } = await supabaseAdmin
            .from('discount_code_usage')
            .insert({
              discount_code_id: validatedDiscountDetails.discount_code_id,
              order_id: orderId,
              customer_email: customerEmail,
              discount_amount: discountApplied,
              original_amount: backendSubtotal,
              final_amount: finalAmount,
              used_at: new Date().toISOString()
            });
            
          if (usageError) {
            console.error('⚠️ Failed to track discount usage:', usageError);
          } else {
            console.log('✅ Discount usage tracked successfully');
          }
        } catch (usageTrackingError) {
          console.error('⚠️ Discount usage tracking error:', usageTrackingError);
          // Don't fail checkout for tracking errors
        }
      }
    } else if (discountApplied > 0) {
      // Update order without discount tracking if validation failed
      const { error: updateError } = await supabaseAdmin
        .from('orders')
        .update({ 
          total_amount: finalAmount,
          updated_at: new Date().toISOString()
        })
        .eq('id', orderId);
        
      if (!updateError) {
        order.total_amount = finalAmount;
      }
    }

    console.log('✅ Final amount for Paystack:', {
      amount: finalAmount,
      kobo: Math.round(finalAmount * 100)
    });

    console.log("💰 Order details:", order);

    // ✅ Build payment callback URL
    const callbackUrl = `${SUPABASE_URL}/functions/v1/payment-callback?order_id=${order.id}`;
    console.log("🔗 Payment callback URL:", callbackUrl);

    // ✅ Initialize payment with service role for internal authorization
    console.log("💳 Initializing payment via paystack-secure...");
    console.log("💰 Payment amount details:", {
      original_total: order.total_amount,
      delivery_fee: deliveryFee,
      discount_applied: discountApplied,
      final_amount: finalAmount
    });
    
    // Debug environment variables
    const hasServiceRole = !!SUPABASE_SERVICE_ROLE_KEY
    const serviceRolePrefix = SUPABASE_SERVICE_ROLE_KEY ? SUPABASE_SERVICE_ROLE_KEY.substring(0, 20) + '...' : 'none'
    console.log("🔐 Service role debug:", { hasServiceRole, serviceRolePrefix })
    
    const { data: paymentData, error: paymentError } = await supabaseAdmin.functions.invoke("paystack-secure", {
      headers: {
        Authorization: `Bearer ${SUPABASE_SERVICE_ROLE_KEY}`,
        "x-internal-caller": "process-checkout"
      },
      body: {
        action: "initialize",
        email: order.customer_email,
        amount: finalAmount, // Use final discounted amount
        metadata: {
          order_id: order.id,
          customer_name: requestBody.customer.name,
          order_number: order.order_number,
          fulfillment_type: requestBody.fulfillment.type,
          items_subtotal: requestBody.cart_totals?.subtotal || (finalAmount - deliveryFee),
          delivery_fee: deliveryFee,
          discount_amount: discountApplied,
          discount_code: requestBody.discount?.code || null,
          client_total: finalAmount,
          authoritative_total: finalAmount,
        },
        callback_url: callbackUrl,
      },
    });

    if (paymentError) {
      console.error("❌ Payment initialization failed:", paymentError);
      console.error("❌ Full payment error details:", JSON.stringify(paymentError, null, 2));
      console.error("❌ Error context:", paymentError.context ? JSON.stringify(paymentError.context, null, 2) : 'no context');
      
      // Provide more specific error based on the type
      let userFriendlyError = 'Payment initialization failed'
      if (paymentError.message?.includes('401') || paymentError.message?.includes('Unauthorized')) {
        userFriendlyError = 'Payment system configuration issue - please contact support'
      } else if (paymentError.message?.includes('503') || paymentError.message?.includes('configuration')) {
        userFriendlyError = 'Payment service temporarily unavailable - please try again'
      }
      
      throw new Error(`${userFriendlyError}: ${paymentError.message || 'Unknown error'}`);
    }

    console.log("🔍 Raw paymentData:", paymentData);

    // ✅ Extract payment info safely
    const paymentReference = paymentData?.data?.reference || paymentData?.reference;
    const authorizationUrl = paymentData?.data?.authorization_url || paymentData?.authorization_url;

    console.log("✅ Payment initialized successfully");
    console.log("💳 Payment reference:", paymentReference);
    console.log("🌐 Authorization URL:", authorizationUrl);

    // ✅ Success response
    return new Response(
      JSON.stringify({
        success: true,
        order: {
          id: order.id,
          order_number: order.order_number,
          total_amount: order.total_amount,
          status: "pending",
        },
        customer: {
          id: customerId,
          email: order.customer_email,
        },
        payment: {
          authorization_url: authorizationUrl,
          reference: paymentReference,
        },
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.error("❌ Checkout processing error:", error);
    console.error("❌ Enhanced error context:", {
      errorName: error?.name || 'UnknownError',
      errorMessage: error?.message || 'No error message',
      errorStack: error?.stack || 'No stack trace',
      errorCause: error?.cause || 'No cause',
      errorCode: error?.code || 'NO_CODE',
      requestHeaders: Object.fromEntries(req.headers.entries()),
      requestMethod: req.method,
      requestUrl: req.url,
      authHeaderPresent: !!req.headers.get("Authorization"),
      guestSessionPresent: !!req.headers.get("x-guest-session-id"),
      timestamp: new Date().toISOString()
    });
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Checkout processing failed",
        code: error?.code || 'CHECKOUT_PROCESSING_ERROR',
        details: {
          timestamp: new Date().toISOString(),
          error_type: error.constructor.name,
          suggestion: error?.message?.includes('JWT') || error?.message?.includes('auth') 
            ? 'Please refresh your session and try again'
            : 'Please check your order details and try again'
        },
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
