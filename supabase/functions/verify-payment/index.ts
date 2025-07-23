import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import Stripe from "https://esm.sh/stripe@14.21.0";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPaymentRequest {
  sessionId: string;
  orderId?: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[VERIFY-PAYMENT] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Payment verification started");

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      throw new Error("Stripe secret key not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { sessionId, orderId }: VerifyPaymentRequest = await req.json();

    if (!sessionId) {
      throw new Error("Session ID is required");
    }

    logStep("Verifying payment session", { sessionId, orderId });

    // Initialize Stripe
    const stripe = new Stripe(stripeKey, { apiVersion: "2023-10-16" });

    // Retrieve the checkout session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    logStep("Stripe session retrieved", { 
      status: session.payment_status, 
      amount: session.amount_total,
      orderId: session.metadata?.order_id 
    });

    const orderIdToUpdate = orderId || session.metadata?.order_id;
    if (!orderIdToUpdate) {
      throw new Error("Order ID not found in request or session metadata");
    }

    // Update order based on payment status
    let updateData: any = {
      payment_reference: sessionId,
      updated_at: new Date().toISOString()
    };

    if (session.payment_status === 'paid') {
      updateData.payment_status = 'paid';
      updateData.status = 'confirmed'; // Move order to confirmed status
      logStep("Payment confirmed, updating order status");
    } else if (session.payment_status === 'unpaid') {
      updateData.payment_status = 'failed';
      logStep("Payment failed, updating order status");
    }

    // Update the order
    const { data: updatedOrder, error: updateError } = await supabaseClient
      .from('orders')
      .update(updateData)
      .eq('id', orderIdToUpdate)
      .select()
      .single();

    if (updateError) {
      throw new Error(`Failed to update order: ${updateError.message}`);
    }

    logStep("Order updated successfully", { 
      orderNumber: updatedOrder.order_number,
      paymentStatus: updatedOrder.payment_status,
      orderStatus: updatedOrder.status 
    });

    // Send confirmation email if payment was successful
    if (session.payment_status === 'paid') {
      try {
        const emailResponse = await fetch(`${Deno.env.get("SUPABASE_URL")}/functions/v1/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
          },
          body: JSON.stringify({
            to: updatedOrder.customer_email,
            toName: updatedOrder.customer_name,
            subject: `Order Confirmation - #${updatedOrder.order_number}`,
            template: 'order_confirmation',
            variables: {
              customerName: updatedOrder.customer_name,
              orderNumber: updatedOrder.order_number,
              totalAmount: (session.amount_total! / 100).toFixed(2),
              orderType: updatedOrder.order_type,
              deliveryAddress: updatedOrder.delivery_address
            }
          })
        });

        if (emailResponse.ok) {
          logStep("Confirmation email sent successfully");
        } else {
          console.error("Failed to send confirmation email:", await emailResponse.text());
        }
      } catch (emailError) {
        console.error("Error sending confirmation email:", emailError);
      }
    }

    // Log payment verification
    try {
      await supabaseClient.from('audit_logs').insert({
        user_id: null,
        action: 'PAYMENT_VERIFIED',
        category: 'Payment',
        entity_type: 'order',
        entity_id: orderIdToUpdate,
        message: `Payment ${session.payment_status} for order #${updatedOrder.order_number}`,
        new_values: { 
          sessionId,
          paymentStatus: session.payment_status,
          amount: session.amount_total ? session.amount_total / 100 : 0,
          orderStatus: updatedOrder.status
        }
      });
    } catch (logError) {
      console.error("Failed to log payment verification:", logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        paymentStatus: session.payment_status,
        orderStatus: updatedOrder.status,
        orderNumber: updatedOrder.order_number,
        amount: session.amount_total ? session.amount_total / 100 : 0,
        customerEmail: updatedOrder.customer_email
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in verify-payment", { message: errorMessage });
    
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