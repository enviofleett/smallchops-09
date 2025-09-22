// supabase/functions/process-checkout/index.ts

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Supabase client
const supabaseAdmin = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

serve(async (req: Request) => {
  try {
    // Parse request body
    const body = await req.json();
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
        { status: 400 }
      );
    }

    if (!["pickup", "delivery"].includes(fulfillment_type)) {
      return new Response(
        JSON.stringify({ error: "Invalid fulfillment type" }),
        { status: 400 }
      );
    }

    if (!items || items.length === 0) {
      return new Response(
        JSON.stringify({ error: "At least one item is required" }),
        { status: 400 }
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
          { status: 400 }
        );
      }
    }

    // --- Step 3: Call DB function to create order ---
    const { data: orderResult, error: orderError } = await supabaseAdmin.rpc(
      "create_order_with_items",
      {
        p_customer_email: customer_email,
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
        { status: 500 }
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
        { status: 500 }
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
      { status: 200 }
    );
  } catch (err) {
    console.error("❌ Checkout processing error:", err);

    return new Response(
      JSON.stringify({
        error: "Checkout failed",
        details: err.message || err.toString(),
      }),
      { status: 500 }
    );
  }
});