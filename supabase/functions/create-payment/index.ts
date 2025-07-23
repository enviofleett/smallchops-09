import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentRequest {
  orderId: string;
  amount: number; // in cents
  currency?: string;
  customerEmail?: string;
  customerName?: string;
  description?: string;
  metadata?: Record<string, string>;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[CREATE-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Payment function started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { 
      orderId, 
      amount, 
      currency = 'usd', 
      customerEmail, 
      customerName, 
      description,
      metadata = {}
    }: PaymentRequest = await req.json();

    if (!orderId || !amount) {
      throw new Error("Missing required fields: orderId and amount");
    }

    logStep("Processing payment request", { orderId, amount, currency, customerEmail });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Get order details from database
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      throw new Error(`Order not found: ${orderError?.message || 'Invalid order ID'}`);
    }

    logStep("Order retrieved", { orderNumber: order.order_number, totalAmount: order.total_amount });

    // Check if customer exists in Stripe
    let customerId = null;
    if (customerEmail) {
      const existingCustomers = await stripe.customers.list({
        email: customerEmail,
        limit: 1
      });

      if (existingCustomers.data.length > 0) {
        customerId = existingCustomers.data[0].id;
        logStep("Existing Stripe customer found", { customerId });
      } else {
        // Create new Stripe customer
        const customer = await stripe.customers.create({
          email: customerEmail,
          name: customerName || order.customer_name,
          metadata: {
            order_id: orderId,
            order_number: order.order_number
          }
        });
        customerId = customer.id;
        logStep("New Stripe customer created", { customerId });
      }
    }

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      customer: customerId || undefined,
      customer_email: customerId ? undefined : customerEmail,
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: description || `Order #${order.order_number}`,
              description: `Restaurant order from ${order.customer_name}`,
              metadata: {
                order_id: orderId,
                order_number: order.order_number
              }
            },
            unit_amount: amount,
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      success_url: `${req.headers.get("origin")}/payment-success?session_id={CHECKOUT_SESSION_ID}&order_id=${orderId}`,
      cancel_url: `${req.headers.get("origin")}/payment-cancelled?order_id=${orderId}`,
      metadata: {
        order_id: orderId,
        order_number: order.order_number,
        ...metadata
      }
    });

    logStep("Stripe checkout session created", { sessionId: session.id, url: session.url });

    // Update order with payment session info
    const { error: updateError } = await supabaseClient
      .from('orders')
      .update({
        payment_reference: session.id,
        payment_method: 'stripe',
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) {
      console.error("Failed to update order with payment reference:", updateError);
    } else {
      logStep("Order updated with payment reference");
    }

    // Log payment activity
    try {
      await supabaseClient.from('audit_logs').insert({
        user_id: null,
        action: 'PAYMENT_INITIATED',
        category: 'Payment',
        entity_type: 'order',
        entity_id: orderId,
        message: `Payment session created for order #${order.order_number}`,
        new_values: { 
          sessionId: session.id, 
          amount: amount / 100, 
          currency,
          customerEmail 
        }
      });
      logStep("Payment activity logged");
    } catch (logError) {
      console.error("Failed to log payment activity:", logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        sessionId: session.id,
        url: session.url,
        orderId,
        amount: amount / 100
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in create-payment", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});