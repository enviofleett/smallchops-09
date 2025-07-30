// CRITICAL SECURITY: Consolidated Secure Paystack Webhook Handler
// This replaces all existing webhook handlers with enhanced security

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// PRODUCTION CORS - Restrict to Paystack IPs only
const PAYSTACK_IPS = [
  '52.31.139.75',
  '52.49.173.169', 
  '52.214.14.220'
];

const corsHeaders = {
  'Access-Control-Allow-Origin': 'https://paystack.co',
  'Access-Control-Allow-Headers': 'content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'POST',
  'Content-Security-Policy': "default-src 'none'",
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY'
};

interface PaystackWebhookPayload {
  event: string;
  data: {
    id?: string;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    gateway_response: string;
    paid_at?: string;
    created_at: string;
    channel: string;
    fees?: number;
    authorization?: {
      authorization_code: string;
      card_type: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      bank: string;
    };
  };
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  { auth: { persistSession: false } }
);

async function verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', key, encoder.encode(payload));
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return computedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

async function logSecurityIncident(type: string, description: string, severity: string, metadata: any = {}) {
  try {
    await supabase.from('security_incidents').insert({
      type,
      description,
      severity,
      request_data: metadata,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log security incident:', error);
  }
}

async function processChargeSuccess(data: any): Promise<{ success: boolean; message: string }> {
  try {
    const result = await supabase.rpc('confirm_payment_atomic', {
      p_reference: data.reference,
      p_amount: data.amount,
      p_paystack_data: data,
      p_confirmed_at: new Date().toISOString()
    });

    if (result.error) {
      throw result.error;
    }

    return { success: true, message: 'Payment confirmed successfully' };
  } catch (error) {
    console.error('Error processing charge success:', error);
    await logSecurityIncident(
      'webhook_processing_error',
      'Failed to process charge.success webhook',
      'high',
      { reference: data.reference, error: error.message }
    );
    throw error;
  }
}

async function processChargeFailed(data: any): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('payment_transactions')
      .update({
        status: 'failed',
        gateway_response: data.gateway_response,
        provider_response: data,
        updated_at: new Date().toISOString()
      })
      .eq('provider_reference', data.reference);

    if (error) {
      throw error;
    }

    // Also update related order if exists
    await supabase
      .from('orders')
      .update({
        payment_status: 'failed',
        status: 'cancelled',
        updated_at: new Date().toISOString()
      })
      .eq('id', (
        await supabase
          .from('payment_transactions')
          .select('order_id')
          .eq('provider_reference', data.reference)
          .single()
      ).data?.order_id);

    return { success: true, message: 'Payment failure recorded' };
  } catch (error) {
    console.error('Error processing charge failed:', error);
    throw error;
  }
}

async function processTransferSuccess(data: any): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('payment_refunds')
      .update({
        status: 'completed',
        provider_refund_id: data.id,
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', (
        await supabase
          .from('payment_transactions')
          .select('id')
          .eq('provider_reference', data.reference)
          .single()
      ).data?.id);

    if (error) {
      throw error;
    }

    return { success: true, message: 'Transfer success recorded' };
  } catch (error) {
    console.error('Error processing transfer success:', error);
    throw error;
  }
}

