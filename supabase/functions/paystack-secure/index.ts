// ========================================
// 🚨 FIXED PAYSTACK EDGE FUNCTION
// Production-Ready Payment Processing
// ========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface PaystackVerificationResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message: string;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address: string;
    metadata: any;
    fees_breakdown: any;
    log: any;
    fees: number;
    customer: any;
    authorization: any;
    plan: any;
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔄 Paystack secure function called')
    const requestBody = await req.json()
    console.log('📨 Request payload:', JSON.stringify(requestBody))
    
    const { action, reference, amount, email, callback_url, metadata, order_id } = requestBody
    
    console.log(`🔄 Processing payment action: ${action}`, {
      reference,
      amount,
      email,
      order_id,
      timestamp: new Date().toISOString()
    })

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? ''
    )

    // Get Paystack secret key
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (!paystackSecretKey) {
      throw new Error('PAYSTACK_SECRET_KEY not configured')
    }

    switch (action) {
      case 'initialize': {
        console.log('🚀 Initializing payment with Paystack')
        
        // Validate required fields
        if (!email || !amount) {
          throw new Error('Email and amount are required for payment initialization')
        }
        
        // Generate consistent reference format
        const txnReference = `txn_${Date.now()}_${crypto.randomUUID()}`
        
        // Build proper callback URL with all necessary parameters
        const baseUrl = callback_url ? new URL(callback_url).origin : 'https://startersmallchops.com'
        const enhancedCallbackUrl = `${baseUrl}/payment/callback?reference=${txnReference}&order_id=${order_id || ''}&status=success`
        
        console.log('📞 Callback URL:', enhancedCallbackUrl)
        
        const paymentRequest = {
          email,
          amount: Math.round(Number(amount) * 100), // Convert to kobo
          reference: txnReference,
          currency: 'NGN',
          callback_url: enhancedCallbackUrl,
          metadata: {
            order_id,
            ...metadata,
            custom_fields: []
          }
        }
        
        console.log('📤 Paystack request:', JSON.stringify(paymentRequest))
        
        const initializeResponse = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(paymentRequest),
        })

        const initData = await initializeResponse.json()
        
        if (!initData.status) {
          console.error('❌ Paystack initialization failed:', initData)
          throw new Error(`Paystack initialization failed: ${initData.message}`)
        }

        console.log('✅ Payment initialized successfully:', {
          reference: txnReference,
          authorization_url: initData.data.authorization_url
        })

        return new Response(
          JSON.stringify({
            status: true,
            data: {
              authorization_url: initData.data.authorization_url,
              access_code: initData.data.access_code,
              reference: txnReference
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'verify': {
        console.log(`Verifying Paystack payment: ${reference}`)
        
        if (!reference) {
          throw new Error('Payment reference is required for verification')
        }

        try {
          const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${paystackSecretKey}`,
              'Content-Type': 'application/json',
            },
          })

          if (!verifyResponse.ok) {
            const errorText = await verifyResponse.text()
            console.log(`❌ Paystack verification HTTP error: ${verifyResponse.status} ${errorText}`)
            throw new Error(`Paystack verification failed (${verifyResponse.status}): ${errorText}`)
          }

          const verificationData = await verifyResponse.json()
          
          if (!verificationData.status) {
            console.error('❌ Paystack verification failed:', verificationData)
            throw new Error(`Paystack verification failed: ${verificationData.message}`)
          }

          console.log(`Paystack payment verified successfully: ${reference}`)
          const paymentData = verificationData.data

          // Process successful payment
          if (paymentData.status === 'success') {
            console.log('💰 Processing successful payment')
            
            // Try to find and update order
            const orderReference = paymentData.metadata?.order_id || order_id
            console.log(`🔍 Looking for order with reference: ${orderReference}`)

            if (orderReference) {
              const { data: updateResult, error: updateError } = await supabase
                .rpc('handle_successful_payment', {
                  p_paystack_reference: paymentData.reference,
                  p_order_reference: orderReference,
                  p_amount: paymentData.amount / 100,
                  p_currency: paymentData.currency || 'NGN',
                  p_paystack_data: paymentData
                })

              if (updateError) {
                console.error('❌ Order update failed:', updateError)
              } else {
                console.log('✅ Order updated successfully:', updateResult)
              }
            }

          return new Response(
            JSON.stringify({
              status: true,
              data: {
                reference: paymentData.reference,
                amount: paymentData.amount / 100,
                status: paymentData.status,
                currency: paymentData.currency,
                paid_at: paymentData.paid_at,
                channel: paymentData.channel
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )

        } catch (error) {
          console.error('Payment verification error:', error)
          throw error
        }
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error) {
    console.error('❌ Edge function error:', error)

    return new Response(
      JSON.stringify({
        status: false,
        error: error.message || 'An unexpected error occurred'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500
      }
    )
  }
})

// ========================================
// 🚀 DEPLOYMENT CHECKLIST
// ========================================

// 1. Deploy this edge function:
//    supabase functions deploy paystack-secure
//
// 2. Set environment variables:
//    supabase secrets set PAYSTACK_SECRET_KEY=sk_test_xxx...
//
// 3. Update frontend to use txn_ references
//
// 4. Test payment flow end-to-end
//
// 5. Monitor logs for successful RPC calls
//
// 6. Run health check:
//    SELECT check_payment_flow_health();
//
// ========================================