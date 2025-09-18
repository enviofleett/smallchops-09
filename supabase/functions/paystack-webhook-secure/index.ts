import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// CORS headers
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface PaystackWebhookEvent {
  event: string;
  data: {
    id: number;
    domain: string;
    status: string;
    reference: string;
    amount: number;
    message?: string;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    ip_address?: string;
    metadata?: any;
    fees?: number;
    customer?: {
      id: number;
      first_name?: string;
      last_name?: string;
      email: string;
      phone?: string;
    };
    authorization?: {
      authorization_code: string;
      bin: string;
      last4: string;
      exp_month: string;
      exp_year: string;
      channel: string;
      card_type: string;
      bank: string;
      country_code: string;
      brand: string;
      reusable: boolean;
      signature: string;
    };
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: { ...corsHeaders, 'Content-Type': 'text/plain' }
    });
  }

  try {
    // Environment validation with enhanced logging
    const PAYSTACK_WEBHOOK_SECRET = Deno.env.get('PAYSTACK_WEBHOOK_SECRET');
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const isDevelopment = Deno.env.get('ENVIRONMENT') === 'development';

    console.log('🔧 Environment validation:', {
      hasWebhookSecret: !!PAYSTACK_WEBHOOK_SECRET,
      hasSupabaseUrl: !!SUPABASE_URL,
      hasServiceRoleKey: !!SUPABASE_SERVICE_ROLE_KEY,
      isDevelopment,
      secretLength: PAYSTACK_WEBHOOK_SECRET?.length
    });

    if (!PAYSTACK_WEBHOOK_SECRET || !SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      console.error('❌ Missing environment variables');
      return new Response('Server configuration error', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    // Get request details for logging
    const clientIP = req.headers.get('cf-connecting-ip') || 
                    req.headers.get('x-forwarded-for') || 
                    req.headers.get('x-real-ip') || 'unknown';
    const userAgent = req.headers.get('user-agent') || 'unknown';

    console.log('🔍 Processing request:', {
      method: req.method,
      clientIP,
      userAgent: userAgent.substring(0, 50) + '...',
      hasSignature: !!req.headers.get('x-paystack-signature')
    });

    // Read body as text for signature verification
    const rawBody = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature');

    if (!paystackSignature) {
      console.error('❌ Missing Paystack signature header');
      return new Response('Unauthorized - missing signature', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    console.log('🔐 Signature processing:', {
      originalLength: paystackSignature.length,
      cleanedLength: paystackSignature.replace(/^sha512=/, '').length,
      hasPrefix: paystackSignature.startsWith('sha512='),
      bodyLength: rawBody.length
    });

    // Clean signature (remove sha512= prefix if present)
    const cleanSignature = paystackSignature.replace(/^sha512=/, '');
    
    // Compute expected signature using HMAC SHA-512
    const encoder = new TextEncoder();
    const keyData = encoder.encode(PAYSTACK_WEBHOOK_SECRET);
    const messageData = encoder.encode(rawBody);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const expectedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');

    // Verify signature
    if (cleanSignature !== expectedSignature) {
      console.error('🚫 Webhook signature verification FAILED:', {
        receivedSignature: cleanSignature.substring(0, 16) + '...',
        expectedSignature: expectedSignature.substring(0, 16) + '...',
        receivedLength: cleanSignature.length,
        expectedLength: expectedSignature.length,
        bodyLength: rawBody.length,
        algorithm: 'SHA-512'
      });

      // Log security event
      try {
        const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
        await supabase.from('audit_logs').insert({
          action: 'webhook_signature_verification_failed',
          category: 'webhook_security',
          message: 'Paystack webhook signature verification failed',
          new_values: {
            client_ip: clientIP,
            user_agent: userAgent,
            signature_mismatch: true,
            body_length: rawBody.length,
            timestamp: new Date().toISOString()
          }
        });
      } catch (e) {
        console.error('Failed to log security event:', e);
      }

      return new Response('Unauthorized - invalid signature', { 
        status: 401, 
        headers: corsHeaders 
      });
    }

    console.log('✅ Webhook signature verified successfully');

    // Parse webhook payload
    let webhookEvent: PaystackWebhookEvent;
    try {
      webhookEvent = JSON.parse(rawBody);
    } catch (e) {
      console.error('❌ Failed to parse webhook payload:', e);
      return new Response('Invalid JSON payload', { 
        status: 400, 
        headers: corsHeaders 
      });
    }

    console.log('📨 Webhook event received:', {
      event: webhookEvent.event,
      reference: webhookEvent.data?.reference,
      status: webhookEvent.data?.status,
      amount: webhookEvent.data?.amount ? webhookEvent.data.amount / 100 : 'unknown'
    });

    // Initialize Supabase client
    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

    // Check for duplicate processing (idempotency)
    const idempotencyKey = `webhook_${webhookEvent.data.reference}_${webhookEvent.event}`;
    const { data: existingProcessing } = await supabase
      .from('audit_logs')
      .select('id')
      .eq('action', 'webhook_processed')
      .eq('new_values->idempotency_key', idempotencyKey)
      .maybeSingle();

    if (existingProcessing) {
      console.log('🔄 Webhook already processed (idempotent):', idempotencyKey);
      return new Response('OK - already processed', { 
        status: 200, 
        headers: corsHeaders 
      });
    }

    // Process based on event type
    if (webhookEvent.event === 'charge.success') {
      console.log('💰 Processing successful charge webhook');
      
      try {
        // Use the atomic payment processing function
        const { data: processResult, error: processError } = await supabase
          .rpc('process_payment_atomically', {
            p_reference: webhookEvent.data.reference,
            p_status: 'paid',
            p_amount_kobo: webhookEvent.data.amount,
            p_gateway_response: webhookEvent.data,
            p_paid_at: webhookEvent.data.paid_at
          });

        if (processError) {
          console.error('❌ Payment processing failed:', processError);
          
          // Log orphaned payment for manual review
          await supabase.from('audit_logs').insert({
            action: 'webhook_payment_orphaned',
            category: 'Payment Processing',
            message: `Webhook received but payment processing failed: ${processError.message}`,
            new_values: {
              reference: webhookEvent.data.reference,
              amount_kobo: webhookEvent.data.amount,
              error: processError.message,
              webhook_data: webhookEvent.data,
              requires_manual_review: true
            }
          });

          return new Response('Payment processing failed', { 
            status: 500, 
            headers: corsHeaders 
          });
        }

        console.log('✅ Payment processed successfully:', {
          reference: webhookEvent.data.reference,
          order_id: processResult?.order_id,
          order_number: processResult?.order_number
        });

        // Trigger communication event for successful payment
        try {
          await supabase.rpc('upsert_communication_event_production', {
            p_event_type: 'payment_confirmed',
            p_recipient_email: webhookEvent.data.customer?.email || 'unknown@example.com',
            p_template_key: 'payment_confirmation',
            p_template_variables: {
              customer_name: webhookEvent.data.customer?.first_name || 'Customer',
              amount: (webhookEvent.data.amount / 100).toFixed(2),
              reference: webhookEvent.data.reference,
              paid_at: webhookEvent.data.paid_at
            },
            p_order_id: processResult?.order_id,
            p_source: 'webhook_success'
          });
          console.log('📧 Email notification queued');
        } catch (emailError) {
          console.warn('⚠️ Email notification failed (non-blocking):', emailError);
        }

      } catch (error) {
        console.error('❌ Critical webhook processing error:', error);
        return new Response('Internal server error', { 
          status: 500, 
          headers: corsHeaders 
        });
      }

    } else if (webhookEvent.event === 'charge.failed') {
      console.log('❌ Processing failed charge webhook');
      
      try {
        await supabase.rpc('process_payment_atomically', {
          p_reference: webhookEvent.data.reference,
          p_status: 'failed',
          p_amount_kobo: webhookEvent.data.amount || 0,
          p_gateway_response: webhookEvent.data,
          p_paid_at: null
        });

        console.log('✅ Failed payment recorded:', webhookEvent.data.reference);
      } catch (error) {
        console.error('❌ Failed payment processing error:', error);
      }

    } else {
      console.log('ℹ️ Unhandled webhook event:', webhookEvent.event);
      
      // Log unhandled events for monitoring
      await supabase.from('audit_logs').insert({
        action: 'webhook_event_unhandled',
        category: 'webhook_monitoring',
        message: `Unhandled webhook event: ${webhookEvent.event}`,
        new_values: {
          event_type: webhookEvent.event,
          reference: webhookEvent.data?.reference,
          webhook_data: webhookEvent.data
        }
      });
    }

    // Log successful processing
    await supabase.from('audit_logs').insert({
      action: 'webhook_processed',
      category: 'webhook_activity',
      message: `Webhook ${webhookEvent.event} processed successfully`,
      new_values: {
        event_type: webhookEvent.event,
        reference: webhookEvent.data?.reference,
        idempotency_key: idempotencyKey,
        client_ip: clientIP,
        processed_at: new Date().toISOString()
      }
    });

    return new Response('OK', { 
      status: 200, 
      headers: corsHeaders 
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    // Log critical error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL')!,
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
      );
      
      await supabase.from('audit_logs').insert({
        action: 'webhook_critical_error',
        category: 'webhook_security',
        message: `Critical webhook processing error: ${error.message}`,
        new_values: {
          error: error.message,
          stack: error.stack,
          timestamp: new Date().toISOString()
        }
      });
    } catch (logError) {
      console.error('Failed to log critical error:', logError);
    }

    return new Response('Internal server error', { 
      status: 500, 
      headers: corsHeaders 
    });
  }
});