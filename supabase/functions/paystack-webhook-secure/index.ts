import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getPaystackConfig } from '../_shared/paystack-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Verify Paystack webhook signature
async function verifyPaystackSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder()
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    )
    
    const hash = await crypto.subtle.sign('HMAC', key, encoder.encode(payload))
    const hashArray = Array.from(new Uint8Array(hash))
    const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
    
    return hashHex === signature
  } catch (error) {
    console.error('Signature verification failed:', error)
    return false
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    if (req.method !== 'POST') {
      return new Response('Method not allowed', { 
        status: 405, 
        headers: corsHeaders 
      })
    }

    const payload = await req.text()
    const signature = req.headers.get('x-paystack-signature')

    if (!signature) {
      console.error('Missing webhook signature')
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    // Get Paystack configuration for webhook secret
    const paystackConfig = getPaystackConfig(req)
    
    if (!paystackConfig.webhookSecret) {
      console.error('Webhook secret not configured')
      return new Response('Webhook secret not configured', { 
        status: 500, 
        headers: corsHeaders 
      })
    }

    // Verify webhook signature
    const isValidSignature = await verifyPaystackSignature(
      payload, 
      signature, 
      paystackConfig.webhookSecret
    )

    if (!isValidSignature) {
      console.error('Invalid webhook signature')
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    console.log('✅ Webhook signature verified')

    const webhookData = JSON.parse(payload)
    const { event, data } = webhookData

    console.log(`🎯 Processing webhook event: ${event}`, {
      reference: data?.reference,
      status: data?.status,
      amount: data?.amount
    })

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    switch (event) {
      case 'charge.success': {
        const reference = data.reference
        const amount = data.amount / 100 // Convert from kobo
        
        console.log(`💰 Processing successful payment: ${reference}, Amount: ₦${amount}`)

        // Update payment transaction status
        const { data: paymentTransaction, error: ptUpdateError } = await supabase
          .from('payment_transactions')
          .update({
            status: 'paid',
            paystack_status: 'success',
            paid_at: new Date(data.paid_at),
            channel: data.channel,
            fees: data.fees || 0,
            gateway_response: data.gateway_response,
            auth_data: data.authorization || {},
            metadata: {
              ...(data.metadata || {}),
              webhook_processed_at: new Date().toISOString(),
              paystack_fees: data.fees,
              customer: data.customer
            },
            updated_at: new Date().toISOString()
          })
          .or(`reference.eq.${reference},paystack_reference.eq.${reference}`)
          .select('order_id')
          .single()

        if (ptUpdateError) {
          console.error('Failed to update payment transaction:', ptUpdateError)
          // Continue processing to update order anyway
        }

        // Get order_id from payment transaction or webhook metadata
        const orderId = paymentTransaction?.order_id || data.metadata?.order_id

        if (orderId) {
          // Update order status
          const { error: orderUpdateError } = await supabase
            .from('orders')
            .update({
              payment_status: 'paid',
              status: 'confirmed',
              paystack_reference: reference,
              paid_at: new Date(data.paid_at),
              updated_at: new Date().toISOString()
            })
            .eq('id', orderId)

          if (orderUpdateError) {
            console.error('Failed to update order:', orderUpdateError)
          } else {
            console.log(`✅ Order ${orderId} marked as paid`)
          }

          // Log successful payment processing
          await supabase
            .from('audit_logs')
            .insert({
              action: 'webhook_payment_success',
              category: 'Payment Processing',
              message: `Payment confirmed via webhook: ${reference}`,
              entity_id: orderId,
              new_values: {
                reference,
                amount,
                channel: data.channel,
                environment: paystackConfig.environment
              }
            })
        } else {
          console.error('No order_id found for payment:', reference)
        }

        break
      }

      case 'charge.failed': {
        const reference = data.reference
        
        console.log(`❌ Processing failed payment: ${reference}`)

        // Update payment transaction status
        await supabase
          .from('payment_transactions')
          .update({
            status: 'failed',
            paystack_status: 'failed',
            gateway_response: data.gateway_response,
            metadata: {
              ...(data.metadata || {}),
              webhook_processed_at: new Date().toISOString(),
              failure_reason: data.gateway_response
            },
            updated_at: new Date().toISOString()
          })
          .or(`reference.eq.${reference},paystack_reference.eq.${reference}`)

        // Get order_id and update order status
        const { data: paymentTransaction } = await supabase
          .from('payment_transactions')
          .select('order_id')
          .or(`reference.eq.${reference},paystack_reference.eq.${reference}`)
          .single()

        if (paymentTransaction?.order_id) {
          await supabase
            .from('orders')
            .update({
              payment_status: 'failed',
              status: 'payment_failed',
              updated_at: new Date().toISOString()
            })
            .eq('id', paymentTransaction.order_id)

          console.log(`✅ Order ${paymentTransaction.order_id} marked as payment failed`)
        }

        break
      }

      default:
        console.log(`ℹ️ Unhandled webhook event: ${event}`)
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        event,
        environment: paystackConfig.environment
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Webhook processing failed',
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
🔐 SECURE PAYSTACK WEBHOOK HANDLER
- ✅ Verifies webhook signatures using environment-specific secrets
- ✅ Processes charge.success and charge.failed events
- ✅ Updates payment_transactions and orders tables
- ✅ Environment-aware configuration
- ✅ Comprehensive logging and audit trails

🔧 SETUP:
1. Configure webhook URL in Paystack dashboard:
   https://your-project.supabase.co/functions/v1/paystack-webhook-secure

2. Set webhook secret in Supabase:
   - PAYSTACK_WEBHOOK_SECRET_TEST (for test mode)
   - PAYSTACK_WEBHOOK_SECRET_LIVE (for live mode)

3. Enable these events in Paystack:
   - charge.success
   - charge.failed
*/