import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

interface PaystackWebhookEvent {
  event: string;
  data: {
    id: number;
    status: string;
    reference: string;
    amount: number;
    gateway_response: string;
    paid_at: string;
    created_at: string;
    channel: string;
    currency: string;
    customer: any;
    metadata?: any;
  };
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    // Get the raw body for signature verification
    const rawBody = await req.text();
    const paystackSignature = req.headers.get('x-paystack-signature');
    
    console.log('🔐 Webhook received:', {
      hasSignature: !!paystackSignature,
      bodyLength: rawBody.length,
      timestamp: new Date().toISOString()
    });

    // Verify webhook signature
    const webhookSecret = Deno.env.get('PAYSTACK_WEBHOOK_SECRET');
    if (!webhookSecret) {
      console.error('❌ PAYSTACK_WEBHOOK_SECRET not configured');
      return new Response('Webhook secret not configured', { 
        status: 500, 
        headers: corsHeaders 
      });
    }

    if (paystackSignature) {
      const secretBytes = new TextEncoder().encode(webhookSecret);
      const key = await crypto.subtle.importKey(
        'raw',
        secretBytes,
        { name: 'HMAC', hash: 'SHA-512' },
        false,
        ['sign']
      );
      
      const signature = await crypto.subtle.sign(
        'HMAC',
        key,
        new TextEncoder().encode(rawBody)
      );
      
      const expectedSignature = Array.from(new Uint8Array(signature))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
        
      if (paystackSignature !== expectedSignature) {
        console.error('❌ Invalid webhook signature');
        return new Response('Invalid signature', { 
          status: 401, 
          headers: corsHeaders 
        });
      }
    }

    // Parse the webhook payload
    const event: PaystackWebhookEvent = JSON.parse(rawBody);
    
    console.log('📨 Processing webhook event:', {
      event: event.event,
      reference: event.data?.reference,
      amount: event.data?.amount,
      status: event.data?.status
    });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Generate idempotency key for this webhook event
    const idempotencyKey = `webhook_${event.data.id}_${event.event}_${Date.now()}`;

    // Check if this webhook event was already processed
    const { data: existingTransaction } = await supabase
      .from('payment_transactions')
      .select('id, webhook_event_id')
      .eq('webhook_event_id', event.data.id.toString())
      .single();

