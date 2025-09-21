import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRecord {
  id: string;
  order_id: string;
  old_status: string | null;
  new_status: string;
  customer_email: string;
  customer_name: string | null;
  order_number: string;
  template_key: string;
  template_variables: any;
  retry_count: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 Processing email notification queue...');

    // Get pending notifications (max 10 per batch)
    const { data: notifications, error: fetchError } = await supabaseClient
      .from('order_status_notifications')
      .select('*')
      .is('processed_at', null)
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      console.error('❌ Error fetching notifications:', fetchError);
      throw fetchError;
    }

    if (!notifications || notifications.length === 0) {
      console.log('✅ No pending notifications to process');
      return new Response(JSON.stringify({ 
        message: 'No pending notifications',
        processed: 0 
      }), {
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      });
    }

    console.log(`📬 Processing ${notifications.length} notifications...`);

    const results = [];
    
    for (const notification of notifications as NotificationRecord[]) {
      try {
        console.log(`📧 Processing notification ${notification.id} for order ${notification.order_number}`);

        // Call the existing simple-order-email function
        const { data: emailResult, error: emailError } = await supabaseClient.functions
          .invoke('simple-order-email', {
            body: {
              orderId: notification.order_id,
              status: notification.new_status
            }
          });

        if (emailError) {
          throw new Error(`Email function error: ${emailError.message}`);
        }

        // Mark as processed on success
        const { error: updateError } = await supabaseClient
          .from('order_status_notifications')
          .update({ 
            processed_at: new Date().toISOString(),
            error_message: null 
          })
          .eq('id', notification.id);

        if (updateError) {
          console.error(`⚠️ Error updating notification ${notification.id}:`, updateError);
        } else {
          console.log(`✅ Successfully processed notification ${notification.id}`);
        }

        results.push({ 
          id: notification.id, 
          order_number: notification.order_number,
          status: 'success',
          email_result: emailResult 
        });
        
      } catch (error) {
        console.error(`❌ Error processing notification ${notification.id}:`, error.message);
        
        // Increment retry count and log error
        const { error: retryUpdateError } = await supabaseClient
          .from('order_status_notifications')
          .update({ 
            retry_count: notification.retry_count + 1,
            error_message: error.message 
          })
          .eq('id', notification.id);

        if (retryUpdateError) {
          console.error(`⚠️ Error updating retry count for ${notification.id}:`, retryUpdateError);
        }

        results.push({ 
          id: notification.id, 
          order_number: notification.order_number,
          status: 'error', 
          error: error.message,
          retry_count: notification.retry_count + 1
        });
      }
    }

    const successCount = results.filter(r => r.status === 'success').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    console.log(`📊 Processing complete: ${successCount} successful, ${errorCount} failed`);

    return new Response(JSON.stringify({ 
      processed: results.length,
      successful: successCount,
      failed: errorCount,
      results 
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });

  } catch (error) {
    console.error('💥 Critical error in email processor:', error);
    
    return new Response(JSON.stringify({ 
      error: 'Email processor failed',
      message: error.message 
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    });
  }
});