import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from '../_shared/cors.ts';
import { getPaystackConfig, validatePaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts';

const VERSION = "v2025-08-22-centralized-config";

// Enhanced logging function
function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [payment-callback ${VERSION}] ${level.toUpperCase()}: ${message}`;
  
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  log('info', '🔄 Payment callback function invoked', {
    method: req.method,
    url: req.url,
    headers: Object.fromEntries(req.headers.entries())
  });

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Step 1: Extract reference with comprehensive debugging
    const reference = await extractReference(req);
    
    if (!reference) {
      log('error', '❌ No payment reference found in request');
      return createErrorRedirect('Missing payment reference - please ensure the payment was completed properly');
    }

    log('info', '📋 Processing payment reference', { reference });

    // Step 2: Validate reference format
    if (!isValidReference(reference)) {
      log('error', '❌ Invalid reference format', { reference });
      return createErrorRedirect(`Invalid payment reference format: ${reference}`);
    }

    // Step 3: Initialize Supabase client
    const supabase = createSupabaseClient();
    if (!supabase) {
      log('error', '❌ Failed to initialize Supabase client');
      return createErrorRedirect('Database connection failed');
    }

    // Step 4: Check if payment is already processed
    const existingPayment = await checkExistingPayment(supabase, reference);
    if (existingPayment?.processed) {
      log('info', '✅ Payment already processed, redirecting to success', { reference });
      return createSuccessRedirect(reference, existingPayment.order_id);
    }

    // Step 5: Verify payment with Paystack (with retries)
    log('info', '🔍 Starting Paystack verification...');
    const verificationResult = await verifyPaymentWithRetry(reference, 3, req);
    
    if (!verificationResult.success) {
      log('error', '❌ Paystack verification failed', {
        reference,
        error: verificationResult.error,
        attempts: verificationResult.attempts
      });
      return createErrorRedirect(`Payment verification failed: ${verificationResult.error}`);
    }

    log('info', '✅ Paystack verification successful', {
      reference,
      amount: verificationResult.data.amount,
      status: verificationResult.data.status
    });

    // Step 6: Process the verified payment
    const orderResult = await processVerifiedPayment(supabase, reference, verificationResult.data);
    
    if (!orderResult.success) {
      log('error', '❌ Order processing failed', { reference, error: orderResult.error });
      return createErrorRedirect(`Order processing failed: ${orderResult.error}`, reference);
    }

    log('info', '✅ Payment callback completed successfully', {
      reference,
      order_id: orderResult.order_id,
      order_number: orderResult.order_number
    });

    // Step 7: Redirect to success page
    return createSuccessRedirect(reference, orderResult.order_id);

  } catch (error) {
    log('error', '❌ Unexpected error in payment callback', {
      error: error.message,
      stack: error.stack
    });
    return createErrorRedirect(`Callback processing failed: ${error.message}`);
  }
});

// Enhanced reference extraction with multiple fallbacks
async function extractReference(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  
  // Check URL parameters first
  let reference = url.searchParams.get('reference') || 
                 url.searchParams.get('trxref') || 
                 url.searchParams.get('txref') ||
                 url.searchParams.get('tx_ref');

  log('info', '🔍 Checking URL parameters for reference', {
    urlParams: Object.fromEntries(url.searchParams.entries()),
    foundReference: reference
  });

  // If not in URL, check request body
  if (!reference && (req.method === 'POST' || req.method === 'PUT')) {
    try {
      const contentType = req.headers.get('content-type') || '';
      
      if (contentType.includes('application/json')) {
        const body = await req.json();
        reference = body.reference || body.trxref || body.txref || body.tx_ref;
        log('info', '🔍 Checking JSON body for reference', { body, foundReference: reference });
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData();
        reference = formData.get('reference') || formData.get('trxref') || formData.get('txref');
        log('info', '🔍 Checking form data for reference', { foundReference: reference });
      }
    } catch (e) {
      log('warn', '⚠️ Could not parse request body', { error: e.message });
    }
  }

  return reference;
}

// Enhanced reference validation with placeholder detection
function isValidReference(reference: string): boolean {
  if (!reference || typeof reference !== 'string') {
    return false;
  }
  
  // Check length (reasonable bounds)
  if (reference.length < 5 || reference.length > 200) {
    return false;
  }
  
  // Guard against placeholder/test references
  const placeholderPatterns = [
    /^(test_|demo_|sample_|placeholder)/i,
    /^txn_0+_/,
    /^pay_0+_/,
    /example/i,
    /dummy/i
  ];
  
  const isPlaceholder = placeholderPatterns.some(pattern => pattern.test(reference));
  
  if (isPlaceholder) {
    log('error', '❌ Placeholder reference detected', { reference });
    return false;
  }
  
  // Check for valid characters (alphanumeric, underscore, hyphen)
  const validFormat = /^[a-zA-Z0-9_-]+$/.test(reference);
  
  log('info', '🔍 Reference validation', {
    reference,
    length: reference.length,
    validFormat,
    isPlaceholder,
    isValid: validFormat && !isPlaceholder
  });
  
  return validFormat && !isPlaceholder;
}

// Initialize Supabase client with error handling
function createSupabaseClient() {
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !serviceRoleKey) {
      log('error', '❌ Missing Supabase configuration', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!serviceRoleKey
      });
      return null;
    }

    return createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false }
    });
  } catch (error) {
    log('error', '❌ Failed to create Supabase client', { error: error.message });
    return null;
  }
}

// Check if payment is already processed
async function checkExistingPayment(supabase: any, reference: string) {
  try {
    log('info', '🔍 Checking for existing payment', { reference });
    
    const { data, error } = await supabase
      .from('orders')
      .select('id, order_number, status, payment_status')
      .eq('payment_reference', reference)
      .single();

    if (error && error.code !== 'PGRST116') { // PGRST116 = not found
      log('warn', '⚠️ Error checking existing payment', { reference, error });
      return null;
    }

    if (data) {
      const processed = data.status === 'confirmed' && data.payment_status === 'paid';
      log('info', '🔍 Existing payment found', {
        reference,
        order_id: data.id,
        status: data.status,
        payment_status: data.payment_status,
        processed
      });
      
      return {
        order_id: data.id,
        order_number: data.order_number,
        processed
      };
    }

    return null;
  } catch (error) {
    log('error', '❌ Failed to check existing payment', { reference, error: error.message });
    return null;
  }
}

// Enhanced Paystack verification with retry logic
async function verifyPaymentWithRetry(reference: string, maxAttempts: number = 3, req?: Request) {
  let lastError = null;
  
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    log('info', `🔍 Paystack verification attempt ${attempt}/${maxAttempts}`, { reference });
    
    try {
      const result = await verifyPaymentWithPaystack(reference, req);
      
      if (result.success) {
        return { ...result, attempts: attempt };
      }
      
      lastError = result.error;
      
      // Enhanced retry logic: retry on 400 "Transaction reference not found" AND 404 errors
      const isRetryableError = result.error.includes('not found') || 
                               result.error.includes('Transaction reference not found') ||
                               result.error.includes('400');
      
      if (isRetryableError && attempt < maxAttempts) {
        const delay = attempt * 2000; // Exponential backoff: 2s, 4s, 6s
        log('info', `⏳ Retryable error detected, waiting ${delay}ms before retry...`, { 
          reference, 
          attempt, 
          error: result.error,
          isRetryableError 
        });
        await new Promise(resolve => setTimeout(resolve, delay));
        continue;
      }
      
      // For non-retryable errors, break immediately
      if (!isRetryableError) {
        log('warn', '❌ Non-retryable error, stopping attempts', { 
          reference, 
          error: result.error,
          attempt 
        });
        break;
      }
      
    } catch (error) {
      lastError = error.message;
      log('error', `❌ Attempt ${attempt} failed`, { reference, error: error.message });
      
      if (attempt < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }
  }
  
  return {
    success: false,
    error: lastError || 'All verification attempts failed',
    attempts: maxAttempts
  };
}

// Enhanced Paystack verification function
async function verifyPaymentWithPaystack(reference: string, req?: Request) {
  try {
    // Get centralized configuration
    const paystackConfig = getPaystackConfiguration(req || new Request('https://example.com'));
    if (!paystackConfig) {
      return {
        success: false,
        error: 'Paystack configuration not available'
      };
    }

    log('info', '🔍 Making Paystack API request', {
      reference,
      keyEnvironment: paystackConfig.isTestMode ? 'TEST' : 'LIVE',
      keyPrefix: paystackConfig.secretKey.substring(0, 10) + '...'
    });

    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackConfig.secretKey}`,
        'Content-Type': 'application/json',
        'User-Agent': `PaystackCallback/${VERSION}`
      },
      signal: AbortSignal.timeout(15000)
    });

    log('info', '🔍 Paystack API response received', {
      reference,
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries())
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      log('error', '❌ Paystack API error response', {
        reference,
        status: response.status,
        responseText
      });
      return {
        success: false,
        error: `Paystack API error: ${response.status} - ${responseText}`
      };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      log('error', '❌ Failed to parse Paystack response', {
        reference,
        responseText,
        parseError: parseError.message
      });
      return {
        success: false,
        error: 'Invalid response format from Paystack'
      };
    }

    log('info', '🔍 Parsed Paystack response', {
      reference,
      dataStatus: data.status,
      transactionStatus: data.data?.status,
      amount: data.data?.amount,
      currency: data.data?.currency
    });

    if (!data.status) {
      return {
        success: false,
        error: data.message || 'Paystack verification failed'
      };
    }

    if (data.data.status !== 'success') {
      return {
        success: false,
        error: `Payment status is ${data.data.status}: ${data.data.gateway_response || 'Transaction not successful'}`
      };
    }

    log('info', '✅ Paystack verification successful', {
      reference,
      amount: data.data.amount / 100,
      currency: data.data.currency,
      customer: data.data.customer?.email
    });

    return {
      success: true,
      data: data.data
    };

  } catch (error) {
    log('error', '❌ Paystack verification exception', {
      reference,
      error: error.message,
      stack: error.stack
    });
    return {
      success: false,
      error: `Verification failed: ${error.message}`
    };
  }
}

