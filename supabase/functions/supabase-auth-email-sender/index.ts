import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  templateId: string;
  to: string;
  variables: Record<string, any>;
  emailType?: string;
}

// Default templates when database templates are not available
const getDefaultTemplate = (templateId: string): { subject: string; html: string; text: string } => {
  switch (templateId) {
    case 'customer_welcome':
      return {
        subject: 'Welcome to {{business_name}}!',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Welcome {{customerName}}!</h1>
            <p>Thank you for joining {{business_name}}. We're excited to have you as part of our community.</p>
            <p>You can explore our products and services at: <a href="{{store_url}}">{{store_url}}</a></p>
            <p>If you have any questions, feel free to contact us at {{support_email}}.</p>
            <p>Best regards,<br>{{business_name}} Team</p>
          </div>
        `,
        text: `Welcome {{customerName}}!\n\nThank you for joining {{business_name}}. We're excited to have you as part of our community.\n\nVisit us at: {{store_url}}\n\nQuestions? Contact us at {{support_email}}\n\nBest regards,\n{{business_name}} Team`
      };
    
    case 'admin_invitation':
      return {
        subject: 'Admin Invitation - {{companyName}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Admin Invitation</h1>
            <p>You've been invited to join {{companyName}} as an {{role}}.</p>
            <p><a href="{{invitation_url}}" style="background: #007bff; color: white; padding: 10px 20px; text-decoration: none; border-radius: 5px;">Accept Invitation</a></p>
            <p>This invitation will expire in 24 hours.</p>
          </div>
        `,
        text: `Admin Invitation\n\nYou've been invited to join {{companyName}} as an {{role}}.\n\nAccept invitation: {{invitation_url}}\n\nThis invitation will expire in 24 hours.`
      };
    
    case 'order_confirmation':
      return {
        subject: 'Order Confirmation - {{orderNumber}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Order Confirmation</h1>
            <p>Hello {{customerName}},</p>
            <p>Thank you for your order! Your order #{{orderNumber}} has been confirmed.</p>
            <p><strong>Order Total:</strong> {{totalAmount}}</p>
            <p>We'll send you updates as your order is processed.</p>
          </div>
        `,
        text: `Order Confirmation\n\nHello {{customerName}},\n\nThank you for your order! Your order #{{orderNumber}} has been confirmed.\n\nOrder Total: {{totalAmount}}\n\nWe'll send you updates as your order is processed.`
      };
    
    default:
      return {
        subject: 'Notification from {{business_name}}',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h1 style="color: #333;">Notification</h1>
            <p>You have a new notification from {{business_name}}.</p>
          </div>
        `,
        text: `Notification\n\nYou have a new notification from {{business_name}}.`
      };
  }
};

// Template variable replacement
function replaceVariables(template: string, variables: Record<string, any>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, String(value || ''));
  });
  return result;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { to, templateId, templateKey, variables = {}, subject, html, text } = await req.json();

    console.log('Auth Email Sender - routing to native SMTP:', {
      to,
      templateId: templateId || templateKey,
      hasCustomContent: !!(subject || html || text)
    });

    // Route all auth emails through native SMTP system
    const emailData = {
      to,
      templateKey: templateId || templateKey,
      variables,
      emailType: 'transactional'
    };

    // Add custom content if provided
    if (subject) emailData.subject = subject;
    if (html) emailData.html = html;
    if (text) emailData.text = text;

    const { data, error } = await supabase.functions.invoke('unified-smtp-sender', {
      body: emailData
    });

    if (error) {
      throw error;
    }

    console.log('Auth email successfully routed to native SMTP');

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent via native SMTP',
        data
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Auth email sender error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        message: 'Failed to send email'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});