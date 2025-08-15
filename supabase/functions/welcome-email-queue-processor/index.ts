import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.53.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CommunicationEvent {
  id: string;
  event_type: string;
  recipient_email: string;
  template_key: string;
  status: string;
  variables: Record<string, any>;
  created_at: string;
  retry_count?: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  console.log('🚀 Welcome Email Queue Processor started');

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Fetch queued welcome emails (limit to 50 per batch)
    const { data: queuedEmails, error: fetchError } = await supabase
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .eq('event_type', 'customer_welcome')
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(50);

    if (fetchError) {
      console.error('❌ Error fetching queued emails:', fetchError);
      throw fetchError;
    }

    console.log(`📧 Found ${queuedEmails?.length || 0} queued welcome emails`);

    if (!queuedEmails || queuedEmails.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No queued emails to process',
          processed: 0,
          failed: 0
        }),
        { 
          status: 200, 
          headers: { 'Content-Type': 'application/json', ...corsHeaders } 
        }
      );
    }

    let processedCount = 0;
    let failedCount = 0;

    // Process emails in batches of 10
    for (let i = 0; i < queuedEmails.length; i += 10) {
      const batch = queuedEmails.slice(i, i + 10);
      
      await Promise.all(
        batch.map(async (email: CommunicationEvent) => {
          try {
            console.log(`📤 Processing email for: ${email.recipient_email}`);

            // Mark email as processing
            await supabase
              .from('communication_events')
              .update({ 
                status: 'processing',
                retry_count: (email.retry_count || 0) + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', email.id);

            // Prepare email data for SMTP sender
            const emailData = {
              to: email.recipient_email,
              template_key: email.template_key,
              template_variables: email.variables,
              email_type: 'welcome',
              priority: 'normal'
            };

            // Send email via existing SMTP sender
            const { data: emailResult, error: emailError } = await supabase.functions.invoke(
              'smtp-email-sender',
              {
                body: emailData
              }
            );

            if (emailError) {
              console.error(`❌ Email sending failed for ${email.recipient_email}:`, emailError);
              
              // Mark as failed
              await supabase
                .from('communication_events')
                .update({ 
                  status: 'failed',
                  error_message: emailError.message || 'Email sending failed',
                  updated_at: new Date().toISOString()
                })
                .eq('id', email.id);
              
              failedCount++;
            } else {
              console.log(`✅ Email sent successfully to: ${email.recipient_email}`);
              
              // Mark as sent
              await supabase
                .from('communication_events')
                .update({ 
                  status: 'sent',
                  sent_at: new Date().toISOString(),
                  updated_at: new Date().toISOString()
                })
                .eq('id', email.id);
              
              processedCount++;
            }

          } catch (error) {
            console.error(`❌ Error processing email ${email.id}:`, error);
            
            // Mark as failed
            await supabase
              .from('communication_events')
              .update({ 
                status: 'failed',
                error_message: error.message || 'Processing error',
                updated_at: new Date().toISOString()
              })
              .eq('id', email.id);
            
            failedCount++;
          }
        })
      );

      // Small delay between batches to avoid overwhelming the email service
      if (i + 10 < queuedEmails.length) {
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Log processing summary
    const summary = {
      success: true,
      message: `Processed ${processedCount} emails, ${failedCount} failed`,
      processed: processedCount,
      failed: failedCount,
      total_queue: queuedEmails.length
    };

    console.log('📊 Processing summary:', summary);

    // Insert audit log
    await supabase
      .from('audit_logs')
      .insert({
        action: 'welcome_email_queue_processed',
        category: 'Email Processing',
        message: `Welcome email queue processing completed`,
        new_values: summary
      });

    return new Response(
      JSON.stringify(summary),
      { 
        status: 200, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );

  } catch (error) {
    console.error('❌ Welcome email queue processor error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Queue processing failed',
        processed: 0,
        failed: 0
      }),
      { 
        status: 500, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders } 
      }
    );
  }
});