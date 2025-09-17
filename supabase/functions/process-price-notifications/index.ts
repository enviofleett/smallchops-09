import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationData {
  old_price: number;
  new_price: number;
  product_name: string;
  percentage_change: number;
}

interface NotificationQueueItem {
  id: string;
  customer_id: string;
  product_id: string;
  notification_type: string;
  data: NotificationData;
  customer_email?: string;
  customer_name?: string;
}

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Starting price notification processing via native SMTP...');

    // Get pending notifications
    const { data: notifications, error: fetchError } = await supabase
      .from('notification_queue')
      .select(`
        *,
        customer_accounts!inner (
          id,
          name,
          user_id
        )
      `)
      .eq('status', 'pending')
      .eq('notification_type', 'price_change')
      .limit(50); // Process 50 at a time

    if (fetchError) {
      console.error('Error fetching notifications:', fetchError);
      throw fetchError;
    }

    if (!notifications || notifications.length === 0) {
      console.log('No pending notifications to process');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Processing ${notifications.length} notifications`);

    let processed = 0;
    let failed = 0;

    for (const notification of notifications) {
      try {
        // Get user email from auth
        const { data: authUser, error: authError } = await supabase.auth.admin.getUserById(
          notification.customer_accounts.user_id
        );

        if (authError || !authUser?.user?.email) {
          console.error('Error getting user email:', authError);
          await markNotificationFailed(notification.id, 'User email not found');
          failed++;
          continue;
        }

        const data = notification.data as NotificationData;
        const priceChange = data.percentage_change;
        const isIncrease = priceChange > 0;
        const changeType = isIncrease ? 'increased' : 'decreased';
        const changeColor = isIncrease ? '#ef4444' : '#22c55e';

        // Send email notification via native SMTP
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('unified-smtp-sender', {
          body: {
            to: authUser.user.email,
            subject: `Price Alert: ${data.product_name} ${changeType}`,
            emailType: 'transactional',
            htmlContent: `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                <h2 style="color: #333;">Price Alert!</h2>
                <div style="background: #f9f9f9; padding: 20px; border-radius: 8px; margin: 20px 0;">
                  <h3 style="margin: 0 0 10px 0;">${data.product_name}</h3>
                  <p style="margin: 5px 0;">
                    <strong>Previous price:</strong> ₦${data.old_price.toLocaleString()}
                  </p>
                  <p style="margin: 5px 0;">
                    <strong>New price:</strong> 
                    <span style="color: ${changeColor}; font-weight: bold;">
                      ₦${data.new_price.toLocaleString()}
                    </span>
                  </p>
                  <p style="margin: 5px 0;">
                    <strong>Change:</strong> 
                    <span style="color: ${changeColor}; font-weight: bold;">
                      ${Math.abs(priceChange)}% ${changeType}
                    </span>
                  </p>
                </div>
                <p>This is one of your favorite products. ${!isIncrease ? 'Great news - the price has dropped!' : 'The price has increased.'}</p>
                <div style="margin: 30px 0;">
                  <a href="https://startersmallchops.com/customer-portal" 
                     style="background: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                    View Product
                  </a>
                </div>
                <p style="color: #666; font-size: 12px;">
                  You can manage your notification preferences in your account settings.
                </p>
              </div>
            `,
            variables: {
              product_name: data.product_name,
              old_price: data.old_price,
              new_price: data.new_price,
              price_change: priceChange,
              customer_name: notification.customer_accounts.name
            }
          }
        });

        if (emailError) {
          console.error('Native SMTP email failed:', emailError);
          await markNotificationFailed(notification.id, emailError.message);
          failed++;
        } else {
          console.log('Email sent successfully via native SMTP:', emailResult?.messageId);
          await markNotificationProcessed(notification.id);
          processed++;
        }

      } catch (error) {
        console.error('Error processing notification:', error);
        await markNotificationFailed(notification.id, error.message);
        failed++;
      }
    }

    console.log(`Processing complete. Processed: ${processed}, Failed: ${failed}`);

    return new Response(JSON.stringify({ 
      processed, 
      failed,
      total: notifications.length 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in process-price-notifications:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function markNotificationProcessed(notificationId: string) {
  const { error } = await supabase
    .from('notification_queue')
    .update({
      status: 'processed',
      processed_at: new Date().toISOString(),
    })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as processed:', error);
  }
}

async function markNotificationFailed(notificationId: string, errorMessage: string) {
  const { error } = await supabase
    .from('notification_queue')
    .update({
      status: 'failed',
      processed_at: new Date().toISOString(),
      data: { error: errorMessage },
    })
    .eq('id', notificationId);

  if (error) {
    console.error('Error marking notification as failed:', error);
  }
}