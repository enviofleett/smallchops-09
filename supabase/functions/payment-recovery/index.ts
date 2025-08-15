import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { corsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { paystack_reference } = await req.json()
    
    if (!paystack_reference) {
      return new Response(
        JSON.stringify({ success: false, error: 'Paystack reference required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    console.log('🔧 MANUAL RECOVERY for reference:', paystack_reference)

    // Step 1: Verify with Paystack API
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!paystackSecretKey) {
      throw new Error('PAYSTACK_SECRET_KEY not configured')
    }

    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${paystack_reference}`,
      {
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        }
      }
    )

    const paystackData = await paystackResponse.json()
    
    if (!paystackData.status || paystackData.data.status !== 'success') {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Payment not successful on Paystack',
          paystack_status: paystackData.data?.status 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const paymentData = paystackData.data
    const amount = paymentData.amount / 100 // Convert from kobo

    console.log('✅ Paystack verification successful:', {
      reference: paymentData.reference,
      amount,
      status: paymentData.status,
      paid_at: paymentData.paid_at
    })

    // Step 2: Find the order - try multiple strategies
    let order = null
    
    // Strategy 1: Find by exact payment reference match
    const { data: orderByRef } = await supabase
      .from('orders')
      .select('*')
      .or(`payment_reference.eq.${paystack_reference},paystack_reference.eq.${paystack_reference}`)
      .single()
    
    if (orderByRef) {
      order = orderByRef
      console.log('📋 Found order by reference:', order.id)
    } else {
      // Strategy 2: Find by amount and time window (last 24 hours)
      const { data: ordersByAmount } = await supabase
        .from('orders')
        .select('*')
        .eq('total_amount', amount)
        .eq('payment_status', 'pending')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })

      if (ordersByAmount && ordersByAmount.length > 0) {
        order = ordersByAmount[0] // Take the most recent
        console.log('📋 Found order by amount match:', order.id)
      }
    }

    if (!order) {
      // Create orphaned payment record
      await supabase
        .from('payment_transactions')
        .insert({
          provider_reference: paystack_reference,
          amount,
          currency: paymentData.currency || 'NGN',
          status: 'orphaned',
          gateway_response: 'Manual recovery - no matching order found',
          metadata: { 
            paystack_data: paymentData,
            recovery_timestamp: new Date().toISOString()
          }
        })

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No matching order found for this payment',
          suggestion: 'Payment marked as orphaned for manual review'
        }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Step 3: Update order status
    const { error: updateError } = await supabase
      .from('orders')
      .update({
        payment_status: 'paid',
        status: 'confirmed',
        paystack_reference: paystack_reference,
        paid_at: new Date(paymentData.paid_at),
        updated_at: new Date().toISOString()
      })
      .eq('id', order.id)

    if (updateError) {
      throw updateError
    }

    // Step 4: Create/update payment transaction
    await supabase
      .from('payment_transactions')
      .upsert({
        provider_reference: paystack_reference,
        order_id: order.id,
        amount,
        currency: paymentData.currency || 'NGN',
        status: 'paid',
        gateway_response: `Manual recovery successful`,
        metadata: { 
          paystack_data: paymentData,
          recovery_timestamp: new Date().toISOString(),
          manual_recovery: true
        },
        paid_at: paymentData.paid_at,
        processed_at: new Date().toISOString()
      })

    // Step 5: Log the manual recovery
    await supabase
      .from('audit_logs')
      .insert({
        action: 'manual_payment_recovery',
        category: 'Payment Recovery',
        message: `Manual payment recovery successful: ${paystack_reference}`,
        entity_id: order.id,
        new_values: {
          paystack_reference,
          order_id: order.id,
          amount,
          recovered_at: new Date().toISOString()
        }
      })

    console.log('🎉 Manual recovery completed successfully!')

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Payment recovered successfully',
        order_id: order.id,
        order_number: order.order_number,
        amount,
        paystack_reference,
        recovered_at: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('❌ Manual recovery failed:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Manual recovery failed',
        message: error.message
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})

/*
🔧 MANUAL PAYMENT RECOVERY FUNCTION

Usage: POST /functions/v1/payment-recovery
Body: { "paystack_reference": "txn_1755270876374_27e680b6-a597-4768-bb0a-813d744c5274" }

This function:
1. Verifies payment with Paystack API
2. Finds matching order by reference or amount
3. Updates order status to paid/confirmed
4. Creates payment transaction record
5. Logs the recovery action

Use this for manually recovering failed webhook payments.
*/