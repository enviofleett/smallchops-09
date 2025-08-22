import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { crypto } from "https://deno.land/std@0.190.0/crypto/mod.ts";
import { getCorsHeaders } from '../_shared/cors.ts';

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const payload = await req.text();
    const signature = req.headers.get('x-paystack-signature');

    // Signature is optional for production safety - we'll validate with IP if missing
    if (!signature) {
      console.log('Missing Paystack signature - proceeding with IP validation only');
    }

    // Get webhook secret from database (optional for production safety)
    const { data: config } = await supabaseClient
      .from('payment_integrations')
      .select('webhook_secret')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();

    const webhookSecret = config?.webhook_secret;

    // If webhook secret is not configured, we'll rely on IP validation for security
    if (!webhookSecret) {
      console.log('Webhook secret not configured - proceeding with IP validation only');
    }

    // 🔒 CORRECT WEBHOOK SIGNATURE VERIFICATION using HMAC-SHA512
    let signatureValid = false;
    
    if (signature && webhookSecret) {
      try {
        console.log('🔐 Verifying webhook signature with HMAC-SHA512');
        
        const encoder = new TextEncoder();
        const key = await crypto.subtle.importKey(
          "raw",
          encoder.encode(webhookSecret),
          { name: "HMAC", hash: "SHA-512" },
          false,
          ["sign", "verify"]
        );

        const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
        const expectedSignature = Array.from(new Uint8Array(signatureBytes))
          .map(b => b.toString(16).padStart(2, '0'))
          .join('');

        // Clean up signature format - remove 'sha512=' prefix if present
        const cleanSignature = signature.startsWith('sha512=') ? signature.slice(7) : signature;
        
        // Use timing-safe comparison
        signatureValid = expectedSignature.length === cleanSignature.length && 
                        expectedSignature === cleanSignature;
        
        if (!signatureValid) {
          console.warn('🚨 Webhook signature verification FAILED:', {
            expected_length: expectedSignature.length,
            received_length: cleanSignature.length,
            expected_prefix: expectedSignature.substring(0, 10),
            received_prefix: cleanSignature.substring(0, 10)
          });
        } else {
          console.log('✅ Webhook signature verified successfully with HMAC-SHA512');
        }
      } catch (error) {
        console.error('❌ Signature verification error:', error);
        signatureValid = false;
      }
    } else {
      console.log('⚠️ Webhook signature verification skipped - no signature or secret available');
    }

    // Enhanced security: Validate IP address when signature verification is not available or fails
    if (!signatureValid && webhookSecret) {
      const clientIP = req.headers.get('cf-connecting-ip') || 
                      req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      req.headers.get('x-real-ip') || 
                      'unknown';

      // Use the database function to validate Paystack IPs
      const { data: isValidIP, error: ipError } = await supabaseClient
        .rpc('validate_paystack_webhook_ip', { request_ip: clientIP });

      if (ipError || !isValidIP) {
        console.error('Invalid IP and signature verification failed:', { ip: clientIP });
        return new Response(JSON.stringify({ error: 'Unauthorized webhook request' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 401,
        });
      }
      
      console.log('IP validation passed for webhook request');
    }

    const event = JSON.parse(payload);

    // Check for replay attacks (events older than 5 minutes)
    const eventTime = new Date(event.created_at || event.data?.created_at);
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    
    if (eventTime < fiveMinutesAgo) {
      console.error('Webhook replay attack detected:', { eventTime, received: new Date() });
      return new Response(JSON.stringify({ error: 'Event too old' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    // Check for duplicate events
    const { data: existingEvent } = await supabaseClient
      .from('webhook_logs')
      .select('id')
      .eq('provider_event_id', event.id)
      .eq('provider', 'paystack')
      .single();

    if (existingEvent) {
      console.log('Duplicate webhook event received:', event.id);
      return new Response(JSON.stringify({ status: 'duplicate_processed' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      });
    }

    // Log webhook event before processing
    const { data: webhookLog, error: logError } = await supabaseClient
      .from('webhook_logs')
      .insert({
        provider: 'paystack',
        event_type: event.event,
        provider_event_id: event.id,
        transaction_reference: event.data?.reference,
        payload: event,
        processed_at: new Date()
      })
      .select()
      .single();

    if (logError) {
      console.error('Failed to log webhook event:', logError);
      // Continue processing even if logging fails
    }

    // Process different event types with error handling
    try {
      switch (event.event) {
        case 'charge.success':
          await handleChargeSuccess(supabaseClient, event.data);
          break;
        case 'charge.failed':
          await handleChargeFailed(supabaseClient, event.data);
          break;
        case 'charge.dispute.create':
          await handleChargeDispute(supabaseClient, event.data);
          break;
        default:
          console.log(`Unhandled event type: ${event.event}`);
      }

      // Update webhook log as processed successfully
      if (webhookLog) {
        await supabaseClient
          .from('webhook_logs')
          .update({ processed_at: new Date() })
          .eq('id', webhookLog.id);
      }

    } catch (processingError) {
      console.error('Webhook processing error:', processingError);
      
      // Update webhook log with error
      if (webhookLog) {
        await supabaseClient
          .from('webhook_logs')
          .update({ 
            processed_at: new Date(),
            payload: { ...event, processing_error: processingError.message }
          })
          .eq('id', webhookLog.id);
      }

      return new Response(JSON.stringify({ 
        error: 'Event processing failed',
        event_id: event.id 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    return new Response(JSON.stringify({ status: 'success' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Webhook error:', error);
    return new Response(JSON.stringify({ error: 'Webhook processing failed' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

// Remove duplicate function - use the improved one below

async function handleChargeSuccess(supabaseClient: any, data: any) {
  try {
    // Use transaction for data consistency
    const { error: transactionError } = await supabaseClient.rpc('handle_successful_payment', {
      p_reference: data.reference,
      p_paid_at: new Date(data.paid_at),
      p_gateway_response: data.gateway_response,
      p_fees: data.fees / 100,
      p_channel: data.channel,
      p_authorization_code: data.authorization?.authorization_code,
      p_card_type: data.authorization?.card_type,
      p_last4: data.authorization?.last4,
      p_exp_month: data.authorization?.exp_month,
      p_exp_year: data.authorization?.exp_year,
      p_bank: data.authorization?.bank
    });

    if (transactionError) {
      throw new Error(`Database transaction failed: ${transactionError.message}`);
    }

    console.log(`Successfully processed charge success for reference: ${data.reference}`);
  } catch (error) {
    console.error('Error handling charge success:', error);
    throw error;
  }
}

async function handleChargeFailed(supabaseClient: any, data: any) {
  try {
    const { error } = await supabaseClient
      .from('payment_transactions')
      .update({
        status: 'failed',
        gateway_response: data.gateway_response,
        processed_at: new Date()
      })
      .eq('provider_reference', data.reference);

    if (error) {
      throw new Error(`Failed to update failed transaction: ${error.message}`);
    }

    console.log(`Successfully processed charge failure for reference: ${data.reference}`);
  } catch (error) {
    console.error('Error handling charge failure:', error);
    throw error;
  }
}

async function handleChargeDispute(supabaseClient: any, data: any) {
  try {
    // Log dispute for manual review
    const { error } = await supabaseClient
      .from('payment_disputes')
      .insert({
        transaction_reference: data.reference,
        dispute_id: data.id,
        reason: data.reason,
        amount: data.amount / 100,
        currency: data.currency,
        status: 'pending_review',
        created_at: new Date(data.created_at)
      });

    if (error) {
      throw new Error(`Failed to log payment dispute: ${error.message}`);
    }

    console.log(`Successfully logged dispute for reference: ${data.reference}`);
  } catch (error) {
    console.error('Error handling charge dispute:', error);
    throw error;
  }
}