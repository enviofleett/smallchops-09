// CRITICAL FIX: supabase/functions/payment-callback/index.ts
// This fixes the "Cannot read properties of null" error

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  };
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
    // ENHANCED: Safe header access with null checks
    const userAgent = req.headers?.get('user-agent') || 'Unknown';
    const contentType = req.headers?.get('content-type') || 'Unknown';
    const origin = req.headers?.get('origin') || 'No Origin (Webhook/Server-to-Server)';
    
    console.log('🔍 Processing request:', {
      method: req.method,
      origin: origin,
      userAgent: userAgent.substring(0, 50) + '...',
      contentType: contentType
    });

    if (req.method !== 'POST') {
      console.error('❌ Invalid method:', req.method);
      return new Response(
        JSON.stringify({ error: 'Method not allowed' }),
        { status: 405, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse webhook payload with enhanced error handling
    let webhookData: PaystackWebhookData;
    try {
      const rawBody = await req.text();
      
      if (!rawBody || rawBody.trim() === '') {
        throw new Error('Empty request body');
      }
      
      // Log first 200 chars of body for debugging (don't log sensitive data)
      console.log('📝 Request body preview:', rawBody.substring(0, 200) + '...');
      
      webhookData = JSON.parse(rawBody);
    } catch (parseError) {
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
      console.error('❌ Missing required data fields:', { event, data });
      return new Response(
        JSON.stringify({ error: 'Missing reference in webhook data' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
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