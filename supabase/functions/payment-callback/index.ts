import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getPaystackConfig, validatePaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts';

// ENHANCED CORS HANDLING for production
const getCorsHeaders = (req: Request) => {
  const origin = req.headers.get('origin');
  const referer = req.headers.get('referer');
  
  // Define allowed origins for your production environment
  const allowedOrigins = [
    'https://startersmallchops.com',
    'https://www.startersmallchops.com',
    'https://startersmallchops.lovableproject.com',
    'https://startersmallchops.lovable.app',
    'https://checkout.paystack.com',
    'https://api.paystack.co',
    'https://js.paystack.co',
    'http://localhost:3000', // Remove in production
    'http://localhost:5173', // Remove in production
  ];

  let corsOrigin = '*'; // Default for webhooks

  // For requests with origin, validate against allowed list
  if (origin) {
    if (allowedOrigins.includes(origin)) {
      corsOrigin = origin;
    } else {
      console.log(`🔒 Origin not in allowed list: ${origin}`);
    }
  } else if (referer) {
    // Fallback to referer domain
    try {
      const refererUrl = new URL(referer);
      const refererOrigin = `${refererUrl.protocol}//${refererUrl.host}`;
      if (allowedOrigins.includes(refererOrigin)) {
        corsOrigin = refererOrigin;
      }
    } catch (error) {
      console.warn('⚠️ Invalid referer URL:', referer);
    }
  } else {
    // No origin/referer - this is normal for webhooks
    console.log('ℹ️ No origin header - webhook or server-to-server call (normal)');
  }

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Max-Age': '86400', // Cache preflight for 24 hours
    'Vary': 'Origin', // Important for caching
  };
};

const VERSION = "v2025-09-17-production-ready-bulletproof";

// Define valid order status enum values
const VALID_ORDER_STATUSES = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled', 'refunded', 'completed', 'returned'] as const;
type OrderStatus = typeof VALID_ORDER_STATUSES[number];

// Paystack status to internal status mapping with safe fallbacks
const PAYSTACK_STATUS_MAP: Record<string, OrderStatus> = {
  'success': 'confirmed',
  'failed': 'cancelled',
  'abandoned': 'cancelled',
  'pending': 'pending',
  'processing': 'pending'
};

interface PaystackWebhookPayload {
  event: string;
  data: {
    status: string;
    reference: string;
    amount: number;
    customer: {
      email: string;
    };
    metadata?: {
      order_id?: string;
      user_id?: string;
    };
  };
}

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

    // Step 6: Process the verified payment with bulletproof validation
    const orderResult = await processVerifiedPaymentSafe(supabase, reference, verificationResult.data);
    
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
        reference = body.reference || body.trxref || body.txref || body.tx_ref || body.data?.reference;
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

// CRITICAL: Process verified payment with bulletproof validation
async function processVerifiedPaymentSafe(supabase: any, reference: string, paystackData: any) {
  try {
    const paystackAmount = paystackData.amount ? paystackData.amount / 100 : null;
    const paystackStatus = paystackData.status?.toLowerCase().trim();

    // CRITICAL FIX: Robust status mapping with fallbacks
    let orderStatus: OrderStatus;

    if (!paystackStatus || paystackStatus === 'null' || paystackStatus === '') {
      log('warn', '⚠️ Empty or null status from Paystack, defaulting to confirmed');
      orderStatus = 'confirmed';
    } else if (PAYSTACK_STATUS_MAP[paystackStatus]) {
      orderStatus = PAYSTACK_STATUS_MAP[paystackStatus];
    } else {
      log('warn', '⚠️ Unknown Paystack status:', paystackStatus, 'defaulting to confirmed');
      orderStatus = 'confirmed';
    }

    // Additional validation: Ensure we never pass null/undefined
    if (!orderStatus || !VALID_ORDER_STATUSES.includes(orderStatus)) {
      log('error', '❌ Invalid order status after mapping:', orderStatus);
      orderStatus = 'confirmed'; // Safe fallback
    }

    log('info', '✅ Mapped status:', paystackStatus, '->', orderStatus);

    log('info', '🔧 Processing verified payment via enhanced RPC', {
      reference,
      amount: paystackAmount,
      currency: paystackData.currency,
      mappedStatus: orderStatus
    });

    // Call the enhanced RPC function with bulletproof validation
    const { data: rpcResult, error: rpcError } = await supabase.rpc('update_order_status_safe', {
      p_reference: reference,
      p_status: orderStatus,
      p_amount: paystackData.amount, // Keep in kobo for logging
      p_customer_email: paystackData.customer?.email || null
    });

    if (rpcError) {
      log('error', '❌ RPC Error:', rpcError);
      return {
        success: false,
        error: `Database update failed: ${rpcError.message}`
      };
    }

    if (!rpcResult || !rpcResult.success) {
      log('error', '❌ RPC returned unsuccessful result', { rpcResult });
      return {
        success: false,
        error: rpcResult?.error || 'Payment processing failed'
      };
    }

    log('info', '✅ Payment processed successfully via enhanced RPC', rpcResult);

    return {
      success: true,
      order_id: rpcResult.order_id,
      order_number: rpcResult.order_number,
      status: rpcResult.status,
      reference: rpcResult.reference
    };

  } catch (error) {
    log('error', '❌ Payment processing exception', {
      reference,
      error: error.message,
      stack: error.stack
    });
    return {
      success: false,
      error: `Payment processing failed: ${error.message}`
    };
  }
}

// Create error redirect response
function createErrorRedirect(message: string, reference?: string): Response {
  const baseUrl = 'https://startersmallchops.com';
  const errorUrl = `${baseUrl}/payment/callback?status=error&message=${encodeURIComponent(message)}${reference ? `&reference=${encodeURIComponent(reference)}` : ''}`;
  
  log('error', '❌ Creating error redirect', {
    errorUrl,
    message,
    reference
  });
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': errorUrl,
      ...getCorsHeaders(null)
    }
  });
}

// Create success redirect response
function createSuccessRedirect(reference: string, orderId?: string): Response {
  const baseUrl = 'https://startersmallchops.com';
  const successUrl = `${baseUrl}/payment/callback?status=success&reference=${encodeURIComponent(reference)}${orderId ? `&order_id=${encodeURIComponent(orderId)}` : ''}`;
  
  log('info', '✅ Creating success redirect', {
    successUrl,
    reference,
    orderId
  });
  
  return new Response(null, {
    status: 302,
    headers: {
      'Location': successUrl,
      ...getCorsHeaders(null)
    }
  });
}