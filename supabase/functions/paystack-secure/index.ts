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
    const { action, reference, amount, order_reference } = await req.json()
    
    console.log(`🔄 Processing payment action: ${action}`, {
      reference,
      order_reference,
      amount,
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
        
        // Generate consistent reference format
        const txnReference = `txn_${Date.now()}_${crypto.randomUUID()}`
        
        const initializeResponse = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${paystackSecretKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            email: req.headers.get('x-user-email') || 'customer@example.com',
            amount: Math.round(amount * 100), // Convert to kobo
            reference: txnReference, // Use consistent format
            currency: 'NGN',
            callback_url: `${req.headers.get('origin')}/payment/callback`,
            metadata: {
              order_reference: order_reference || reference, // Store original order ref
              custom_fields: []
            }
          }),
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
            success: true,
            data: {
              authorization_url: initData.data.authorization_url,
              access_code: initData.data.access_code,
              reference: txnReference // Return the txn_ reference
            }
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      case 'verify': {
        console.log('🔍 Verifying payment with Paystack')
        
        if (!reference) {
          throw new Error('Payment reference is required for verification')
        }

        // Verify with Paystack with retry logic
        let verificationData: PaystackVerificationResponse | null = null
        let retryCount = 0
        const maxRetries = 3

        while (retryCount < maxRetries && !verificationData) {
          try {
            console.log(`🔄 Verification attempt ${retryCount + 1} for reference: ${reference}`)
            
            const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${paystackSecretKey}`,
                'Content-Type': 'application/json',
              },
            })

            if (verifyResponse.status === 200) {
              verificationData = await verifyResponse.json()
              break
            } else if (verifyResponse.status === 400) {
              console.warn(`⚠️ Transaction not found (attempt ${retryCount + 1}):`, reference)
              if (retryCount < maxRetries - 1) {
                // Wait with exponential backoff
                const delay = Math.pow(2, retryCount) * 1000
                await new Promise(resolve => setTimeout(resolve, delay))
              }
            } else {
              throw new Error(`Paystack API error: ${verifyResponse.status}`)
            }
          } catch (error) {
            console.error(`❌ Verification attempt ${retryCount + 1} failed:`, error)
            if (retryCount === maxRetries - 1) throw error
          }
          retryCount++
        }

        if (!verificationData || !verificationData.status) {
          console.error('❌ Payment verification failed:', {
            reference,
            data: verificationData
          })
          
          return new Response(
            JSON.stringify({
              success: false,
              message: 'Payment verification failed',
              reference
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 400
            }
          )
        }

        const paymentData = verificationData.data

        console.log('✅ Payment verified successfully:', {
          reference: paymentData.reference,
          status: paymentData.status,
          amount: paymentData.amount / 100 // Convert from kobo
        })

        // Only process successful payments
        if (paymentData.status === 'success') {
          console.log('💰 Processing successful payment')
          
          // Extract order reference from metadata
          const orderReference = paymentData.metadata?.order_reference || 
                               paymentData.metadata?.custom_fields?.find((f: any) => f.variable_name === 'order_reference')?.value ||
                               reference

          // Call the fixed RPC function
          console.log('🔗 Calling handle_successful_payment RPC:', {
            paystack_reference: paymentData.reference,
            order_reference: orderReference,
            amount: paymentData.amount / 100,
            currency: paymentData.currency
          })

          const { data: rpcResult, error: rpcError } = await supabase
            .rpc('handle_successful_payment', {
              p_paystack_reference: paymentData.reference,
              p_order_reference: orderReference,
              p_amount: paymentData.amount / 100, // Convert from kobo
              p_currency: paymentData.currency || 'NGN',
              p_paystack_data: paymentData
            })

          if (rpcError) {
            console.error('❌ RPC function error:', rpcError)
            throw new Error(`Database update failed: ${rpcError.message}`)
          }

          console.log('✅ RPC function result:', rpcResult)

          if (!rpcResult?.success) {
            console.warn('⚠️ RPC function reported failure:', rpcResult)
          }

          return new Response(
            JSON.stringify({
              success: true,
              message: 'Payment verified and processed successfully',
              data: {
                reference: paymentData.reference,
                amount: paymentData.amount / 100,
                status: paymentData.status,
                order_updated: rpcResult?.success || false,
                order_id: rpcResult?.order_id,
                payment_transaction_id: rpcResult?.payment_transaction_id
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        } else {
          console.log('⚠️ Payment not successful:', paymentData.status)
          
          return new Response(
            JSON.stringify({
              success: false,
              message: `Payment status: ${paymentData.status}`,
              data: {
                reference: paymentData.reference,
                status: paymentData.status
              }
            }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          )
        }
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error) {
    console.error('❌ Edge function error:', {
      message: error.message,
      stack: error.stack,
      timestamp: new Date().toISOString()
    })

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'An unexpected error occurred',
        timestamp: new Date().toISOString()
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