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
      const { error: txnUpdateError } = await supabaseAdmin
        .from('payment_transactions')
        .update({ 
          status: 'success',
          paid_at: new Date().toISOString(),
          gateway_response: data
        })
        .eq('id', transaction.id);

      if (txnUpdateError) {
        console.error('Failed to update payment transaction:', txnUpdateError);
      }

      // Update order status
      const orderUpdatePayload: Record<string, any> = {
        payment_status: 'paid',
        status: 'confirmed',
        paid_at: new Date().toISOString(),
        payment_verified_at: new Date().toISOString()
      };

      const { error: orderUpdateError } = await supabaseAdmin
        .from('orders')
        .update(orderUpdatePayload)
        .eq('id', transaction.order_id);

      if (orderUpdateError) {
        console.warn('Order update (with payment_verified_at) failed, retrying without it:', orderUpdateError);
        const { error: orderFallbackError } = await supabaseAdmin
          .from('orders')
          .update({ 
            payment_status: 'paid',
            status: 'confirmed',
            paid_at: new Date().toISOString()
          })
          .eq('id', transaction.order_id);
        if (orderFallbackError) {
          console.error('Order update failed:', orderFallbackError);
        }
      }

      // Send payment confirmation email using templates
      const order = transaction.orders;
      if (order) {
        try {
          await supabaseAdmin.functions.invoke('production-smtp-sender', {
            body: {
              to: order.customer_email,
              template_key: 'payment_confirmation',
              variables: {
                customer_name: order.customer_name,
                customer_email: order.customer_email,
                order_number: order.order_number,
                order_total: `₦${order.total_amount.toLocaleString()}`,
                payment_reference: data.reference,
                order_date: new Date().toLocaleDateString(),
                store_name: 'Your Store',
                store_url: 'https://your-store.com',
                support_email: 'support@your-store.com',
                payment_amount: `₦${(data.amount / 100).toLocaleString()}`,
                payment_method: data.channel
              },
              priority: 'high'
            }
          });
          console.log('Payment confirmation email sent via template to:', order.customer_email);
        } catch (emailError) {
          console.error('Failed to send payment confirmation email:', emailError);
        }

        // Send admin notification using templates
        try {
          await supabaseAdmin.functions.invoke('production-smtp-sender', {
            body: {
              to: 'admin@your-store.com',
              template_key: 'admin_new_order',
              variables: {
                customer_name: order.customer_name,
                customer_email: order.customer_email,
                order_number: order.order_number,
                order_total: `₦${order.total_amount.toLocaleString()}`,
                payment_reference: data.reference,
                order_date: new Date().toLocaleDateString(),
                store_name: 'Your Store',
                store_url: 'https://your-store.com',
                support_email: 'support@your-store.com',
                fulfillment_type: order.order_type,
                payment_amount: `₦${(data.amount / 100).toLocaleString()}`,
                payment_method: data.channel
              },
              priority: 'high'
            }
          });
          console.log('Admin notification sent via template for order:', order.order_number);
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