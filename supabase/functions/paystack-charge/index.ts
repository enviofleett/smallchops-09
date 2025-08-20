import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders, handleCorsPreflight } from "../_shared/cors.ts";
import { getPaystackConfig } from "../_shared/paystack-config.ts";

const validateChargeInput = (body: any) => {
  const errors: string[] = [];
  
  if (!body.authorization_code || typeof body.authorization_code !== 'string') {
    errors.push('authorization_code is required and must be a string');
  }
  
  if (!body.amount || typeof body.amount !== 'number' || body.amount <= 0) {
    errors.push('amount is required and must be a positive number');
  }
  
  if (body.amount < 50) {
    errors.push('amount must be at least 50 NGN');
  }
  
  if (body.amount > 10000000) {
    errors.push('amount exceeds maximum limit of 10,000,000 NGN');
  }
  
  if (!body.email || typeof body.email !== 'string' || !body.email.includes('@')) {
    errors.push('email is required and must be a valid email address');
  }
  
  return errors;
};

const sanitizeError = (error: any): string => {
  // Return user-safe error messages
  if (error.message?.includes('authorization_code')) {
    return 'Invalid or expired saved payment method';
  }
  if (error.message?.includes('insufficient funds')) {
    return 'Insufficient funds in account';
  }
  if (error.message?.includes('declined')) {
    return 'Payment was declined by your bank';
  }
  return 'Payment processing failed. Please try again or use a different payment method.';
};

serve(async (req) => {
  const cors = getCorsHeaders(req);
  const pre = handleCorsPreflight(req);
  if (pre) return new Response(null, { status: 204, headers: cors });

  let supabaseClient;
  let user;

  try {
    // Initialize Supabase client
    supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Authenticate user
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Authentication required'
      }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: userData, error: authError } = await supabaseClient.auth.getUser(token);
    
    if (authError || !userData.user) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Invalid authentication token'
      }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 401,
      });
    }

    user = userData.user;

    // Rate limiting check
    const userIp = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for') || 'unknown';
    await checkRateLimit(supabaseClient, user.id, userIp, 'payment_charge');

    // Parse and validate request body
    const body = await req.json();
    const validationErrors = validateChargeInput(body);
    
    if (validationErrors.length > 0) {
      return new Response(JSON.stringify({
        status: false,
        error: 'Validation failed',
        details: validationErrors
      }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    const { authorization_code, amount, email, reference, metadata = {}, orderId } = body;

    // PATCH: Use request-aware config instead of direct env var
    const config = getPaystackConfig(req);

    // Generate reference if not provided
    const transactionRef = reference || `charge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Create transaction record with proper error handling
    const { data: transaction, error: dbError } = await supabaseClient
      .from('payment_transactions')
      .insert({
        transaction_reference: transactionRef,
        provider: 'paystack',
        order_id: orderId,
        amount: parseFloat(amount.toString()),
        currency: 'NGN',
        customer_email: email,
        metadata: { ...metadata, user_id: user.id, charge_type: 'saved_card' },
        status: 'pending',
        transaction_type: 'charge'
      })
      .select()
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return new Response(JSON.stringify({
        status: false,
        error: 'Failed to initialize payment'
      }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Charge authorization with Paystack using config
    const paystackResponse = await fetch(`${config.baseUrl}/transaction/charge_authorization`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        authorization_code,
        email,
        amount: Math.round(amount * 100), // Convert to kobo
        reference: transactionRef,
        metadata: { ...metadata, orderId, user_id: user.id }
      })
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      // Update transaction as failed
      await supabaseClient
        .from('payment_transactions')
        .update({ 
          status: 'failed',
          gateway_response: paystackData.message,
          processed_at: new Date()
        })
        .eq('id', transaction.id);

      return new Response(JSON.stringify({
        status: false,
        error: sanitizeError(paystackData)
      }), {
        headers: { ...cors, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Update transaction with Paystack response
    const updateData = {
      provider_reference: paystackData.data.reference,
      status: paystackData.data.status === 'success' ? 'success' : 'pending',
      gateway_response: paystackData.data.gateway_response,
      processed_at: new Date(),
      fees: paystackData.data.fees ? paystackData.data.fees / 100 : 0,
      channel: paystackData.data.channel
    };

    await supabaseClient
      .from('payment_transactions')
      .update(updateData)
      .eq('id', transaction.id);

    // Update order status if payment successful
    if (paystackData.data.status === 'success' && orderId) {
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
      status: true,
      data: {
        reference: paystackData.data.reference,
        status: paystackData.data.status,
        amount: paystackData.data.amount / 100,
        currency: paystackData.data.currency,
        gateway_response: paystackData.data.gateway_response
      }
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Paystack charge error:', error);
    
    // Log error for monitoring
    if (supabaseClient && user) {
      try {
        await supabaseClient
          .from('payment_error_logs')
          .insert({
            user_id: user.id,
            error_type: 'charge_failed',
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
      error: sanitizeError(error)
    }), {
      headers: { ...cors, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Rate limiting function
async function checkRateLimit(supabaseClient: any, userId: string, ipAddress: string, operationType: string) {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60000);
  
  // Check user-based rate limit (5 charge attempts per minute)
  const { data: userLimits } = await supabaseClient
    .from('payment_rate_limits')
    .select('attempts')
    .eq('user_id', userId)
    .eq('operation_type', operationType)
    .gte('window_start', oneMinuteAgo.toISOString());
  
  const userAttempts = userLimits?.reduce((sum, limit) => sum + limit.attempts, 0) || 0;
  
  if (userAttempts >= 5) {
    throw new Error('Too many payment attempts. Please wait before trying again.');
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