async function processTransferFailed(data: any): Promise<{ success: boolean; message: string }> {
  try {
    const { error } = await supabase
      .from('payment_refunds')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('transaction_id', (
        await supabase
          .from('payment_transactions')
          .select('id')
          .eq('provider_reference', data.reference)
          .single()
      ).data?.id);

    if (error) {
      throw error;
    }

    return { success: true, message: 'Transfer failure recorded' };
  } catch (error) {
    console.error('Error processing transfer failed:', error);
    throw error;
  }
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    console.log('[WEBHOOK] Processing Paystack webhook...');
    
    // Enhanced IP validation
    const clientIP = req.headers.get('cf-connecting-ip') || 
                    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                    req.headers.get('x-real-ip') || 
                    'unknown';

    // Verify request comes from Paystack (production security)
    if (Deno.env.get('DENO_ENV') === 'production' && !PAYSTACK_IPS.includes(clientIP)) {
      await logSecurityIncident(
        'unauthorized_webhook_ip',
        `Webhook request from unauthorized IP: ${clientIP}`,
        'high',
        { ip: clientIP, user_agent: req.headers.get('user-agent') }
      );

      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 403,
      });
    }
    
    // CRITICAL SECURITY 1: Verify webhook signature
    const signature = req.headers.get('x-paystack-signature');
    if (!signature) {
      await logSecurityIncident(
        'webhook_missing_signature',
        'Webhook received without signature',
        'critical',
        { headers: Object.fromEntries(req.headers.entries()) }
      );
      return new Response('Unauthorized - No signature', { status: 401, headers: corsHeaders });
    }

    const body = await req.text();
    console.log('[WEBHOOK] Received payload, verifying signature...');

    // Get active webhook secret from database
    const { data: config } = await supabase.rpc('get_active_paystack_config');
    
    if (!config?.webhook_secret) {
      await logSecurityIncident(
        'webhook_secret_not_configured',
        'Webhook secret not configured',
        'critical',
        { ip: clientIP }
      );

      return new Response(JSON.stringify({ error: 'Webhook not configured' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 503,
      });
    }

    // Verify signature
    const isValidSignature = await verifyWebhookSignature(body, signature, config.webhook_secret);
    if (!isValidSignature) {
      await logSecurityIncident(
        'webhook_signature_mismatch',
        'Invalid webhook signature detected',
        'critical',
        {
          expected_signature: 'REDACTED',
          received_signature: 'REDACTED',
          payload_length: body.length
        }
      );
      return new Response('Unauthorized - Invalid signature', { status: 401, headers: corsHeaders });
    }

    console.log('[WEBHOOK] Signature verified successfully');

    // CRITICAL SECURITY 2: Parse and validate event data
    let eventData: PaystackWebhookPayload;
    try {
      eventData = JSON.parse(body);
    } catch (error) {
      console.error('[WEBHOOK] Invalid JSON payload:', error);
      return new Response('Invalid JSON payload', { status: 400, headers: corsHeaders });
    }

    if (!eventData.event || !eventData.data) {
      console.error('[WEBHOOK] Invalid event structure');
      return new Response('Invalid event structure', { status: 400, headers: corsHeaders });
    }

    const eventId = eventData.data.id || eventData.data.reference;
    console.log(`[WEBHOOK] Processing event: ${eventData.event} for ${eventId}`);

    // CRITICAL SECURITY 3: Prevent replay attacks and duplicate processing
    const { data: existingEvent, error: duplicateError } = await supabase
      .from('webhook_events')
      .select('id, processed')
      .eq('paystack_event_id', eventId)
      .eq('event_type', eventData.event)
      .single();

    if (existingEvent) {
      console.log(`[WEBHOOK] Event ${eventId} already processed`);
      return new Response('Event already processed', { status: 200, headers: corsHeaders });
    }

    // CRITICAL SECURITY 4: Log webhook event for audit
    const { data: loggedEvent, error: logError } = await supabase
      .from('webhook_events')
      .insert({
        paystack_event_id: eventId,
        event_type: eventData.event,
        event_data: eventData,
        signature: signature,
        processed: false,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logError) {
      console.error('[WEBHOOK] Failed to log event:', logError);
      throw logError;
    }

    // CRITICAL SECURITY 5: Process event with comprehensive error handling
    let processingResult: { success: boolean; message: string };

    try {
      switch (eventData.event) {
        case 'charge.success':
          console.log('[WEBHOOK] Processing charge.success');
          processingResult = await processChargeSuccess(eventData.data);
          break;
        
        case 'charge.failed':
          console.log('[WEBHOOK] Processing charge.failed');
          processingResult = await processChargeFailed(eventData.data);
          break;
        
        case 'transfer.success':
          console.log('[WEBHOOK] Processing transfer.success');
          processingResult = await processTransferSuccess(eventData.data);
          break;
        
        case 'transfer.failed':
          console.log('[WEBHOOK] Processing transfer.failed');
          processingResult = await processTransferFailed(eventData.data);
          break;
        
        default:
          console.log(`[WEBHOOK] Unhandled event type: ${eventData.event}`);
          processingResult = { success: true, message: `Event type ${eventData.event} acknowledged but not processed` };
      }

      // Update event processing status
      await supabase
        .from('webhook_events')
        .update({
          processed: true,
          processing_result: processingResult,
          processed_at: new Date().toISOString()
        })
        .eq('id', loggedEvent.id);

      console.log(`[WEBHOOK] Successfully processed ${eventData.event} for ${eventId}`);
      return new Response(
        JSON.stringify({ success: true, message: processingResult.message }), 
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (processingError) {
      console.error('[WEBHOOK] Event processing error:', processingError);
      
      // Update event with error status
      await supabase
        .from('webhook_events')
        .update({
          processed: false,
          processing_result: { success: false, error: processingError.message },
          processed_at: new Date().toISOString()
        })
        .eq('id', loggedEvent.id);

      // Log security incident
      await logSecurityIncident(
        'webhook_processing_error',
        'Failed to process webhook event',
        'high',
        {
          event_type: eventData.event,
          event_id: eventId,
          error: processingError.message
        }
      );

      return new Response(
        JSON.stringify({ success: false, error: 'Event processing failed' }), 
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('[WEBHOOK] Webhook handler error:', error);
    
    await logSecurityIncident(
      'webhook_handler_error',
      'Critical error in webhook handler',
      'critical',
      { error: error.message }
    );

    return new Response(
      JSON.stringify({ success: false, error: 'Webhook processing failed' }), 
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});