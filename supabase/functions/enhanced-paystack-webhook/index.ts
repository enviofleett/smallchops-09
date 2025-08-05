import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const body = await req.json();
    const event = body.event;
    const data = body.data;

    console.log('Webhook received:', event, 'for reference:', data.reference);

    if (event === 'charge.success') {
      // Get payment transaction
      const { data: transaction, error: transactionError } = await supabaseAdmin
        .from('payment_transactions')
        .select('*, orders(*)')
        .eq('provider_reference', data.reference)
        .single();

      if (transactionError || !transaction) {
        console.error('Transaction not found:', data.reference);
        return new Response('Transaction not found', { status: 404, headers: corsHeaders });
      }

      // Update payment status
      await supabaseAdmin
        .from('payment_transactions')
        .update({ 
          status: 'success',
          paid_at: new Date().toISOString(),
          provider_response: data
        })
        .eq('id', transaction.id);

      // Update order status
      await supabaseAdmin
        .from('orders')
        .update({ 
          payment_status: 'paid',
          status: 'processing'
        })
        .eq('id', transaction.order_id);

      // Send order confirmation email
      const order = transaction.orders;
      if (order) {
        try {
          await supabaseAdmin.functions.invoke('smtp-email-sender', {
            body: {
              to: order.customer_email,
              subject: `Payment Confirmed - Order ${order.order_number}`,
              html: `
                <h1>Payment Confirmed!</h1>
                <p>Hello ${order.customer_name},</p>
                <p>Your payment for order <strong>${order.order_number}</strong> has been successfully processed.</p>
                <div style="background: #e8f5e8; padding: 15px; margin: 20px 0; border-radius: 5px; border: 1px solid #4caf50;">
                  <h3>✅ Payment Details:</h3>
                  <p><strong>Amount Paid:</strong> ₦${(data.amount / 100).toLocaleString()}</p>
                  <p><strong>Transaction Reference:</strong> ${data.reference}</p>
                  <p><strong>Payment Method:</strong> ${data.channel}</p>
                </div>
                <div style="background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 5px;">
                  <h3>Order Details:</h3>
                  <p><strong>Order Number:</strong> ${order.order_number}</p>
                  <p><strong>Total Amount:</strong> ₦${order.total_amount.toLocaleString()}</p>
                  <p><strong>Fulfillment:</strong> ${order.order_type === 'delivery' ? 'Home Delivery' : 'Store Pickup'}</p>
                  <p><strong>Status:</strong> Processing</p>
                </div>
                <p>Your order is now being processed. We will send you updates as it progresses.</p>
                <p>Thank you for your purchase!</p>
              `,
              text: `Payment Confirmed - Order ${order.order_number}\n\nYour payment of ₦${(data.amount / 100).toLocaleString()} has been confirmed. Transaction reference: ${data.reference}`
            }
          });
          console.log('Payment confirmation email sent to:', order.customer_email);
        } catch (emailError) {
          console.error('Failed to send payment confirmation email:', emailError);
        }

        // Send admin notification
        try {
          await supabaseAdmin.functions.invoke('smtp-email-sender', {
            body: {
              to: 'admin@your-store.com',
              subject: `New Order Received - ${order.order_number}`,
              html: `
                <h1>New Order Alert!</h1>
                <p>A new order has been received and payment confirmed.</p>
                <div style="background: #f0f8ff; padding: 15px; margin: 20px 0; border-radius: 5px; border: 1px solid #007bff;">
                  <h3>Order Information:</h3>
                  <p><strong>Order Number:</strong> ${order.order_number}</p>
                  <p><strong>Customer:</strong> ${order.customer_name} (${order.customer_email})</p>
                  <p><strong>Amount:</strong> ₦${order.total_amount.toLocaleString()}</p>
                  <p><strong>Payment Reference:</strong> ${data.reference}</p>
                  <p><strong>Fulfillment Type:</strong> ${order.order_type}</p>
                </div>
                <p>Please process this order promptly.</p>
              `,
              text: `New Order: ${order.order_number} from ${order.customer_name} for ₦${order.total_amount.toLocaleString()}`
            }
          });
          console.log('Admin notification sent for order:', order.order_number);
        } catch (adminEmailError) {
          console.error('Failed to send admin notification:', adminEmailError);
        }
      }

      console.log('Payment webhook processed successfully');
      return new Response('OK', { status: 200, headers: corsHeaders });
    }

    return new Response('Event not handled', { status: 200, headers: corsHeaders });

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response('Error processing webhook', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});