// supabase/functions/process-checkout/index.ts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightResponse } from '../_shared/cors.ts';

// Supabase client
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Hot fix: Function to get or create customer ID from email
async function getOrCreateCustomerId(email: string): Promise<string> {
  try {
    // First, try to find existing customer
    const { data: existingCustomer, error: findError } = await supabaseAdmin
      .from('customers')
      .select('id')
      .eq('email', email)
      .single()
    
    if (existingCustomer && !findError) {
      return existingCustomer.id
    }
    
    // If not found, create new customer
    const { data: newCustomer, error: createError } = await supabaseAdmin
      .from('customers')
      .insert({ email })
      .select('id')
      .single()
    
    if (createError) {
      console.error('Failed to create customer:', createError)
      throw new Error(`Failed to create customer: ${createError.message}`)
    }
    
    return newCustomer.id
    
  } catch (error) {
    console.error('Error in getOrCreateCustomerId:', error)
    throw error
  }
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightResponse(origin);
  }

  try {
    // Hot fix: Add comprehensive request validation
    if (req.method !== 'POST') {
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { 
          status: 405,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        }
      );
    }

    // Hot fix: Check content-type header
    const contentType = req.headers.get('content-type');
    if (!contentType?.includes('application/json')) {
      return new Response(
        JSON.stringify({ error: 'Content-Type must be application/json' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        }
      );
    }

    // Hot fix: Safe JSON parsing with multiple fallbacks
    let body;
    try {
      const rawBody = await req.text(); // Get as text first
      
      // Check if body is empty
      if (!rawBody || rawBody.trim() === '') {
        return new Response(
          JSON.stringify({ error: 'Request body cannot be empty' }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
          }
        );
      }

      // Try to parse JSON
      body = JSON.parse(rawBody);
      
    } catch (parseError) {
      console.error('❌ JSON parse error:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON in request body',
          details: parseError.message 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        }
      );
    }

    // Hot fix: Validate required fields
    if (!body || typeof body !== 'object') {
      return new Response(
        JSON.stringify({ error: 'Request body must be a valid JSON object' }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        }
      );
    }
    const {
      customer_email,
      fulfillment_type,
      items,
      delivery_address,
      pickup_point_id,
      delivery_zone_id,
      guest_session_id,
      promotion_code,
      client_total
    } = body;

    console.log("📦 Checkout request received:", body);

    // --- Step 1: Validate inputs ---
    if (!customer_email) {
      return new Response(
        JSON.stringify({ error: "Customer email is required" }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        }
      );
    }

    if (!["pickup", "delivery"].includes(fulfillment_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid fulfillment type" }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        }
      );
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one item is required" }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        }
      );
    }

    // --- Step 2: Validate promotion code (if provided) ---
    if (promotion_code) {
      const { data: promo, error: promoError } = await supabaseAdmin
        .from("promotions")
        .select("*")
        .eq("code", promotion_code)
        .single();

      if (promoError || !promo || promo.expired) {
        console.error("❌ Invalid or expired promotion:", promoError);
        return new Response(
          JSON.stringify({ error: "Invalid promotion code or promotion has expired." }),
          { 
            status: 400,
            headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
          }
        );
      }
    }

    // --- Step 3: Convert email to customer_id and create order ---
    console.log("🔍 Converting email to customer_id:", customer_email);
    const customer_id = await getOrCreateCustomerId(customer_email);
    console.log("✅ Customer ID obtained:", customer_id);

    const { data: orderResult, error: orderError } = await supabaseAdmin.rpc(
      "create_order_with_items",
      {
        p_customer_id: customer_id, // ✅ Changed from p_customer_email
        p_fulfillment_type: fulfillment_type,
        p_items: items,
        p_delivery_address: delivery_address || null,
        p_pickup_point_id: pickup_point_id || null,
        p_delivery_zone_id: delivery_zone_id || null,
        p_guest_session_id: guest_session_id || null,
        p_promotion_code: promotion_code || null,
        p_client_total: client_total || null,
      }
    );

    if (orderError) {
      console.error("❌ Database function error (full):", JSON.stringify(orderError, null, 2));
      return new Response(
        JSON.stringify({ error: "Order creation failed", details: orderError }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        }
      );
    }

    console.log("✅ Order successfully created:", orderResult);

    // --- Step 4: Initialize Paystack payment ---
    const orderId = orderResult?.id || orderResult?.order_id;
    const paymentReference = `txn_${orderId}_${Date.now()}`;
    
    console.log("💰 Initializing Paystack payment:", { orderId, paymentReference, amount: client_total });

    const paystackPayload = {
      email: customer_email,
      amount: client_total * 100, // Paystack expects kobo
      reference: paymentReference,
      callback_url: `${Deno.env.get("SUPABASE_URL")}/functions/v1/payment-webhook`,
      metadata: {
        order_id: orderId,
        custom_fields: [
          {
            display_name: "Order ID",
            variable_name: "order_id",
            value: orderId
          }
        ]
      }
    };

    const paystackResponse = await fetch("https://api.paystack.co/transaction/initialize", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${Deno.env.get("PAYSTACK_SECRET_KEY")}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(paystackPayload),
    });

    const paystackData = await paystackResponse.json();

    if (!paystackResponse.ok || !paystackData.status) {
      console.error("❌ Paystack initialization failed:", paystackData);
      return new Response(
        JSON.stringify({ 
          error: "Payment initialization failed", 
          details: paystackData.message || "Unknown error" 
        }),
        { 
          status: 500,
          headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
        }
      );
    }

    console.log("✅ Paystack payment initialized successfully:", paystackData.data);

    // --- Step 5: Update order with payment reference ---
    const { error: updateError } = await supabaseAdmin
      .from("orders")
      .update({ 
        payment_reference: paymentReference,
        payment_status: 'pending'
      })
      .eq("id", orderId);

    if (updateError) {
      console.warn("⚠️ Failed to update order with payment reference:", updateError);
    }

    // --- Step 6: Build response ---
    return new Response(
      JSON.stringify({
        success: true,
        order: orderResult,
        payment: {
          reference: paymentReference,
          authorization_url: paystackData.data.authorization_url,
          access_code: paystackData.data.access_code,
          payment_url: paystackData.data.authorization_url
        }
      }),
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      }
    );
  } catch (err) {
    console.error("❌ Checkout processing error:", err);

    return new Response(
      JSON.stringify({
        error: "Checkout failed",
        details: err.message || err.toString(),
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...getCorsHeaders(origin) }
      }
    );
  }
});