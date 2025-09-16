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

    // Get business settings for admin email and company info
    const { data: businessSettings } = await supabaseAdmin
      .from('business_settings')
      .select('admin_notification_email, email, name, site_url')
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

    // Prepare template variables for admin_new_order template
    const templateVariables = {
      order_number: order_number,
      customer_name: customer_name,
      customer_email: customer_email,
      customer_phone: order_items?.[0]?.customer_phone || 'N/A', // Get from order if available
      total_amount: total_amount?.toLocaleString() || '0',
      order_date: new Date().toLocaleDateString(),
      order_items_list: order_items.length > 0 ? 
        order_items.map(item => 
          `• ${item.product_name} - Qty: ${item.quantity} - ₦${item.unit_price?.toLocaleString()}`
        ).join('\n') : 'No items',
      admin_dashboard_link: `${businessSettings?.site_url || 'https://yourdomain.com'}/admin/orders/${order_id}`,
      business_name: businessSettings?.name || 'Starters'
    };

    // Send admin notification using the template from Email Template Manager
    const { data: emailResult, error: emailError } = await supabaseAdmin.functions.invoke('unified-smtp-sender', {
      body: {
        to: adminEmail,
        templateKey: 'admin_new_order',
        variables: templateVariables,
        emailType: 'transactional',
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