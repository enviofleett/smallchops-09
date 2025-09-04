import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CleanupStats {
  invalidEmails: number;
  stuckProcessing: number;
  validQueued: number;
  processed: number;
  failed: number;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  );

  try {
    const stats: CleanupStats = {
      invalidEmails: 0,
      stuckProcessing: 0,
      validQueued: 0,
      processed: 0,
      failed: 0
    };

    console.log('🧹 Starting email queue cleanup...');

    // 1. Clean up emails with invalid/missing recipient data
    const { data: invalidEmails, error: invalidError } = await supabase
      .from('communication_events')
      .update({
        status: 'failed',
        error_message: 'Invalid email data - missing or invalid recipient',
        updated_at: new Date().toISOString()
      })
      .or('recipient_email.is.null,recipient_email.eq.,not.recipient_email.like.*@*')
      .in('status', ['queued', 'processing'])
      .select('id');

    if (invalidError) {
      console.error('Error cleaning invalid emails:', invalidError);
    } else {
      stats.invalidEmails = invalidEmails?.length || 0;
      console.log(`✅ Cleaned ${stats.invalidEmails} invalid emails`);
    }

    // 2. Reset stuck processing emails back to queued
    const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    const { data: stuckEmails, error: stuckError } = await supabase
      .from('communication_events')
      .update({
        status: 'queued',
        processing_started_at: null,
        updated_at: new Date().toISOString()
      })
      .eq('status', 'processing')
      .lt('processing_started_at', tenMinutesAgo)
      .select('id');

    if (stuckError) {
      console.error('Error resetting stuck emails:', stuckError);
    } else {
      stats.stuckProcessing = stuckEmails?.length || 0;
      console.log(`✅ Reset ${stats.stuckProcessing} stuck processing emails`);
    }

    // 3. Get count of valid queued emails
    const { count: queuedCount, error: countError } = await supabase
      .from('communication_events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'queued')
      .not('recipient_email', 'is', null)
      .like('recipient_email', '%@%');

    if (countError) {
      console.error('Error counting queued emails:', countError);
    } else {
      stats.validQueued = queuedCount || 0;
      console.log(`📊 Found ${stats.validQueued} valid queued emails`);
    }

    // 4. Process a batch of emails if there are any queued
    if (stats.validQueued > 0) {
      console.log('🚀 Triggering email queue processor...');
      
      try {
        const { data: processorResult, error: processorError } = await supabase.functions.invoke(
          'unified-email-queue-processor',
          { body: { batch_size: 25, dry_run: false } }
        );

        if (processorError) {
          console.error('Queue processor error:', processorError);
          stats.failed = 1;
        } else {
          console.log('✅ Queue processor result:', processorResult);
          stats.processed = processorResult?.processed || 0;
        }
      } catch (error) {
        console.error('Error invoking queue processor:', error);
        stats.failed = 1;
      }
    }

    // Log cleanup results
    await supabase.from('audit_logs').insert({
      action: 'email_queue_cleanup',
      category: 'Email System',
      message: `Queue cleanup completed: ${stats.invalidEmails} invalid cleaned, ${stats.stuckProcessing} stuck reset, ${stats.validQueued} queued, ${stats.processed} processed`,
      new_values: stats
    });

    console.log('✅ Email queue cleanup completed:', stats);

    return new Response(JSON.stringify({
      success: true,
      stats,
      message: 'Email queue cleanup completed successfully'
    }), {
      status: 200,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });

  } catch (error) {
    console.error('💥 Queue cleanup error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      message: 'Email queue cleanup failed'
    }), {
      status: 500,
      headers: { 
        'Content-Type': 'application/json',
        ...corsHeaders 
      }
    });
  }
});