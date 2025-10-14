import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

/**
 * CRON Job Handler - Processes queued emails every 5 minutes
 * This should be invoked via Supabase Edge Function cron or external scheduler
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

    console.log('⏰ CRON: Starting email queue processing...');

    // Check queue size
    const { count: queuedCount } = await supabase
      .from('communication_events')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'queued');

    console.log(`📊 Queue size: ${queuedCount} emails`);

    if (!queuedCount || queuedCount === 0) {
      return new Response(JSON.stringify({
        success: true,
        message: 'No emails in queue',
        queued: 0
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Process in batches to avoid timeouts
    const batchSize = queuedCount > 100 ? 50 : 20;
    
    // Call the processor function directly via HTTP (JWT verification disabled)
    const functionUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/process-communication-events-enhanced`;
    
    const response = await fetch(functionUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_ANON_KEY')}`
      },
      body: JSON.stringify({
        batchSize,
        immediate_processing: false
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ Processor invocation failed:', response.status, errorText);
      throw new Error(`Processor returned ${response.status}: ${errorText}`);
    }

    const data = await response.json();
    const error = null;

    if (error) {
      console.error('❌ Processor invocation failed:', error);
      throw error;
    }

    console.log(`✅ CRON: Processed batch - ${data?.processed || 0} sent, ${data?.failed || 0} failed`);

    // Alert if queue is growing (more than 1000 emails)
    if (queuedCount > 1000) {
      console.warn(`⚠️ ALERT: Large queue detected (${queuedCount} emails)`);
    }

    return new Response(JSON.stringify({
      success: true,
      queued_before: queuedCount,
      processed: data?.processed || 0,
      failed: data?.failed || 0,
      batch_size: batchSize
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 CRON job failed:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
