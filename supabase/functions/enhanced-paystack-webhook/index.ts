import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { crypto } from 'https://deno.land/std@0.177.0/crypto/mod.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-paystack-signature',
};

interface PaystackWebhookPayload {
  event: string;
  data: {
    id: number;
    reference: string;
    amount: number;
    currency: string;
    status: string;
    paid_at?: string;
    gateway_response?: string;
    channel?: string;
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

async function verifyWebhookSignature(payload: string, signature: string, secret: string): Promise<boolean> {
  try {
    const encoder = new TextEncoder();
    const keyData = encoder.encode(secret);
    const messageData = encoder.encode(payload);
    
    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-512' },
      false,
      ['sign']
    );
    
    const signatureBuffer = await crypto.subtle.sign('HMAC', cryptoKey, messageData);
    const computedSignature = Array.from(new Uint8Array(signatureBuffer))
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
    
    return computedSignature === signature;
  } catch (error) {
    console.error('Signature verification error:', error);
    return false;
  }
}

async function logPaymentError(
  supabaseClient: any, 
  errorCode: string, 
  message: string, 
  context: any = {}
) {
  try {
    await supabaseClient.functions.invoke('log-payment-error', {
      body: {
        error_code: errorCode,
        error_message: message,
        error_context: context,
        severity: 'high'
      }
    });
  } catch (error) {
    console.error('Failed to log payment error:', error);
  }
}

async function recordPaymentMetric(
  supabaseClient: any,
  metricName: string,
  value: number,
  metadata: any = {}
) {
  try {
    await supabaseClient.functions.invoke('record-payment-metric', {
      body: {
        metric_name: metricName,
        metric_value: value,
        metadata
      }
    });
  } catch (error) {
    console.error('Failed to record payment metric:', error);
  }
}

Deno.serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    if (req.method !== 'POST') {
      throw new Error('Only POST method allowed');
    }

    // Get raw payload for signature verification
    const rawPayload = await req.text();
    const signature = req.headers.get('x-paystack-signature') || '';

    if (!signature) {
      await logPaymentError(supabaseClient, 'MISSING_SIGNATURE', 'Webhook signature missing');
      throw new Error('Webhook signature required');
    }

    // Get webhook secret from environment config
    const { data: webhookSecret, error: secretError } = await supabaseClient
      .rpc('get_active_paystack_config')
      .single();

    if (secretError || !webhookSecret?.webhook_secret) {
      await logPaymentError(supabaseClient, 'WEBHOOK_CONFIG_ERROR', 'Webhook secret not configured');
      throw new Error('Webhook configuration error');
    }

    // Verify webhook signature
    const isValidSignature = await verifyWebhookSignature(
      rawPayload, 
      signature, 
      webhookSecret.webhook_secret
    );

    if (!isValidSignature) {
      await logPaymentError(supabaseClient, 'INVALID_SIGNATURE', 'Webhook signature verification failed', {
        signature,
        payload_length: rawPayload.length
      });
      throw new Error('Invalid webhook signature');
    }

    // Parse webhook payload
    const payload: PaystackWebhookPayload = JSON.parse(rawPayload);
    
    console.log('Processing Paystack webhook:', payload.event, payload.data.reference);

    // Record webhook metric
    await recordPaymentMetric(supabaseClient, 'webhook_received', 1, {
      event: payload.event,
      reference: payload.data.reference
    });

    switch (payload.event) {
      case 'charge.success':
        await handleChargeSuccess(supabaseClient, payload);
        break;
        
      case 'charge.failed':
        await handleChargeFailed(supabaseClient, payload);
        break;
        
      case 'transfer.success':
        await handleTransferSuccess(supabaseClient, payload);
        break;
        
      case 'transfer.failed':
        await handleTransferFailed(supabaseClient, payload);
        break;
        
      default:
        console.log('Unhandled webhook event:', payload.event);
        await recordPaymentMetric(supabaseClient, 'webhook_unhandled', 1, {
          event: payload.event
        });
    }

