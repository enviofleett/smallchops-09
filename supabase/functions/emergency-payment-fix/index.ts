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
    const { action } = await req.json();

    if (action === 'fix_test_order') {
      return await fixTestOrder();
    } else {
      return new Response(JSON.stringify({ success: false, error: 'Invalid action' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
  } catch (error: any) {
    console.error('Emergency fix error:', error);
    return new Response(JSON.stringify({ success: false, error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function fixTestOrder() {
  const orderNumber = 'ORD-20250811-8222';
  const paystackReference = 'txn_1754906935502_dda21f55-7931-4bd3-b012-180c53e398d2';
  
  console.log(`🚨 Emergency fix for order: ${orderNumber}`);
  
  try {
    // Get order details
    const { data: order, error: orderError } = await supabaseClient
      .from('orders')
      .select('*')
      .eq('order_number', orderNumber)
      .single();
    
    if (orderError || !order) {
      throw new Error(`Order ${orderNumber} not found: ${orderError?.message}`);
    }
    
    console.log('📋 Order found:', order.id);
    
    // Check if payment transaction already exists
    const { data: existingTx } = await supabaseClient
      .from('payment_transactions')
      .select('id')
      .eq('provider_reference', paystackReference)
      .single();
    
    if (existingTx) {
      console.log('⚠️ Payment transaction already exists:', existingTx.id);
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment transaction already exists'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Create payment transaction record
    const paymentData = {
      order_id: order.id,
      provider_reference: paystackReference,
      amount: order.total_amount,
      currency: 'NGN',
      status: 'paid',
      channel: 'online',
      customer_email: order.customer_email,
      paid_at: new Date().toISOString(),
      metadata: {
        emergency_fix: true,
        original_order_number: orderNumber,
        fix_timestamp: new Date().toISOString(),
        recovered_payment: true
      },
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    console.log('💾 Creating payment transaction...');
    const { data: paymentTransaction, error: paymentError } = await supabaseClient
      .from('payment_transactions')
      .insert(paymentData)
      .select()
      .single();
    
    if (paymentError) {
      console.error('❌ Payment transaction insert error:', paymentError);
      throw new Error(`Failed to create payment record: ${paymentError.message}`);
    }
    
    console.log('✅ Payment transaction created:', paymentTransaction.id);
    
    // Update order status
    console.log('🔄 Updating order status...');
    const { error: orderUpdateError } = await supabaseClient
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        paid_at: new Date().toISOString(),
        payment_reference: paystackReference,
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id);
    
    if (orderUpdateError) {
      console.error('❌ Order update error:', orderUpdateError);
      throw new Error(`Failed to update order: ${orderUpdateError.message}`);
    }
    
    console.log('✅ Order status updated to confirmed');
    
    // Log the emergency fix
    console.log('📝 Logging emergency fix...');
    await supabaseClient.from('audit_logs').insert({
      action: 'emergency_payment_fix_applied',
      category: 'Payment Recovery',
      message: `Emergency fix applied to order ${orderNumber} - payment confirmed`,
      new_values: {
        order_id: order.id,
        order_number: orderNumber,
        paystack_reference: paystackReference,
        amount: order.total_amount,
        status: 'paid',
        payment_transaction_id: paymentTransaction.id
      }
    });
    
    console.log('🎉 Emergency fix completed successfully!');
    
    return new Response(JSON.stringify({
      success: true,
      message: `Successfully fixed payment for order ${orderNumber}`,
      data: {
        order_id: order.id,
        order_number: orderNumber,
        payment_transaction_id: paymentTransaction.id,
        amount: order.total_amount,
        status: 'paid',
        payment_status: 'paid'
      }
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
    
  } catch (error: any) {
    console.error('💥 Emergency fix failed:', error);
    
    // Log the failure
    await supabaseClient.from('audit_logs').insert({
      action: 'emergency_payment_fix_failed',
      category: 'Payment Recovery',
      message: `Emergency fix failed for order ${orderNumber}: ${error.message}`,
      new_values: { 
        order_number: orderNumber, 
        paystack_reference: paystackReference, 
        error: error.message 
      }
    });
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: { orderNumber, paystackReference }
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}