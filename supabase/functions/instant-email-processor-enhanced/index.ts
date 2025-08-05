import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🚀 Enhanced email processor starting...');

    // Get stuck emails
    const { data: stuckEmails, error: fetchError } = await supabaseClient
      .from('communication_events')
      .select('*')
      .eq('status', 'queued')
      .order('created_at', { ascending: true })
      .limit(10);

    if (fetchError) {
      throw fetchError;
    }

    console.log(`📧 Found ${stuckEmails?.length || 0} stuck emails to process`);

    let processedCount = 0;
    let errorCount = 0;

    if (stuckEmails && stuckEmails.length > 0) {
      for (const email of stuckEmails) {
        try {
          // Update status to processing
          await supabaseClient
            .from('communication_events')
            .update({ 
              status: 'processing',
              updated_at: new Date().toISOString()
            })
            .eq('id', email.id);

          // Process the email using the enhanced SMTP sender
          const { error: sendError } = await supabaseClient.functions.invoke(
            'enhanced-smtp-sender',
            {
              body: {
                to: email.recipient_email,
                subject: getEmailSubject(email.event_type, email.variables),
                html: generateEmailContent(email.event_type, email.variables),
                template_id: email.template_id,
                event_id: email.id
              }
            }
          );

          if (sendError) {
            console.error(`❌ Failed to send email ${email.id}:`, sendError);
            
            // Mark as failed
            await supabaseClient
              .from('communication_events')
              .update({ 
                status: 'failed',
                error_message: sendError.message,
                retry_count: (email.retry_count || 0) + 1,
                updated_at: new Date().toISOString()
              })
              .eq('id', email.id);
            
            errorCount++;
          } else {
            // Mark as sent
            await supabaseClient
              .from('communication_events')
              .update({ 
                status: 'sent',
                sent_at: new Date().toISOString(),
                processed_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
              })
              .eq('id', email.id);
            
            processedCount++;
            console.log(`✅ Email sent successfully: ${email.id}`);
          }

          // Small delay between emails to avoid rate limiting
          await new Promise(resolve => setTimeout(resolve, 100));
          
        } catch (error) {
          console.error(`❌ Error processing email ${email.id}:`, error);
          errorCount++;
        }
      }
    }

    // Log processing results
    await supabaseClient
      .from('audit_logs')
      .insert({
        action: 'enhanced_email_processing',
        category: 'Email System',
        message: `Processed ${processedCount} emails successfully, ${errorCount} errors`,
        new_values: {
          processed_count: processedCount,
          error_count: errorCount,
          total_found: stuckEmails?.length || 0
        }
      });

    const result = {
      success: true,
      processed_count: processedCount,
      error_count: errorCount,
      total_found: stuckEmails?.length || 0,
      timestamp: new Date().toISOString()
    };

    console.log('📊 Email processing complete:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('💥 Enhanced email processor error:', error);
    return new Response(JSON.stringify({ 
      success: false, 
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});

function getEmailSubject(eventType: string, variables: any): string {
  switch (eventType) {
    case 'customer_welcome':
      return 'Welcome to Starters! 🎉';
    case 'order_confirmation':
      return `Order Confirmation - ${variables?.orderNumber || 'Your Order'}`;
    case 'admin_order_notification':
      return `New Order Alert - ${variables?.orderNumber || 'Order Received'}`;
    default:
      return 'Notification from Starters';
  }
}

function generateEmailContent(eventType: string, variables: any): string {
  const customerName = variables?.customerName || variables?.customer_name || 'Valued Customer';
  
  switch (eventType) {
    case 'customer_welcome':
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3b82f6;">Welcome to Starters! 🎉</h1>
          <p>Hello ${customerName},</p>
          <p>Thank you for joining Starters! We're excited to have you as part of our community.</p>
          <p>You can now browse our products, place orders, and track your deliveries.</p>
          <p>Best regards,<br>The Starters Team</p>
        </div>
      `;
    
    case 'order_confirmation':
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3b82f6;">Order Confirmed! 📦</h1>
          <p>Hello ${customerName},</p>
          <p>Your order <strong>${variables?.orderNumber || 'has been'}</strong> confirmed!</p>
          <p><strong>Order Total:</strong> ₦${variables?.orderTotal || variables?.total_amount || '0'}</p>
          <p>We'll notify you when your order is ready for delivery.</p>
          <p>Thank you for choosing Starters!</p>
        </div>
      `;
    
    case 'admin_order_notification':
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #f59e0b;">New Order Alert! 🔔</h1>
          <p><strong>Order:</strong> ${variables?.orderNumber || variables?.order_number || 'New Order'}</p>
          <p><strong>Customer:</strong> ${customerName}</p>
          <p><strong>Total:</strong> ₦${variables?.total_amount || variables?.orderTotal || '0'}</p>
          <p><strong>Type:</strong> ${variables?.fulfillment_type || variables?.orderType || 'Delivery'}</p>
          <p>Please process this order in the admin dashboard.</p>
        </div>
      `;
    
    default:
      return `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <h1 style="color: #3b82f6;">Notification</h1>
          <p>Hello ${customerName},</p>
          <p>You have a new notification from Starters.</p>
          <p>Best regards,<br>The Starters Team</p>
        </div>
      `;
  }
}