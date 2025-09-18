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

// PRODUCTION FIX: Enhanced reference extraction with comprehensive webhook support
async function extractReference(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  
  // Step 1: Check URL parameters first (for callback URLs)
  const urlParams = ['reference', 'trxref', 'txref', 'tx_ref', 'transaction_id', 'payment_reference'];
  let reference = null;
  
  for (const param of urlParams) {
    const value = url.searchParams.get(param);
    if (value && value.trim().length > 5) {
      reference = value.trim();
      break;
    }
  }

  log('info', '🔍 Checking URL parameters for reference', {
    urlParams: Object.fromEntries(url.searchParams.entries()),
    foundReference: reference
  });

  // Step 2: Check request body (for webhook data)
  if (!reference && (req.method === 'POST' || req.method === 'PUT')) {
    try {
      const contentType = req.headers.get('content-type') || '';
      let body: any = null;
      
      if (contentType.includes('application/json')) {
        body = await req.json();
        log('info', '📨 Received webhook body', { 
          eventType: body.event,
          hasData: !!body.data,
          topLevelKeys: Object.keys(body || {})
        });
      } else if (contentType.includes('application/x-www-form-urlencoded')) {
        const formData = await req.formData();
        body = Object.fromEntries(formData.entries());
        log('info', '📝 Received form data', { keys: Object.keys(body || {}) });
      }
      
      if (body) {
        // CRITICAL FIX: Comprehensive reference extraction for multiple webhook formats
        const candidates = [
          // Direct reference fields
          body.reference,
          body.trxref,
          body.txref,
          body.tx_ref,
          body.transaction_id,
          body.payment_reference,
          body.provider_reference,
          
          // Paystack webhook: data.reference (most common)
          body.data?.reference,
          body.data?.trxref,
          body.data?.tx_ref,
          body.data?.transaction_id,
          
          // Alternative webhook formats
          body.transaction?.reference,
          body.payment?.reference,
          body.charge?.reference,
          
          // Deep search in nested objects
          ...searchNestedReference(body, 'reference'),
          ...searchNestedReference(body, 'trxref'),
          ...searchNestedReference(body, 'tx_ref')
        ];
        
        // Find first valid candidate
        reference = candidates.find(candidate => 
          candidate && 
          typeof candidate === 'string' && 
          candidate.trim().length > 5 &&
          !candidate.includes('undefined') &&
          !candidate.includes('null')
        );
        
        log('info', '🔍 Webhook reference extraction', { 
          candidatesFound: candidates.filter(c => c).length,
          foundReference: reference,
          webhookStructure: {
            hasEvent: !!body.event,
            hasData: !!body.data,
            dataKeys: body.data ? Object.keys(body.data) : null
          }
        });
      }
    } catch (e) {
      log('warn', '⚠️ Could not parse request body', { error: e.message });
    }
  }

  // Step 3: Final validation and cleanup
  if (reference) {
    reference = reference.trim();
    log('info', '✅ Reference extracted successfully', { 
      reference, 
      length: reference.length,
      source: url.searchParams.has('reference') ? 'URL' : 'webhook'
    });
  } else {
    log('error', '❌ No payment reference found after comprehensive search', {
      urlParamsCount: url.searchParams.size,
      bodyParsed: req.method === 'POST' || req.method === 'PUT'
    });
  }

  return reference;
}

