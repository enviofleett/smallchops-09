import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

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

    console.log('Review request processor started');

    // Get automation config for review requests
    const { data: config } = await supabase
      .from('email_automation_config')
      .select('*')
      .eq('automation_type', 'review_request')
      .eq('is_enabled', true)
      .single();

    if (!config) {
      console.log('Review request automation is disabled');
      return new Response(JSON.stringify({ message: 'Review request automation disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate time threshold (7 days ago)
    const reviewThreshold = new Date(Date.now() - (config.trigger_delay_minutes * 60 * 1000));

    // Find delivered orders from 7+ days ago that haven't had review requests sent
    const { data: ordersForReview } = await supabase
      .from('orders')
      .select('id, customer_name, customer_email, order_time, status')
      .eq('status', 'delivered')
      .lt('order_time', reviewThreshold.toISOString())
      .not('customer_email', 'is', null);

    if (!ordersForReview || ordersForReview.length === 0) {
      console.log('No orders found for review requests');
      return new Response(JSON.stringify({ message: 'No orders eligible for review requests' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    let emailsQueued = 0;

    for (const order of ordersForReview) {
      try {
        // Check if review request already sent for this order
        const { data: existingEmail } = await supabase
          .from('communication_events')
          .select('id')
          .eq('order_id', order.id)
          .eq('event_type', 'review_request')
          .eq('template_key', config.template_key)
          .single();

        if (existingEmail) {
          console.log(`Review request already sent for order ${order.id}`);
          continue;
        }

        // Create review request email event
        await supabase
          .from('communication_events')
          .insert({
            event_type: 'review_request',
            recipient_email: order.customer_email,
            order_id: order.id,
            template_key: config.template_key,
            variables: {
              customer_name: order.customer_name || 'Valued Customer',
              order_id: order.id
            },
            priority: 'low',
            status: 'queued'
          });

        emailsQueued++;
        processedCount++;

        console.log(`Queued review request for order ${order.id}`);
      } catch (error) {
        console.error(`Error processing review request for order ${order.id}:`, error);
      }
    }

    // Trigger email processors if we have queued emails
    if (emailsQueued > 0) {
      console.log(`Triggering email processors for ${emailsQueued} queued emails`);
      
      // Trigger instant email processor
      await supabase.functions.invoke('instant-email-processor', {
        body: { priority: 'low', event_types: ['review_request'] }
      });
    }

    console.log(`Review request processing complete: ${processedCount} orders processed, ${emailsQueued} emails queued`);

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      emails_queued: emailsQueued,
      message: `Processed ${processedCount} orders, queued ${emailsQueued} review request emails`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in review request processor:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Error processing review requests'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});