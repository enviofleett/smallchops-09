import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

// Paystack's official IP addresses for webhook validation
const PAYSTACK_IPS = [
  '52.31.139.75',
  '52.49.173.169', 
  '52.214.14.220'
];

interface PaystackWebhookPayload {
  event: string;
  data: {
    id: string;
    reference: string;
    amount: number;
    status: string;
    gateway_response: string;
    paid_at?: string;
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
    customer?: {
      email: string;
      customer_code: string;
    };
    metadata?: any;
  };
}

// Security function to verify webhook signature using HMAC-SHA512
async function verifyPaystackSignature(
  body: string, 
  signature: string, 
  secret: string
): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
    const computedSig = Array.from(new Uint8Array(sigBuf))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return computedSig === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

// Function to validate Paystack IP addresses
function validatePaystackIP(clientIP: string | null): boolean {
  if (!clientIP) return false;
  
  // Handle comma-separated IPs (proxies)
  const actualIP = clientIP.split(',')[0].trim();
  return PAYSTACK_IPS.includes(actualIP);
}

// Security incident logging
async function logSecurityIncident(
  supabase: any,
  type: string, 
  description: string, 
  severity: string, 
  metadata?: any
): Promise<void> {
  try {
    await supabase.from('security_incidents').insert({
      type,
      description,
      severity,
      ip_address: metadata?.ip,
      user_agent: metadata?.userAgent,
      request_data: metadata?.requestData,
      created_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to log security incident:', error);
  }
}

// Asynchronous webhook processing function
async function processWebhookAsync(
  supabase: any,
  webhookData: PaystackWebhookPayload,
  eventId: string
): Promise<{ success: boolean; message: string }> {
  try {
    console.log(`Processing webhook event: ${webhookData.event} for reference: ${webhookData.data.reference}`);
    
    let result: { success: boolean; message: string };
    
    switch (webhookData.event) {
      case 'charge.success':
        result = await processChargeSuccess(supabase, webhookData.data);
        break;
      case 'charge.failed':
        result = await processChargeFailed(supabase, webhookData.data);
        break;
      case 'transfer.success':
        result = await processTransferSuccess(supabase, webhookData.data);
        break;
      case 'transfer.failed':
        result = await processTransferFailed(supabase, webhookData.data);
        break;
      default:
        console.log(`Unhandled webhook event: ${webhookData.event}`);
        result = { success: true, message: 'Event ignored' };
    }
    
    // Update webhook processing status
    await supabase
      .from('webhook_events')
      .update({
        processed: true,
        processing_result: result,
        processed_at: new Date().toISOString()
      })
      .eq('paystack_event_id', eventId);
    
    return result;
  } catch (error) {
    console.error('Async webhook processing error:', error);
    return { success: false, message: error.message };
  }
}

// Process successful charge events
async function processChargeSuccess(supabase: any, data: any): Promise<{ success: boolean; message: string }> {
  try {
    // Double-verify payment with Paystack API before processing
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      throw new Error('Paystack secret key not configured');
    }
    
    const verifyResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(data.reference)}`,
      {
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      }
    );
    
    const verifyData = await verifyResponse.json();
    
    if (!verifyData.status || verifyData.data?.status !== 'success') {
      console.warn('Payment verification failed:', verifyData.message);
      return { success: false, message: 'Payment verification failed' };
    }
    
    // Use RPC function for atomic payment processing
    await supabase.rpc('handle_successful_payment', {
      p_reference: data.reference,
      p_paid_at: data.paid_at ? new Date(data.paid_at).toISOString() : new Date().toISOString(),
      p_gateway_response: data.gateway_response,
      p_fees: data.fees ? data.fees / 100 : 0,
      p_channel: data.channel,
      p_authorization_code: data.authorization?.authorization_code,
      p_card_type: data.authorization?.card_type,
      p_last4: data.authorization?.last4,
      p_exp_month: data.authorization?.exp_month,
      p_exp_year: data.authorization?.exp_year,
      p_bank: data.authorization?.bank
    });
    
    // Trigger real-time notifications using pg_notify
    await supabase.rpc('pg_notify', {
      channel: 'payment_success',
      payload: JSON.stringify({
        reference: data.reference,
        amount: data.amount,
        timestamp: new Date().toISOString()
      })
    });
    
    return { success: true, message: 'Payment processed successfully' };
  } catch (error) {
    console.error('Error processing charge success:', error);
    return { success: false, message: error.message };
  }
}

// Process failed charge events
async function processChargeFailed(supabase: any, data: any): Promise<{ success: boolean; message: string }> {
  try {
    // Update payment transaction status
    await supabase
      .from('payment_transactions')
      .update({
        status: 'failed',
        gateway_response: data.gateway_response,
        updated_at: new Date().toISOString()
      })
      .eq('provider_reference', data.reference);
    
    // Update associated order status
    const { data: transaction } = await supabase
      .from('payment_transactions')
      .select('order_id')
      .eq('provider_reference', data.reference)
      .single();
    
    if (transaction?.order_id) {
      await supabase
        .from('orders')
        .update({
          payment_status: 'failed',
          status: 'cancelled',
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.order_id);
    }
    
    return { success: true, message: 'Failed payment processed' };
  } catch (error) {
    console.error('Error processing charge failure:', error);
    return { success: false, message: error.message };
  }
}

// Process transfer success events
async function processTransferSuccess(supabase: any, data: any): Promise<{ success: boolean; message: string }> {
  try {
    await supabase
      .from('payment_refunds')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('provider_refund_id', data.reference);
    
    return { success: true, message: 'Transfer success processed' };
  } catch (error) {
    console.error('Error processing transfer success:', error);
    return { success: false, message: error.message };
  }
}

// Process transfer failed events
async function processTransferFailed(supabase: any, data: any): Promise<{ success: boolean; message: string }> {
  try {
    await supabase
      .from('payment_refunds')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('provider_refund_id', data.reference);
    
    return { success: true, message: 'Transfer failure processed' };
  } catch (error) {
    console.error('Error processing transfer failure:', error);
    return { success: false, message: error.message };
  }
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }
  
  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }
  
  let supabase: any;
  let rawBody: string;
  let clientIP: string | null = null;
  
  try {
    // Initialize Supabase client
    supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );
    
    // Get client IP for validation
    clientIP = req.headers.get('cf-connecting-ip') || 
               req.headers.get('x-forwarded-for') || 
               req.headers.get('x-real-ip');
    
    // IP validation for production - allow bypass in development/test environment
    const isDevelopment = Deno.env.get('ENVIRONMENT') !== 'production';
    const validIP = validatePaystackIP(clientIP);
    
    if (!validIP && !isDevelopment) {
      // In production, log but don't block - Paystack IPs can change
      await logSecurityIncident(
        supabase,
        'suspicious_webhook_ip',
        `Webhook from non-standard IP: ${clientIP}`,
        'medium',
        { ip: clientIP, userAgent: req.headers.get('user-agent') }
      );
      console.warn('Non-standard webhook IP detected:', clientIP);
    }
    
    // Get raw body for signature verification
    rawBody = await req.text();
    
    // Verify Paystack signature
    const paystackSignature = req.headers.get('x-paystack-signature');
    if (!paystackSignature) {
      await logSecurityIncident(
        supabase,
        'missing_webhook_signature',
        'Missing x-paystack-signature header',
        'critical',
        { ip: clientIP }
      );
      
      return new Response('Missing signature', { 
        status: 401, 
        headers: corsHeaders 
      });
    }
    
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      console.error('Paystack secret key not configured');
      return new Response('Server misconfigured', { 
        status: 500, 
        headers: corsHeaders 
      });
    }
    
    const isValidSignature = await verifyPaystackSignature(
      rawBody, 
      paystackSignature, 
      secretKey
    );
    
    if (!isValidSignature) {
      await logSecurityIncident(
        supabase,
        'invalid_webhook_signature',
        'Invalid webhook signature',
        'critical',
        { 
          ip: clientIP,
          signature: paystackSignature,
          bodyLength: rawBody.length
        }
      );
      
      return new Response('Invalid signature', { 
        status: 401, 
        headers: corsHeaders 
      });
    }
    
    // Parse webhook data
    const webhookData: PaystackWebhookPayload = JSON.parse(rawBody);
    
    // Validate webhook structure
    if (!webhookData.event || !webhookData.data || !webhookData.data.reference) {
      return new Response('Invalid webhook structure', { 
        status: 400, 
        headers: corsHeaders 
      });
    }
    
    // Check for duplicate events (prevent replay attacks)
    const eventId = `${webhookData.event}-${webhookData.data.reference}-${webhookData.data.id || Date.now()}`;
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('paystack_event_id')
      .eq('paystack_event_id', eventId)
      .maybeSingle();
    
    if (existingEvent) {
      console.log('Duplicate webhook event ignored:', eventId);
      return new Response('Event already processed', { 
        status: 200, 
        headers: corsHeaders 
      });
    }
    
    // Log webhook event immediately
    const { error: logError } = await supabase
      .from('webhook_events')
      .insert({
        paystack_event_id: eventId,
        event_type: webhookData.event,
        event_data: webhookData,
        processed: false,
        received_at: new Date().toISOString()
      });
    
    if (logError) {
      console.error('Failed to log webhook event:', logError);
    }
    
    // Return immediate 200 OK response to prevent Paystack retries
    const response = new Response('Webhook received', { 
      status: 200, 
      headers: corsHeaders 
    });
    
    // Process webhook asynchronously in background
    EdgeRuntime.waitUntil(
      processWebhookAsync(supabase, webhookData, eventId)
        .then(result => {
          console.log(`Webhook ${eventId} processing completed:`, result);
        })
        .catch(error => {
          console.error(`Webhook ${eventId} processing failed:`, error);
        })
    );
    
    return response;
    
  } catch (error) {
    console.error('Webhook processing error:', error);
    
    // Log the error if supabase is available
    if (supabase) {
      await logSecurityIncident(
        supabase,
        'webhook_processing_error',
        `Webhook processing failed: ${error.message}`,
        'high',
        { 
          error: error.message,
          ip: clientIP,
          bodyLength: rawBody?.length || 0
        }
      );
    }
    
    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});