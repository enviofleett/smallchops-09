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
        p_fulfillment_type: fulfillment_type, // ⚠️ requires enum or text in DB
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

      // Special handling for missing enum type
      if (orderError.message?.includes('type "fulfillment_type" does not exist')) {
        return new Response(
          JSON.stringify({
            error:
              "Database schema error: missing enum type 'fulfillment_type'. Please create it or change function signature to use text.",
          }),
          { status: 500 }
        );
      }

      return new Response(
        JSON.stringify({ error: "Order creation failed", details: orderError }),
        { status: 500 }
      );
    }

    console.log("✅ Order successfully created:", orderResult);

    // --- Step 4: Build response ---
    return new Response(
      JSON.stringify({
        success: true,
        order: orderResult,
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