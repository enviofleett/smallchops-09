import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0';

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
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log('🔄 Starting enhanced email retry process...');

    // Get failed welcome emails from the last 24 hours
    const { data: failedEmails, error: fetchError } = await supabase
      .from('communication_events')
      .select('*')
      .eq('event_type', 'customer_welcome')
      .eq('status', 'failed')
      .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
      .lt('retry_count', 3);

    if (fetchError) {
      console.error('Error fetching failed emails:', fetchError);
      throw fetchError;
    }

    if (!failedEmails || failedEmails.length === 0) {
      console.log('✅ No failed emails to retry');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No failed emails to retry',
          processed: 0 
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );
    }

    console.log(`📧 Found ${failedEmails.length} failed emails to retry`);

    let successCount = 0;
    let errorCount = 0;

    // Process each failed email
    for (const email of failedEmails) {
      try {
        // Reset email status to queued for retry
        const { error: updateError } = await supabase
          .from('communication_events')
          .update({
            status: 'queued',
            retry_count: (email.retry_count || 0) + 1,
            last_error: null,
            error_message: null,
            updated_at: new Date().toISOString()
          })
          .eq('id', email.id);

        if (updateError) {
          console.error(`Error updating email ${email.id}:`, updateError);
          errorCount++;
          continue;
        }

        // Trigger immediate processing
        try {
          const { error: processError } = await supabase.functions.invoke('enhanced-email-processor', {
            body: { 
              immediate_processing: true,
              event_id: email.id 
            }
          });

          if (processError) {
            console.warn(`Processing warning for email ${email.id}:`, processError);
          }
        } catch (processErr) {
          console.warn(`Could not trigger instant processing for ${email.id}:`, processErr);
          // Don't count this as an error since the email is queued
        }

        console.log(`✅ Requeued email for ${email.recipient_email}`);
        successCount++;

      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error);
        errorCount++;
      }
    }

    // Log the retry operation
    await supabase
      .from('audit_logs')
      .insert({
        action: 'enhanced_email_retry',
        category: 'Email Processing',
        message: `Enhanced email retry completed: ${successCount} requeued, ${errorCount} errors`,
        new_values: {
          success_count: successCount,
          error_count: errorCount,
          total_processed: failedEmails.length
        }
      });

    const result = {
      success: true,
      message: 'Enhanced email retry completed',
      processed: failedEmails.length,
      requeued: successCount,
      errors: errorCount
    };

    console.log('📊 Enhanced email retry results:', result);

    return new Response(
      JSON.stringify(result),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
      }
    );

  } catch (error: any) {
    console.error('Enhanced email retry function error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Unknown error occurred',
        timestamp: new Date().toISOString()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});