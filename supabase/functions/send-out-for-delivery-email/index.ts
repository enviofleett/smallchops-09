import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Build email content function (inline version)
function buildOutForDeliveryEmailContent(order: any, driver?: any) {
  const subject = `Your order #${order.order_number} is out for delivery!`;
  
  const driverInfo = driver ? `
    <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
      <h3 style="margin: 0 0 8px 0; color: #333;">Your Delivery Driver</h3>
      <p style="margin: 4px 0;"><strong>${driver.name}</strong></p>
      <p style="margin: 4px 0;">Phone: ${driver.phone}</p>
      <p style="margin: 4px 0;">Vehicle: ${driver.vehicle_type}</p>
    </div>
  ` : '';

  const itemsList = order.order_items.map((item: any) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.product_name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${item.quantity}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₦${item.total_price}</td>
    </tr>
  `).join('');

  const html = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h1 style="color: #333; text-align: center;">Your Order is Out for Delivery! 🚚</h1>
      
      <p>Hi ${order.customer_name},</p>
      
      <p>Great news! Your order <strong>#${order.order_number}</strong> is now out for delivery and should arrive soon.</p>
      
      ${driverInfo}
      
      <div style="background-color: #f8f9fa; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <h3 style="margin: 0 0 8px 0; color: #333;">Delivery Details</h3>
        <p style="margin: 4px 0;"><strong>Address:</strong><br>${order.delivery_address?.street || ''} ${order.delivery_address?.city || ''}</p>
        ${order.delivery_instructions ? `<p style="margin: 4px 0;"><strong>Instructions:</strong> ${order.delivery_instructions}</p>` : ''}
        ${order.estimated_delivery_time ? `<p style="margin: 4px 0;"><strong>Estimated Time:</strong> ${new Date(order.estimated_delivery_time).toLocaleString()}</p>` : ''}
      </div>

      <h3>Order Summary</h3>
      <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
        <thead>
          <tr style="background-color: #f8f9fa;">
            <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #ddd;">Item</th>
            <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #ddd;">Qty</th>
            <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #ddd;">Price</th>
          </tr>
        </thead>
        <tbody>
          ${itemsList}
        </tbody>
        <tfoot>
          <tr style="background-color: #f8f9fa; font-weight: bold;">
            <td colspan="2" style="padding: 12px 8px; border-top: 2px solid #ddd;">Total</td>
            <td style="padding: 12px 8px; text-align: right; border-top: 2px solid #ddd;">₦${order.total_amount}</td>
          </tr>
        </tfoot>
      </table>

      <p style="margin-top: 24px;">Thank you for your order!</p>
      <p style="color: #666; font-size: 14px;">If you have any questions, please don't hesitate to contact us.</p>
    </div>
  `;

  return { subject, html };
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

    // Generate email content
    const { subject, html } = buildOutForDeliveryEmailContent(orderData, driver);

    // Send email using native SMTP system
    const { data: emailResponse, error: emailError } = await supabase.functions.invoke('unified-smtp-sender', {
      body: {
        to: order.customer_email,
        subject: subject,
        htmlContent: html,
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