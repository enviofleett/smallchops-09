import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders, handleCorsPreflightResponse } from '../_shared/cors.ts';
import { getPaystackConfig, validatePaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts';

// ========================================
// ENHANCED SECURE PAYSTACK PAYMENT VERIFICATION API
// Implements 5-phase security and reliability improvements
// ========================================

// Request/Response Interfaces
interface VerifyPaymentRequest {
  reference: string;
  idempotency_key?: string;
  webhook_signature?: string; // For webhook verification
}

interface VerificationMetrics {
  start_time: number;
  paystack_response_time?: number;
  db_processing_time?: number;
  total_time?: number;
}

interface SecurityContext {
  user_id?: string;
  ip_address?: string;
  user_agent?: string;
  rate_limit_key: string;
}

// ========================================
// PHASE 1: SECURITY & AUTHENTICATION
// ========================================

// Rate limiting helper
const RATE_LIMITS = {
  payment_verification: { max: 10, window: 60 }, // 10 requests per minute
  per_user: { max: 5, window: 60 }, // 5 per user per minute
  per_ip: { max: 20, window: 60 } // 20 per IP per minute
};

async function checkRateLimit(supabase: any, key: string, limit: { max: number, window: number }): Promise<boolean> {
  try {
    const { data, error } = await supabase.rpc('check_rate_limit_enhanced', {
      p_identifier: key,
      p_limit_type: 'payment_verification',
      p_max_requests: limit.max,
      p_window_minutes: Math.floor(limit.window / 60)
    });

    if (error) {
      console.warn('Rate limit check failed:', error);
      return true; // Allow on error (fail open)
    }

    return data?.allowed === true;
  } catch (error) {
    console.warn('Rate limit error:', error);
    return true; // Allow on error
  }
}

// JWT Authentication validation
async function validateAuthentication(req: Request, supabase: any): Promise<SecurityContext | null> {
  const authHeader = req.headers.get('authorization');
  const clientIP = req.headers.get('x-forwarded-for') || req.headers.get('x-real-ip') || 'unknown';
  const userAgent = req.headers.get('user-agent') || 'unknown';

  // Extract IP address (handle multiple IPs in forwarded header)
  const ipAddress = clientIP.split(',')[0].trim();
  
  // For now, authentication is optional - but prepare the structure
  let userId: string | undefined;
  
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.substring(7);
      const { data: { user }, error } = await supabase.auth.getUser(token);
      
      if (!error && user) {
        userId = user.id;
        console.log('✅ Authenticated user:', user.id);
      } else {
        console.warn('⚠️ Invalid authentication token');
      }
    } catch (authError) {
      console.warn('Authentication error:', authError);
    }
  }

  return {
    user_id: userId,
    ip_address: ipAddress,
    user_agent: userAgent,
    rate_limit_key: userId || ipAddress
  };
}

// Enhanced input validation
function validatePaymentReference(reference: string): { valid: boolean; error?: string } {
  if (!reference || typeof reference !== 'string') {
    return { valid: false, error: 'Payment reference is required and must be a string' };
  }

  // Sanitize reference (remove potentially dangerous characters)
  const sanitized = reference.replace(/[^a-zA-Z0-9_-]/g, '');
  if (sanitized !== reference) {
    return { valid: false, error: 'Payment reference contains invalid characters' };
  }

  if (reference.length < 10 || reference.length > 100) {
    return { valid: false, error: 'Payment reference must be between 10 and 100 characters' };
  }

  return { valid: true };
}

// ========================================
// PHASE 2: CONFIGURATION & ENVIRONMENT
// ========================================

async function getSecurePaystackConfig(req: Request) {
  try {
    const config = getPaystackConfig(req);
    const validation = validatePaystackConfig(config);
    
    if (!validation.isValid) {
      throw new Error(`Paystack configuration invalid: ${validation.errors.join(', ')}`);
    }

    logPaystackConfigStatus(config);
    return config;
  } catch (error) {
    console.error('❌ Paystack configuration error:', error);
    throw new Error('Payment service not properly configured');
  }
}

