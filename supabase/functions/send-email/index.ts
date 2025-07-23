import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  toName?: string;
  subject: string;
  template?: 'order_confirmation' | 'delivery_notification' | 'welcome' | 'order_status_update';
  variables?: Record<string, any>;
  html?: string;
  text?: string;
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-EMAIL] ${step}${detailsStr}`);
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Email function started");

    const apiToken = Deno.env.get("MAILERSEND_API_TOKEN");
    if (!apiToken) {
      throw new Error("MailerSend API token not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { to, toName, subject, template, variables, html, text }: EmailRequest = await req.json();
    
    if (!to || !subject) {
      throw new Error("Missing required fields: 'to' and 'subject'");
    }

    logStep("Processing email request", { to, subject, template });

    let emailHtml = html;
    let emailText = text;

    // Generate content based on template
    if (template && variables) {
      const templates = {
        order_confirmation: {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Order Confirmation</h2>
              <p>Dear ${variables.customerName || 'Customer'},</p>
              <p>Thank you for your order! Your order <strong>#${variables.orderNumber}</strong> has been confirmed.</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Order Details:</h3>
                <p><strong>Order Number:</strong> ${variables.orderNumber}</p>
                <p><strong>Total Amount:</strong> $${variables.totalAmount}</p>
                <p><strong>Order Type:</strong> ${variables.orderType}</p>
                ${variables.deliveryAddress ? `<p><strong>Delivery Address:</strong> ${variables.deliveryAddress}</p>` : ''}
              </div>
              <p>We'll send you updates as your order is prepared.</p>
              <p>Best regards,<br>Your Restaurant Team</p>
            </div>
          `,
          text: `Order Confirmation - Dear ${variables.customerName || 'Customer'}, Thank you for your order! Order #${variables.orderNumber} confirmed. Total: $${variables.totalAmount}. Order Type: ${variables.orderType}.`
        },
        delivery_notification: {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Order Update</h2>
              <p>Dear ${variables.customerName || 'Customer'},</p>
              <p>Your order <strong>#${variables.orderNumber}</strong> status has been updated to: <strong>${variables.status}</strong></p>
              ${variables.status === 'out_for_delivery' ? '<p>🚗 Your order is on its way! Expected delivery time: 20-30 minutes.</p>' : ''}
              ${variables.status === 'ready' ? '<p>📦 Your order is ready for pickup!</p>' : ''}
              ${variables.status === 'delivered' ? '<p>✅ Your order has been delivered. Enjoy your meal!</p>' : ''}
              <p>Order Details:</p>
              <ul>
                <li>Order Number: ${variables.orderNumber}</li>
                <li>Total Amount: $${variables.totalAmount}</li>
                ${variables.estimatedTime ? `<li>Estimated Time: ${variables.estimatedTime}</li>` : ''}
              </ul>
              <p>Thank you for choosing us!</p>
            </div>
          `,
          text: `Order Update - Order #${variables.orderNumber} status: ${variables.status}. ${variables.status === 'out_for_delivery' ? 'Your order is on its way!' : variables.status === 'ready' ? 'Your order is ready for pickup!' : 'Thank you for your order!'}`
        },
        welcome: {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7c3aed;">Welcome to Our Restaurant!</h2>
              <p>Dear ${variables.customerName || 'Customer'},</p>
              <p>Welcome to our restaurant family! We're excited to serve you delicious meals.</p>
              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>🎉 Welcome Offer</h3>
                <p>Use code <strong>WELCOME10</strong> to get 10% off your first order!</p>
              </div>
              <p>Browse our menu and place your first order today. We offer both delivery and pickup options.</p>
              <p>Looking forward to serving you!</p>
              <p>Best regards,<br>Your Restaurant Team</p>
            </div>
          `,
          text: `Welcome! Dear ${variables.customerName || 'Customer'}, Welcome to our restaurant! Use code WELCOME10 for 10% off your first order. We look forward to serving you!`
        },
        order_status_update: {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Order Status Update</h2>
              <p>Dear ${variables.customerName || 'Customer'},</p>
              <p>Your order <strong>#${variables.orderNumber}</strong> status has changed from <em>${variables.oldStatus}</em> to <strong>${variables.newStatus}</strong>.</p>
              ${variables.newStatus === 'cancelled' ? '<p style="color: #dc2626;">We apologize for any inconvenience. If you have questions, please contact us.</p>' : ''}
              ${variables.newStatus === 'preparing' ? '<p>👨‍🍳 Your order is being prepared with care!</p>' : ''}
              ${variables.newStatus === 'confirmed' ? '<p>✅ Your order has been confirmed and will be prepared soon.</p>' : ''}
              <p>Thank you for your patience!</p>
            </div>
          `,
          text: `Order Status Update - Order #${variables.orderNumber} status changed from ${variables.oldStatus} to ${variables.newStatus}.`
        }
      };

      if (templates[template]) {
        emailHtml = templates[template].html;
        emailText = templates[template].text;
      }
    }

    // MailerSend API request
    const emailPayload = {
      from: {
        email: "orders@yourdomain.com", // Replace with your verified domain
        name: "Restaurant Orders"
      },
      to: [
        {
          email: to,
          name: toName || to
        }
      ],
      subject,
      html: emailHtml,
      text: emailText
    };

    logStep("Sending email via MailerSend", { to, subject });

    const response = await fetch("https://api.mailersend.com/v1/email", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiToken}`,
        "X-Requested-With": "XMLHttpRequest"
      },
      body: JSON.stringify(emailPayload)
    });

    const responseData = await response.text();
    logStep("MailerSend response", { status: response.status, data: responseData });

    if (!response.ok) {
      throw new Error(`MailerSend API error: ${response.status} - ${responseData}`);
    }

    // Log email activity to database
    try {
      await supabaseClient.from('audit_logs').insert({
        user_id: null,
        action: 'EMAIL_SENT',
        category: 'Communication',
        entity_type: 'email',
        message: `Email sent to ${to} with subject: ${subject}`,
        new_values: { to, subject, template, success: true }
      });
      logStep("Email activity logged to database");
    } catch (logError) {
      console.error("Failed to log email activity:", logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        messageId: response.headers.get('X-Message-Id')
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in send-email", { message: errorMessage });
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage 
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});