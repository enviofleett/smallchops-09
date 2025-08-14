import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { Resend } from "npm:resend@2.0.0";

const resend = new Resend(Deno.env.get("RESEND_API_KEY"));

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface AssignmentNotificationRequest {
  orderId: string;
  riderId: string;
}

const handler = async (req: Request): Promise<Response> => {
  console.log('📧 Rider assignment notification function called');
  
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { orderId, riderId }: AssignmentNotificationRequest = await req.json();
    
    console.log('📋 Processing assignment notification:', { orderId, riderId });

    // Fetch order details
    const { data: order, error: orderError } = await supabase
      .from('orders')
      .select(`
        *,
        order_items(*)
      `)
      .eq('id', orderId)
      .single();

    if (orderError || !order) {
      console.error('❌ Order not found:', orderError);
      return new Response(JSON.stringify({ error: 'Order not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch rider details
    const { data: rider, error: riderError } = await supabase
      .from('drivers')
      .select('*')
      .eq('id', riderId)
      .single();

    if (riderError || !rider) {
      console.error('❌ Rider not found:', riderError);
      return new Response(JSON.stringify({ error: 'Rider not found' }), {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Only send email if rider has an email address
    if (!rider.email) {
      console.log('⚠️ Rider has no email address, skipping notification');
      return new Response(JSON.stringify({ 
        success: true, 
        message: 'Assignment successful but no email sent (rider has no email)' 
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log('📧 Sending assignment notification to:', rider.email);

    // Format delivery address
    const deliveryAddress = order.delivery_address 
      ? typeof order.delivery_address === 'string' 
        ? order.delivery_address 
        : `${order.delivery_address.street || ''} ${order.delivery_address.city || ''}`.trim()
      : 'Address not provided';

    // Format order items
    const itemsList = order.order_items?.map((item: any) => 
      `• ${item.quantity}x ${item.product_name} - ₦${item.unit_price.toLocaleString()}`
    ).join('\n') || 'No items found';

    // Calculate estimated delivery time (30 minutes from now)
    const estimatedTime = new Date(Date.now() + 30 * 60 * 1000);
    const timeString = estimatedTime.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });

    const emailResponse = await resend.emails.send({
      from: "Dispatch Team <dispatch@startersmallchops.com>",
      to: [rider.email],
      subject: `New Delivery Assignment - Order #${order.order_number} 🚗`,
      html: `
        <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f8fafc;">
          <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);">
            <div style="text-align: center; margin-bottom: 32px;">
              <h1 style="color: #1f2937; font-size: 28px; font-weight: bold; margin: 0;">
                New Delivery Assignment 🚗
              </h1>
              <p style="color: #6b7280; font-size: 16px; margin: 8px 0 0 0;">
                Order #${order.order_number}
              </p>
            </div>

            <div style="background: #3b82f6; color: white; border-radius: 8px; padding: 20px; margin: 24px 0; text-align: center;">
              <h2 style="margin: 0 0 8px 0; font-size: 20px;">Hi ${rider.name}!</h2>
              <p style="margin: 0; font-size: 16px; opacity: 0.9;">
                You have been assigned a new delivery order
              </p>
            </div>

            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <h3 style="color: #374151; font-size: 18px; margin: 0 0 16px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
                📋 Order Details
              </h3>
              <div style="margin-bottom: 16px;">
                <strong style="color: #374151;">Customer:</strong> 
                <span style="color: #4b5563;">${order.customer_name}</span>
              </div>
              <div style="margin-bottom: 16px;">
                <strong style="color: #374151;">Phone:</strong> 
                <span style="color: #4b5563;">${order.customer_phone || 'Not provided'}</span>
              </div>
              <div style="margin-bottom: 16px;">
                <strong style="color: #374151;">Order Type:</strong> 
                <span style="background: #fef3c7; color: #92400e; padding: 4px 8px; border-radius: 4px; font-size: 14px; text-transform: capitalize;">
                  ${order.order_type}
                </span>
              </div>
              <div style="margin-bottom: 16px;">
                <strong style="color: #374151;">Total Amount:</strong> 
                <span style="color: #059669; font-weight: 600; font-size: 18px;">₦${order.total_amount.toLocaleString()}</span>
              </div>
            </div>

            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <h3 style="color: #374151; font-size: 18px; margin: 0 0 16px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
                📍 Delivery Information
              </h3>
              <div style="margin-bottom: 16px;">
                <strong style="color: #374151;">Delivery Address:</strong><br>
                <span style="color: #4b5563; line-height: 1.5;">${deliveryAddress}</span>
              </div>
              <div style="margin-bottom: 16px;">
                <strong style="color: #374151;">Estimated Delivery Time:</strong> 
                <span style="color: #7c3aed; font-weight: 600;">${timeString}</span>
              </div>
            </div>

            <div style="border: 1px solid #e5e7eb; border-radius: 8px; padding: 24px; margin: 24px 0;">
              <h3 style="color: #374151; font-size: 18px; margin: 0 0 16px 0; border-bottom: 1px solid #e5e7eb; padding-bottom: 8px;">
                🛍️ Order Items
              </h3>
              <pre style="background: #f9fafb; padding: 16px; border-radius: 6px; color: #374151; font-family: monospace; font-size: 14px; line-height: 1.5; margin: 0; white-space: pre-wrap;">${itemsList}</pre>
            </div>

            ${order.special_instructions ? `
              <div style="background: #fef3c7; border: 1px solid #f59e0b; border-radius: 8px; padding: 16px; margin: 24px 0;">
                <h4 style="color: #92400e; font-size: 16px; margin: 0 0 8px 0;">
                  📝 Special Instructions
                </h4>
                <p style="color: #92400e; margin: 0; line-height: 1.4;">
                  ${order.special_instructions}
                </p>
              </div>
            ` : ''}

            <div style="background: #dcfce7; border: 1px solid #16a34a; border-radius: 8px; padding: 20px; margin: 32px 0; text-align: center;">
              <h3 style="color: #15803d; margin: 0 0 12px 0;">
                📱 Next Steps
              </h3>
              <ol style="color: #15803d; text-align: left; margin: 0; padding-left: 20px; line-height: 1.6;">
                <li>Review the order details above</li>
                <li>Contact the customer if needed</li>
                <li>Update your status in the system</li>
                <li>Deliver the order and mark as completed</li>
              </ol>
            </div>

            <div style="text-align: center; margin-top: 32px; padding-top: 24px; border-top: 1px solid #e5e7eb;">
              <p style="color: #6b7280; font-size: 14px; margin: 0;">
                For support, contact our dispatch team at 
                <a href="mailto:dispatch@startersmallchops.com" style="color: #3b82f6;">dispatch@startersmallchops.com</a>
              </p>
            </div>
          </div>
        </div>
      `,
    });

    console.log('📧 Assignment email sent successfully:', emailResponse);

    // Log the notification in communication events
    await supabase.from('communication_events').insert({
      order_id: orderId,
      event_type: 'rider_assignment',
      recipient_email: rider.email,
      template_key: 'rider_assignment',
      email_type: 'transactional',
      status: 'delivered',
      variables: {
        rider_name: rider.name,
        order_number: order.order_number,
        customer_name: order.customer_name,
        delivery_address: deliveryAddress,
        total_amount: order.total_amount,
        estimated_time: timeString
      }
    });

    return new Response(JSON.stringify({
      success: true,
      message: 'Assignment notification sent successfully',
      emailId: emailResponse.data?.id
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('❌ Error in rider assignment notification function:', error);
    return new Response(JSON.stringify({ 
      error: error.message || 'Internal server error' 
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
};

serve(handler);