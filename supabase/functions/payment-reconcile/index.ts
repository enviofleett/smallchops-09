import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Health metrics calculation
async function getHealthMetrics(supabase: any) {
  try {
    console.log('📊 Calculating payment health metrics...');
    
    // Get webhook metrics for the last 24 hours
    const { data: webhookData, error: webhookError } = await supabase
      .from('webhook_events')
      .select('processed, processing_result, received_at')
      .gte('received_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (webhookError) {
      console.error('Error fetching webhook data:', webhookError);
    }

    const totalWebhooks = webhookData?.length || 0;
    const successfulWebhooks = webhookData?.filter(w => w.processed && w.processing_result?.success)?.length || 0;
    const webhookSuccessRate = totalWebhooks > 0 ? (successfulWebhooks / totalWebhooks) * 100 : 100;

    // Get payment metrics for the last 24 hours
    const { data: paymentData, error: paymentError } = await supabase
      .from('payment_transactions')
      .select('status, created_at, updated_at')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

    if (paymentError) {
      console.error('Error fetching payment data:', paymentError);
    }

    const totalPayments = paymentData?.length || 0;
    const successfulPayments = paymentData?.filter(p => p.status === 'paid' || p.status === 'success')?.length || 0;
    const paymentSuccessRate = totalPayments > 0 ? (successfulPayments / totalPayments) * 100 : 100;

    // Calculate average verification time
    const verificationTimes = paymentData
      ?.filter(p => p.updated_at && p.created_at)
      ?.map(p => new Date(p.updated_at).getTime() - new Date(p.created_at).getTime())
      ?.filter(t => t > 0 && t < 300000) || []; // Filter unrealistic times

    const avgVerificationTime = verificationTimes.length > 0 
      ? verificationTimes.reduce((a, b) => a + b, 0) / verificationTimes.length 
      : 0;

    // Count stuck orders
    const { data: stuckOrders, error: stuckError } = await supabase
      .from('orders')
      .select('id')
      .eq('status', 'pending')
      .eq('payment_status', 'pending')
      .lt('created_at', new Date(Date.now() - 10 * 60 * 1000).toISOString()); // Older than 10 minutes

    if (stuckError) {
      console.error('Error fetching stuck orders:', stuckError);
    }

    const stuckOrdersCount = stuckOrders?.length || 0;

    // Get last webhook received time
    const { data: lastWebhook } = await supabase
      .from('webhook_events')
      .select('received_at')
      .order('received_at', { ascending: false })
      .limit(1);

    const metrics = {
      webhook_success_rate: webhookSuccessRate,
      total_webhooks_24h: totalWebhooks,
      failed_webhooks_24h: totalWebhooks - successfulWebhooks,
      payment_success_rate: paymentSuccessRate,
      total_payments_24h: totalPayments,
      stuck_orders_count: stuckOrdersCount,
      last_webhook_received: lastWebhook?.[0]?.received_at || null,
      avg_verification_time_ms: Math.round(avgVerificationTime)
    };

    console.log('📊 Health metrics calculated:', metrics);
    return metrics;
  } catch (error) {
    console.error('Error calculating health metrics:', error);
    throw error;
  }
}

