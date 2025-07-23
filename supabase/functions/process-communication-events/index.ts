import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';

// Production-ready CORS configuration
const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = [
    'https://oknnklksdiqaifhxaccs.supabase.co',
    'https://project-oknnklksdiqaifhxaccs.lovable.app',
    'http://localhost:5173',
    'http://localhost:3000'
  ];
  
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

const ORDER_STATUS_TEMPLATES = {
  'pending': {
    subject: 'Order Confirmation - #{order_number}',
    template: `
      <h2>Thank you for your order!</h2>
      <p>Dear {customer_name},</p>
      <p>We've received your order <strong>#{order_number}</strong> and it's being processed.</p>
      <p>Order Total: <strong>{total_amount}</strong></p>
      <p>We'll keep you updated on your order status.</p>
      <p>Best regards,<br>Your Team</p>
    `
  },
  'confirmed': {
    subject: 'Order Confirmed - #{order_number}',
    template: `
      <h2>Your order has been confirmed!</h2>
      <p>Dear {customer_name},</p>
      <p>Great news! Your order <strong>#{order_number}</strong> has been confirmed and is now being prepared.</p>
      <p>Estimated preparation time: 15-30 minutes</p>
      <p>We'll notify you when your order is ready.</p>
      <p>Best regards,<br>Your Team</p>
    `
  },
  'preparing': {
    subject: 'Order Being Prepared - #{order_number}',
    template: `
      <h2>Your order is being prepared!</h2>
      <p>Dear {customer_name},</p>
      <p>Our kitchen team is now preparing your order <strong>#{order_number}</strong>.</p>
      <p>We'll notify you as soon as it's ready for pickup or delivery.</p>
      <p>Best regards,<br>Your Team</p>
    `
  },
  'ready_for_pickup': {
    subject: 'Order Ready for Pickup - #{order_number}',
    template: `
      <h2>Your order is ready for pickup!</h2>
      <p>Dear {customer_name},</p>
      <p>Your order <strong>#{order_number}</strong> is ready for pickup.</p>
      <p>Please collect your order at your earliest convenience.</p>
      <p>Location: {pickup_address}</p>
      <p>Best regards,<br>Your Team</p>
    `
  },
  'ready_for_delivery': {
    subject: 'Order Ready for Delivery - #{order_number}',
    template: `
      <h2>Your order is ready for delivery!</h2>
      <p>Dear {customer_name},</p>
      <p>Your order <strong>#{order_number}</strong> is ready and will be delivered shortly.</p>
      <p>Delivery Address: {delivery_address}</p>
      <p>We'll notify you when the delivery is on its way.</p>
      <p>Best regards,<br>Your Team</p>
    `
  },
  'out_for_delivery': {
    subject: 'Order Out for Delivery - #{order_number}',
    template: `
      <h2>Your order is out for delivery!</h2>
      <p>Dear {customer_name},</p>
      <p>Your order <strong>#{order_number}</strong> is now out for delivery.</p>
      <p>Expected delivery time: 15-30 minutes</p>
      <p>Delivery Address: {delivery_address}</p>
      <p>Best regards,<br>Your Team</p>
    `
  },
  'delivered': {
    subject: 'Order Delivered - #{order_number}',
    template: `
      <h2>Your order has been delivered!</h2>
      <p>Dear {customer_name},</p>
      <p>Your order <strong>#{order_number}</strong> has been successfully delivered.</p>
      <p>We hope you enjoy your meal!</p>
      <p>Thank you for choosing us. We look forward to serving you again.</p>
      <p>Best regards,<br>Your Team</p>
    `
  },
  'cancelled': {
    subject: 'Order Cancelled - #{order_number}',
    template: `
      <h2>Order Cancelled</h2>
      <p>Dear {customer_name},</p>
      <p>We regret to inform you that your order <strong>#{order_number}</strong> has been cancelled.</p>
      <p>If payment was processed, a refund will be issued within 3-5 business days.</p>
      <p>We apologize for any inconvenience caused.</p>
      <p>Best regards,<br>Your Team</p>
    `
  }
};

