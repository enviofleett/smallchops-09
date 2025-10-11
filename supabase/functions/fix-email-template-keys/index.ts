import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * Fix NULL template_key values in communication_events
 * Maps event_type to correct template_key
 */
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { dry_run = true } = await req.json().catch(() => ({ dry_run: true }));

    console.log(`🔧 Starting template key fix (dry_run: ${dry_run})...`);

    // Get all events with NULL template_key
    const { data: nullEvents, error: fetchError } = await supabase
      .from('communication_events')
      .select('id, event_type, recipient_email')
      .eq('status', 'queued')
      .is('template_key', null);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📊 Found ${nullEvents?.length || 0} events with NULL template_key`);

    if (!nullEvents || nullEvents.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        fixed_count: 0,
        message: 'No NULL template keys found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Template mapping based on event_type
    const templateMapping: Record<string, string> = {
      'customer_welcome': 'customer_welcome',
      'order_confirmation': 'order_confirmation',
      'order_status_update': 'order_confirmed',
      'order_ready': 'order_ready',
      'order_delivered': 'order_delivered',
      'payment_confirmation': 'payment_confirmation',
      'admin_notification': 'admin_new_order',
      'admin_status_update': 'admin_status_update',
      'shipping_notification': 'shipping_notification',
      'purchase_receipt': 'order_confirmation',
    };

    let fixedCount = 0;
    const updates = [];

    for (const event of nullEvents) {
      const correctTemplate = templateMapping[event.event_type];
      
      if (correctTemplate) {
        updates.push({
          id: event.id,
          event_type: event.event_type,
          new_template_key: correctTemplate
        });

        if (!dry_run) {
          await supabase
            .from('communication_events')
            .update({ template_key: correctTemplate })
            .eq('id', event.id);
        }

        fixedCount++;
      } else {
        console.warn(`⚠️ No template mapping for event_type: ${event.event_type}`);
      }
    }

    console.log(`✅ ${dry_run ? 'Would fix' : 'Fixed'} ${fixedCount} template keys`);

    return new Response(JSON.stringify({
      success: true,
      dry_run,
      fixed_count: fixedCount,
      total_null: nullEvents.length,
      updates: dry_run ? updates : undefined,
      message: dry_run 
        ? `Would fix ${fixedCount} template keys (dry run)` 
        : `Fixed ${fixedCount} template keys`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Template key fix failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
