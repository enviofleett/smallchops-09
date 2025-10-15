import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Helper function to build order items HTML for template
function buildOrderItemsHtml(orderItems: any[]): string {
  return orderItems.map(item => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #e9ecef;">${item.product_name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e9ecef; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #e9ecef; text-align: right;">₦${item.total_price?.toLocaleString()}</td>
    </tr>
  `).join('');
}

// Helper function to build order items text for template
function buildOrderItemsText(orderItems: any[]): string {
  return orderItems.map(item => 
    `${item.product_name} - Qty: ${item.quantity} - ₦${item.total_price?.toLocaleString()}`
  ).join('\n');
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { order_id } = await req.json();

    if (!order_id) {
      throw new Error('Order ID is required');
    }

    console.log('Processing out-for-delivery email for order:', order_id);

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items (
          id,
          product_name,
          quantity,
          unit_price,
          total_price
        )
      `)
      .eq('id', order_id)
      .single();

    if (orderError || !order) {
      throw new Error(`Failed to fetch order: ${orderError?.message || 'Order not found'}`);
    }

    // Fetch complete driver details if assigned (production-ready)
    const { data: assignment } = await supabase
      .from('order_assignments')
      .select(`
        *,
        drivers (
          id,
          name,
          phone,
          email,
          vehicle_type,
          vehicle_brand,
          vehicle_model,
          license_plate
        )
      `)
      .eq('order_id', order_id)
      .eq('status', 'assigned')
      .single();

    const driver = assignment?.drivers;

    console.log('Driver info fetched:', driver ? {
      name: driver.name,
      phone: driver.phone,
      vehicle: `${driver.vehicle_brand || ''} ${driver.vehicle_model || ''}`.trim(),
      license: driver.license_plate
    } : 'No driver assigned');

    // Build email content using the utility function
    const orderData = {
      id: order.id,
      order_number: order.order_number,
      customer_name: order.customer_name,
      customer_phone: order.customer_phone,
      delivery_address: order.delivery_address,
      delivery_instructions: order.delivery_instructions,
      estimated_delivery_time: order.estimated_delivery_time,
      order_items: order.order_items || [],
      total_amount: order.total_amount
    };

    // Parse delivery address properly (handles string, object, or null)
    let deliveryAddressText = 'Address not available';
    if (orderData.delivery_address) {
      if (typeof orderData.delivery_address === 'string') {
        deliveryAddressText = orderData.delivery_address;
      } else if (typeof orderData.delivery_address === 'object') {
        const addr = orderData.delivery_address;
        deliveryAddressText = [
          addr.address_line_1,
          addr.address_line_2,
          addr.city,
          addr.state
        ].filter(Boolean).join(', ') || 'Address not available';
      }
    }

    // Fetch business settings for support email
    const { data: businessSettings } = await supabase
      .from('business_settings')
      .select('admin_notification_email, name')
      .single();

    const supportEmail = businessSettings?.admin_notification_email || 'support@startersmallchops.com';
    const businessName = businessSettings?.name || 'Starters';

    // Prepare comprehensive template variables for delivery emails (production-ready)
    const templateVariables = {
      customer_name: orderData.customer_name || 'Customer',
      order_number: orderData.order_number,
      delivery_address: deliveryAddressText,
      delivery_instructions: orderData.delivery_instructions || 'No special instructions',
      estimated_delivery_time: orderData.estimated_delivery_time ? 
        new Date(orderData.estimated_delivery_time).toLocaleString() : 'To be confirmed',
      // Complete driver information
      driver_name: driver?.name || 'Our delivery team',
      driver_phone: driver?.phone || 'Will be provided shortly',
      driver_email: driver?.email || '',
      driver_vehicle_type: driver?.vehicle_type || 'Vehicle',
      driver_vehicle_brand: driver?.vehicle_brand || '',
      driver_vehicle_model: driver?.vehicle_model || '',
      driver_license_plate: driver?.license_plate || '',
      driver_vehicle_full: driver ? 
        `${driver.vehicle_brand || ''} ${driver.vehicle_model || ''}`.trim() || driver.vehicle_type || 'Vehicle' : 'Vehicle',
      has_driver_assigned: driver ? 'true' : 'false',
      order_items_html: buildOrderItemsHtml(orderData.order_items || []),
      order_items_text: buildOrderItemsText(orderData.order_items || []),
      total_amount: `₦${orderData.total_amount?.toLocaleString() || '0'}`,
      order_total: orderData.total_amount?.toLocaleString() || '0',
      business_name: businessName,
      support_email: supportEmail,
      current_year: new Date().getFullYear().toString(),
      status_display: 'Out for Delivery',
      new_status: 'out_for_delivery'
    };

    console.log('Template variables prepared with driver info:', {
      has_driver: !!driver,
      driver_name: templateVariables.driver_name,
      driver_vehicle: templateVariables.driver_vehicle_full
    });

    // Send email using the template from Email Template Manager
    const { data: emailResponse, error: emailError } = await supabase.functions.invoke('unified-smtp-sender', {
      body: {
        to: order.customer_email,
        templateKey: 'out_for_delivery',
        variables: templateVariables,
        emailType: 'transactional'
      }
    });

    if (emailError) {
      throw new Error(`Failed to send email: ${emailError.message}`);
    }

    console.log('Email sent successfully via native SMTP:', emailResponse);

    // Update order status to out_for_delivery
    const { error: updateError } = await supabase
      .from('orders')
      .update({ 
        status: 'out_for_delivery',
        updated_at: new Date().toISOString()
      })
      .eq('id', order_id);

    if (updateError) {
      console.error('Failed to update order status:', updateError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Out-for-delivery email sent successfully via native SMTP'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Error sending out-for-delivery email:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to send out-for-delivery email'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});