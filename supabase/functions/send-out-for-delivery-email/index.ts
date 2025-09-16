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

    // Fetch driver details if assigned
    const { data: assignment } = await supabase
      .from('order_assignments')
      .select(`
        *,
        drivers (
          id,
          name,
          phone,
          vehicle_type
        )
      `)
      .eq('order_id', order_id)
      .eq('status', 'assigned')
      .single();

    const driver = assignment?.drivers;

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

    // Prepare template variables for the out_for_delivery template
    const templateVariables = {
      customer_name: orderData.customer_name,
      order_number: orderData.order_number,
      delivery_address: orderData.delivery_address ? 
        `${orderData.delivery_address?.street || ''} ${orderData.delivery_address?.city || ''}`.trim() : 'N/A',
      delivery_instructions: orderData.delivery_instructions || '',
      estimated_delivery_time: orderData.estimated_delivery_time ? 
        new Date(orderData.estimated_delivery_time).toLocaleString() : '',
      driver_name: driver?.name || '',
      driver_phone: driver?.phone || '',
      driver_vehicle_type: driver?.vehicle_type || '',
      order_items_html: buildOrderItemsHtml(orderData.order_items || []),
      order_items_text: buildOrderItemsText(orderData.order_items || []),
      total_amount: orderData.total_amount?.toLocaleString() || '0',
      business_name: 'Starters' // Get from business settings if needed
    };

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