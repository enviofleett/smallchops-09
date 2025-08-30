import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartAbandonmentData {
  session_id: string;
  customer_email?: string;
  customer_id?: string;
  cart_data: any[];
  total_value: number;
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

    console.log('Cart abandonment processor started');

    if (req.method === 'POST') {
      // Handle cart tracking from frontend
      const { session_id, customer_email, customer_id, cart_data, total_value }: CartAbandonmentData = await req.json();

      // Update or create cart tracking record
      const { data: existingCart } = await supabase
        .from('cart_abandonment_tracking')
        .select('*')
        .eq('session_id', session_id)
        .single();

      if (existingCart) {
        // Update existing cart
        await supabase
          .from('cart_abandonment_tracking')
          .update({
            customer_email,
            customer_id,
            cart_data,
            total_value,
            is_abandoned: false,
            recovered_at: null
          })
          .eq('session_id', session_id);
      } else {
        // Create new cart tracking
        await supabase
          .from('cart_abandonment_tracking')
          .insert({
            session_id,
            customer_email,
            customer_id,
            cart_data,
            total_value,
            is_abandoned: false
          });
      }

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Process abandoned carts (called by cron or manual trigger)
    console.log('Processing abandoned carts...');

    // Get automation config for cart abandonment
    const { data: config } = await supabase
      .from('email_automation_config')
      .select('*')
      .eq('automation_type', 'cart_abandonment')
      .eq('is_enabled', true)
      .single();

    if (!config) {
      console.log('Cart abandonment automation is disabled');
      return new Response(JSON.stringify({ message: 'Cart abandonment automation disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const abandonmentThreshold = new Date(Date.now() - (config.trigger_delay_minutes * 60 * 1000));

    // Find carts that should be marked as abandoned
    const { data: cartsToAbandon } = await supabase
      .from('cart_abandonment_tracking')
      .select('*')
      .eq('is_abandoned', false)
      .is('recovery_email_sent_at', null)
      .lt('created_at', abandonmentThreshold.toISOString())
      .not('customer_email', 'is', null);

    let processedCount = 0;
    let emailsQueued = 0;

    for (const cart of cartsToAbandon || []) {
      try {
        // Mark cart as abandoned
        await supabase
          .from('cart_abandonment_tracking')
          .update({
            is_abandoned: true,
            abandoned_at: new Date().toISOString(),
            recovery_email_sent_at: new Date().toISOString()
          })
          .eq('id', cart.id);

        // Get customer name if available
        let customerName = 'Valued Customer';
        if (cart.customer_id) {
          const { data: customer } = await supabase
            .from('customer_accounts')
            .select('name')
            .eq('id', cart.customer_id)
            .single();
          if (customer?.name) customerName = customer.name;
        }

        // Create email communication event
        await supabase
          .from('communication_events')
          .insert({
            event_type: 'cart_abandonment',
            recipient_email: cart.customer_email,
            template_key: config.template_key,
            variables: {
              customer_name: customerName,
              item_count: cart.cart_data?.length || 0,
              total_amount: `₦${cart.total_value?.toLocaleString() || '0'}`,
              cart_url: `${Deno.env.get('SUPABASE_URL')}/cart?session=${cart.session_id}`
            },
            priority: 'normal',
            status: 'queued'
          });

        emailsQueued++;
        processedCount++;

        console.log(`Queued abandonment email for ${cart.customer_email}`);
      } catch (error) {
        console.error(`Error processing cart ${cart.id}:`, error);
      }
    }

    // Trigger email processors if we have queued emails
    if (emailsQueued > 0) {
      console.log(`Triggering email processors for ${emailsQueued} queued emails`);
      
      // Trigger instant email processor
      await supabase.functions.invoke('instant-email-processor', {
        body: { priority: 'normal', event_types: ['cart_abandonment'] }
      });
    }

    console.log(`Cart abandonment processing complete: ${processedCount} carts processed, ${emailsQueued} emails queued`);

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      emails_queued: emailsQueued,
      message: `Processed ${processedCount} abandoned carts, queued ${emailsQueued} recovery emails`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in cart abandonment processor:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Error processing cart abandonment'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});