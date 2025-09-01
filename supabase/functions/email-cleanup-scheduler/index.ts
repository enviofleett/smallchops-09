
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

    console.log('📧 Starting daily email cleanup...');

    // Execute email cleanup with production-ready parameters
    const { data: cleanupResult, error } = await supabase.rpc('cleanup_email_legacy', {
      p_dry_run: false,
      p_queue_stale_hours: 2,      // Mark processing items as failed after 2 hours
      p_queue_cutoff_days: 1,      // Mark queued items as failed after 1 day
      p_fail_log_retention_days: 7,  // Archive failed logs after 7 days
      p_sent_log_retention_days: 30  // Keep sent logs for 30 days
    });

    if (error) {
      console.error('❌ Email cleanup failed:', error);
      throw error;
    }

    console.log('✅ Email cleanup completed:', cleanupResult);

    // Log cleanup execution
    await supabase.from('cron_execution_logs').insert({
      task_name: 'email_cleanup_scheduler',
      status: 'completed',
      result_data: cleanupResult,
      duration_ms: 0, // Will be calculated by trigger
      completed_at: new Date().toISOString()
    });

    return new Response(JSON.stringify({
      success: true,
      cleanup_result: cleanupResult,
      message: 'Daily email cleanup completed successfully'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('💥 Email cleanup scheduler failed:', error);
    
    // Log failed execution
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabase.from('cron_execution_logs').insert({
        task_name: 'email_cleanup_scheduler',
        status: 'failed',
        error_message: error.message,
        completed_at: new Date().toISOString()
      });
    } catch (logError) {
      console.error('Failed to log cleanup error:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      details: 'Daily email cleanup failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
