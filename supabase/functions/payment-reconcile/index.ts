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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { action, ...requestData } = await req.json();

    switch (action) {
      case 'scan_issues':
        return await scanPaymentIssues(supabase);
      case 'fix_stuck_order':
        return await fixStuckOrder(supabase, requestData.order_id);
      case 'search_payment':
        return await searchPaymentDetails(supabase, requestData.reference);
      default:
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