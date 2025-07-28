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
  priority?: 'high' | 'normal' | 'low';
}

const logStep = (step: string, details?: any) => {
  const detailsStr = details ? ` - ${JSON.stringify(details)}` : '';
  console.log(`[SEND-EMAIL-RATE-LIMITED] ${step}${detailsStr}`);
};

const checkRateLimit = async (supabaseClient: any, recipient: string) => {
  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  // Check hourly limit (10 emails per hour per recipient)
  const { count: hourlyCount } = await supabaseClient
    .from('communication_logs')
    .select('*', { count: 'exact', head: true })
    .eq('recipient', recipient)
    .eq('channel', 'email')
    .gte('created_at', oneHourAgo.toISOString());

  if (hourlyCount && hourlyCount >= 10) {
    throw new Error(`Rate limit exceeded: Maximum 10 emails per hour per recipient`);
  }

  // Check daily limit (50 emails per day per recipient)
  const { count: dailyCount } = await supabaseClient
    .from('communication_logs')
    .select('*', { count: 'exact', head: true })
    .eq('recipient', recipient)
    .eq('channel', 'email')
    .gte('created_at', oneDayAgo.toISOString());

  if (dailyCount && dailyCount >= 50) {
    throw new Error(`Rate limit exceeded: Maximum 50 emails per day per recipient`);
  }

  return { hourlyCount: hourlyCount || 0, dailyCount: dailyCount || 0 };
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    logStep("Rate-limited email function started");

    const apiToken = Deno.env.get("MAILERSEND_API_TOKEN");
    if (!apiToken) {
      throw new Error("MailerSend API token not configured");
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
      { auth: { persistSession: false } }
    );

    const { to, toName, subject, template, variables, html, text, priority = 'normal' }: EmailRequest = await req.json();
    
    if (!to || !subject) {
      throw new Error("Missing required fields: 'to' and 'subject'");
    }

    // Email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(to)) {
      throw new Error("Invalid email address format");
    }

    logStep("Processing email request", { to, subject, template, priority });

    // Check rate limits
    const rateLimitInfo = await checkRateLimit(supabaseClient, to);
    logStep("Rate limit check passed", rateLimitInfo);

    // Get dynamic sender configuration
    const { data: commSettings } = await supabaseClient
      .from('communication_settings')
      .select('sender_email, smtp_user, mailersend_domain, mailersend_domain_verified')
      .single();

    let senderEmail = "orders@example.com";
    let senderName = "Restaurant Orders";

    if (commSettings?.sender_email && commSettings?.mailersend_domain_verified) {
      senderEmail = commSettings.sender_email;
      senderName = commSettings.smtp_user || "Restaurant Orders";
    } else if (commSettings?.mailersend_domain && commSettings?.mailersend_domain_verified) {
      senderEmail = `orders@${commSettings.mailersend_domain}`;
      senderName = commSettings.smtp_user || "Restaurant Orders";
    }

    if (!commSettings?.mailersend_domain_verified) {
      logStep("WARNING: Using fallback domain - Please verify your MailerSend domain");
    }

    let emailHtml = html;
    let emailText = text;

    // Generate content based on template with aligned variables
    if (template && variables) {
      const templates = {
        order_confirmation: {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #2563eb;">Order Confirmation</h2>
              <p>Dear ${variables.customer_name || variables.customerName || 'Customer'},</p>
              <p>Thank you for your order! Your order <strong>#${variables.order_number || variables.orderNumber}</strong> has been confirmed.</p>
              <div style="background: #f8fafc; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>Order Details:</h3>
                <p><strong>Order Number:</strong> ${variables.order_number || variables.orderNumber}</p>
                <p><strong>Total Amount:</strong> ${variables.total_amount || variables.totalAmount}</p>
                <p><strong>Order Type:</strong> ${variables.order_type || variables.orderType || 'delivery'}</p>
                ${variables.delivery_address || variables.deliveryAddress ? `<p><strong>Delivery Address:</strong> ${variables.delivery_address || variables.deliveryAddress}</p>` : ''}
              </div>
              <p>We'll send you updates as your order is prepared.</p>
              <p>Best regards,<br>${senderName}</p>
            </div>
          `,
          text: `Order Confirmation - Dear ${variables.customer_name || variables.customerName || 'Customer'}, Thank you for your order! Order #${variables.order_number || variables.orderNumber} confirmed. Total: ${variables.total_amount || variables.totalAmount}. Order Type: ${variables.order_type || variables.orderType || 'delivery'}.`
        },
        delivery_notification: {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #059669;">Order Update</h2>
              <p>Dear ${variables.customer_name || variables.customerName || 'Customer'},</p>
              <p>Your order <strong>#${variables.order_number || variables.orderNumber}</strong> status has been updated to: <strong>${variables.new_status || variables.newStatus || variables.status}</strong></p>
              ${(variables.new_status || variables.newStatus || variables.status) === 'out_for_delivery' ? '<p>🚗 Your order is on its way! Expected delivery time: 20-30 minutes.</p>' : ''}
              ${(variables.new_status || variables.newStatus || variables.status) === 'ready' ? '<p>📦 Your order is ready for pickup!</p>' : ''}
              ${(variables.new_status || variables.newStatus || variables.status) === 'delivered' ? '<p>✅ Your order has been delivered. Enjoy your meal!</p>' : ''}
              <p>Order Details:</p>
              <ul>
                <li>Order Number: ${variables.order_number || variables.orderNumber}</li>
                <li>Total Amount: ${variables.total_amount || variables.totalAmount}</li>
                ${variables.estimated_time || variables.estimatedTime ? `<li>Estimated Time: ${variables.estimated_time || variables.estimatedTime}</li>` : ''}
              </ul>
              <p>Thank you for choosing us!</p>
            </div>
          `,
          text: `Order Update - Order #${variables.order_number || variables.orderNumber} status: ${variables.new_status || variables.newStatus || variables.status}. Thank you for your order!`
        },
        welcome: {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #7c3aed;">Welcome to ${senderName}!</h2>
              <p>Dear ${variables.customer_name || variables.customerName || 'Customer'},</p>
              <p>Welcome to our restaurant family! We're excited to serve you delicious meals.</p>
              <div style="background: #fef3c7; padding: 20px; border-radius: 8px; margin: 20px 0;">
                <h3>🎉 Welcome Offer</h3>
                <p>Use code <strong>WELCOME10</strong> to get 10% off your first order!</p>
              </div>
              <p>Browse our menu and place your first order today. We offer both delivery and pickup options.</p>
              <p>Looking forward to serving you!</p>
              <p>Best regards,<br>${senderName}</p>
            </div>
          `,
          text: `Welcome! Dear ${variables.customer_name || variables.customerName || 'Customer'}, Welcome to ${senderName}! Use code WELCOME10 for 10% off your first order. We look forward to serving you!`
        },
        order_status_update: {
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
              <h2 style="color: #dc2626;">Order Status Update</h2>
              <p>Dear ${variables.customer_name || variables.customerName || 'Customer'},</p>
              <p>Your order <strong>#${variables.order_number || variables.orderNumber}</strong> status has changed from <em>${variables.old_status || variables.oldStatus}</em> to <strong>${variables.new_status || variables.newStatus}</strong>.</p>
              ${(variables.new_status || variables.newStatus) === 'cancelled' ? '<p style="color: #dc2626;">We apologize for any inconvenience. If you have questions, please contact us.</p>' : ''}
              ${(variables.new_status || variables.newStatus) === 'preparing' ? '<p>👨‍🍳 Your order is being prepared with care!</p>' : ''}
              ${(variables.new_status || variables.newStatus) === 'confirmed' ? '<p>✅ Your order has been confirmed and will be prepared soon.</p>' : ''}
              <p>Thank you for your patience!</p>
            </div>
          `,
          text: `Order Status Update - Order #${variables.order_number || variables.orderNumber} status changed from ${variables.old_status || variables.oldStatus} to ${variables.new_status || variables.newStatus}.`
        }
      };

      if (templates[template]) {
        emailHtml = templates[template].html;
        emailText = templates[template].text;
      }
    }

    // MailerSend API request with retry logic
    const emailPayload = {
      from: {
        email: senderEmail,
        name: senderName
      },
      to: [
        {
          email: to,
          name: toName || to
        }
      ],
      subject,
      html: emailHtml,
      text: emailText,
      tags: [`priority:${priority}`, `template:${template || 'custom'}`]
    };

    logStep("Sending email via MailerSend", { to, subject, senderEmail });

    let response;
    let attempt = 0;
    const maxRetries = 3;

    while (attempt < maxRetries) {
      try {
        response = await fetch("https://api.mailersend.com/v1/email", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${apiToken}`,
            "X-Requested-With": "XMLHttpRequest"
          },
          body: JSON.stringify(emailPayload)
        });

        if (response.ok) break;
        
        if (response.status >= 400 && response.status < 500) {
          // Client error - don't retry
          break;
        }
        
        attempt++;
        if (attempt < maxRetries) {
          await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
        }
      } catch (fetchError) {
        attempt++;
        if (attempt >= maxRetries) throw fetchError;
        await new Promise(resolve => setTimeout(resolve, 1000 * attempt));
      }
    }

    const responseData = await response!.text();
    logStep("MailerSend response", { status: response!.status, data: responseData, attempts: attempt + 1 });

    if (!response!.ok) {
      throw new Error(`MailerSend API error: ${response!.status} - ${responseData}`);
    }

    // Enhanced logging with delivery tracking
    try {
      const messageId = response!.headers.get('X-Message-Id');
      
      // Log to audit_logs
      await supabaseClient.from('audit_logs').insert({
        user_id: null,
        action: 'EMAIL_SENT',
        category: 'Communication',
        entity_type: 'email',
        message: `Email sent to ${to} with subject: ${subject}`,
        new_values: { 
          to, 
          subject, 
          template, 
          success: true, 
          messageId,
          senderEmail,
          priority,
          attempts: attempt + 1,
          timestamp: new Date().toISOString()
        }
      });

      // Log to communication_logs for detailed tracking
      await supabaseClient.from('communication_logs').insert({
        channel: 'email',
        recipient: to,
        subject: subject,
        template_name: template || 'custom',
        status: 'sent',
        provider_response: {
          status: response!.status,
          messageId,
          provider: 'mailersend',
          priority,
          attempts: attempt + 1
        }
      });
      
      logStep("Email activity logged to database");
    } catch (logError) {
      console.error("Failed to log email activity:", logError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: "Email sent successfully",
        messageId: response!.headers.get('X-Message-Id'),
        priority,
        attempts: attempt + 1
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logStep("ERROR in send-email-with-rate-limit", { message: errorMessage });
    
    // Enhanced error logging
    try {
      const { to, subject, template } = await req.json().catch(() => ({ to: 'unknown', subject: 'unknown', template: null }));
      
      await supabaseClient.from('communication_logs').insert({
        channel: 'email',
        recipient: to,
        subject: subject,
        template_name: template || 'unknown',
        status: 'failed',
        error_message: errorMessage,
        provider_response: {
          error: errorMessage,
          provider: 'mailersend',
          timestamp: new Date().toISOString()
        }
      });

      await supabaseClient.from('audit_logs').insert({
        user_id: null,
        action: 'EMAIL_FAILED',
        category: 'Communication',
        entity_type: 'email',
        message: `Failed to send email to ${to}: ${errorMessage}`,
        new_values: { to, subject, template, success: false, error: errorMessage }
      });
    } catch (logError) {
      console.error("Failed to log email error:", logError);
    }
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: errorMessage,
        timestamp: new Date().toISOString()
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});