// Enhanced Paystack configuration using centralized config
function getPaystackConfiguration(req: Request) {
  try {
    const config = getPaystackConfig(req);
    const validation = validatePaystackConfig(config);
    
    if (!validation.isValid) {
      log('error', '❌ Paystack configuration invalid', { errors: validation.errors });
      return null;
    }
    
    logPaystackConfigStatus(config);
    return config;
  } catch (error) {
    log('error', '❌ Failed to get Paystack configuration', { error: error.message });
    return null;
  }
}

// Process verified payment
async function processVerifiedPayment(supabase: any, reference: string, paystackData: any) {
  try {
    const paystackAmount = paystackData.amount ? paystackData.amount / 100 : null;

    log('info', '🔧 Processing verified payment via RPC', {
      reference,
      amount: paystackAmount,
      currency: paystackData.currency
    });

    // Use secure RPC to verify and update payment status
    const { data: orderResult, error: rpcError } = await supabase.rpc('verify_and_update_payment_status', {
      payment_ref: reference,
      new_status: 'confirmed',
      payment_amount: paystackAmount,
      payment_gateway_response: paystackData
    });

    // Handle both array and object returns from RPC (or use existing order data from duplicate key handling)
    let orderData;
    
    if (rpcError) {
      // Handle duplicate key violation as idempotent success
      const isDuplicateKeyError = rpcError.message?.includes('duplicate key value violates unique constraint') ||
                                 rpcError.message?.includes('idx_communication_events_unique_payment_confirmation');
      
      if (isDuplicateKeyError) {
        log('info', '✅ Duplicate key detected - payment already processed, fetching existing order', { 
          reference, 
          error: rpcError.message 
        });
        
        // Fetch existing order details since payment is already processed
        try {
          const { data: existingOrder, error: fetchError } = await supabase
            .from('orders')
            .select('id, order_number, customer_name, customer_email, total_amount, order_type')
            .eq('payment_reference', reference)
            .single();
            
          if (fetchError || !existingOrder) {
            log('error', '❌ Could not fetch existing order after duplicate key error', { 
              reference, 
              fetchError: fetchError?.message 
            });
            return {
              success: false,
              error: 'Payment processed but order details unavailable'
            };
          }
          
          log('info', '✅ Retrieved existing order details for idempotent success', { 
            reference, 
            order_id: existingOrder.id,
            order_number: existingOrder.order_number
          });
          
          // Use existing order data
          orderData = {
            order_id: existingOrder.id,
            order_number: existingOrder.order_number,
            customer_name: existingOrder.customer_name,
            customer_email: existingOrder.customer_email,
            amount: existingOrder.total_amount,
            order_type: existingOrder.order_type
          };
          
        } catch (fetchException) {
          log('error', '❌ Exception fetching existing order after duplicate key error', { 
            reference, 
            error: fetchException.message 
          });
          return {
            success: false,
            error: 'Payment processed but unable to retrieve order details'
          };
        }
      } else {
        // Non-duplicate errors are genuine failures
        log('error', '❌ RPC verification failed', { reference, error: rpcError });
        
        // Sanitize error message for user display
        const sanitizedError = rpcError.message?.includes('duplicate key') ? 
          'Payment is being processed - please check your order status' :
          'Payment processing temporarily unavailable - please contact support';
          
        return {
          success: false,
          error: sanitizedError
        };
      }
    } else {
      // Normal RPC success - process the returned order data
      if (Array.isArray(orderResult)) {
        if (!orderResult || orderResult.length === 0) {
          log('error', '❌ No order data returned from RPC (array empty)', { reference });
          return {
            success: false,
            error: 'Order not found or already processed'
          };
        }
        orderData = orderResult[0];
      } else if (orderResult && typeof orderResult === 'object') {
        orderData = orderResult;
      } else {
        log('error', '❌ No order data returned from RPC (invalid format)', { reference, orderResult });
        return {
          success: false,
          error: 'Order not found or already processed'
        };
      }
    }

    // Check if RPC returned error result
    if (orderData && orderData.success === false) {
      log('error', '❌ RPC returned error', { reference, error: orderData.error });
      return {
        success: false,
        error: orderData.error || 'Payment processing failed'
      };
    }

    // Ensure we have required fields
    if (!orderData || !orderData.order_id) {
      log('error', '❌ Order data missing required fields', { reference, orderData });
      return {
        success: false,
        error: 'Invalid order data returned'
      };
    }
    log('info', '✅ RPC operation successful', {
      reference,
      order_id: orderData.order_id,
      order_number: orderData.order_number
    });

    // Update payment status and method explicitly (non-blocking)
    try {
      await supabase.from('orders').update({
        payment_status: 'paid',
        payment_method: 'Paystack'
      }).eq('id', orderData.order_id);
      
      log('info', '✅ Payment status and method updated (paid, Paystack)');
    } catch (paymentStatusError) {
      log('warn', '⚠️ Payment status/method update failed (non-blocking)', {
        error: paymentStatusError.message
      });
    }

    // Update/create payment transaction record (non-blocking)
    try {
      await supabase.from('payment_transactions').upsert({
        reference: reference,
        provider_reference: reference,
        amount: paystackAmount || orderData.amount,
        currency: paystackData.currency || 'NGN',
        status: 'completed',
        gateway_response: JSON.stringify(paystackData),
        verified_at: new Date().toISOString(),
        order_id: orderData.order_id
      }, {
        onConflict: 'reference'
      });
      
      log('info', '✅ Payment transaction record updated');
    } catch (txnError) {
      log('warn', '⚠️ Payment transaction update failed (non-blocking)', {
        error: txnError.message
      });
    }

    // Enhanced immediate payment confirmation email with fallback queue
    try {
      const rawEmail = typeof orderData.customer_email === 'string' ? orderData.customer_email.trim() : '';
      if (!rawEmail) {
        log('warn', '⚠️ No valid customer email - skipping payment confirmation', {
          reference,
          order_id: orderData.order_id,
          customer_email: orderData.customer_email
        });
      } else {
        // Avoid duplicates
        const { data: existingConfirmation } = await supabase
          .from('communication_events')
          .select('id, status')
          .eq('order_id', orderData.order_id)
          .eq('recipient_email', rawEmail.toLowerCase())
          .eq('event_type', 'payment_confirmation')
          .eq('template_key', 'payment_confirmation')
          .single();

        if (existingConfirmation) {
          log('info', '✅ Payment confirmation email already exists - skipping duplicate', {
            reference,
            order_id: orderData.order_id,
            existing_id: existingConfirmation.id,
            status: existingConfirmation.status
          });
        } else {
          // Try immediate send
          const res = await supabase.functions.invoke('unified-smtp-sender', {
            body: {
              to: rawEmail,
              subject: 'Payment Confirmation - Order ' + orderData.order_number,
              templateKey: 'payment_confirmation',
              variables: {
                customerName: orderData.customer_name || 'Valued Customer',
                orderNumber: orderData.order_number,
                amount: orderData.amount?.toString() || (paystackAmount ?? 0).toString(),
                paymentMethod: 'Paystack',
                orderType: orderData.order_type || 'order'
              }
            }
          });

          if (res.error) {
            log('warn', '⚠️ Immediate payment confirmation failed - queuing fallback', {
              error: res.error.message || 'Unknown error',
              httpStatus: res.status || 'unknown',
              reference,
              order_id: orderData.order_id,
              customer_email: rawEmail
            });

            try {
              await supabase.from('communication_events').insert({
                order_id: orderData.order_id,
                recipient_email: rawEmail.toLowerCase(),
                event_type: 'payment_confirmation',
                template_key: 'payment_confirmation',
                email_type: 'transactional',
                status: 'queued',
                priority: 'high',
                variables: {
                  customerName: orderData.customer_name || 'Valued Customer',
                  orderNumber: orderData.order_number,
                  amount: orderData.amount?.toString() || (paystackAmount ?? 0).toString(),
                  paymentMethod: 'Paystack'
                }
              });
              log('info', '✅ Payment confirmation fallback queued for later processing');
            } catch (queueError) {
              if (queueError.message?.includes('duplicate key value violates unique constraint')) {
                log('info', '✅ Payment confirmation already queued (duplicate key) - continuing');
              } else {
                log('error', '❌ Failed to queue payment confirmation fallback', {
                  error: queueError.message,
                  reference,
                  order_id: orderData.order_id
                });
              }
            }
          } else {
            log('info', '✅ Immediate payment confirmation email sent successfully');
          }
        }
      }
    } catch (emailError) {
      // Non-blocking: Log the error but don't fail the entire payment process
      log('warn', '⚠️ Payment confirmation email process failed (non-blocking)', {
        error: emailError.message,
        reference,
        order_id: orderData.order_id,
        customer_email: orderData.customer_email
      });
    }

    return {
      success: true,
      order_id: orderData.order_id,
      order_number: orderData.order_number
    };

  } catch (error) {
    log('error', '❌ Payment processing failed', {
      reference,
      error: error.message
    });
    return {
      success: false,
      error: error.message
    };
  }
}

