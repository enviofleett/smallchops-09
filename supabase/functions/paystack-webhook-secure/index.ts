
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { getCorsHeaders } from "../_shared/cors.ts";


// Paystack webhook events that we handle
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
      account_name?: string;
    };
    customer?: {
      email: string;
      customer_code: string;
    };
    metadata?: any;
  };
}

// Security function to verify webhook signature
// Signature verification removed per Paystack IP-only recommendation

// Function to log security incidents
async function logSecurityIncident(
  type: string, 
  description: string, 
  severity: string, 
  metadata?: any
): Promise<void> {
  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    await supabase.from('audit_logs').insert({
      action: type,
      category: 'Security',
      message: description,
      new_values: { 
        severity, 
        metadata,
        timestamp: new Date().toISOString() 
      }
    });
  } catch (error) {
    console.error('Failed to log security incident:', error);
  }
}

// Handle charge.success events
async function processChargeSuccess(data: any): Promise<{ success: boolean; message: string }> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    // Use the existing successful payment handler
    await supabase.rpc('handle_successful_payment', {
      p_reference: data.reference,
      p_paid_at: (data.paid_at ? new Date(data.paid_at) : new Date()).toISOString(),
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

    return { success: true, message: 'Charge success processed' };
  } catch (error) {
    console.error('Error processing charge success:', error);
    return { success: false, message: error.message };
  }
}

// Handle charge.failed events
async function processChargeFailed(data: any): Promise<{ success: boolean; message: string }> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    // Update payment transaction status
    const { error: updateError } = await supabase
      .from('payment_transactions')
      .update({
        status: 'failed',
        gateway_response: data.gateway_response,
        updated_at: new Date()
      })
      .eq('provider_reference', data.reference);

    if (updateError) throw updateError;

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
          updated_at: new Date()
        })
        .eq('id', transaction.order_id);
    }

    return { success: true, message: 'Charge failure processed' };
  } catch (error) {
    console.error('Error processing charge failure:', error);
    return { success: false, message: error.message };
  }
}

// Handle transfer.success events
async function processTransferSuccess(data: any): Promise<{ success: boolean; message: string }> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    // Update refund status if applicable
    const { error } = await supabase
      .from('refunds')
      .update({
        status: 'completed',
        processed_at: new Date(),
        gateway_response: data.gateway_response
      })
      .eq('provider_reference', data.reference);

    if (error) throw error;

    return { success: true, message: 'Transfer success processed' };
  } catch (error) {
    console.error('Error processing transfer success:', error);
    return { success: false, message: error.message };
  }
}

// Handle transfer.failed events
async function processTransferFailed(data: any): Promise<{ success: boolean; message: string }> {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    { auth: { persistSession: false } }
  );

  try {
    // Update refund status
    const { error } = await supabase
      .from('refunds')
      .update({
        status: 'failed',
        processed_at: new Date(),
        gateway_response: data.gateway_response
      })
      .eq('provider_reference', data.reference);

    if (error) throw error;

    return { success: true, message: 'Transfer failure processed' };
  } catch (error) {
    console.error('Error processing transfer failure:', error);
    return { success: false, message: error.message };
  }
}

serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Only accept POST requests
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

// Verify Paystack signature (HMAC-SHA512 over raw body)
let webhookData: any;
try {
  const rawBody = await req.text();
  const providedSig = req.headers.get('x-paystack-signature');
  if (!providedSig) {
    await logSecurityIncident('webhook_missing_signature', 'Missing x-paystack-signature header', 'critical', {});
    return new Response('Unauthorized', { status: 401, headers: corsHeaders });
  }

  // Resolve secret key from ENV or DB config
  let secretKey = Deno.env.get('PAYSTACK_SECRET_KEY') || '';
  if (!secretKey) {
    try {
      const { data: cfg } = await supabase.rpc('get_active_paystack_config');
      const eff = Array.isArray(cfg) ? cfg?.[0] : cfg;
      if (eff?.secret_key) secretKey = eff.secret_key;
    } catch (_) {}
  }
  if (!secretKey) {
    await logSecurityIncident('webhook_secret_missing', 'No Paystack secret available for signature verification', 'critical', {});
    return new Response('Server misconfigured', { status: 500, headers: corsHeaders });
  }

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secretKey),
    { name: 'HMAC', hash: 'SHA-512' },
    false,
    ['sign']
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, encoder.encode(rawBody));
  const computedSig = Array.from(new Uint8Array(sigBuf)).map(b => b.toString(16).padStart(2, '0')).join('');

  if (computedSig !== providedSig) {
    await logSecurityIncident('webhook_invalid_signature', 'Invalid Paystack signature', 'critical', { providedSig });
    return new Response('Invalid signature', { status: 401, headers: corsHeaders });
  }

  webhookData = JSON.parse(rawBody);
} catch (error) {
  console.error('Invalid webhook payload:', error);
  return new Response('Invalid JSON', { status: 400, headers: corsHeaders });
}

// Basic IP logging (retain for auditing)
const clientIP = req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for');

// Validate request is from Paystack IPs (basic IP validation)
const paystackIPs = [
  '52.31.139.75',
  '52.49.173.169',
  '52.214.14.220'
];

