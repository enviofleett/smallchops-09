import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface ReconciliationResult {
  order_id: string;
  order_number: string;
  reference: string;
  status: 'success' | 'failed' | 'pending' | 'not_found';
  message: string;
  payment_amount?: number;
  order_amount?: number;
}

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

    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('PAYSTACK_SECRET_KEY not configured');
    }

    const body = await req.json();
    const { action, order_ids, reference } = body;

    console.log('🚨 Emergency reconciliation started:', { action, order_ids, reference });

    if (action === 'reconcile_pending_orders') {
      // Get all pending orders from last 48 hours
      const { data: pendingOrders, error: ordersError } = await supabaseAdmin
        .from('orders')
        .select('id, order_number, payment_reference, total_amount, customer_email, created_at')
        .eq('payment_status', 'pending')
        .gte('created_at', new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (ordersError) {
        throw new Error(`Failed to fetch pending orders: ${ordersError.message}`);
      }

      console.log(`📋 Found ${pendingOrders?.length || 0} pending orders to reconcile`);

      const results: ReconciliationResult[] = [];

      for (const order of pendingOrders || []) {
        if (!order.payment_reference) {
          results.push({
            order_id: order.id,
            order_number: order.order_number,
            reference: 'N/A',
            status: 'failed',
            message: 'No payment reference found'
          });
          continue;
        }

        try {
          console.log(`🔍 Verifying payment for order ${order.order_number}: ${order.payment_reference}`);

          // Verify with Paystack
          const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${order.payment_reference}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${paystackSecretKey}`,
              'Content-Type': 'application/json',
            }
          });

          if (!verifyResponse.ok) {
            results.push({
              order_id: order.id,
              order_number: order.order_number,
              reference: order.payment_reference,
              status: 'failed',
              message: `Paystack API error: ${verifyResponse.status}`
            });
            continue;
          }

          const verificationData = await verifyResponse.json();

          if (!verificationData.status) {
            results.push({
              order_id: order.id,
              order_number: order.order_number,
              reference: order.payment_reference,
              status: 'not_found',
              message: verificationData.message || 'Payment not found on Paystack'
            });
            continue;
          }

          const paymentData = verificationData.data;

          if (paymentData.status === 'success') {
            console.log(`💰 Payment successful for ${order.order_number}, updating records`);

            // Create payment transaction record if it doesn't exist
            const { data: existingTransaction } = await supabaseAdmin
              .from('payment_transactions')
              .select('id')
              .eq('provider_reference', order.payment_reference)
              .single();

            if (!existingTransaction) {
              const { error: transactionError } = await supabaseAdmin
                .from('payment_transactions')
                .insert({
                  provider_reference: order.payment_reference,
                  order_id: order.id,
                  amount: paymentData.amount / 100,
                  currency: paymentData.currency || 'NGN',
                  status: 'success',
                  paid_at: paymentData.paid_at,
                  provider_response: paymentData,
                  created_at: new Date().toISOString()
                });

              if (transactionError) {
                console.error(`❌ Failed to create transaction for ${order.order_number}:`, transactionError);
              }
            }

            // Update order status
            const { error: updateError } = await supabaseAdmin
              .from('orders')
              .update({
                payment_status: 'paid',
                status: 'confirmed',
                paid_at: paymentData.paid_at,
                updated_at: new Date().toISOString()
              })
              .eq('id', order.id);

            if (updateError) {
              results.push({
                order_id: order.id,
                order_number: order.order_number,
                reference: order.payment_reference,
                status: 'failed',
                message: `Database update failed: ${updateError.message}`,
                payment_amount: paymentData.amount / 100,
                order_amount: order.total_amount
              });
            } else {
              results.push({
                order_id: order.id,
                order_number: order.order_number,
                reference: order.payment_reference,
                status: 'success',
                message: 'Order successfully reconciled and updated',
                payment_amount: paymentData.amount / 100,
                order_amount: order.total_amount
              });
            }
          } else {
            results.push({
              order_id: order.id,
              order_number: order.order_number,
              reference: order.payment_reference,
              status: 'pending',
              message: `Payment status: ${paymentData.status}`,
              payment_amount: paymentData.amount / 100,
              order_amount: order.total_amount
            });
          }

          // Small delay to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));

        } catch (error: any) {
          console.error(`❌ Error processing order ${order.order_number}:`, error);
          results.push({
            order_id: order.id,
            order_number: order.order_number,
            reference: order.payment_reference,
            status: 'failed',
            message: error.message || 'Unknown error'
          });
        }
      }

      // Log summary
      const summary = {
        total_processed: results.length,
        successful: results.filter(r => r.status === 'success').length,
        failed: results.filter(r => r.status === 'failed').length,
        pending: results.filter(r => r.status === 'pending').length,
        not_found: results.filter(r => r.status === 'not_found').length
      };

      console.log('📊 Reconciliation summary:', summary);

      // Create audit log
      await supabaseAdmin.from('audit_logs').insert({
        action: 'emergency_payment_reconciliation',
        category: 'Payment Processing',
        message: `Emergency reconciliation completed: ${summary.successful} successful, ${summary.failed} failed`,
        new_values: { summary, results }
      });

      return new Response(JSON.stringify({
        success: true,
        summary,
        results
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (action === 'verify_single_payment' && reference) {
      console.log(`🔍 Verifying single payment: ${reference}`);

      const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        }
      });

      const verificationData = await verifyResponse.json();

      return new Response(JSON.stringify({
        success: verifyResponse.ok,
        paystack_response: verificationData
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('🚨 Emergency reconciliation error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Emergency reconciliation failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});