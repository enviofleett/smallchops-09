import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { PaymentValidator } from "../_shared/payment-validators.ts";

// PRODUCTION CORS - No wildcards
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [];
  const isDev = Deno.env.get('DENO_ENV') === 'development';
  
  if (isDev) {
    allowedOrigins.push('http://localhost:5173', 'http://localhost:3000');
  }
  
  const isAllowed = origin && allowedOrigins.includes(origin);
  
  return {
    'Access-Control-Allow-Origin': isAllowed ? origin : (isDev ? '*' : 'null'),
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  let supabaseClient;
  let user;

  try {
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // FIXED AUTH - Consistent validation
    const authHeader = req.headers.get('authorization'); // lowercase only
    if (!authHeader?.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Authentication required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.substring(7); // More secure than replace
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Invalid authentication token'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    user = userData.user;

    // Rate limiting check
    const userIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown';
    await checkRateLimit(supabaseClient, user.id, userIp, 'payment_initialize');

    // Parse and validate request body
    const body = await req.json();
    
    // Input validation
    const errors = [];
    if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
      errors.push('Valid email is required');
    }
    if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
      errors.push('Valid amount is required');
    }
    if (body.amount < 50) {
      errors.push('Minimum amount is 50 NGN');
    }
    if (body.amount > 10000000) {
      errors.push('Maximum amount is 10,000,000 NGN');
    }
    
    if (errors.length > 0) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Validation failed',
        details: errors
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }
    const { email, amount, currency = 'NGN', reference, callback_url, metadata = {}, orderId } = body;

    // Get Paystack configuration
    const { data: config } = await supabaseClient
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();

    if (!config) {
      throw new Error('Paystack not configured');
    }

    // Validate amount using PaymentValidator
    const amountValidation = PaymentValidator.validateAmount(parseFloat(amount.toString()), currency || 'NGN');
    if (!amountValidation.isValid) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Amount validation failed',
        details: amountValidation.errors
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Generate secure transaction reference
    const transactionRef = reference || PaymentValidator.generateSecureReference('INIT');
    
    const { data: transaction, error: dbError } = await supabaseClient
      .from('payment_transactions')
      .insert({
        transaction_reference: transactionRef,
        provider: 'paystack',
        order_id: orderId,
        amount: amountValidation.sanitizedAmount,
        currency: currency || 'NGN',
        customer_email: email,
        metadata: { ...metadata, user_id: user.id },
        status: 'pending',
        transaction_type: 'initialize'
      })
      .select()
      .single();

    if (dbError) {
      throw new Error('Failed to create transaction record');
    }

    // Initialize with Paystack
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secret_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: amountValidation.subunitAmount, // Use validated amount in kobo
        currency,
        reference: transactionRef,
        callback_url: callback_url || `${req.headers.get('origin')}/payment/callback`,
        metadata: { ...metadata, orderId },
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
      })
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      throw new Error(paystackData.message || 'Failed to initialize payment');
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

  } catch (error) {
    console.error('Paystack initialization error:', error);
    
    // Log error for monitoring
    if (supabaseClient && user) {
      try {
        await supabaseClient
          .from('payment_error_logs')
          .insert({
            user_id: user.id,
            error_type: 'initialization_failed',
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
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Rate limiting function
async function checkRateLimit(supabaseClient: any, userId: string, ipAddress: string, operationType: string) {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000);
  
  // Check user-based rate limit (10 requests per minute)
  const { data: userLimits } = await supabaseClient
    .from('payment_rate_limits')
    .select('attempts')
    .eq('user_id', userId)
    .eq('operation_type', operationType)
    .gte('window_start', oneMinuteAgo.toISOString());
  
  const userAttempts = userLimits?.reduce((sum, limit) => sum + limit.attempts, 0) || 0;
  
  if (userAttempts >= 10) {
    throw new Error('Rate limit exceeded. Please wait before trying again.');
  }
  
  // Check IP-based rate limit (20 requests per minute)
  const { data: ipLimits } = await supabaseClient
    .from('payment_rate_limits')
    .select('attempts')
    .eq('ip_address', ipAddress)
    .eq('operation_type', operationType)
    .gte('window_start', oneMinuteAgo.toISOString());
  
  const ipAttempts = ipLimits?.reduce((sum, limit) => sum + limit.attempts, 0) || 0;
  
  if (ipAttempts >= 20) {
    throw new Error('Rate limit exceeded for this IP. Please wait before trying again.');
  }
  
  // Record this attempt
  await supabaseClient
    .from('payment_rate_limits')
    .insert({
      user_id: userId,
      ip_address: ipAddress,
      operation_type: operationType,
      attempts: 1,
      window_start: now.toISOString()
    });
}