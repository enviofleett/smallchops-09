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

    const { 
      order_id, 
      order_number, 
      customer_name, 
      customer_email, 
      total_amount, 
      order_items = [] 
    } = await req.json();

    console.log('Processing admin order notification for order:', order_number);

    // Get business settings for admin email
    const { data: businessSettings } = await supabaseAdmin
      .from('business_settings')
      .select('admin_notification_email, email, name')
      .limit(1)
      .single();

    const adminEmail = businessSettings?.admin_notification_email || businessSettings?.email;
    
    if (!adminEmail) {
      console.warn('No admin email configured, skipping admin notification');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'No admin email configured' 
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Send admin notification using enhanced-smtp-sender
    const { data: emailResult, error: emailError } = await supabaseAdmin.functions.invoke('enhanced-smtp-sender', {
      body: {
        to: adminEmail,
        subject: `New Order Received: ${order_number}`,
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #2d3748;">New Order Notification</h2>
            <div style="background: #f7fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
              <h3>Order Details</h3>
              <p><strong>Order Number:</strong> ${order_number}</p>
              <p><strong>Customer:</strong> ${customer_name}</p>
              <p><strong>Email:</strong> ${customer_email}</p>
              <p><strong>Total Amount:</strong> ₦${total_amount?.toLocaleString() || 'N/A'}</p>
              <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
            </div>
            
            ${order_items.length > 0 ? `
              <div style="margin: 20px 0;">
                <h3>Order Items</h3>
                <ul>
                  ${order_items.map(item => `
                    <li>${item.product_name} - Qty: ${item.quantity} - ₦${item.unit_price?.toLocaleString()}</li>
                  `).join('')}
                </ul>
              </div>
            ` : ''}
            
            <div style="margin-top: 30px; padding: 20px; background: #e2e8f0; border-radius: 8px;">
              <p style="margin: 0;">
                <a href="https://yourdomain.com/admin/orders/${order_id}" 
                   style="background: #3182ce; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                  View Order in Admin
                </a>
              </p>
            </div>
          </div>
        `,
        priority: 'high'
      }
    });

    if (emailError) {
      console.error('Failed to send admin notification:', emailError);
      throw new Error(`Admin notification failed: ${emailError.message}`);
    }

    console.log('Admin notification sent successfully for order:', order_number);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Admin notification sent successfully',
        email_result: emailResult
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Admin order notification error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to send admin notification'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});