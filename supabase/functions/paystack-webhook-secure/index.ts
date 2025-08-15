import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getPaystackConfig } from '../_shared/paystack-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Paystack's official webhook IP addresses for whitelisting
const PAYSTACK_IPS = [
  '52.31.139.75',
  '52.49.173.169', 
  '52.214.14.220'
]

// Verify webhook origin by IP whitelisting
function verifyPaystackIP(request: Request): boolean {
  const forwardedFor = request.headers.get('x-forwarded-for')
  const realIP = request.headers.get('x-real-ip')
  const cfConnectingIP = request.headers.get('cf-connecting-ip')
  
  // Get the actual client IP
  const clientIP = cfConnectingIP || realIP || forwardedFor?.split(',')[0]?.trim()
  
  if (!clientIP) {
    console.warn('⚠️ Could not determine client IP address')
    return false
  }
  
  console.log(`🔍 Webhook request from IP: ${clientIP}`)
  
  const isValidIP = PAYSTACK_IPS.includes(clientIP)
  if (isValidIP) {
    console.log('✅ IP address verified as Paystack webhook server')
  } else {
    console.warn(`❌ Invalid IP address: ${clientIP}. Expected one of: ${PAYSTACK_IPS.join(', ')}`)
  }
  
  return isValidIP
}

// Verify Paystack webhook signature using HMAC SHA-512
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
    
    const isValid = hashHex === signature
    console.log(`🔐 Signature verification: ${isValid ? 'VALID' : 'INVALID'}`)
    
    return isValid
  } catch (error) {
    console.error('❌ Signature verification failed:', error)
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

    // Get Paystack configuration for webhook secret
    const paystackConfig = getPaystackConfig(req)
    
    // Security validation with both methods
    const requireBothMethods = Deno.env.get('PAYSTACK_WEBHOOK_REQUIRE_BOTH') === 'true'
    
    // Method 1: IP Whitelisting
    const isValidIP = verifyPaystackIP(req)
    
    // Method 2: Signature verification (if secret is available)
    let isValidSignature = false
    if (signature && paystackConfig.webhookSecret) {
      isValidSignature = await verifyPaystackSignature(
        payload, 
        signature, 
        paystackConfig.webhookSecret
      )
    } else if (signature) {
      console.warn('⚠️ Webhook signature provided but no secret configured')
    } else {
      console.warn('⚠️ No webhook signature provided')
    }

    // Security decision logic
    let securityPassed = false
    let securityMethod = ''

    if (requireBothMethods) {
      // Strict mode: both IP and signature must be valid
      securityPassed = isValidIP && isValidSignature
      securityMethod = 'IP + Signature (strict)'
    } else {
      // Flexible mode: either IP OR signature is sufficient
      securityPassed = isValidIP || isValidSignature
      securityMethod = isValidIP ? 
        (isValidSignature ? 'IP + Signature' : 'IP only') : 
        'Signature only'
    }

    if (!securityPassed) {
      console.error(`❌ Webhook security validation failed. Method: ${securityMethod}`)
      console.error(`- IP valid: ${isValidIP}`)
      console.error(`- Signature valid: ${isValidSignature}`)
      console.error(`- Require both: ${requireBothMethods}`)
      
      return new Response('Unauthorized', { 
        status: 401, 
        headers: corsHeaders 
      })
    }

    console.log(`✅ Webhook security verified via: ${securityMethod}`)

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