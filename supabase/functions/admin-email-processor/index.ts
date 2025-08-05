import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { action, priority = 'all', event_types = [] } = await req.json();

    console.log(`Admin email processor: ${action} with priority: ${priority}`);

    let result = { success: false, message: '', processed: 0, failed: 0 };

    switch (action) {
      case 'process_queue':
        result = await processEmailQueue(supabaseAdmin, priority, event_types);
        break;

      case 'requeue_failed':
        result = await requeueFailedEmails(supabaseAdmin);
        break;

      case 'get_queue_stats':
        result = await getQueueStats(supabaseAdmin);
        break;

      case 'clear_failed':
        result = await clearFailedEmails(supabaseAdmin);
        break;

      case 'manual_trigger':
        result = await manualTriggerProcessors(supabaseAdmin, priority);
        break;

      default:
        throw new Error(`Unknown action: ${action}`);
    }

    return new Response(
      JSON.stringify(result),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Admin email processor error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Admin email processing failed'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function processEmailQueue(supabase: any, priority: string, eventTypes: string[]) {
  console.log(`Processing email queue with priority: ${priority}, event types:`, eventTypes);

  // Trigger multiple processors for comprehensive coverage
  const processors = [
    'enhanced-email-processor',
    'instant-email-processor',
    'production-email-processor'
  ];

  let totalProcessed = 0;
  let totalFailed = 0;
  const results = [];

  for (const processor of processors) {
    try {
      console.log(`Triggering ${processor}...`);
      const result = await supabase.functions.invoke(processor, {
        body: { 
          priority: priority === 'high' ? 'high' : 'all',
          event_types: eventTypes.length > 0 ? eventTypes : undefined
        }
      });

      if (result.data?.processed) {
        totalProcessed += result.data.processed;
      }
      if (result.data?.failed) {
        totalFailed += result.data.failed;
      }

      results.push({
        processor,
        success: !result.error,
        data: result.data,
        error: result.error
      });

      console.log(`${processor} result:`, result.data);
    } catch (processorError) {
      console.error(`${processor} failed:`, processorError);
      totalFailed++;
      results.push({
        processor,
        success: false,
        error: processorError.message
      });
    }
  }

  return {
    success: true,
    message: `Triggered ${processors.length} processors`,
    processed: totalProcessed,
    failed: totalFailed,
    details: results
  };
}

async function requeueFailedEmails(supabase: any) {
  console.log('Requeuing failed emails...');

  const { data, error } = await supabase
    .from('communication_events')
    .update({
      status: 'queued',
      retry_count: 0,
      error_message: null,
      last_error: null,
      updated_at: new Date().toISOString()
    })
    .eq('status', 'failed')
    .lt('retry_count', 3) // Only requeue emails that haven't exceeded max retries
    .select('id');

  if (error) {
    throw new Error(`Failed to requeue emails: ${error.message}`);
  }

  const requeued = data?.length || 0;
  console.log(`Requeued ${requeued} failed emails`);

  return {
    success: true,
    message: `Requeued ${requeued} failed emails`,
    processed: requeued,
    failed: 0
  };
}

async function getQueueStats(supabase: any) {
  console.log('Getting queue statistics...');

  const { data, error } = await supabase
    .from('communication_events')
    .select('status, priority, event_type')
    .in('status', ['queued', 'processing', 'sent', 'failed']);

  if (error) {
    throw new Error(`Failed to get queue stats: ${error.message}`);
  }

  const stats = {
    queued: data.filter(e => e.status === 'queued').length,
    processing: data.filter(e => e.status === 'processing').length,
    completed: data.filter(e => e.status === 'sent').length,
    failed: data.filter(e => e.status === 'failed').length,
    high_priority: data.filter(e => e.priority === 'high').length,
    by_type: data.reduce((acc, e) => {
      acc[e.event_type] = (acc[e.event_type] || 0) + 1;
      return acc;
    }, {})
  };

  return {
    success: true,
    message: 'Queue statistics retrieved',
    processed: 0,
    failed: 0,
    stats
  };
}

async function clearFailedEmails(supabase: any) {
  console.log('Clearing old failed emails...');

  const { data, error } = await supabase
    .from('communication_events')
    .delete()
    .eq('status', 'failed')
    .lt('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Older than 7 days
    .select('id');

  if (error) {
    throw new Error(`Failed to clear failed emails: ${error.message}`);
  }

  const cleared = data?.length || 0;
  console.log(`Cleared ${cleared} old failed emails`);

  return {
    success: true,
    message: `Cleared ${cleared} old failed emails`,
    processed: cleared,
    failed: 0
  };
}

async function manualTriggerProcessors(supabase: any, priority: string) {
  console.log(`Manually triggering all email processors with priority: ${priority}`);

  const triggerResults = await processEmailQueue(supabase, priority, []);

  // Also trigger the email automation system as backup
  try {
    await supabase.functions.invoke('email-automation-trigger', {
      body: {
        trigger_type: 'manual_processing',
        immediate_processing: true
      }
    });
    console.log('Email automation trigger activated');
  } catch (automationError) {
    console.warn('Email automation trigger failed:', automationError);
  }

  return {
    ...triggerResults,
    message: `Manual processing triggered - ${triggerResults.message}`
  };
}