serve(async (req: Request): Promise<Response> => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Processing communication events...');

    // Get communication settings
    const { data: commSettings } = await supabase
      .from('communication_settings')
      .select('*')
      .single();

    if (!commSettings?.enable_email) {
      console.log('Email communication is disabled');
      return new Response(JSON.stringify({ 
        message: 'Email communication is disabled' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get queued communication events (retry failed events up to 3 times)
    const { data: events, error: eventsError } = await supabase
      .from('communication_events')
      .select(`
        *,
        orders (
          order_number,
          customer_name,
          customer_email,
          customer_phone,
          total_amount,
          delivery_address,
          pickup_time,
          delivery_time
        )
      `)
      .in('status', ['queued', 'failed'])
      .lt('retry_count', 3)
      .order('created_at', { ascending: true })
      .limit(10);

    if (eventsError) {
      throw new Error(`Failed to fetch events: ${eventsError.message}`);
    }

    if (!events || events.length === 0) {
      console.log('No events to process');
      return new Response(JSON.stringify({ 
        message: 'No events to process' 
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`Processing ${events.length} events`);
    let processedCount = 0;
    let errorCount = 0;

    for (const event of events) {
      try {
        // Mark event as processing
        await supabase
          .from('communication_events')
          .update({ status: 'processing' })
          .eq('id', event.id);

        if (event.event_type === 'order_status_update' && event.orders) {
          const order = event.orders;
          const newStatus = event.payload?.new_status;
          
          // Get customer communication preferences
          const { data: preferences } = await supabase
            .from('customer_communication_preferences')
            .select('*')
            .eq('customer_email', order.customer_email)
            .single();

          // Check if customer allows order updates
          if (preferences && !preferences.allow_order_updates) {
            console.log(`Customer ${order.customer_email} has opted out of order updates`);
            
            // Mark as processed but skipped
            await supabase
              .from('communication_events')
              .update({
                status: 'sent',
                processed_at: new Date().toISOString()
              })
              .eq('id', event.id);

            processedCount++;
            continue;
          }

          const template = ORDER_STATUS_TEMPLATES[newStatus as keyof typeof ORDER_STATUS_TEMPLATES];
          
          if (!template) {
            throw new Error(`No template found for status: ${newStatus}`);
          }

          // Prepare template variables
          const variables = {
            customer_name: order.customer_name || 'Valued Customer',
            order_number: order.order_number,
            total_amount: `$${order.total_amount}`,
            delivery_address: order.delivery_address || 'N/A',
            pickup_address: commSettings.address || 'Our Location',
            new_status: newStatus
          };

          // Replace variables in template
          let emailHtml = template.template;
          let emailSubject = template.subject;
          
          Object.entries(variables).forEach(([key, value]) => {
            const regex = new RegExp(`{${key}}`, 'g');
            emailHtml = emailHtml.replace(regex, value);
            emailSubject = emailSubject.replace(regex, value);
          });

          // Send email via send-email function
          const emailResponse = await supabase.functions.invoke('send-email', {
            body: {
              to: order.customer_email,
              subject: emailSubject,
              html: emailHtml,
              order_id: event.order_id,
              event_id: event.id
            }
          });

          if (emailResponse.error) {
            throw new Error(`Failed to send email: ${emailResponse.error.message}`);
          }

          processedCount++;
          console.log(`Successfully processed event ${event.id} for order ${order.order_number}`);
        }

      } catch (eventError: any) {
        console.error(`Error processing event ${event.id}:`, eventError);
        errorCount++;

        // Update event with error
        await supabase
          .from('communication_events')
          .update({
            status: 'failed',
            last_error: eventError.message,
            retry_count: supabase.raw('retry_count + 1')
          })
          .eq('id', event.id);
      }
    }

    const response = {
      message: `Processed ${processedCount} events successfully, ${errorCount} errors`,
      processed: processedCount,
      errors: errorCount
    };

    console.log('Communication event processing completed:', response);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('Error in process-communication-events function:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});