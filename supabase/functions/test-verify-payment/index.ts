
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0/dist/module/index.js'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[TEST-VERIFY] Testing payment verification for pending order')
    
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Test the pending order: ORD-20250817-3263
    const testReference = 'pay_1755443504603_c3yj8mb1y';
    const testOrderId = '0638ea0b-484d-4e90-b4d2-29b21e3265b8';

    console.log('[TEST-VERIFY] Testing with reference:', testReference);

    // First check current order status
    const { data: currentOrder, error: orderError } = await supabaseClient
      .from('orders')
      .select('id, order_number, status, payment_status, total_amount, customer_email, order_type')
      .eq('id', testOrderId)
      .single();

    if (orderError) {
      throw new Error(`Failed to fetch order: ${orderError.message}`);
    }

    console.log('[TEST-VERIFY] Current order status:', currentOrder);

    // Test the RPC directly
    const { data: rpcResult, error: rpcError } = await supabaseClient.rpc(
      'verify_and_update_payment_status',
      {
        payment_ref: testReference,
        new_status: 'confirmed',
        payment_amount: currentOrder.total_amount,
        payment_gateway_response: {
          test: true,
          reference: testReference,
          amount: currentOrder.total_amount * 100,
          status: 'success'
        }
      }
    );

    if (rpcError) {
      console.error('[TEST-VERIFY] RPC failed:', rpcError);
      throw new Error(`RPC failed: ${rpcError.message}`);
    }

    console.log('[TEST-VERIFY] RPC result:', rpcResult);

    // Check final order status
    const { data: finalOrder, error: finalError } = await supabaseClient
      .from('orders')
      .select('id, order_number, status, payment_status, paid_at, updated_at')
      .eq('id', testOrderId)
      .single();

    if (finalError) {
      throw new Error(`Failed to fetch final order: ${finalError.message}`);
    }

    console.log('[TEST-VERIFY] Final order status:', finalOrder);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Test completed successfully',
        initial_status: currentOrder,
        rpc_result: rpcResult,
        final_status: finalOrder
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('[TEST-VERIFY] ERROR:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