// Auto-recovery function for stuck orders
async function autoRecoverStuckOrders(supabase: any) {
  try {
    console.log('🔧 Starting auto-recovery for stuck orders...');
    
    // Find orders that are stuck in pending but have successful payments
    const { data: stuckOrders, error: stuckError } = await supabase
      .from('orders')
      .select(`
        id, order_number, customer_email, total_amount, created_at,
        payment_transactions!inner(
          provider_reference, status, paid_at
        )
      `)
      .eq('status', 'pending')
      .eq('payment_status', 'pending')
      .eq('payment_transactions.status', 'paid')
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString());

    if (stuckError) {
      console.error('Error finding stuck orders:', stuckError);
      return { recovered_count: 0, errors: [stuckError.message] };
    }

    if (!stuckOrders || stuckOrders.length === 0) {
      console.log('✅ No stuck orders found for recovery');
      return { recovered_count: 0, errors: [] };
    }

    console.log(`🔧 Found ${stuckOrders.length} stuck orders to recover`);
    
    let recoveredCount = 0;
    const errors: string[] = [];

    for (const order of stuckOrders) {
      try {
        const { error: updateError } = await supabase
          .from('orders')
          .update({
            status: 'confirmed',
            payment_status: 'paid',
            paid_at: order.payment_transactions[0]?.paid_at || new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('id', order.id);

        if (updateError) {
          console.error(`Failed to recover order ${order.order_number}:`, updateError);
          errors.push(`Order ${order.order_number}: ${updateError.message}`);
        } else {
          console.log(`✅ Recovered order ${order.order_number}`);
          recoveredCount++;
          
          // Log the recovery action
          await supabase.from('audit_logs').insert({
            action: 'auto_recovery_order_confirmed',
            category: 'Payment Recovery',
            message: `Auto-recovered stuck order: ${order.order_number}`,
            new_values: {
              order_id: order.id,
              order_number: order.order_number,
              recovery_method: 'automated_reconciliation'
            }
          });
        }
      } catch (orderError) {
        console.error(`Exception recovering order ${order.order_number}:`, orderError);
        errors.push(`Order ${order.order_number}: ${orderError.message}`);
      }
    }

    console.log(`🔧 Auto-recovery completed: ${recoveredCount} orders recovered, ${errors.length} errors`);
    return { recovered_count: recoveredCount, errors };
    
  } catch (error) {
    console.error('Auto-recovery function failed:', error);
    throw error;
  }
}

// Scan for stuck orders without recovery
async function scanStuckOrders(supabase: any) {
  try {
    const { data: stuckOrders, error } = await supabase
      .from('orders')
      .select(`
        id, order_number, customer_email, total_amount, created_at, payment_reference,
        payment_transactions(provider_reference, status)
      `)
      .eq('status', 'pending')
      .eq('payment_status', 'pending')
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString())
      .limit(50);

    if (error) {
      console.error('Error scanning stuck orders:', error);
      return { stuck_orders: [] };
    }

    return { stuck_orders: stuckOrders || [] };
  } catch (error) {
    console.error('Error in scanStuckOrders:', error);
    throw error;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { action, ...requestData } = await req.json();

    // Route to different actions
    if (action === 'health_metrics') {
      const metrics = await getHealthMetrics(supabase);
      return new Response(JSON.stringify(metrics), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else if (action === 'auto_recover_stuck_orders') {
      const result = await autoRecoverStuckOrders(supabase);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else if (action === 'scan_stuck_orders') {
      const result = await scanStuckOrders(supabase);
      return new Response(JSON.stringify(result), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else if (action === 'scanPaymentIssues') {
      return await scanPaymentIssues(supabase);
    } else if (action === 'fixStuckOrder') {
      const orderId = requestData.orderId;
      if (!orderId) {
        return new Response(JSON.stringify({ error: 'Order ID is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return await fixStuckOrder(supabase, orderId);
    } else if (action === 'searchPaymentDetails') {
      const reference = requestData.reference;
      if (!reference) {
        return new Response(JSON.stringify({ error: 'Payment reference is required' }), {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      return await searchPaymentDetails(supabase, reference);
    } else {
      return new Response(JSON.stringify({ error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Payment reconciliation error:', error);
    return new Response(JSON.stringify({ error: 'Internal server error' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function scanPaymentIssues(supabase: any) {
  const issues = [];

  try {
    // Find orders stuck in pending status with successful payments
    const { data: stuckOrders } = await supabase
      .from('orders')
      .select(`
        id,
        order_number,
        payment_status,
        status,
        created_at,
        payment_reference
      `)
      .eq('payment_status', 'pending')
      .eq('status', 'pending')
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()); // older than 5 minutes

    for (const order of stuckOrders || []) {
      // Check if there's a successful payment for this order
      const { data: successfulPayment } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('order_id', order.id)
        .eq('status', 'paid')
        .maybeSingle();

      if (successfulPayment) {
        issues.push({
          id: `stuck_order_${order.id}`,
          type: 'stuck_order',
          order_id: order.id,
          reference: successfulPayment.provider_reference,
          description: `Order ${order.order_number} has successful payment but is stuck in pending status`,
          severity: 'high'
        });
      } else if (order.payment_reference) {
        // Check Paystack directly for this reference
        const paystackStatus = await checkPaystackStatus(order.payment_reference);
        if (paystackStatus === 'success') {
          issues.push({
            id: `missing_tx_${order.id}`,
            type: 'missing_transaction',
            order_id: order.id,
            reference: order.payment_reference,
            description: `Order ${order.order_number} successful on Paystack but missing transaction record`,
            severity: 'critical'
          });
        }
      }
    }

    // Find payment transactions without corresponding orders
    const { data: orphanedPayments } = await supabase
      .from('payment_transactions')
      .select('*')
      .is('order_id', null)
      .eq('status', 'paid');

    for (const payment of orphanedPayments || []) {
      issues.push({
        id: `orphaned_payment_${payment.id}`,
        type: 'payment_mismatch',
        reference: payment.provider_reference,
        description: `Successful payment ${payment.provider_reference} has no associated order`,
        severity: 'medium'
      });
    }

    return new Response(JSON.stringify({ 
      success: true, 
      issues,
      summary: {
        total: issues.length,
        critical: issues.filter(i => i.severity === 'critical').length,
        high: issues.filter(i => i.severity === 'high').length
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error scanning payment issues:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Failed to scan payment issues' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function fixStuckOrder(supabase: any, orderId: string) {
  try {
    // Find successful payment for this order
    const { data: payment } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('order_id', orderId)
      .eq('status', 'paid')
      .maybeSingle();

    if (!payment) {
      return new Response(JSON.stringify({ 
        success: false, 
        message: 'No successful payment found for this order' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Update order status to confirmed
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        paid_at: payment.paid_at || new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .eq('id', orderId);

    if (updateError) throw updateError;

    // Log the fix
    await supabase.from('audit_logs').insert({
      action: 'payment_reconciliation_fix',
      category: 'Payment',
      message: `Fixed stuck order ${orderId} - updated to confirmed status`,
      new_values: { order_id: orderId, payment_reference: payment.provider_reference }
    });

    return new Response(JSON.stringify({ 
      success: true, 
      message: 'Order status updated successfully' 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error fixing stuck order:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      message: 'Failed to fix order status' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function searchPaymentDetails(supabase: any, reference: string) {
  try {
    // Search in payment_transactions
    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select(`
        *,
        orders (
          id,
          order_number,
          status,
          payment_status,
          total_amount
        )
      `)
      .eq('provider_reference', reference)
      .maybeSingle();

    // Search in orders by payment_reference
    const { data: order } = await supabase
      .from('orders')
      .select('*')
      .eq('payment_reference', reference)
      .maybeSingle();

    const found = transaction || order;

    return new Response(JSON.stringify({ 
      found: !!found,
      transaction,
      order,
      paystack_status: await checkPaystackStatus(reference)
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Error searching payment details:', error);
    return new Response(JSON.stringify({ 
      found: false, 
      error: 'Search failed' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function checkPaystackStatus(reference: string): Promise<string | null> {
  try {
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secretKey) return null;

    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.ok) {
      const data = await response.json();
      return data.data?.status || null;
    }
    return null;
  } catch (error) {
    console.error('Error checking Paystack status:', error);
    return null;
  }
}