// Create success redirect
function createSuccessRedirect(reference: string, orderId: string) {
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://startersmallchops.com';
  const successUrl = `${frontendUrl}/payment/callback?reference=${encodeURIComponent(reference)}&status=success&order_id=${encodeURIComponent(orderId)}`;
  
  log('info', '✅ Creating success redirect', { successUrl });
  
  const corsHeaders = getCorsHeaders(null);
  
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': successUrl
    }
  });
}

// Create error redirect with sanitized user messages
function createErrorRedirect(message: string, reference?: string) {
  // Sanitize error message for user display
  const sanitizedMessage = sanitizeErrorMessage(message);
  
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://startersmallchops.com';
  const errorParams = new URLSearchParams({
    status: 'error',
    message: sanitizedMessage
  });
  
  // Include reference if provided for better error handling
  if (reference) {
    errorParams.set('reference', reference);
  }
  
  const errorUrl = `${frontendUrl}/payment/callback?${errorParams.toString()}`;
  
  log('error', '❌ Creating error redirect', { 
    errorUrl, 
    originalMessage: message,
    sanitizedMessage,
    reference 
  });
  
  const corsHeaders = getCorsHeaders(null);
  
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': errorUrl
    }
  });
}

// Sanitize error messages for user display
function sanitizeErrorMessage(message: string): string {
  if (!message || typeof message !== 'string') {
    return 'Payment processing encountered an issue - please contact support';
  }
  
  const lowerMessage = message.toLowerCase();
  
  // Map specific error patterns to user-friendly messages
  if (lowerMessage.includes('duplicate key')) {
    return 'Payment is being processed - please check your order status';
  }
  
  if (lowerMessage.includes('constraint') || lowerMessage.includes('violation')) {
    return 'Payment validation failed - please contact support';
  }
  
  if (lowerMessage.includes('timeout') || lowerMessage.includes('network')) {
    return 'Payment verification is taking longer than expected - please check your order status in a few minutes';
  }
  
  if (lowerMessage.includes('not found') || lowerMessage.includes('reference')) {
    return 'Payment reference not found - please ensure the payment was completed properly';
  }
  
  if (lowerMessage.includes('invalid') || lowerMessage.includes('format')) {
    return 'Invalid payment information - please contact support';
  }
  
  if (lowerMessage.includes('database') || lowerMessage.includes('connection')) {
    return 'Service temporarily unavailable - please try again in a few minutes';
  }
  
  if (lowerMessage.includes('paystack') || lowerMessage.includes('api')) {
    return 'Payment gateway temporarily unavailable - please contact support';
  }
  
  // For any unmatched technical errors, provide a generic message
  if (lowerMessage.includes('error') || lowerMessage.includes('failed') || lowerMessage.includes('exception')) {
    return 'Payment processing encountered an issue - please contact support for assistance';
  }
  
  // If message seems user-friendly already (no technical terms), keep it
  const technicalTerms = ['rpc', 'sql', 'postgres', 'supabase', 'function', 'null', 'undefined', 'exception', 'stack'];
  const containsTechnicalTerms = technicalTerms.some(term => lowerMessage.includes(term));
  
  if (!containsTechnicalTerms && message.length < 100) {
    return message;
  }
  
  // Default fallback
  return 'Payment processing is temporarily unavailable - please contact support';
}