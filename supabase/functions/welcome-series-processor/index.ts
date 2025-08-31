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

    console.log('Welcome series processor started');

    // Get automation config for welcome series
    const { data: config } = await supabase
      .from('email_automation_config')
      .select('*')
      .eq('automation_type', 'welcome_series_day1')
      .eq('is_enabled', true)
      .single();

    if (!config) {
      console.log('Welcome series automation is disabled');
      return new Response(JSON.stringify({ message: 'Welcome series automation disabled' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Calculate time threshold (24 hours ago + buffer)
    const welcomeThreshold = new Date(Date.now() - (config.trigger_delay_minutes * 60 * 1000));

    // Find customers who registered 24+ hours ago but haven't received welcome series
    const { data: customersForWelcome } = await supabase
      .from('customer_accounts')
      .select('id, name, email, created_at')
      .lt('created_at', welcomeThreshold.toISOString())
      .not('email', 'is', null);

    if (!customersForWelcome || customersForWelcome.length === 0) {
      console.log('No customers found for welcome series');
      return new Response(JSON.stringify({ message: 'No customers eligible for welcome series' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    let processedCount = 0;
    let emailsQueued = 0;

    // Get business name for personalization
    const { data: businessSettings } = await supabase
      .from('business_settings')
      .select('name')
      .single();
    
    const businessName = businessSettings?.name || 'Starters';

    for (const customer of customersForWelcome) {
      try {
        // Check if customer already received welcome series day 1
        const { data: existingEmail } = await supabase
          .from('communication_events')
          .select('id')
          .eq('recipient_email', customer.email)
          .eq('event_type', 'welcome_series_day1')
          .eq('template_key', config.template_key)
          .single();

        if (existingEmail) {
          console.log(`Customer ${customer.email} already received welcome series day 1`);
          continue;
        }

        // Create welcome series email event
        await supabase
          .from('communication_events')
          .insert({
            event_type: 'welcome_series_day1',
            recipient_email: customer.email,
            template_key: config.template_key,
            variables: {
              customer_name: customer.name || 'Valued Customer',
              business_name: businessName
            },
            priority: 'normal',
            status: 'queued'
          });

        emailsQueued++;
        processedCount++;

        console.log(`Queued welcome series day 1 for ${customer.email}`);
      } catch (error) {
        console.error(`Error processing welcome series for customer ${customer.id}:`, error);
      }
    }

    // Trigger email processors if we have queued emails
    if (emailsQueued > 0) {
      console.log(`Triggering email processors for ${emailsQueued} queued emails`);
      
      // Trigger instant email processor
      await supabase.functions.invoke('instant-email-processor', {
        body: { priority: 'normal', event_types: ['welcome_series_day1'] }
      });
    }

    console.log(`Welcome series processing complete: ${processedCount} customers processed, ${emailsQueued} emails queued`);

    return new Response(JSON.stringify({
      success: true,
      processed: processedCount,
      emails_queued: emailsQueued,
      message: `Processed ${processedCount} customers, queued ${emailsQueued} welcome series emails`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in welcome series processor:', error);
    return new Response(JSON.stringify({
      error: error.message,
      details: 'Error processing welcome series'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});