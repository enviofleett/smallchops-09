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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('⏰ Email notification cron job triggered');

    // Process the email notification queue
    const { data: processResult, error: processError } = await supabaseClient.functions
      .invoke('process-email-notifications');

    if (processError) {
      console.error('❌ Email processing failed:', processError);
      throw processError;
    }

    console.log('✅ Email processing completed:', processResult);

    return new Response(JSON.stringify({
      success: true,
      message: 'Email notifications processed successfully',
      result: processResult,
      timestamp: new Date().toISOString()
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('💥 Email cron job error:', error);

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