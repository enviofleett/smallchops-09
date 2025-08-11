import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabaseClient = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, ...requestData } = await req.json();

    if (action === 'emergency_fix') {
      return await emergencyFixTransaction(requestData);
    } else if (action === 'sync_payments') {
      return await syncPaystackPayments(requestData);
    } else if (action === 'health_check') {
      return await paymentHealthCheck();
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error: any) {
    console.error('Payment recovery error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function emergencyFixTransaction(requestData: any) {
  const { order_number, paystack_reference } = requestData;
  
  console.log(`🚨 Emergency fix for order: ${order_number}, reference: ${paystack_reference}`);
  
  try {
    // Get Paystack config
    const { data: config } = await supabaseClient
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();
    
    if (!config) {
      throw new Error('Paystack configuration not found');
    }
    
    const secretKey = config.test_mode ? config.secret_key : (config.live_secret_key || config.secret_key);
    
    // Verify with Paystack
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${paystack_reference}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' }
    });
    
    if (!paystackResponse.ok) {
      throw new Error(`Paystack verification failed: ${paystackResponse.status}`);
    }
    
    const paystackData = await paystackResponse.json();
    const tx = paystackData.data;
    
    if (tx.status !== 'success') {
      throw new Error(`Payment not successful on Paystack: ${tx.status}`);
    }
    
    // Get order details
    const { data: order } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('order_number', order_number)
      .single();
    
    if (!order) {
      throw new Error(`Order ${order_number} not found`);
    }
    
    // Create payment transaction record
    const paymentData = {
      order_id: order.id,
      provider_reference: paystack_reference,
      amount: tx.amount / 100, // Convert from kobo to NGN
      currency: tx.currency || 'NGN',
      status: 'paid',
      channel: tx.channel,
      customer_email: tx.customer?.email || order.customer_email,
      paid_at: tx.paid_at || new Date().toISOString(),
      gateway_response: tx.gateway_response,
      provider_response: tx,
      metadata: {
        emergency_fix: true,
        original_order_number: order_number,
        fix_timestamp: new Date().toISOString()
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    // Insert payment transaction
    const { data: paymentTransaction, error: paymentError } = await supabaseClient
      .from('payment_transactions')
      .insert(paymentData)
      .single();
    
    if (paymentError) {
      console.error('Payment transaction insert error:', paymentError);
      throw new Error(`Failed to create payment record: ${paymentError.message}`);
    }
    
    // Update order status
    const { error: orderError } = await supabaseClient
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        paid_at: tx.paid_at || new Date().toISOString(),
        payment_reference: paystack_reference,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);
    
    if (orderError) {
      console.error('Order update error:', orderError);
      throw new Error(`Failed to update order: ${orderError.message}`);
    }
    
    // Log the emergency fix
    await supabaseClient.from('audit_logs').insert({
      action: 'emergency_payment_fix',
      category: 'Payment Recovery',
      message: `Emergency fix applied to order ${order_number}`,
      new_values: {
        order_id: order.id,
        order_number,
        paystack_reference,
        amount: tx.amount / 100,
        status: 'paid'
      }
    });
    
    console.log(`✅ Emergency fix completed for order ${order_number}`);
    
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully fixed payment for order ${order_number}`,
      data: {
        order_id: order.id,
        payment_transaction_id: paymentTransaction.id,
        amount: tx.amount / 100,
        status: 'paid'
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Emergency fix failed:', error);
    
    // Log the failure
    await supabaseClient.from('audit_logs').insert({
      action: 'emergency_payment_fix_failed',
      category: 'Payment Recovery',
      message: `Emergency fix failed for order ${order_number}: ${error.message}`,
      new_values: { order_number, paystack_reference, error: error.message }
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: { order_number, paystack_reference }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function syncPaystackPayments(requestData: any) {
  const { hours = 24 } = requestData;
  
  console.log(`🔄 Syncing Paystack payments from last ${hours} hours`);
  
  try {
    // Get Paystack config
    const { data: config } = await supabaseClient
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();
    
    if (!config) {
      throw new Error('Paystack configuration not found');
    }
    
    const secretKey = config.test_mode ? config.secret_key : (config.live_secret_key || config.secret_key);
    
    // Get pending orders from the specified time range
    const { data: pendingOrders } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('payment_status', 'pending')
      .gte('created_at', new Date(Date.now() - hours * 60 * 60 * 1000).toISOString());
    
    let syncedCount = 0;
    let errorCount = 0;
    const results = [];
    
    for (const order of pendingOrders || []) {
      try {
        if (!order.payment_reference) {
          console.log(`⏭️  Skipping order ${order.order_number} - no payment reference`);
          continue;
        }
        
        // Verify with Paystack
        const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${order.payment_reference}`, {
          method: 'GET',
          headers: { 'Authorization': `Bearer ${secretKey}`, 'Content-Type': 'application/json' }
        });
        
        if (!paystackResponse.ok) {
          console.log(`⚠️  Paystack verification failed for ${order.order_number}: ${paystackResponse.status}`);
          continue;
        }
        
        const paystackData = await paystackResponse.json();
        const tx = paystackData.data;
        
        if (tx.status === 'success') {
          // Check if payment transaction already exists
          const { data: existingTx } = await supabaseClient
            .from('payment_transactions')
            .select('id')
            .eq('provider_reference', order.payment_reference)
            .single();
          
          if (!existingTx) {
            // Create payment transaction
            await supabaseClient.from('payment_transactions').insert({
              order_id: order.id,
              provider_reference: order.payment_reference,
              amount: tx.amount / 100,
              currency: tx.currency || 'NGN',
              status: 'paid',
              channel: tx.channel,
              customer_email: tx.customer?.email || order.customer_email,
              paid_at: tx.paid_at || new Date().toISOString(),
              gateway_response: tx.gateway_response,
              provider_response: tx,
              metadata: {
                sync_recovery: true,
                sync_timestamp: new Date().toISOString()
              },
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            });
          }
          
          // Update order
          await supabaseClient
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'confirmed',
              paid_at: tx.paid_at || new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq('id', order.id);
          
          syncedCount++;
          results.push({
            order_number: order.order_number,
            status: 'synced',
            amount: tx.amount / 100
          });
          
          console.log(`✅ Synced payment for order ${order.order_number}`);
        } else {
          results.push({
            order_number: order.order_number,
            status: 'not_paid',
            paystack_status: tx.status
          });
        }
      } catch (error: any) {
        errorCount++;
        results.push({
          order_number: order.order_number,
          status: 'error',
          error: error.message
        });
        console.error(`❌ Error syncing order ${order.order_number}:`, error);
      }
    }
    
    // Log sync operation
    await supabaseClient.from('audit_logs').insert({
      action: 'payment_sync_operation',
      category: 'Payment Recovery',
      message: `Payment sync completed: ${syncedCount} synced, ${errorCount} errors`,
      new_values: {
        hours,
        synced_count: syncedCount,
        error_count: errorCount,
        total_processed: results.length
      }
    });
    
    return new Response(JSON.stringify({
      success: true,
      message: `Payment sync completed: ${syncedCount} payments synced, ${errorCount} errors`,
      data: {
        synced_count: syncedCount,
        error_count: errorCount,
        total_processed: results.length,
        results
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Payment sync failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}

async function paymentHealthCheck() {
  try {
    const now = new Date();
    const last24h = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    
    // Get payment statistics
    const { data: orderStats } = await supabaseClient
      .from('orders')
      .select('payment_status, status, created_at')
      .gte('created_at', last24h.toISOString());
    
    const totalOrders = orderStats?.length || 0;
    const paidOrders = orderStats?.filter(o => o.payment_status === 'paid').length || 0;
    const pendingOrders = orderStats?.filter(o => o.payment_status === 'pending').length || 0;
    
    const completionRate = totalOrders > 0 ? (paidOrders / totalOrders) * 100 : 0;
    
    // Get payment transactions count
    const { data: txStats } = await supabaseClient
      .from('payment_transactions')
      .select('status, created_at')
      .gte('created_at', last24h.toISOString());
    
    const totalTransactions = txStats?.length || 0;
    const successfulTransactions = txStats?.filter(t => t.status === 'paid' || t.status === 'success').length || 0;
    
    // Health indicators
    const alerts = [];
    
    if (completionRate < 90) {
      alerts.push({
        severity: 'critical',
        message: `Payment completion rate is ${completionRate.toFixed(2)}% (below 90% threshold)`
      });
    }
    
    if (pendingOrders > 10) {
      alerts.push({
        severity: 'warning',
        message: `${pendingOrders} orders are stuck in pending status`
      });
    }
    
    if (totalOrders > 0 && totalTransactions === 0) {
      alerts.push({
        severity: 'critical',
        message: 'Orders exist but no payment transactions recorded'
      });
    }
    
    const healthScore = completionRate;
    let healthStatus = 'healthy';
    if (healthScore < 50) healthStatus = 'critical';
    else if (healthScore < 80) healthStatus = 'warning';
    
    return new Response(JSON.stringify({
      success: true,
      health_status: healthStatus,
      health_score: healthScore,
      data: {
        period: 'last_24_hours',
        orders: {
          total: totalOrders,
          paid: paidOrders,
          pending: pendingOrders,
          completion_rate: completionRate
        },
        transactions: {
          total: totalTransactions,
          successful: successfulTransactions
        },
        alerts,
        recommendations: alerts.length > 0 ? [
          'Run payment sync to recover stuck payments',
          'Check Paystack configuration',
          'Review payment flow logs'
        ] : ['System is healthy']
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('Health check failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}