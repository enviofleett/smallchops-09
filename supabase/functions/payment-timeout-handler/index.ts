import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"
import { corsHeaders } from "../_shared/cors.ts"

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('[PAYMENT-TIMEOUT] Starting payment timeout check...')
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Define timeout threshold (15 minutes for production)
    const timeoutMinutes = 15
    const timeoutThreshold = new Date(Date.now() - timeoutMinutes * 60 * 1000)
    
    console.log(`[PAYMENT-TIMEOUT] Checking payments older than: ${timeoutThreshold.toISOString()}`)

    // Find stuck payments (pending/initialized for more than timeout threshold)
    const { data: stuckPayments, error: fetchError } = await supabase
      .from('payment_transactions')
      .select(`
        id, reference, order_id, status, created_at,
        orders (
          id, order_number, customer_email, customer_name, 
          total_amount, payment_reference
        )
      `)
      .in('status', ['pending', 'initialized'])
      .lt('created_at', timeoutThreshold.toISOString())
      .order('created_at', { ascending: true })

    if (fetchError) {
      throw new Error(`Failed to fetch stuck payments: ${fetchError.message}`)
    }

    if (!stuckPayments || stuckPayments.length === 0) {
      console.log('[PAYMENT-TIMEOUT] No stuck payments found')
      return new Response(JSON.stringify({
        success: true,
        message: 'No stuck payments found',
        processed: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      })
    }

    console.log(`[PAYMENT-TIMEOUT] Found ${stuckPayments.length} stuck payments`)

    const results = []
    let processedCount = 0

    for (const payment of stuckPayments) {
      try {
        console.log(`[PAYMENT-TIMEOUT] Processing stuck payment: ${payment.reference}`)

        // Verify payment status with Paystack one final time
        const paystackResponse = await fetch(
          `https://api.paystack.co/transaction/verify/${payment.reference}`,
          {
            headers: {
              'Authorization': `Bearer ${Deno.env.get('PAYSTACK_SECRET_KEY')}`,
              'Content-Type': 'application/json'
            }
          }
        )

        let finalStatus = 'failed' // Default to failed for timeout
        let shouldNotifyCustomer = true

        if (paystackResponse.ok) {
          const verificationData = await paystackResponse.json()
          
          if (verificationData.status && verificationData.data) {
            const paystackStatus = verificationData.data.status
            
            // If payment succeeded on Paystack but wasn't processed
            if (paystackStatus === 'success') {
              console.log(`[PAYMENT-TIMEOUT] Payment ${payment.reference} was successful but not processed!`)
              
              // Process the successful payment
              await supabase.rpc('handle_successful_payment', {
                p_reference: payment.reference,
                p_paid_at: new Date(verificationData.data.paid_at),
                p_gateway_response: verificationData.data.gateway_response,
                p_fees: verificationData.data.fees / 100,
                p_channel: verificationData.data.channel
              })
              
              finalStatus = 'completed'
              shouldNotifyCustomer = false // Success email will be sent by handle_successful_payment
              
              console.log(`[PAYMENT-TIMEOUT] Recovered successful payment: ${payment.reference}`)
            } else if (paystackStatus === 'failed' || paystackStatus === 'abandoned') {
              finalStatus = 'failed'
            } else {
              // Still pending/processing on Paystack side - mark as timeout
              finalStatus = 'timeout'
            }
          }
        } else {
          console.warn(`[PAYMENT-TIMEOUT] Could not verify with Paystack: ${paystackResponse.status}`)
          finalStatus = 'timeout'
        }

        // Update payment transaction status
        const { error: updateError } = await supabase
          .from('payment_transactions')
          .update({
            status: finalStatus,
            processed_at: new Date().toISOString(),
            gateway_response: `Timeout handler processed at ${new Date().toISOString()}`
          })
          .eq('id', payment.id)

        if (updateError) {
          throw new Error(`Failed to update payment ${payment.id}: ${updateError.message}`)
        }

        // Update order status if payment failed/timed out
        if (finalStatus !== 'completed') {
          await supabase
            .from('orders')
            .update({
              status: 'cancelled',
              payment_status: finalStatus,
              cancelled_at: new Date().toISOString(),
              cancellation_reason: finalStatus === 'timeout' ? 'Payment timeout' : 'Payment failed'
            })
            .eq('id', payment.order_id)
        }

        // Queue customer notification for failed/timeout payments
        if (shouldNotifyCustomer && payment.orders?.customer_email && finalStatus !== 'completed') {
          try {
            await supabase
              .from('communication_events')
              .insert({
                event_type: 'payment_timeout',
                recipient_email: payment.orders.customer_email,
                template_key: finalStatus === 'timeout' ? 'payment_timeout' : 'payment_failed',
                template_variables: {
                  customer_name: payment.orders.customer_name || 'Customer',
                  order_number: payment.orders.order_number,
                  total_amount: payment.orders.total_amount,
                  payment_reference: payment.reference,
                  timeout_minutes: timeoutMinutes
                },
                status: 'queued',
                order_id: payment.order_id,
                priority: 'high'
              })
            
            console.log(`[PAYMENT-TIMEOUT] Queued notification for ${payment.orders.customer_email}`)
          } catch (emailError) {
            console.error(`[PAYMENT-TIMEOUT] Failed to queue notification: ${emailError}`)
          }
        }

        // Log the timeout action
        await supabase.from('audit_logs').insert({
          action: 'payment_timeout_processed',
          category: 'Payment Management',
          message: `Payment timeout handler processed stuck payment`,
          entity_id: payment.order_id,
          new_values: {
            payment_id: payment.id,
            payment_reference: payment.reference,
            original_status: payment.status,
            final_status: finalStatus,
            stuck_duration_minutes: Math.round((Date.now() - new Date(payment.created_at).getTime()) / 60000)
          }
        })

        results.push({
          payment_id: payment.id,
          reference: payment.reference,
          order_id: payment.order_id,
          original_status: payment.status,
          final_status: finalStatus,
          processed: true
        })

        processedCount++
        
      } catch (paymentError) {
        console.error(`[PAYMENT-TIMEOUT] Error processing payment ${payment.reference}:`, paymentError)
        
        results.push({
          payment_id: payment.id,
          reference: payment.reference,
          order_id: payment.order_id,
          processed: false,
          error: paymentError.message
        })
      }
    }

    console.log(`[PAYMENT-TIMEOUT] Processed ${processedCount}/${stuckPayments.length} stuck payments`)

    return new Response(JSON.stringify({
      success: true,
      message: `Processed ${processedCount} stuck payments`,
      processed: processedCount,
      total_found: stuckPayments.length,
      results: results
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200
    })

  } catch (error) {
    console.error('[PAYMENT-TIMEOUT] ERROR:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500
    })
  }
})