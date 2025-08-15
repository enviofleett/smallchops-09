// ========================================
// 🚨 FIXED PAYSTACK EDGE FUNCTION
// Production-Ready Payment Processing
// ========================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0/dist/module/index.js'
import { getPaystackConfig, validatePaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

// Timeout configuration
const PAYSTACK_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;

// Enhanced logging for debugging
const logError = (context: string, error: any, metadata: any = {}) => {
  const errorLog = {
    timestamp: new Date().toISOString(),
    context,
    error: error.message || error,
    stack: error.stack,
    metadata,
    request_id: crypto.randomUUID()
  };
  console.error('PAYMENT_ERROR:', JSON.stringify(errorLog));
};

// Reference validation and normalization
const normalizePaymentReference = (reference: string): string | null => {
  if (!reference || typeof reference !== 'string') return null;
  
  const trimmed = reference.trim();
  
  // Valid formats: txn_timestamp_uuid, checkout_sessionid, pay_legacy
  if (trimmed.match(/^txn_\d+_[a-f0-9-]{36}$/)) return trimmed;
  if (trimmed.match(/^checkout_[a-zA-Z0-9]+$/)) return trimmed;
  if (trimmed.match(/^pay_[a-zA-Z0-9]+$/)) return trimmed;
  
  console.warn('⚠️ Unknown reference format:', trimmed);
  return trimmed; // Allow unknown formats but log them
};

// Fallback recovery strategies
const tryReferenceRecovery = async (reference: string, supabase: any) => {
  console.log('🔍 Attempting reference recovery for:', reference);
  
  try {
    // Try to find payment by similar reference patterns
    const { data: payments } = await supabase
      .from('payment_transactions')
      .select('*')
      .or(`provider_reference.ilike.%${reference}%,metadata->>original_reference.eq.${reference}`)
      .limit(1);
    
    if (payments && payments.length > 0) {
      const payment = payments[0];
      console.log('✅ Found payment via reference recovery');
      
      return new Response(JSON.stringify({
        status: true,
        data: {
          reference: payment.provider_reference,
          amount: payment.amount,
          status: payment.status === 'paid' ? 'success' : payment.status,
          currency: payment.currency || 'NGN',
          paid_at: payment.paid_at,
          channel: payment.metadata?.channel || 'card'
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Reference recovery failed:', error);
  }
  
  return null;
};

// Database recovery for failed API calls
const tryDatabaseRecovery = async (reference: string, supabase: any) => {
  console.log('🗄️ Attempting database recovery for:', reference);
  
  try {
    // Look for any payment with this reference regardless of status
    const { data: payment } = await supabase
      .from('payment_transactions')
      .select('*')
      .eq('provider_reference', reference)
      .single();
    
    if (payment) {
      console.log('✅ Found payment in database during recovery');
      
      return new Response(JSON.stringify({
        status: true,
        data: {
          reference: payment.provider_reference,
          amount: payment.amount,
          status: payment.status === 'paid' ? 'success' : 'pending',
          currency: payment.currency || 'NGN',
          paid_at: payment.paid_at,
          channel: payment.metadata?.channel || 'card'
        }
      }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }
  } catch (error) {
    console.error('Database recovery failed:', error);
  }
  
  return null;
};

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

const handlePaymentRequest = async (req: Request) => {
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

    // Initialize Supabase client with SERVICE ROLE for database writes
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Get environment-specific Paystack configuration
    console.log('🔍 Fetching Paystack configuration...')
    
    let paystackConfig;
    try {
      const envConfig = getPaystackConfig(req);
      const validation = validatePaystackConfig(envConfig);
      
      if (!validation.isValid) {
        throw new Error(`Paystack configuration invalid: ${validation.errors.join(', ')}`);
      }
      
      logPaystackConfigStatus(envConfig);
      
      paystackConfig = {
        secret_key: envConfig.secretKey,
        test_mode: envConfig.isTestMode,
        environment: envConfig.environment
      };
      
      console.log('🔑 Using secret key type:', envConfig.isTestMode ? 'test' : 'live');
      
    } catch (configError) {
      console.error('❌ Environment config failed:', configError);
      
      // Fallback: try legacy environment variable
      const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
      if (!paystackSecretKey) {
        throw new Error('Paystack not configured - ' + configError.message);
      }
      
      console.log('🔄 Using fallback PAYSTACK_SECRET_KEY');
      paystackConfig = {
        secret_key: paystackSecretKey,
        test_mode: paystackSecretKey.startsWith('sk_test_')
      };
    }

    switch (action) {
      case 'initialize': {
        console.log('🚀 Initializing payment with Paystack')
        
        // Validate required fields
        if (!email || !amount) {
          throw new Error('Email and amount are required for payment initialization')
        }
        
        // Generate server-only backend reference in txn_ format
        const txnReference = `txn_${Date.now()}_${crypto.randomUUID()}`
        console.log('✅ Server-generated reference:', txnReference)
        
        // Build proper callback URL with all necessary parameters
        const baseUrl = callback_url ? new URL(callback_url).origin : 'https://startersmallchops.com'
        const enhancedCallbackUrl = `${baseUrl}/payment/callback?reference=${txnReference}&order_id=${order_id || ''}&status=success`
        
        console.log('📞 Callback URL:', enhancedCallbackUrl)
        
        const paymentRequest = {
          email,
          amount: Math.round(Number(amount) * 100).toString(), // Convert to kobo and stringify for Paystack
          currency: 'NGN',
          reference: txnReference,
          channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer'],
          metadata: JSON.stringify({
            order_id,
            customer_name: metadata?.customer_name || 'Customer',
            order_number: metadata?.order_number || 'N/A'
          })
        }
        
        console.log('🚀 Sending to Paystack:', JSON.stringify(paymentRequest))
        
        // Add timeout for initialization
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT);
        
        const initializeResponse = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${paystackConfig.secret_key}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(paymentRequest),
          signal: controller.signal
        });
        
        clearTimeout(timeoutId);

        console.log('📡 Paystack response status:', initializeResponse.status)
        const initData = await initializeResponse.json()
        console.log('📦 Paystack response data:', JSON.stringify(initData))
        
        if (!initData.status) {
          console.error('❌ Paystack initialization failed:', initData)
          throw new Error(`Paystack initialization failed: ${initData.message}`)
        }

        console.log('Paystack payment initialized successfully:', txnReference)

        // CRITICAL FIX: Create payment transaction record during initialization
        try {
          console.log('💾 Creating payment transaction record')
          const { error: transactionError } = await supabase
            .from('payment_transactions')
            .insert({
              provider_reference: txnReference,
              order_id: order_id,
              amount: Math.round(Number(amount)),
              currency: 'NGN',
              status: 'pending',
              gateway_response: 'Payment initialized',
              metadata: {
                order_id,
                ...metadata,
                paystack_access_code: initData.data.access_code
              },
              created_at: new Date().toISOString()
            })
          
          if (transactionError) {
            console.error('❌ Failed to create payment transaction:', transactionError)
            // Don't fail the payment initialization, but log for monitoring
          } else {
            console.log('✅ Payment transaction record created successfully')
          }
        } catch (dbError) {
          console.error('❌ Database error creating transaction:', dbError)
          // Continue with payment initialization
        }

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

        // Enhanced reference validation and normalization
        const normalizedReference = normalizePaymentReference(reference);
        if (!normalizedReference) {
          console.error(`❌ Invalid payment reference format: ${reference}`);
          return new Response(JSON.stringify({
            success: false,
            error: 'Invalid payment reference format',
            code: 'INVALID_REFERENCE',
            retryable: false,
            reference
          }), {
            status: 400,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        // Try database fallback first for recently processed payments
        try {
          const { data: existingPayment } = await supabase
            .from('payment_transactions')
            .select('*')
            .eq('provider_reference', normalizedReference)
            .eq('status', 'paid')
            .single();

          if (existingPayment) {
            console.log('✅ Payment found in database, skipping API call');
            return new Response(JSON.stringify({
              status: true,
              data: {
                reference: existingPayment.provider_reference,
                amount: existingPayment.amount,
                status: 'success',
                currency: existingPayment.currency || 'NGN',
                paid_at: existingPayment.paid_at,
                channel: existingPayment.metadata?.channel || 'card'
              }
            }), {
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (dbError) {
          console.log('Database fallback failed, proceeding with API verification');
        }

        let retryCount = 0;
        let verifyResponse;
        let lastError;
        
        while (retryCount < MAX_RETRIES) {
          try {
            // Add AbortController for timeout
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), PAYSTACK_TIMEOUT);
            
            verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${normalizedReference}`, {
              method: 'GET',
              headers: {
                'Authorization': `Bearer ${paystackConfig.secret_key}`,
                'Content-Type': 'application/json',
              },
              signal: controller.signal
            });
            
            clearTimeout(timeoutId);
            
            if (verifyResponse.ok) break; // Success, exit retry loop
            
            const errorText = await verifyResponse.text();
            lastError = new Error(`Paystack API error (${verifyResponse.status}): ${errorText}`);
            
            // Don't retry for 4xx errors (client errors)
            if (verifyResponse.status >= 400 && verifyResponse.status < 500) {
              console.error(`❌ Paystack verification HTTP error: ${verifyResponse.status} ${errorText}`);
              
              // Check if payment reference was not found - try fallback strategies
              if (verifyResponse.status === 400 && errorText.includes('Transaction reference not found')) {
                const fallbackResult = await tryReferenceRecovery(normalizedReference, supabase);
                if (fallbackResult) return fallbackResult;
              }
              
              throw lastError;
            }
            
            throw lastError;
            
          } catch (error) {
            lastError = error;
            retryCount++;
            logError('PAYSTACK_VERIFY_ATTEMPT', error, { attempt: retryCount, reference: normalizedReference });
            
            if (retryCount >= MAX_RETRIES) {
              console.error('❌ Paystack verification failed after retries:', error);
              
              // Try database recovery as final fallback
              const dbFallback = await tryDatabaseRecovery(normalizedReference, supabase);
              if (dbFallback) return dbFallback;
              
              return new Response(JSON.stringify({
                success: false,
                error: 'Payment verification temporarily unavailable',
                code: 'VERIFICATION_TIMEOUT',
                retryable: true,
                reference: normalizedReference,
                details: lastError.message
              }), {
                status: 503,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
            
            // Only retry for 5xx errors (server errors) or network errors
            if (verifyResponse && verifyResponse.status >= 400 && verifyResponse.status < 500) {
              break; // Don't retry client errors
            }
            
            // Exponential backoff: wait 1s, 2s, 4s
            await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, retryCount - 1)));
          }
        }

        const verificationData = await verifyResponse.json()
        
        if (!verificationData.status) {
          console.error('❌ Paystack verification failed:', verificationData)
          
          // Try database recovery for failed API calls
          const dbFallback = await tryDatabaseRecovery(normalizedReference, supabase);
          if (dbFallback) return dbFallback;
          
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
            try {
              const { data: updateResult, error: updateError } = await supabase
                .rpc('handle_successful_payment', {
                  p_paystack_reference: paymentData.reference,
                  p_order_reference: orderReference,
                  p_amount: paymentData.amount / 100,
                  p_currency: paymentData.currency || 'NGN',
                  p_paystack_data: paymentData
                });

              if (updateError) {
                logError('RPC_ERROR', updateError, { reference, orderReference });
                
                // Check if it's a duplicate processing attempt
                if (updateError.code === '23505' || updateError.message.includes('duplicate')) {
                  return new Response(JSON.stringify({
                    status: true,
                    message: 'Payment already processed',
                    reference: paymentData.reference,
                    data: {
                      reference: paymentData.reference,
                      amount: paymentData.amount / 100,
                      status: paymentData.status,
                      currency: paymentData.currency,
                      paid_at: paymentData.paid_at,
                      channel: paymentData.channel
                    }
                  }), {
                    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                  });
                }
                
                // Other database errors
                return new Response(JSON.stringify({
                  success: false,
                  error: 'Database update failed',
                  code: 'DB_ERROR',
                  retryable: true,
                  reference: paymentData.reference
                }), {
                  status: 503,
                  headers: { ...corsHeaders, 'Content-Type': 'application/json' }
                });
              }

              console.log('✅ Order updated successfully:', updateResult);
              
            } catch (dbError) {
              logError('DB_CONNECTION_ERROR', dbError, { reference, orderReference });
              return new Response(JSON.stringify({
                success: false,
                error: 'Database temporarily unavailable',
                code: 'DB_CONNECTION_ERROR',
                retryable: true,
                reference: paymentData.reference
              }), {
                status: 503,
                headers: { ...corsHeaders, 'Content-Type': 'application/json' }
              });
            }
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
        );
      }

      default:
        throw new Error(`Unknown action: ${action}`)
    }

  } catch (error) {
    logError('PAYMENT_HANDLER', error, { url: req.url });

    return new Response(
      JSON.stringify({
        status: false,
        error: error.message || 'Payment service temporarily unavailable',
        code: 'INTERNAL_ERROR'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503
      }
    )
  }
};

// Main handler with request tracking
serve(async (req: Request) => {
  const requestId = crypto.randomUUID();
  const startTime = Date.now();
  
  try {
    const result = await handlePaymentRequest(req);
    
    // Log successful requests
    console.log('PAYMENT_SUCCESS:', {
      request_id: requestId,
      duration: Date.now() - startTime,
      timestamp: new Date().toISOString()
    });
    
    return result;
    
  } catch (error) {
    logError('PAYMENT_HANDLER', error, {
      request_id: requestId,
      duration: Date.now() - startTime,
      url: req.url
    });
    
    return new Response(JSON.stringify({
      status: false,
      error: 'Payment service temporarily unavailable',
      request_id: requestId
    }), {
      status: 503,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

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