    return new Response(
      JSON.stringify({ success: true, message: 'Webhook processed successfully' }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Webhook processing error:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function handleChargeSuccess(supabaseClient: any, payload: PaystackWebhookPayload) {
  const { data } = payload;
  
  try {
    // Find transaction by reference
    const { data: transaction, error: txError } = await supabaseClient
      .from('payment_transactions')
      .select('id, order_id, metadata')
      .eq('provider_reference', data.reference)
      .single();

    if (txError || !transaction) {
      await logPaymentError(supabaseClient, 'TRANSACTION_NOT_FOUND', 
        `Transaction not found for reference: ${data.reference}`, { reference: data.reference });
      return;
    }

    // Update transaction with success details
    const { error: updateError } = await supabaseClient
      .from('payment_transactions')
      .update({
        status: 'success',
        paid_at: data.paid_at || new Date().toISOString(),
        gateway_response: data.gateway_response || 'Successful',
        fees: (data.fees || 0) / 100, // Convert from kobo
        channel: data.channel,
        authorization_code: data.authorization?.authorization_code,
        card_type: data.authorization?.card_type,
        last4: data.authorization?.last4,
        exp_month: data.authorization?.exp_month,
        exp_year: data.authorization?.exp_year,
        bank: data.authorization?.bank,
        account_name: data.authorization?.account_name,
        processed_at: new Date().toISOString()
      })
      .eq('id', transaction.id);

    if (updateError) {
      await logPaymentError(supabaseClient, 'TRANSACTION_UPDATE_FAILED', 
        `Failed to update transaction: ${updateError.message}`, { transaction_id: transaction.id });
      return;
    }

    // Update order status if order exists
    if (transaction.order_id) {
      const { error: orderError } = await supabaseClient
        .from('orders')
        .update({
          payment_status: 'paid',
          status: 'confirmed',
          updated_at: new Date().toISOString()
        })
        .eq('id', transaction.order_id);

      if (orderError) {
        await logPaymentError(supabaseClient, 'ORDER_UPDATE_FAILED', 
          `Failed to update order: ${orderError.message}`, { order_id: transaction.order_id });
      }
    }

    // Save payment method if authorization provided and user exists
    if (data.authorization && transaction.metadata?.user_id) {
      const { error: saveError } = await supabaseClient
        .from('saved_payment_methods')
        .upsert({
          user_id: transaction.metadata.user_id,
          provider: 'paystack',
          authorization_code: data.authorization.authorization_code,
          card_type: data.authorization.card_type,
          last4: data.authorization.last4,
          exp_month: data.authorization.exp_month,
          exp_year: data.authorization.exp_year,
          bank: data.authorization.bank,
          is_active: true,
          updated_at: new Date().toISOString()
        }, { onConflict: 'authorization_code' });

      if (saveError) {
        console.warn('Failed to save payment method:', saveError);
      }
    }

    // Record success metric
    await recordPaymentMetric(supabaseClient, 'payment_success', 1, {
      amount: data.amount / 100,
      channel: data.channel,
      reference: data.reference
    });

    console.log('Charge success processed:', data.reference);

  } catch (error) {
    await logPaymentError(supabaseClient, 'CHARGE_SUCCESS_HANDLER_ERROR', 
      `Error processing charge success: ${error.message}`, { reference: data.reference });
    throw error;
  }
}

async function handleChargeFailed(supabaseClient: any, payload: PaystackWebhookPayload) {
  const { data } = payload;
  
  try {
    // Find and update transaction
    const { error: updateError } = await supabaseClient
      .from('payment_transactions')
      .update({
        status: 'failed',
        gateway_response: data.gateway_response || 'Payment failed',
        processed_at: new Date().toISOString()
      })
      .eq('provider_reference', data.reference);

    if (updateError) {
      await logPaymentError(supabaseClient, 'FAILED_TRANSACTION_UPDATE_ERROR', 
        `Failed to update failed transaction: ${updateError.message}`, { reference: data.reference });
    }

    // Record failure metric
    await recordPaymentMetric(supabaseClient, 'payment_failed', 1, {
      reference: data.reference,
      gateway_response: data.gateway_response
    });

    console.log('Charge failure processed:', data.reference);

  } catch (error) {
    await logPaymentError(supabaseClient, 'CHARGE_FAILED_HANDLER_ERROR', 
      `Error processing charge failure: ${error.message}`, { reference: data.reference });
    throw error;
  }
}

async function handleTransferSuccess(supabaseClient: any, payload: PaystackWebhookPayload) {
  const { data } = payload;
  
  try {
    // Update refund status if this is a refund transfer
    const { error: refundError } = await supabaseClient
      .from('payment_refunds')
      .update({
        status: 'completed',
        updated_at: new Date().toISOString()
      })
      .eq('provider_refund_id', data.reference);

    if (refundError) {
      console.warn('Refund update error:', refundError);
    }

    // Record transfer success metric
    await recordPaymentMetric(supabaseClient, 'transfer_success', 1, {
      reference: data.reference,
      amount: data.amount / 100
    });

    console.log('Transfer success processed:', data.reference);

  } catch (error) {
    await logPaymentError(supabaseClient, 'TRANSFER_SUCCESS_HANDLER_ERROR', 
      `Error processing transfer success: ${error.message}`, { reference: data.reference });
    throw error;
  }
}

async function handleTransferFailed(supabaseClient: any, payload: PaystackWebhookPayload) {
  const { data } = payload;
  
  try {
    // Update refund status if this is a refund transfer
    const { error: refundError } = await supabaseClient
      .from('payment_refunds')
      .update({
        status: 'failed',
        updated_at: new Date().toISOString()
      })
      .eq('provider_refund_id', data.reference);

    if (refundError) {
      console.warn('Refund update error:', refundError);
    }

    // Record transfer failure metric
    await recordPaymentMetric(supabaseClient, 'transfer_failed', 1, {
      reference: data.reference,
      gateway_response: data.gateway_response
    });

    console.log('Transfer failure processed:', data.reference);

  } catch (error) {
    await logPaymentError(supabaseClient, 'TRANSFER_FAILED_HANDLER_ERROR', 
      `Error processing transfer failure: ${error.message}`, { reference: data.reference });
    throw error;
  }
}