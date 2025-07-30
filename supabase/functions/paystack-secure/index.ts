import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PaymentValidator } from "../_shared/payment-validators.ts";
import { DistributedRateLimiter } from "../_shared/rate-limiter.ts";

// PRODUCTION CORS - Restrict to specific origins
const getAllowedOrigins = (): string[] => {
  const origins = Deno.env.get('ALLOWED_ORIGINS');
  if (!origins) {
    console.warn('ALLOWED_ORIGINS not set, using localhost for development');
    return ['http://localhost:5173', 'https://localhost:5173'];
  }
  return origins.split(',').map(origin => origin.trim());
};

const createCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = getAllowedOrigins();
  const isAllowed = origin && allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : allowedOrigins[0],
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400', // 24 hours
    'Vary': 'Origin'
  };
};

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = createCorsHeaders(origin);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { 
      headers: corsHeaders,
      status: 204
    });
  }

  // Only allow POST method
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({
      status: false,
      error: 'Method not allowed'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 405,
    });
  }

  let supabaseClient;
  let user;

  try {
    // Initialize Supabase with enhanced security
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { 
        auth: { 
          persistSession: false,
          autoRefreshToken: false 
        }
      }
    );

    // Enhanced IP detection for security
    const clientIP = req.headers.get('cf-connecting-ip') || 
                    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                    req.headers.get('x-real-ip') || 
                    'unknown';

    // Check if IP is blocked
    const ipBlockStatus = await DistributedRateLimiter.isIPBlocked(clientIP);
    if (ipBlockStatus.blocked) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Access temporarily restricted',
        retryAfter: Math.ceil((ipBlockStatus.unblockTime?.getTime() - Date.now()) / 1000)
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 429,
      });
    }

    // Multi-layer rate limiting
    const [globalLimit, ipLimit] = await Promise.all([
      DistributedRateLimiter.checkGlobalRateLimit('payment'),
      DistributedRateLimiter.checkIPRateLimit(clientIP, 'payment')
    ]);

    if (!globalLimit.allowed) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Service temporarily unavailable',
        retryAfter: globalLimit.retryAfter
      }), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': globalLimit.retryAfter?.toString() || '60'
        },
        status: 503,
      });
    }

    if (!ipLimit.allowed) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Too many requests from this IP',
        retryAfter: ipLimit.retryAfter
      }), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': ipLimit.retryAfter?.toString() || '60'
        },
        status: 429,
      });
    }

    // Enhanced authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Authentication required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Validate JWT token
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      await DistributedRateLimiter.blockSuspiciousIP(
        clientIP, 
        'Invalid authentication attempts', 
        15 * 60 * 1000 // 15 minutes
      );

      return new Response(JSON.stringify({
        status: false,
        error: 'Invalid authentication'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    user = userData.user;

    // User-specific rate limiting
    const userLimit = await DistributedRateLimiter.checkUserRateLimit(user.id, 'payment');
    if (!userLimit.allowed) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Too many payment attempts',
        retryAfter: userLimit.retryAfter
      }), {
        headers: { 
          ...corsHeaders, 
          'Content-Type': 'application/json',
          'Retry-After': userLimit.retryAfter?.toString() || '60'
        },
        status: 429,
      });
    }

    // Enhanced input validation
    const contentType = req.headers.get('content-type');
    if (!contentType || !contentType.includes('application/json')) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Content-Type must be application/json'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    let body;
    try {
      const rawBody = await req.text();
      if (rawBody.length > 10240) { // 10KB limit
        throw new Error('Request body too large');
      }
      body = JSON.parse(rawBody);
    } catch (parseError) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Invalid JSON format'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { action, ...actionData } = body;

    // Route to appropriate handler with enhanced security
    switch (action) {
      case 'initialize':
        return await handleInitializePayment(supabaseClient, user, actionData, corsHeaders);
      case 'verify':
        return await handleVerifyPayment(supabaseClient, user, actionData, corsHeaders);
      case 'charge':
        return await handleChargePayment(supabaseClient, user, actionData, corsHeaders);
      default:
        return new Response(JSON.stringify({
          status: false,
          error: 'Invalid action specified'
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 400,
        });
    }

  } catch (error) {
    console.error('Paystack secure endpoint error:', error);
    
    // Enhanced error logging
    if (supabaseClient && user) {
      try {
        await supabaseClient.from('payment_error_logs').insert({
          user_id: user.id,
          error_type: 'secure_endpoint_error',
          error_message: error.message,
          error_stack: error.stack,
          occurred_at: new Date()
        });
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
    }

    return new Response(JSON.stringify({
      status: false,
      error: 'Internal server error'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Enhanced payment initialization
async function handleInitializePayment(supabaseClient: any, user: any, data: any, corsHeaders: any) {
  const { email, amount, currency = 'NGN', reference, callback_url, metadata = {}, orderId } = data;

  // Enhanced validation
  const validationErrors = [];
  
  if (!email || typeof email !== 'string' || !email.includes('@')) {
    validationErrors.push('Valid email is required');
  }

  const amountValidation = PaymentValidator.validateAmount(parseFloat(amount), currency);
  if (!amountValidation.isValid) {
    validationErrors.push(...amountValidation.errors);
  }

  // Additional security validations
  if (email.length > 254) { // RFC 5321 limit
    validationErrors.push('Email address too long');
  }

  if (callback_url && !isValidURL(callback_url)) {
    validationErrors.push('Invalid callback URL');
  }

  if (validationErrors.length > 0) {
    return new Response(JSON.stringify({
      status: false,
      error: 'Validation failed',
      details: validationErrors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Get active Paystack configuration
  const { data: config } = await supabaseClient.rpc('get_active_paystack_config');
  
  if (!config) {
    return new Response(JSON.stringify({
      status: false,
      error: 'Payment system not configured'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 503,
    });
  }

  // Generate secure reference
  const transactionRef = reference || PaymentValidator.generateSecureReference('PAY');
  
  // Order amount verification if orderId provided
  if (orderId) {
    const orderVerification = await PaymentValidator.verifyOrderAmount(orderId, amountValidation.sanitizedAmount, currency);
    if (!orderVerification.isValid) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Order amount mismatch',
        details: orderVerification.errors
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
  }

  // Create transaction record with enhanced security
  const { data: transaction, error: dbError } = await supabaseClient
    .from('payment_transactions')
    .insert({
      transaction_reference: transactionRef,
      provider: 'paystack',
      order_id: orderId,
      amount: amountValidation.sanitizedAmount,
      currency: currency,
      customer_email: email,
      metadata: { 
        ...metadata, 
        user_id: user.id,
        ip_address: 'redacted', // Don't store IP in metadata
        user_agent: 'redacted'  // Don't store user agent
      },
      status: 'pending',
      transaction_type: 'initialize'
    })
    .select()
    .single();

  if (dbError) {
    throw new Error('Failed to create payment record');
  }

  // Initialize with Paystack using enhanced security
  const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.secret_key}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Supabase-Paystack-Integration/1.0'
    },
    body: JSON.stringify({
      email,
      amount: amountValidation.subunitAmount,
      currency,
      reference: transactionRef,
      callback_url: callback_url || `${Deno.env.get('FRONTEND_URL')}/payment/callback`,
      metadata: { ...metadata, orderId, secure: true },
      channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
    })
  });

  if (!paystackResponse.ok) {
    throw new Error('Paystack API request failed');
  }

  const paystackData = await paystackResponse.json();

  if (!paystackData.status) {
    throw new Error(paystackData.message || 'Payment initialization failed');
  }

  // Update transaction with Paystack reference
  await supabaseClient
    .from('payment_transactions')
    .update({ provider_reference: paystackData.data.reference })
    .eq('id', transaction.id);

  return new Response(JSON.stringify({
    status: true,
    data: {
      authorization_url: paystackData.data.authorization_url,
      access_code: paystackData.data.access_code,
      reference: paystackData.data.reference
    }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}

// Enhanced payment verification
async function handleVerifyPayment(supabaseClient: any, user: any, data: any, corsHeaders: any) {
  const { reference } = data;

  // Enhanced reference validation
  const refValidation = PaymentValidator.validatePaymentReference(reference);
  if (!refValidation.isValid) {
    return new Response(JSON.stringify({
      status: false,
      error: 'Invalid payment reference',
      details: refValidation.errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Verify ownership
  const ownershipValidation = await PaymentValidator.validateReferenceOwnership(reference, user.id);
  if (!ownershipValidation.isValid) {
    return new Response(JSON.stringify({
      status: false,
      error: 'Access denied',
      details: ownershipValidation.errors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 403,
    });
  }

  // Get active Paystack configuration
  const { data: config } = await supabaseClient.rpc('get_active_paystack_config');
  
  if (!config) {
    return new Response(JSON.stringify({
      status: false,
      error: 'Payment system not configured'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 503,
    });
  }

  // Verify with Paystack
  const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
    headers: {
      'Authorization': `Bearer ${config.secret_key}`,
      'User-Agent': 'Supabase-Paystack-Integration/1.0'
    }
  });

  if (!paystackResponse.ok) {
    throw new Error('Paystack verification request failed');
  }

  const verification = await paystackResponse.json();

  if (!verification.status) {
    throw new Error(verification.message || 'Verification failed');
  }

  // Use atomic transaction to update payment
  const { error: updateError } = await supabaseClient.rpc('verify_payment_atomic', {
    p_reference: reference,
    p_paystack_data: verification.data,
    p_verified_at: new Date()
  });

  if (updateError) {
    throw new Error('Failed to update payment status');
  }

  return new Response(JSON.stringify({
    status: true,
    data: verification.data
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: 200,
  });
}

// Enhanced charge payment
async function handleChargePayment(supabaseClient: any, user: any, data: any, corsHeaders: any) {
  const { authorization_code, amount, email, reference, metadata = {}, orderId } = data;

  // Enhanced validation for charge operations
  const validationErrors = [];
  
  if (!authorization_code || typeof authorization_code !== 'string') {
    validationErrors.push('Valid authorization code is required');
  }

  if (!email || typeof email !== 'string' || !email.includes('@')) {
    validationErrors.push('Valid email is required');
  }

  const amountValidation = PaymentValidator.validateAmount(parseFloat(amount), 'NGN');
  if (!amountValidation.isValid) {
    validationErrors.push(...amountValidation.errors);
  }

  if (validationErrors.length > 0) {
    return new Response(JSON.stringify({
      status: false,
      error: 'Validation failed',
      details: validationErrors
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 400,
    });
  }

  // Enhanced rate limiting for charges (more restrictive)
  const chargeLimit = await DistributedRateLimiter.checkPaymentRateLimit(`charge:${user.id}`, 'initialize');
  if (!chargeLimit.allowed) {
    return new Response(JSON.stringify({
      status: false,
      error: 'Too many charge attempts',
      retryAfter: chargeLimit.retryAfter
    }), {
      headers: { 
        ...corsHeaders, 
        'Content-Type': 'application/json',
        'Retry-After': chargeLimit.retryAfter?.toString() || '60'
      },
      status: 429,
    });
  }

  // Get active Paystack configuration
  const { data: config } = await supabaseClient.rpc('get_active_paystack_config');
  
  if (!config) {
    return new Response(JSON.stringify({
      status: false,
      error: 'Payment system not configured'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 503,
    });
  }

  // Generate secure reference
  const transactionRef = reference || PaymentValidator.generateSecureReference('CHARGE');

  // Create transaction record
  const { data: transaction, error: dbError } = await supabaseClient
    .from('payment_transactions')
    .insert({
      transaction_reference: transactionRef,
      provider: 'paystack',
      order_id: orderId,
      amount: amountValidation.sanitizedAmount,
      currency: 'NGN',
      customer_email: email,
      metadata: { ...metadata, user_id: user.id, charge_type: 'saved_card' },
      status: 'pending',
      transaction_type: 'charge'
    })
    .select()
    .single();

  if (dbError) {
    throw new Error('Failed to create payment record');
  }

  // Charge authorization with enhanced security
  const paystackResponse = await fetch('https://api.paystack.co/transaction/charge_authorization', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${config.secret_key}`,
      'Content-Type': 'application/json',
      'User-Agent': 'Supabase-Paystack-Integration/1.0'
    },
    body: JSON.stringify({
      authorization_code,
      email,
      amount: amountValidation.subunitAmount,
      reference: transactionRef,
      metadata: { ...metadata, orderId, user_id: user.id, secure: true }
    })
  });

  if (!paystackResponse.ok) {
    throw new Error('Paystack charge request failed');
  }

  const paystackData = await paystackResponse.json();

  // Update transaction with result
  const updateData = {
    provider_reference: paystackData.data?.reference || transactionRef,
    status: paystackData.status && paystackData.data?.status === 'success' ? 'success' : 'failed',
    gateway_response: paystackData.data?.gateway_response || paystackData.message,
    processed_at: new Date(),
    fees: paystackData.data?.fees ? paystackData.data.fees / 100 : 0,
    channel: paystackData.data?.channel
  };

  await supabaseClient
    .from('payment_transactions')
    .update(updateData)
    .eq('id', transaction.id);

  // Update order if successful
  if (paystackData.status && paystackData.data?.status === 'success' && orderId) {
    await supabaseClient
      .from('orders')
      .update({ 
        payment_status: 'paid',
        status: 'confirmed',
        updated_at: new Date()
      })
      .eq('id', orderId);
  }

  return new Response(JSON.stringify({
    status: paystackData.status,
    data: paystackData.status ? {
      reference: paystackData.data.reference,
      status: paystackData.data.status,
      amount: paystackData.data.amount / 100,
      currency: paystackData.data.currency,
      gateway_response: paystackData.data.gateway_response
    } : { error: paystackData.message }
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    status: paystackData.status ? 200 : 400,
  });
}

// Utility function to validate URLs
function isValidURL(string: string): boolean {
  try {
    const url = new URL(string);
    return url.protocol === 'http:' || url.protocol === 'https:';
  } catch {
    return false;
  }
}