// Helper function to search for reference fields in nested objects
function searchNestedReference(obj: any, fieldName: string, maxDepth: number = 3): string[] {
  const results: string[] = [];
  
  function search(current: any, depth: number) {
    if (depth > maxDepth || !current || typeof current !== 'object') return;
    
    for (const [key, value] of Object.entries(current)) {
      if (key.toLowerCase().includes(fieldName.toLowerCase()) && typeof value === 'string' && value.length > 5) {
        results.push(value);
      } else if (typeof value === 'object' && value !== null) {
        search(value, depth + 1);
      }
    }
  }
  
  search(obj, 0);
  return results;
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

    // Use secure RPC to verify and update payment status (avoids double trigger firing)
    const { data: orderResult, error: rpcError } = await supabase.rpc('verify_and_update_payment_status', {
      payment_ref: reference,
      new_status: 'confirmed',
      payment_amount: paystackAmount,
      payment_gateway_response: paystackData
    });

    if (rpcError) {
      // Handle duplicate key constraint or payment confirmation duplicates as idempotent success
      if (rpcError.message && (
        rpcError.message.includes('duplicate key value violates unique constraint') ||
        rpcError.message.includes('idx_communication_events_unique_payment_confirmation')
      )) {
        log('info', '✅ Payment confirmation already exists (idempotent success)', { 
          reference, 
          constraint_error: rpcError.message 
        });
        
        // Fetch the existing order for success redirect
        try {
          const { data: existingOrder, error: fetchError } = await supabase
            .from('orders')
            .select('id, order_number, status, payment_status')
            .eq('payment_reference', reference)
            .maybeSingle();
            
          if (fetchError || !existingOrder) {
            log('error', '❌ Could not fetch existing order after duplicate constraint', { 
              reference, 
              fetchError: fetchError?.message 
            });
            return {
              success: false,
              error: 'Payment processed but order details unavailable'
            };
          }
          
          log('info', '✅ Successfully fetched existing order after idempotent success', {
            reference,
            order_id: existingOrder.id,
            order_number: existingOrder.order_number,
            status: existingOrder.status,
            payment_status: existingOrder.payment_status
          });
          
          return {
            success: true,
            order_id: existingOrder.id,
            order_number: existingOrder.order_number
          };
        } catch (fetchError) {
          log('error', '❌ Exception fetching existing order after duplicate constraint', { 
            reference, 
            error: fetchError.message 
          });
          return {
            success: false,
            error: 'Payment processed but order verification failed'
          };
        }
      }
      
      log('error', '❌ RPC verification failed', { reference, error: rpcError });
      return {
        success: false,
        error: rpcError.message || 'Database operation failed'
      };
    }

    // Handle both array and object returns from RPC
    let orderData;
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

    // P0 HOTFIX: Fetch customer_email if missing from RPC response
    let customerEmail = orderData.customer_email;
    let customerName = orderData.customer_name;
    
    if (!customerEmail && orderData.order_id) {
      log('warn', '⚠️ Customer email missing from RPC, fetching from orders table', { 
        order_id: orderData.order_id, 
        reference 
      });
      
      try {
        const { data: orderDetails, error: fetchError } = await supabase
          .from('orders')
          .select('customer_email, customer_name')
          .eq('id', orderData.order_id)
          .maybeSingle();
          
        if (!fetchError && orderDetails) {
          customerEmail = orderDetails.customer_email;
          customerName = orderDetails.customer_name || customerName;
          log('info', '✅ Customer email fetched successfully', { 
            order_id: orderData.order_id, 
            customer_email: customerEmail ? 'present' : 'still_missing',
            reference 
          });
        } else {
          log('warn', '⚠️ Could not fetch customer email from orders table', { 
            order_id: orderData.order_id, 
            error: fetchError?.message,
            reference 
          });
        }
      } catch (fetchException) {
        log('warn', '⚠️ Exception fetching customer email', { 
          order_id: orderData.order_id, 
          error: fetchException.message,
          reference 
        });
      }
    }

    // Enhanced immediate payment confirmation email with fallback queue
    try {
      // P0 HOTFIX: Only attempt email send if we have a valid recipient
      if (!customerEmail || typeof customerEmail !== 'string' || !customerEmail.includes('@')) {
        log('warn', '⚠️ No valid customer email - skipping immediate send, using queue fallback only', {
          order_id: orderData.order_id,
          customer_email: customerEmail ? 'invalid_format' : 'missing',
          reference
        });
        
        // Skip direct send, go straight to fallback queue
        throw new Error('No valid customer email available for immediate send');
      }

      const confirmationEmailResult = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          to: customerEmail,
          subject: 'Payment Confirmation - Order ' + orderData.order_number,
          templateKey: 'payment_confirmation',
          variables: {
            customerName: customerName || 'Valued Customer',
            orderNumber: orderData.order_number,
            amount: orderData.amount?.toString() || paystackAmount?.toString() || '0',
            paymentMethod: 'Paystack',
            orderType: orderData.order_type || 'order'
          }
        }
      });

      // Enhanced error logging with HTTP status and response details
      if (confirmationEmailResult.error) {
        const errorDetails = {
          error: confirmationEmailResult.error.message || 'Unknown error',
          httpStatus: confirmationEmailResult.status || 'unknown',
          responseBody: confirmationEmailResult.data || null,
          order_id: orderData.order_id,
          customer_email: orderData.customer_email,
          reference: reference
        };
        
        log('warn', '⚠️ Immediate payment confirmation email failed - creating idempotent queue fallback', errorDetails);
        
        // Idempotent queue fallback: Use RPC function for safe insertion
        try {
          const { data: eventId, error: rpcError } = await supabase.rpc('upsert_payment_confirmation_event', {
            p_reference: reference,
            p_order_id: orderData.order_id,
            p_recipient_email: customerEmail || orderData.customer_email,
            p_template_variables: {
              customerName: customerName || 'Valued Customer',
              orderNumber: orderData.order_number,
              amount: orderData.amount?.toString() || paystackAmount?.toString() || '0',
              paymentMethod: 'Paystack',
              orderType: orderData.order_type || 'order',
              fallback_reason: 'immediate_send_failed'
            }
          });
          
          if (rpcError) {
            log('warn', '⚠️ Idempotent email event creation failed', {
              order_id: orderData.order_id,
              rpcError: rpcError.message,
              reference
            });
          } else {
            log('info', '✅ Payment confirmation queued for later delivery (idempotent)', {
              order_id: orderData.order_id,
              event_id: eventId,
              fallback_used: true,
              reference
            });
          }
        } catch (queueError) {
          log('error', '❌ Failed to queue payment confirmation fallback via RPC', {
            order_id: orderData.order_id,
            queueError: queueError.message,
            reference
          });
        }
      } else {
        log('info', '✅ Payment confirmation email sent immediately', {
          order_id: orderData.order_id,
          customer_email: customerEmail,
          messageId: confirmationEmailResult.data?.messageId,
          provider: confirmationEmailResult.data?.provider,
          reference
        });
      }
    } catch (emailError) {
      const errorDetails = {
        error: emailError.message,
        stack: emailError.stack,
        order_id: orderData.order_id,
        customer_email: customerEmail,
        reference: reference
      };
      
      log('warn', '⚠️ Exception sending immediate payment confirmation - creating idempotent queue fallback', errorDetails);
      
      // Idempotent queue fallback for exceptions too
      try {
        const { data: eventId, error: rpcError } = await supabase.rpc('upsert_payment_confirmation_event', {
          p_reference: reference,
          p_order_id: orderData.order_id,
          p_recipient_email: customerEmail || orderData.customer_email,
          p_template_variables: {
            customerName: customerName || 'Valued Customer',
            orderNumber: orderData.order_number,
            amount: orderData.amount?.toString() || paystackAmount?.toString() || '0',
            paymentMethod: 'Paystack',
            orderType: orderData.order_type || 'order',
            fallback_reason: 'exception_during_send'
          }
        });
        
        if (rpcError) {
          log('error', '❌ Critical: Failed both immediate send and idempotent queue fallback', {
            order_id: orderData.order_id,
            originalError: emailError.message,
            rpcError: rpcError.message,
            reference
          });
        } else {
          log('info', '✅ Payment confirmation queued after exception (idempotent)', {
            order_id: orderData.order_id,
            event_id: eventId,
            fallback_used: true,
            reference
          });
        }
      } catch (queueError) {
        log('error', '❌ Critical: Exception during idempotent queue fallback', {
          order_id: orderData.order_id,
          originalError: emailError.message,
          queueError: queueError.message,
          reference
        });
      }
    }
    } catch (txnError) {
      log('warn', '⚠️ Payment transaction update failed (non-blocking)', {
        error: txnError.message
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

// Create error redirect
function createErrorRedirect(message: string, reference?: string) {
  const frontendUrl = Deno.env.get('FRONTEND_URL') || 'https://startersmallchops.com';
  const errorParams = new URLSearchParams({
    status: 'error',
    message: message
  });
  
  // Include reference if provided for better error handling
  if (reference) {
    errorParams.set('reference', reference);
  }
  
  const errorUrl = `${frontendUrl}/payment/callback?${errorParams.toString()}`;
  
  log('error', '❌ Creating error redirect', { errorUrl, message, reference });
  
  const corsHeaders = getCorsHeaders(null);
  
  return new Response(null, {
    status: 302,
    headers: {
      ...corsHeaders,
      'Location': errorUrl
    }
  });
}