    if (existingTransaction) {
      console.log('✅ Webhook already processed:', event.data.id);
      return new Response(JSON.stringify({ message: 'Already processed' }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (event.event === 'charge.success') {
      // Process successful payment
      const amountKobo = event.data.amount; // Paystack sends amount in kobo
      const reference = event.data.reference;

      try {
        // Use atomic payment processing function
        const { data: processResult, error: processError } = await supabase
          .rpc('process_payment_atomically', {
            p_payment_reference: reference,
            p_idempotency_key: idempotencyKey,
            p_amount_kobo: amountKobo,
            p_status: 'confirmed',
            p_webhook_event_id: event.data.id.toString()
          });

        if (processError) {
          console.error('❌ Payment processing failed:', processError);
          
          // Log orphaned payment for manual review
          await supabase.from('payment_transactions').insert({
            provider_reference: reference,
            amount: amountKobo / 100, // Convert kobo to naira
            amount_kobo: amountKobo,
            currency: 'NGN',
            status: 'orphaned',
            idempotency_key: idempotencyKey,
            webhook_event_id: event.data.id.toString(),
            last_webhook_at: new Date().toISOString(),
            provider_response: event.data,
            customer_email: event.data.customer?.email || null
          });

          return new Response(JSON.stringify({ 
            message: 'Payment logged as orphaned', 
            reference 
          }), {
            status: 200,
            headers: { ...corsHeaders, 'Content-Type': 'application/json' }
          });
        }

        console.log('✅ Payment processed successfully:', {
          reference,
          orderId: processResult?.[0]?.order_id,
          orderNumber: processResult?.[0]?.order_number
        });

        // Trigger communication event for payment confirmation
        if (processResult?.[0]?.order_id && event.data.customer?.email) {
          try {
            // Create unique dedupe_key with timestamp to prevent duplicates
            const dedupeKey = `${processResult[0].order_id}|payment_confirmed_webhook|payment_confirmation|${event.data.customer.email}|${Date.now()}`;
            
            const communicationEvent = {
              order_id: processResult[0].order_id,
              event_type: 'payment_confirmed_webhook',
              recipient_email: event.data.customer.email,
              template_key: 'payment_confirmation',
              template_variables: {
                customerName: event.data.customer?.first_name || 'Customer',
                orderNumber: processResult[0].order_number,
                amount: (amountKobo / 100).toFixed(2),
                paymentMethod: event.data.channel || 'Online Payment',
                paidAt: event.data.paid_at
              },
              variables: {
                customerName: event.data.customer?.first_name || 'Customer',
                orderNumber: processResult[0].order_number,
                amount: (amountKobo / 100).toFixed(2),
                paymentMethod: event.data.channel || 'Online Payment',
                paidAt: event.data.paid_at
              },
              status: 'queued',
              dedupe_key: dedupeKey,
              source: 'paystack_webhook',
              email_type: 'transactional',
              priority: 'high',
              scheduled_at: new Date().toISOString()
            };

            const { error: commError } = await supabase
              .from('communication_events')
              .insert(communicationEvent);

            if (commError) {
              console.warn('⚠️ Communication event insert failed:', commError.message);
            } else {
              console.log('📧 Payment confirmation email queued:', dedupeKey);
            }
          } catch (err: any) {
            if (err.code === '23505') {
              console.warn('📧 Duplicate payment confirmation event skipped (edge case):', processResult[0].order_id);
            } else {
              console.error('❌ Communication event error:', err.message);
            }
            // Don't crash the webhook - payment was successful
          }
        }

      } catch (error) {
        console.error('❌ Critical payment processing error:', error);
        
        // Log critical error for immediate attention
        await supabase.from('audit_logs').insert({
          action: 'webhook_payment_processing_failed',
          category: 'Payment Critical',
          message: `Critical webhook processing failure: ${error.message}`,
          new_values: {
            reference,
            amount_kobo: amountKobo,
            event_id: event.data.id,
            error: error.message
          }
        });

        return new Response(JSON.stringify({ 
          message: 'Critical error logged', 
          reference 
        }), {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }

    } else if (event.event === 'charge.failed') {
      // Process failed payment
      const reference = event.data.reference;
      const amountKobo = event.data.amount;

      try {
        const { error: processError } = await supabase
          .rpc('process_payment_atomically', {
            p_payment_reference: reference,
            p_idempotency_key: idempotencyKey,
            p_amount_kobo: amountKobo,
            p_status: 'failed',
            p_webhook_event_id: event.data.id.toString()
          });

        if (processError) {
          console.warn('⚠️  Failed payment processing warning:', processError.message);
        }

        console.log('📝 Failed payment recorded:', reference);

      } catch (error) {
        console.error('❌ Failed payment logging error:', error);
      }

    } else {
      // Log unhandled webhook events for monitoring
      console.log('ℹ️  Unhandled webhook event:', event.event);
      
      await supabase.from('audit_logs').insert({
        action: 'webhook_unhandled_event',
        category: 'Webhook Monitoring',
        message: `Unhandled webhook event: ${event.event}`,
        new_values: {
          event: event.event,
          reference: event.data?.reference,
          event_id: event.data?.id
        }
      });
    }

    return new Response(JSON.stringify({ message: 'Webhook processed' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Webhook processing error:', error);
    
    // Return 200 to prevent Paystack retries for malformed data
    return new Response(JSON.stringify({ 
      message: 'Error logged', 
      error: error.message 
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});