// ========================================
// PHASE 3: ENHANCED PROCESSING LOGIC
// ========================================

async function verifyWithPaystackRetry(reference: string, secretKey: string, maxRetries = 3): Promise<any> {
  let lastError: Error | null = null;
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const startTime = Date.now();
      console.log(`🔍 Paystack verification attempt ${attempt}/${maxRetries} for ${reference}`);
      
      const response = await fetch(
        `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
        {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${secretKey}`,
            'Content-Type': 'application/json',
            'User-Agent': 'Starters-Payment-API/1.0'
          },
          signal: AbortSignal.timeout(15000) // 15 second timeout
        }
      );

      const responseTime = Date.now() - startTime;
      console.log(`📡 Paystack API response: ${response.status} (${responseTime}ms)`);

      if (!response.ok) {
        throw new Error(`Paystack API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      return { data, responseTime };
      
    } catch (error) {
      lastError = error as Error;
      console.warn(`⚠️ Paystack attempt ${attempt} failed:`, error.message);
      
      if (attempt === maxRetries) break;
      
      // Exponential backoff: 1s, 2s, 4s
      const delay = Math.pow(2, attempt - 1) * 1000;
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('All Paystack verification attempts failed');
}

async function processPaymentAtomically(
  supabase: any, 
  reference: string, 
  paystackData: any, 
  amountNaira: number,
  context: SecurityContext
): Promise<any> {
  try {
    console.log('🔄 Processing payment atomically:', { reference, amount: amountNaira });
    
    const { data: result, error } = await supabase.rpc('verify_and_update_payment_status_enhanced', {
      payment_ref: reference,
      new_status: 'confirmed',
      payment_amount: amountNaira,
      payment_gateway_response: paystackData,
      processing_context: {
        user_id: context.user_id,
        ip_address: context.ip_address,
        user_agent: context.user_agent,
        timestamp: new Date().toISOString()
      }
    });

    if (error) {
      console.error('❌ Atomic processing failed:', error);
      throw error;
    }

    return result;
  } catch (error) {
    console.error('❌ Atomic processing error:', error);
    throw error;
  }
}

// ========================================
// PHASE 4: PRODUCTION MONITORING
// ========================================

async function logSecurityEvent(
  supabase: any,
  eventType: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  details: any,
  context: SecurityContext
) {
  try {
    await supabase.from('audit_logs').insert({
      action: `payment_verification_${eventType}`,
      category: 'Payment Security',
      message: `Payment verification ${eventType}`,
      user_id: context.user_id,
      ip_address: context.ip_address,
      user_agent: context.user_agent,
      new_values: {
        event_type: eventType,
        severity,
        details,
        timestamp: new Date().toISOString()
      }
    });
  } catch (logError) {
    console.error('Failed to log security event:', logError);
  }
}

async function recordMetrics(supabase: any, metrics: VerificationMetrics, context: SecurityContext) {
  try {
    await supabase.from('api_metrics').insert({
      endpoint: 'verify-payment',
      metric_type: 'response_time',
      metric_value: metrics.total_time,
      dimensions: {
        paystack_time: metrics.paystack_response_time,
        db_time: metrics.db_processing_time,
        user_id: context.user_id,
        ip_address: context.ip_address
      }
    });
  } catch (error) {
    console.warn('Failed to record metrics:', error);
  }
}

// ========================================
// PHASE 5: ADVANCED FEATURES
// ========================================

function validateWebhookSignature(signature: string, payload: string, secret: string): boolean {
  // Implement Paystack webhook signature validation
  // This is a placeholder for webhook verification
  return true; // TODO: Implement actual signature validation
}

// ========================================
// MAIN REQUEST HANDLER
// ========================================

serve(async (req) => {
  const metrics: VerificationMetrics = { start_time: Date.now() };
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return handleCorsPreflightResponse(origin);
  }

  // Only allow POST
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ 
      success: false, 
      error: 'Method not allowed - POST required' 
    }), { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  let supabase: any;
  let context: SecurityContext | null = null;

  try {
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Database service not configured');
    }
    
    supabase = createClient(supabaseUrl, supabaseServiceKey);

    // PHASE 1: Authentication & Security Context
    context = await validateAuthentication(req, supabase);
    if (!context) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Authentication required' 
      }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Rate limiting
    const rateLimitOk = await checkRateLimit(supabase, context.rate_limit_key, RATE_LIMITS.payment_verification);
    if (!rateLimitOk) {
      await logSecurityEvent(supabase, 'rate_limit_exceeded', 'medium', { key: context.rate_limit_key }, context);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Rate limit exceeded. Please try again later.' 
      }), {
        status: 429,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse and validate request
    let requestBody: VerifyPaymentRequest;
    try {
      requestBody = await req.json();
    } catch {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Invalid JSON in request body' 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { reference, idempotency_key, webhook_signature } = requestBody;

    // Validate payment reference
    const refValidation = validatePaymentReference(reference);
    if (!refValidation.valid) {
      await logSecurityEvent(supabase, 'invalid_reference', 'low', { reference, error: refValidation.error }, context);
      
      return new Response(JSON.stringify({ 
        success: false, 
        error: refValidation.error 
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('🔍 Processing payment verification:', { reference, idempotency_key, user_id: context.user_id });

    // PHASE 2: Get secure configuration
    const paystackConfig = await getSecurePaystackConfig(req);

    // Enhanced idempotency check
    if (idempotency_key) {
      const { data: existingOrder } = await supabase
        .from('orders')
        .select('id, order_number, status, total_amount, customer_email, payment_status')
        .eq('idempotency_key', idempotency_key)
        .eq('status', 'confirmed')
        .single();

      if (existingOrder) {
        console.log('✅ Payment already verified via idempotency:', idempotency_key);
        
        await logSecurityEvent(supabase, 'idempotency_hit', 'low', { idempotency_key, order_id: existingOrder.id }, context);
        
        return new Response(JSON.stringify({
          success: true,
          status: 'success',
          amount: existingOrder.total_amount,
          order_id: existingOrder.id,
          order_number: existingOrder.order_number,
          customer_email: existingOrder.customer_email,
          message: 'Payment already verified (idempotent)',
          data: {
            order_id: existingOrder.id,
            order_number: existingOrder.order_number,
            amount: existingOrder.total_amount,
            status: 'success',
            reference,
            idempotent: true,
            verified_at: new Date().toISOString()
          }
        }), {
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
    }

    // PHASE 3: Enhanced Paystack verification with retry
    const paystackStart = Date.now();
    const { data: paystackData, responseTime } = await verifyWithPaystackRetry(reference, paystackConfig.secretKey);
    metrics.paystack_response_time = responseTime;

    console.log('📨 Paystack verification response:', {
      status: paystackData.status,
      paymentStatus: paystackData.data?.status,
      amount: paystackData.data?.amount,
      reference: paystackData.data?.reference
    });

    // Validate Paystack response
    if (!paystackData.status || paystackData.data?.status !== 'success') {
      await logSecurityEvent(supabase, 'payment_not_successful', 'medium', {
        reference,
        paystack_status: paystackData.data?.status,
        gateway_response: paystackData.data?.gateway_response
      }, context);

      return new Response(JSON.stringify({
        success: false,
        status: paystackData.data?.status || 'failed',
        error: 'Payment not successful',
        gateway_response: paystackData.data?.gateway_response
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Validate amount
    const amountKobo = paystackData.data.amount;
    if (typeof amountKobo !== 'number' || isNaN(amountKobo) || amountKobo <= 0) {
      await logSecurityEvent(supabase, 'invalid_amount', 'high', { reference, amount: amountKobo }, context);
      
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid payment amount received from gateway'
      }), {
        status: 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const amountNaira = amountKobo / 100;

    // PHASE 3: Atomic payment processing
    const dbStart = Date.now();
    try {
      const processResult = await processPaymentAtomically(supabase, reference, paystackData.data, amountNaira, context);
      metrics.db_processing_time = Date.now() - dbStart;

      const result = Array.isArray(processResult) ? processResult[0] : processResult;
      
      if (!result || result.success === false) {
        throw new Error(result?.error || 'Payment processing failed');
      }

      // Log successful verification
      await logSecurityEvent(supabase, 'verification_success', 'low', {
        reference,
        order_id: result.order_id,
        amount: amountNaira
      }, context);

      // Non-blocking email notification
      try {
        const { error: emailError } = await supabase.rpc('upsert_payment_confirmation_event', {
          p_reference: reference,
          p_recipient_email: paystackData.data.customer?.email || 'unknown@example.com',
          p_order_id: result.order_id,
          p_template_variables: {
            customerName: paystackData.data.customer?.first_name || 'Customer',
            orderNumber: result.order_number,
            amount: amountNaira.toFixed(2),
            paymentMethod: paystackData.data.channel || 'Online Payment',
            paidAt: paystackData.data.paid_at
          }
        });

        if (emailError) {
          console.warn('⚠️ Email confirmation failed (non-blocking):', emailError);
        }
      } catch (emailError) {
        console.warn('⚠️ Email notification error (non-blocking):', emailError);
      }

      // PHASE 4: Record metrics
      metrics.total_time = Date.now() - metrics.start_time;
      await recordMetrics(supabase, metrics, context);

      // Success response
      const successResponse = {
        success: true,
        status: 'success',
        amount: amountNaira,
        order_id: result.order_id,
        order_number: result.order_number,
        customer: paystackData.data.customer,
        channel: paystackData.data.channel,
        paid_at: paystackData.data.paid_at,
        data: {
          order_id: result.order_id,
          order_number: result.order_number,
          amount: amountNaira,
          status: 'success',
          customer: paystackData.data.customer,
          reference,
          verified_at: new Date().toISOString(),
          processing_time_ms: metrics.total_time
        }
      };

      return new Response(JSON.stringify(successResponse), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });

    } catch (processingError) {
      console.error('❌ Payment processing error:', processingError);
      
      const errorMessage = processingError.message || '';
      const isDuplicate = errorMessage.includes('duplicate') || 
                         errorMessage.includes('already exists') ||
                         errorMessage.includes('unique constraint');

      if (isDuplicate) {
        // Handle duplicate payment gracefully
        try {
          const { data: existingOrder } = await supabase
            .from('orders')
            .select('id, order_number, status, payment_status, total_amount, customer_email')
            .eq('payment_reference', reference)
            .single();

          if (existingOrder) {
            await logSecurityEvent(supabase, 'duplicate_handled', 'low', { reference, order_id: existingOrder.id }, context);
            
            return new Response(JSON.stringify({
              success: true,
              status: 'success',
              amount: existingOrder.total_amount,
              order_id: existingOrder.id,
              order_number: existingOrder.order_number,
              customer: paystackData.data.customer,
              channel: paystackData.data.channel,
              paid_at: paystackData.data.paid_at,
              data: {
                order_id: existingOrder.id,
                order_number: existingOrder.order_number,
                amount: existingOrder.total_amount,
                status: 'success',
                customer: paystackData.data.customer,
                reference,
                duplicate_handled: true,
                verified_at: new Date().toISOString()
              }
            }), {
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' }
            });
          }
        } catch (fetchError) {
          console.error('Failed to fetch existing order:', fetchError);
        }
      }

      // Critical error logging
      await logSecurityEvent(supabase, 'processing_error', 'critical', {
        reference,
        error: errorMessage,
        amount: amountNaira,
        is_duplicate: isDuplicate
      }, context);

      return new Response(JSON.stringify({
        success: false,
        error: 'Payment processing failed'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

  } catch (error) {
    console.error('❌ Global payment verification error:', error);
    
    if (supabase && context) {
      await logSecurityEvent(supabase, 'global_error', 'critical', {
        error: error.message,
        stack: error.stack
      }, context);
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Payment verification failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});