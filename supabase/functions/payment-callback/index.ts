// SECURE PAYMENT CALLBACK: supabase/functions/payment-callback/index.ts
// Streamlined security enhancements for payment webhooks

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Define valid order status mapping
const VALID_ORDER_STATUSES = {
  'success': 'confirmed',
  'failed': 'failed',
  'abandoned': 'cancelled', 
  'pending': 'pending',
  'processing': 'processing'
} as const;

type ValidOrderStatus = typeof VALID_ORDER_STATUSES[keyof typeof VALID_ORDER_STATUSES];

interface PaystackWebhookData {
  event: string;
  data: {
    status: string;
    reference: string;
    amount: number;
    gateway_response?: string;
    customer?: {
      email?: string;
    };
    metadata?: Record<string, any>;
    created_at?: string;
    paid_at?: string;
  };
}

// SECURITY: Simple rate limiting storage
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100;
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour

// SECURITY: Webhook signature verification using built-in crypto
async function verifyWebhookSignature(body: string, signature: string): Promise<boolean> {
  const webhookSecret = Deno.env.get('PAYSTACK_WEBHOOK_SECRET');
  
  if (!webhookSecret) {
    console.warn('⚠️ PAYSTACK_WEBHOOK_SECRET not configured - skipping signature verification');
    return true;
  }

  if (!signature) {
    console.error('🚫 Missing webhook signature');
    return false;
  }

  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(webhookSecret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );

    const expectedSignature = await crypto.subtle.sign(
      'HMAC',
      key,
      encoder.encode(body)
    );

    const expectedHex = Array.from(new Uint8Array(expectedSignature))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    const isValid = signature.toLowerCase() === expectedHex.toLowerCase();
    
    if (!isValid) {
      console.error('🚫 Webhook signature verification failed');
    } else {
      console.log('✅ Webhook signature verified');
    }

    return isValid;
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

// SECURITY: Simple rate limiting
function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const existing = requestCounts.get(clientIP);
  
  if (!existing || now > existing.resetTime) {
    requestCounts.set(clientIP, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (existing.count >= RATE_LIMIT) {
    console.warn(`🚫 Rate limit exceeded for IP: ${clientIP}`);
    return false;
  }
  
  existing.count++;
  return true;
}

// SECURITY: Log security events
async function logSecurityEvent(
  supabase: any,
  event: string, 
  details: Record<string, any>
) {
  try {
    await supabase.from('audit_logs').insert({
      action: event,
      category: 'webhook_security',
      message: `Webhook security event: ${event}`,
      new_values: details,
      event_time: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// CORS headers
const getCorsHeaders = () => ({
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Max-Age': '86400',
  'Vary': 'Origin',
});

serve(async (req: Request) => {
  if (!req) {
    console.error('❌ Null request object received');
    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: { ...getCorsHeaders(), 'Content-Type': 'application/json' } }
    );
  }

  const corsHeaders = getCorsHeaders();

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // Get request info for security logging
    const userAgent = req.headers?.get('user-agent') || 'Unknown';
    const clientIP = req.headers?.get('x-forwarded-for') || req.headers?.get('cf-connecting-ip') || 'unknown';
    const webhookSignature = req.headers?.get('x-paystack-signature') || '';
    
    console.log('🔍 Processing request:', {
      method: req.method,
      clientIP: clientIP,
      userAgent: userAgent.substring(0, 50) + '...',
      hasSignature: !!webhookSignature
    });

    // Validate method
    if (req.method !== 'POST') {
      await logSecurityEvent(supabase, 'invalid_method', { 
        method: req.method, 
        clientIP,
        userAgent 
      });
      
      console.error('❌ Invalid method:', req.method);
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Rate limiting
    if (!checkRateLimit(clientIP)) {
      await logSecurityEvent(supabase, 'rate_limit_exceeded', { 
        clientIP,
        userAgent 
      });
      
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse and verify webhook payload
    let webhookData: PaystackWebhookData;
    let rawBody: string;
    
    try {
      rawBody = await req.text();
      
      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body');
      }
      
      // Verify webhook signature
      const signatureValid = await verifyWebhookSignature(rawBody, webhookSignature);
      if (!signatureValid) {
        await logSecurityEvent(supabase, 'invalid_signature', { 
          clientIP,
          userAgent,
          bodyLength: rawBody.length
        });
        
        return new Response(
          JSON.stringify({ error: 'Invalid webhook signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      console.log('📝 Request body preview:', rawBody.substring(0, 200) + '...');
      webhookData = JSON.parse(rawBody);
    } catch (parseError) {
      await logSecurityEvent(supabase, 'invalid_payload', { 
        clientIP,
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        bodyLength: rawBody?.length || 0
      });
      
      console.error('❌ Failed to parse webhook JSON:', parseError);
      return new Response(
        JSON.stringify({ 
          error: 'Invalid JSON payload',
          details: parseError instanceof Error ? parseError.message : 'Unknown parse error'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Validate webhook structure
    if (!webhookData || typeof webhookData !== 'object') {
      console.error('❌ Invalid webhook data structure');
      return new Response(
        JSON.stringify({ error: 'Invalid webhook data structure' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const { event, data } = webhookData;
    
    if (!data || !data.reference) {
      await logSecurityEvent(supabase, 'missing_reference', { 
        clientIP,
        event,
        hasData: !!data
      });
      
      console.error('❌ Missing required data fields:', { event, data });
      return new Response(
        JSON.stringify({ error: 'Missing reference in webhook data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('📝 Webhook event:', event);
    console.log('📋 Payment reference:', data.reference);
    console.log('📊 Payment status from Paystack:', data.status);

    // Map status with null-safety
    let orderStatus: ValidOrderStatus;
    const paystackStatus = data.status?.toString().toLowerCase().trim();

    if (!paystackStatus || paystackStatus === 'null' || paystackStatus === 'undefined' || paystackStatus === '') {
      console.warn('⚠️ Empty or invalid status from Paystack:', data.status);
      orderStatus = 'failed';
    } else if (VALID_ORDER_STATUSES[paystackStatus as keyof typeof VALID_ORDER_STATUSES]) {
      orderStatus = VALID_ORDER_STATUSES[paystackStatus as keyof typeof VALID_ORDER_STATUSES];
    } else {
      console.warn('⚠️ Unknown Paystack status:', paystackStatus, '- mapping to failed');
      orderStatus = 'failed';
    }

    console.log('✅ Mapped order status:', paystackStatus, '->', orderStatus);

    // Double-check we never pass null/undefined
    if (!orderStatus) {
      console.error('🚨 Order status is still null after mapping - forcing to failed');
      orderStatus = 'failed';
    }

    // Call the database function
    console.log('🔧 Calling update_order_status_safe RPC with validated status:', orderStatus);
    
    const { data: rpcResult, error: rpcError } = await supabase.rpc('update_order_status_safe', {
      p_reference: data.reference,
      p_status: orderStatus,
      p_amount: data.amount || null,
      p_customer_email: data.customer?.email || null
    });

    if (rpcError) {
      console.error('❌ RPC returned error', {
        reference: data.reference,
        error: rpcError.message,
        details: rpcError.details,
        hint: rpcError.hint
      });

      return new Response(
        JSON.stringify({ 
          error: 'Database update failed', 
          details: rpcError.message,
          reference: data.reference
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log('✅ RPC call successful:', rpcResult);

    // Log successful payment processing
    await logSecurityEvent(supabase, 'payment_processed', { 
      clientIP,
      reference: data.reference,
      event,
      mappedStatus: orderStatus,
      amount: data.amount
    });

    // Return success response
    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Webhook processed successfully',
        reference: data.reference,
        mapped_status: orderStatus,
        timestamp: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    console.error('🔍 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type'
    });

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});