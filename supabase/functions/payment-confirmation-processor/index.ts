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

    // Check if payment confirmation already sent for this order
    const { data: existingEmail } = await supabase
      .from('communication_events')
      .select('id')
      .eq('order_id', order_id)
      .eq('event_type', 'payment_confirmation')
      .eq('template_key', 'payment_confirmation')
      .single();

    if (existingEmail) {
      console.log(`Payment confirmation already sent for order ${order_id}`);
      return new Response(JSON.stringify({ 
        message: 'Payment confirmation already sent',
        already_sent: true 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Create payment confirmation email event
    const { data: emailEvent, error: emailError } = await supabase
      .from('communication_events')
      .insert({
        event_type: 'payment_confirmation',
        recipient_email: customer_email,
        order_id: order_id,
        template_key: 'payment_confirmation',
        variables: {
          customer_name: customer_name || 'Valued Customer',
          customerName: customer_name || 'Valued Customer', // Alias for template compatibility
          order_id: order_id,
          order_number: order_id, // Some templates may expect this
          amount: `₦${amount.toLocaleString()}`,
          payment_reference: payment_reference || 'N/A'
        },
        priority: 'high',
        status: 'queued'
      })
      .select()
      .single();

    if (emailError) {
      throw new Error(`Failed to create payment confirmation email: ${emailError.message}`);
    }

    console.log(`Queued payment confirmation for order ${order_id}`);

    // Trigger instant email processor for immediate processing with fallback
    const { error: processorError } = await supabase.functions.invoke('instant-email-processor', {
      body: { 
        priority: 'high', 
        event_types: ['payment_confirmation'],
        immediate: true 
      }
    });

    if (processorError) {
      console.error('Error triggering instant email processor:', processorError);
      
      // Fallback: trigger unified-email-queue-processor for batch processing
      console.log('⚡ Falling back to unified-email-queue-processor');
      try {
        await supabase.functions.invoke('unified-email-queue-processor', {
          body: { 
            batch_size: 5,
            priority_filter: 'high'
          }
        });
        console.log('✅ Fallback processor invoked successfully');
      } catch (fallbackError) {
        console.error('❌ Fallback processor also failed:', fallbackError);
      }
    } else {
      console.log('✅ Instant email processor triggered successfully');
    }

    // Also trigger instant email processor as backup (legacy call - keeping for redundancy)
    await supabase.functions.invoke('instant-email-processor', {
      body: { priority: 'high' }
    });

    console.log('Payment confirmation processing complete');

    return new Response(JSON.stringify({
      success: true,
      email_event_id: emailEvent.id,
      message: `Payment confirmation email queued for order ${order_id}`,
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