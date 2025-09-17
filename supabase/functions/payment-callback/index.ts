// ENHANCED SECURITY: supabase/functions/payment-callback/index.ts
// Comprehensive security enhancements for payment webhooks

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";

// CRITICAL: Define valid order status mapping (FIXED to match current database)
const VALID_ORDER_STATUSES = {
  'success': 'confirmed',      // ✅ Fixed: was 'completed', now matches database enum
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

// SECURITY: Paystack IP ranges for webhook validation
const PAYSTACK_IP_RANGES = [
  '52.31.139.75',
  '52.49.173.169', 
  '52.214.14.220',
  '54.76.111.105',
  '54.217.218.164',
  '35.157.26.200',
  '35.156.85.64',
  '52.58.127.244'
];

// SECURITY: Rate limiting storage (simple in-memory for now)
const requestCounts = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 100; // requests per hour per IP
const RATE_WINDOW = 60 * 60 * 1000; // 1 hour in milliseconds

// SECURITY: Replay attack prevention
const processedWebhooks = new Set<string>();
const WEBHOOK_EXPIRY = 5 * 60 * 1000; // 5 minutes

// SECURITY: Webhook signature verification
async function verifyWebhookSignature(body: string, signature: string): Promise<boolean> {
  const webhookSecret = Deno.env.get('PAYSTACK_WEBHOOK_SECRET');
  
  if (!webhookSecret) {
    console.warn('⚠️ PAYSTACK_WEBHOOK_SECRET not configured - skipping signature verification');
    return true; // Allow webhook if no secret configured (development mode)
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

    const providedSignature = signature.toLowerCase();
    const computedSignature = expectedHex.toLowerCase();

    const isValid = providedSignature === computedSignature;
    
    if (!isValid) {
      console.error('🚫 Webhook signature verification failed', {
        provided: providedSignature.substring(0, 20) + '...',
        computed: computedSignature.substring(0, 20) + '...'
      });
    } else {
      console.log('✅ Webhook signature verified');
    }

    return isValid;
  } catch (error) {
    console.error('❌ Signature verification error:', error);
    return false;
  }
}

// SECURITY: Rate limiting check
function checkRateLimit(clientIP: string): boolean {
  const now = Date.now();
  const key = clientIP;
  
  const existing = requestCounts.get(key);
  
  if (!existing || now > existing.resetTime) {
    // First request or reset window
    requestCounts.set(key, { count: 1, resetTime: now + RATE_WINDOW });
    return true;
  }
  
  if (existing.count >= RATE_LIMIT) {
    console.warn(`🚫 Rate limit exceeded for IP: ${clientIP}`);
    return false;
  }
  
  existing.count++;
  return true;
}

// SECURITY: IP validation
function isValidPaystackIP(clientIP: string): boolean {
  // In development, allow localhost
  if (clientIP.includes('127.0.0.1') || clientIP.includes('::1') || clientIP.includes('localhost')) {
    return true;
  }
  
  return PAYSTACK_IP_RANGES.includes(clientIP);
}

// SECURITY: Audit logging
async function logSecurityEvent(
  supabase: any,
  event: string, 
  details: Record<string, any>,
  level: 'info' | 'warning' | 'error' = 'info'
) {
  try {
    await supabase.from('audit_logs').insert({
      event_type: 'webhook_security',
      event_name: event,
      details: details,
      level: level,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log security event:', error);
  }
}

// FIXED CORS HANDLING with null safety
const getCorsHeaders = (req: Request | null) => {
  // CRITICAL FIX: Handle null request
  if (!req || !req.headers) {
    console.warn('⚠️ Null request object - using default CORS headers');
    return {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Max-Age': '86400',
      'Vary': 'Origin',
    };
  }

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
    // Remove localhost entries for production deployment
    // 'http://localhost:3000', 
    // 'http://localhost:5173',
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
    console.log('ℹ️ No origin header - likely webhook or server-to-server call');
  }

  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-requested-with',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin',
  };
};

serve(async (req: Request) => {
  // CRITICAL FIX: Add null check for request object
  if (!req) {
    console.error('❌ Null request object received');
    const defaultHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Content-Type': 'application/json'
    };
    
    return new Response(
      JSON.stringify({ error: 'Invalid request' }),
      { status: 400, headers: defaultHeaders }
    );
  }

  // Now safe to call getCorsHeaders
  const corsHeaders = getCorsHeaders(req);

  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    console.log('✅ CORS preflight request handled');
    return new Response(null, { 
      status: 204,
      headers: corsHeaders 
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    // SECURITY: Enhanced request analysis
    const userAgent = req.headers?.get('user-agent') || 'Unknown';
    const contentType = req.headers?.get('content-type') || 'Unknown';
    const origin = req.headers?.get('origin') || 'No Origin (Webhook/Server-to-Server)';
    const clientIP = req.headers?.get('x-forwarded-for') || req.headers?.get('cf-connecting-ip') || 'unknown';
    const webhookSignature = req.headers?.get('x-paystack-signature') || '';
    
    const requestInfo = {
      method: req.method,
      origin: origin,
      userAgent: userAgent.substring(0, 50) + '...',
      contentType: contentType,
      clientIP: clientIP,
      hasSignature: !!webhookSignature
    };
    
    console.log('🔍 Processing request:', requestInfo);

    // SECURITY: Method validation
    if (req.method !== 'POST') {
      await logSecurityEvent(supabase, 'invalid_method', { 
        method: req.method, 
        clientIP,
        userAgent 
      }, 'warning');
      
      console.error('❌ Invalid method:', req.method);
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Rate limiting
    if (!checkRateLimit(clientIP)) {
      await logSecurityEvent(supabase, 'rate_limit_exceeded', { 
        clientIP,
        userAgent 
      }, 'warning');
      
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded' }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: IP validation (optional - can be disabled for development)
    const skipIPValidation = Deno.env.get('SKIP_IP_VALIDATION') === 'true';
    if (!skipIPValidation && !isValidPaystackIP(clientIP)) {
      await logSecurityEvent(supabase, 'invalid_source_ip', { 
        clientIP,
        userAgent,
        expectedIPs: PAYSTACK_IP_RANGES 
      }, 'error');
      
      console.error('🚫 Invalid source IP:', clientIP);
      return new Response(
        JSON.stringify({ error: 'Unauthorized source' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Parse and verify webhook payload
    let webhookData: PaystackWebhookData;
    let rawBody: string;
    
    try {
      rawBody = await req.text();
      
      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body');
      }
      
      // SECURITY: Verify webhook signature before processing
      const signatureValid = await verifyWebhookSignature(rawBody, webhookSignature);
      if (!signatureValid) {
        await logSecurityEvent(supabase, 'invalid_signature', { 
          clientIP,
          userAgent,
          bodyLength: rawBody.length
        }, 'error');
        
        return new Response(
          JSON.stringify({ error: 'Invalid webhook signature' }),
          { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      // Log first 200 chars of body for debugging (don't log sensitive data)
      console.log('📝 Request body preview:', rawBody.substring(0, 200) + '...');
      
      webhookData = JSON.parse(rawBody);
    } catch (parseError) {
      await logSecurityEvent(supabase, 'invalid_payload', { 
        clientIP,
        error: parseError instanceof Error ? parseError.message : 'Unknown parse error',
        bodyLength: rawBody?.length || 0
      }, 'error');
      
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
      }, 'error');
      
      console.error('❌ Missing required data fields:', { event, data });
      return new Response(
        JSON.stringify({ error: 'Missing reference in webhook data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Replay attack prevention
    const webhookId = `${data.reference}-${event}-${data.status}`;
    if (processedWebhooks.has(webhookId)) {
      await logSecurityEvent(supabase, 'duplicate_webhook', { 
        clientIP,
        reference: data.reference,
        event,
        webhookId
      }, 'warning');
      
      console.warn('⚠️ Duplicate webhook detected:', webhookId);
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Webhook already processed',
          reference: data.reference
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // SECURITY: Timestamp validation (prevent old webhook replays)
    const webhookTimestamp = data.paid_at || data.created_at;
    if (webhookTimestamp) {
      const webhookTime = new Date(webhookTimestamp).getTime();
      const now = Date.now();
      if (now - webhookTime > WEBHOOK_EXPIRY) {
        await logSecurityEvent(supabase, 'expired_webhook', { 
          clientIP,
          reference: data.reference,
          webhookTime: new Date(webhookTimestamp).toISOString(),
          age: now - webhookTime
        }, 'warning');
        
        console.warn('⚠️ Webhook too old:', {
          reference: data.reference,
          age: (now - webhookTime) / 1000 / 60,
          minutes: 'minutes'
        });
      }
    }

    // Add to processed set to prevent replays
    processedWebhooks.add(webhookId);
    
    // Clean up old processed webhooks periodically
    if (processedWebhooks.size > 1000) {
      processedWebhooks.clear();
      console.log('🧹 Cleared processed webhooks cache');
    }

    console.log('📝 Webhook event:', event);
    console.log('📋 Payment reference:', data.reference);
    console.log('📊 Payment status from Paystack:', data.status);

    // CRITICAL FIX: Robust status mapping with null-safety
    let orderStatus: ValidOrderStatus;
    const paystackStatus = data.status?.toString().toLowerCase().trim();

    if (!paystackStatus || paystackStatus === 'null' || paystackStatus === 'undefined' || paystackStatus === '') {
      console.warn('⚠️ Empty, null, or invalid status from Paystack:', data.status);
      orderStatus = 'failed'; // Safe fallback
    } else if (VALID_ORDER_STATUSES[paystackStatus as keyof typeof VALID_ORDER_STATUSES]) {
      orderStatus = VALID_ORDER_STATUSES[paystackStatus as keyof typeof VALID_ORDER_STATUSES];
    } else {
      console.warn('⚠️ Unknown Paystack status:', paystackStatus, '- mapping to failed');
      orderStatus = 'failed'; // Safe fallback for unknown statuses
    }

    console.log('✅ Mapped order status:', paystackStatus, '->', orderStatus);

    // CRITICAL: Double-check we never pass null/undefined
    if (!orderStatus) {
      console.error('🚨 Order status is still null after mapping - forcing to failed');
      orderStatus = 'failed';
    }

    // Call the RPC function with validated data
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

      // Log the exact values being passed for debugging
      console.error('🔍 Debug info:', {
        originalPaystackStatus: data.status,
        mappedOrderStatus: orderStatus,
        reference: data.reference,
        amount: data.amount
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

    // SECURITY: Log successful payment processing
    await logSecurityEvent(supabase, 'payment_processed', { 
      clientIP,
      reference: data.reference,
      event,
      mappedStatus: orderStatus,
      amount: data.amount
    }, 'info');

    // Return success response to Paystack
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
    
    // Log full error details for debugging
    console.error('🔍 Error details:', {
      message: error instanceof Error ? error.message : 'Unknown error',
      stack: error instanceof Error ? error.stack : 'No stack trace',
      name: error instanceof Error ? error.name : 'Unknown error type'
    });

    // Ensure we always return proper headers even in error cases
    const safeHeaders = corsHeaders || {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    };

    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        message: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: safeHeaders }
    );
  }
});