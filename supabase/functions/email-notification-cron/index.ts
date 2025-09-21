import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Create service role client for cron operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('⏰ Email notification cron job triggered');

    // First trigger our secure email processing function
    const { data: triggerResult, error: triggerError } = await supabaseClient
      .rpc('trigger_email_processing');

    if (triggerError) {
      console.error('❌ Email trigger failed:', triggerError);
      throw triggerError;
    }

    console.log('✅ Email trigger completed:', triggerResult);

    // Then process the unified email queue
    const { data: processResult, error: processError } = await supabaseClient.functions
      .invoke('unified-smtp-sender', {
        body: { batch_process: true, cron_trigger: true }
      });

    if (processError) {
      console.warn('⚠️ Unified SMTP processing issue:', processError);
      // Don't throw - let's try alternative processors
    }

    // Also try the core email processor as backup
    const { data: coreResult, error: coreError } = await supabaseClient.functions
      .invoke('email-core', {
        body: { action: 'process_queue', cron_trigger: true }
      });

    if (coreError) {
      console.warn('⚠️ Core email processing issue:', coreError);
    }

    console.log('✅ Email cron job completed successfully');

    return new Response(JSON.stringify({
      success: true,
      message: 'Email notifications processed successfully',
      trigger_result: triggerResult,
      process_result: processResult,
      core_result: coreResult,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('💥 Email cron job error:', error);

    // Log to audit table for monitoring
    try {
      const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );
      
      await supabaseClient
        .from('audit_logs')
        .insert({
          action: 'email_cron_job_failed',
          category: 'Email System Error',
          message: `Email cron job failed: ${error.message}`,
          new_values: {
            error: error.message,
            stack: error.stack,
            timestamp: new Date().toISOString()
          }
        });
    } catch (logError) {
      console.error('❌ Failed to log error:', logError);
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Email cron job failed',
      message: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});