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
      trigger_type, 
      customer_email, 
      customer_name, 
      order_data, 
      immediate_processing = true 
    } = await req.json();

    console.log(`Email automation trigger: ${trigger_type} for ${customer_email}`);

    let emailEvents = [];

    switch (trigger_type) {
      case 'order_confirmation':
        emailEvents = await createOrderConfirmationEmails(
          supabaseAdmin, 
          customer_email, 
          customer_name, 
          order_data
        );
        break;

      case 'customer_welcome':
        emailEvents = await createWelcomeEmail(
          supabaseAdmin, 
          customer_email, 
          customer_name
        );
        break;

      case 'payment_confirmation':
        emailEvents = await createPaymentConfirmationEmails(
          supabaseAdmin, 
          customer_email, 
          customer_name, 
          order_data
        );
        break;

      default:
        throw new Error(`Unknown trigger type: ${trigger_type}`);
    }

    // Insert all email events
    if (emailEvents.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('communication_events')
        .insert(emailEvents);

      if (insertError) {
        throw new Error(`Failed to queue emails: ${insertError.message}`);
      }

      console.log(`Queued ${emailEvents.length} email events for ${trigger_type}`);
    }

    // Trigger immediate processing if requested
    if (immediate_processing && emailEvents.length > 0) {
      console.log('Triggering immediate email processing...');
      
      const processors = [
        'instant-email-processor',
        'unified-email-queue-processor'
      ];

      for (const processor of processors) {
        try {
          await supabaseAdmin.functions.invoke(processor);
          console.log(`${processor} triggered successfully`);
          break; // Stop after first successful trigger
        } catch (processorError) {
          console.warn(`${processor} failed:`, processorError.message);
          continue;
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Email automation triggered successfully',
        trigger_type,
        emails_queued: emailEvents.length,
        immediate_processing
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Email automation trigger error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to trigger email automation'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});

async function createOrderConfirmationEmails(supabase: any, customerEmail: string, customerName: string, orderData: any) {
  // Get business settings
  const { data: businessSettings } = await supabase
    .from('business_settings')
    .select('admin_notification_email, email, name')
    .limit(1)
    .single();

  const adminEmail = businessSettings?.admin_notification_email || businessSettings?.email || 'admin@starters.com';
  const businessName = businessSettings?.name || 'Starters';

  return [
    // Customer order confirmation
    {
      event_type: 'order_confirmation',
      recipient_email: customerEmail,
      order_id: orderData?.order_id,
      status: 'queued',
      template_key: 'order_confirmation_clean',
      template_variables: {
        customerName: customerName || 'Valued Customer',
        orderId: orderData?.order_number || orderData?.order_id,
        orderDate: new Date().toLocaleDateString(),
        orderTotal: `₦${orderData?.total_amount?.toLocaleString() || '0'}`,
        orderItems: orderData?.items ? 
          orderData.items.map(item => `${item.product_name} - Qty: ${item.quantity}`).join('<br>') :
          'Order items will be confirmed shortly',
        deliveryAddress: orderData?.delivery_address || 'As specified in your order',
        companyName: businessName,
        supportEmail: businessSettings?.email || 'support@starters.com'
      },
      priority: 'high'
    },
    // Admin notification
    {
      event_type: 'admin_new_order',
      recipient_email: adminEmail,
      order_id: orderData?.order_id,
      status: 'queued',
      template_key: 'admin_new_order',
      template_variables: {
        orderNumber: orderData?.order_number || orderData?.order_id,
        customerName: customerName || 'Customer',
        customerEmail: customerEmail,
        orderTotal: `₦${orderData?.total_amount?.toLocaleString() || '0'}`,
        orderDate: new Date().toLocaleDateString(),
        itemsCount: orderData?.items?.length || 1,
        orderId: orderData?.order_id,
        adminDashboardLink: `https://yourdomain.com/admin/orders/${orderData?.order_id}`,
        companyName: businessName
      },
      priority: 'high'
    }
  ];
}

async function createWelcomeEmail(supabase: any, customerEmail: string, customerName: string) {
  // Get business settings
  const { data: businessSettings } = await supabase
    .from('business_settings')
    .select('email, name, website_url')
    .limit(1)
    .single();

  return [
    {
      event_type: 'customer_welcome',
      recipient_email: customerEmail,
      status: 'queued',
      template_key: 'customer_welcome',
      template_variables: {
        customerName: customerName || 'Valued Customer',
        companyName: businessSettings?.name || 'Starters',
        websiteUrl: businessSettings?.website_url || 'https://starters.com',
        supportEmail: businessSettings?.email || 'support@starters.com'
      },
      priority: 'normal'
    }
  ];
}

async function createPaymentConfirmationEmails(supabase: any, customerEmail: string, customerName: string, orderData: any) {
  return await createOrderConfirmationEmails(supabase, customerEmail, customerName, orderData);
}