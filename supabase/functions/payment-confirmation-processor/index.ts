import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PaymentConfirmationData {
  order_id: string;
  customer_email: string;
  customer_name?: string;
  amount: number;
  payment_reference?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('Payment confirmation processor started');

    const { order_id, customer_email, customer_name, amount, payment_reference }: PaymentConfirmationData = await req.json();

    if (!order_id || !customer_email || !amount) {
      throw new Error('Missing required payment confirmation data');
    }

    // Use idempotent RPC to create/update payment confirmation event
    const { data: upsertResult, error: upsertError } = await supabase
      .rpc('upsert_payment_confirmation_event', {
        p_reference: payment_reference || `pay_${Date.now()}_${order_id.slice(-8)}`,
        p_recipient_email: customer_email,
        p_order_id: order_id,
        p_template_variables: {
          customer_name: customer_name || 'Valued Customer',
          order_id: order_id,
          amount: `₦${amount.toLocaleString()}`,
          payment_reference: payment_reference || 'N/A',
          confirmation_date: new Date().toISOString()
        }
      });

    if (upsertError) {
      throw new Error(`Failed to upsert payment confirmation: ${upsertError.message}`);
    }

    // Log the idempotent result
    console.log(`Payment confirmation event result:`, upsertResult);
    
    if (upsertResult?.existing) {
      console.log(`Payment confirmation already exists for order ${order_id}`);
    } else {
      console.log(`Payment confirmation queued for order ${order_id}`);
    }

    // Trigger instant email processor for immediate processing
    const { error: processorError } = await supabase.functions.invoke('instant-email-processor', {
      body: { 
        priority: 'high', 
        event_types: ['payment_confirmation'],
        immediate: true 
      }
    });

    if (processorError) {
      console.error('Error triggering email processor:', processorError);
    }

    // Also trigger instant email processor as backup
    await supabase.functions.invoke('instant-email-processor', {
      body: { priority: 'high' }
    });

    console.log('Payment confirmation processing complete');

    return new Response(JSON.stringify({
      success: true,
      event_id: upsertResult?.event_id,
      status: upsertResult?.status || 'upserted',
      existing: upsertResult?.existing || false,
      message: upsertResult?.message || `Payment confirmation processed for order ${order_id}`,
      order_id,
      customer_email
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in payment confirmation processor:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Error processing payment confirmation'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});