// In production, verify IP or call validator function
if (Deno.env.get('ENVIRONMENT') === 'production' && clientIP) {
  if (!paystackIPs.includes(clientIP.split(',')[0].trim())) {
    const { data: ipValidation } = await supabase.functions.invoke('validate-paystack-ip', {
      body: { ip: clientIP }
    });

    if (!ipValidation?.valid) {
      await logSecurityIncident(
        'webhook_invalid_ip',
        `Webhook from unauthorized IP: ${clientIP}`,
        'critical',
        { ip: clientIP }
      );
      return new Response('Unauthorized IP', { status: 403, headers: corsHeaders });
    }
  }
}

// Validate event structure
if (!webhookData.event || !webhookData.data) {
  console.error('Invalid webhook structure');
  return new Response('Invalid webhook structure', { status: 400, headers: corsHeaders });
}

    // Check for duplicate events (prevent replay attacks)
    const eventId = `${webhookData.event}-${webhookData.data.reference}-${webhookData.data.id}`;
    const { data: existingEvent } = await supabase
      .from('webhook_events')
      .select('paystack_event_id')
      .eq('paystack_event_id', eventId)
      .maybeSingle();

    if (existingEvent) {
      console.log('Duplicate webhook event ignored:', eventId);
      return new Response('Event already processed', { status: 200, headers: corsHeaders });
    }

    // Log the webhook event
    const { error: logError } = await supabase
      .from('webhook_events')
      .insert({
        paystack_event_id: eventId,
        event_type: webhookData.event,
        event_data: webhookData,
        processed: false,
        created_at: new Date()
      });

    if (logError) {
      console.error('Failed to log webhook event:', logError);
    }

    console.log(`Processing Paystack webhook: ${webhookData.event}`);

    // Process the webhook event
    let processingResult: { success: boolean; message: string };

    switch (webhookData.event) {
      case 'charge.success': {
        // Double-verify with Paystack before processing using env or DB config
        let verifyKey = '';
        let verifyKeySource = 'unknown';

        if (Deno.env.get('PAYSTACK_SECRET_KEY')) {
          verifyKey = Deno.env.get('PAYSTACK_SECRET_KEY')!;
          verifyKeySource = 'env:PAYSTACK_SECRET_KEY';
        } else {
          try {
            const { data: cfg } = await supabase.rpc('get_active_paystack_config');
            const eff = Array.isArray(cfg) ? cfg?.[0] : cfg;
            if (eff?.secret_key) {
              verifyKey = eff.secret_key;
              verifyKeySource = 'db:secret_key';
            }
          } catch (_e) {}
        }

        console.log(`Double verify key source: ${verifyKeySource}`);

        if (!verifyKey) {
          console.warn('No key available for double verification; skipping processing');
          processingResult = { success: false, message: 'Missing key for verification' };
          break;
        }

        try {
          const ref = webhookData.data.reference;
          const verifyRes = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(ref)}`, {
            headers: { 'Authorization': `Bearer ${verifyKey}`, 'Content-Type': 'application/json' }
          });
          const verifyText = await verifyRes.text();
          const verifyJson: any = verifyText ? JSON.parse(verifyText) : {};
          const vData = verifyJson?.data;
          const verifiedSuccess = verifyJson?.status === true && vData?.status === 'success';
          if (!verifiedSuccess) {
            console.warn('Verification did not confirm success; ignoring event', verifyJson?.message);
            processingResult = { success: false, message: 'Verification did not confirm success' };
            break;
          }
          // Merge verified fields with webhook payload and process
          const merged = {
            ...webhookData.data,
            paid_at: vData?.paid_at ?? webhookData.data.paid_at,
            gateway_response: vData?.gateway_response ?? webhookData.data.gateway_response,
            fees: (typeof vData?.fees === 'number' ? vData.fees : webhookData.data.fees),
            channel: vData?.channel ?? webhookData.data.channel,
            authorization: vData?.authorization ?? webhookData.data.authorization,
          };
          processingResult = await processChargeSuccess(merged);
        } catch (e) {
          console.error('Double verification error:', e);
          processingResult = { success: false, message: 'Verification error' };
        }
        break;
      }

      case 'charge.failed':
        processingResult = await processChargeFailed(webhookData.data);
        break;
      
      case 'transfer.success':
        processingResult = await processTransferSuccess(webhookData.data);
        break;
      
      case 'transfer.failed':
        processingResult = await processTransferFailed(webhookData.data);
        break;
      
      default:
        console.log(`Unhandled webhook event: ${webhookData.event}`);
        processingResult = { success: true, message: 'Event ignored' };
    }

    // Update webhook event processing status
    const { error: updateError } = await supabase
      .from('webhook_events')
      .update({
        processed: true,
        processing_result: processingResult,
        processed_at: new Date()
      })
      .eq('paystack_event_id', eventId);

    if (updateError) {
      console.error('Failed to update webhook processing status:', updateError);
    }

    // Log successful processing
    if (processingResult.success) {
      console.log(`Successfully processed ${webhookData.event}:`, processingResult.message);
    } else {
      console.error(`Failed to process ${webhookData.event}:`, processingResult.message);
    }

    return new Response(JSON.stringify({
      success: processingResult.success,
      message: processingResult.message
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Webhook processing error:', error);
    
    // Log the error
    await logSecurityIncident(
      'webhook_processing_error',
      `Webhook processing failed: ${error.message}`,
      'high',
      { error: error.message, stack: error.stack }
    );

    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error'
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
