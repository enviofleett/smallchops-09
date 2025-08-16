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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const { templateId, to, variables = {}, emailType = 'transactional' }: EmailRequest = await req.json();

    console.log('Auth email sender processing:', { templateId, to, emailType });

    if (!templateId || !to) {
      throw new Error('Missing required fields: templateId, to');
    }

    // Try to get template from database first
    let templateData = null;
    try {
      const { data } = await supabaseAdmin
        .from('enhanced_email_templates')
        .select('*')
        .eq('template_key', templateId)
        .eq('is_active', true)
        .maybeSingle();
      
      templateData = data;
    } catch (dbError) {
      console.warn('Database template fetch failed, using default:', dbError.message);
    }

    // Use database template or fallback to default
    const template = templateData || getDefaultTemplate(templateId);
    
    // Get business settings for default variables
    let businessSettings = null;
    try {
      const { data } = await supabaseAdmin
        .from('business_settings')
        .select('name, email, website_url')
        .limit(1)
        .maybeSingle();
      businessSettings = data;
    } catch (error) {
      console.warn('Could not fetch business settings:', error.message);
    }

    // Merge variables with defaults
    const allVariables = {
      business_name: businessSettings?.name || 'Starters Small Chops',
      support_email: businessSettings?.email || 'support@startersmallchops.com',
      store_url: businessSettings?.website_url || 'https://startersmallchops.com',
      ...variables
    };

    // Process template
    const subject = replaceVariables(
      templateData ? templateData.subject_template : template.subject, 
      allVariables
    );
    const html = replaceVariables(
      templateData ? templateData.html_template : template.html, 
      allVariables
    );
    const text = replaceVariables(
      templateData ? templateData.text_template : template.text, 
      allVariables
    );

    console.log('Template processed, invoking SMTP sender...');

    // Send via SMTP sender with fallback
    try {
      const { data: smtpResult, error: smtpError } = await supabaseAdmin.functions.invoke('smtp-email-sender', {
        body: {
          templateId,
          recipient: { email: to, name: allVariables.customerName || 'Customer' },
          variables: allVariables,
          emailType,
          to,
          subject,
          html,
          text
        }
      });

      if (smtpError) {
        console.warn('Primary SMTP failed, trying fallback:', smtpError);
        
        // Fallback to production SMTP sender
        const { data: fallbackResult, error: fallbackError } = await supabaseAdmin.functions.invoke('production-smtp-sender', {
          body: {
            to,
            subject,
            html,
            text,
            templateId,
            variables: allVariables
          }
        });

        if (fallbackError) {
          throw new Error(`Both SMTP senders failed: ${smtpError.message}, ${fallbackError.message}`);
        }

        console.log('Email sent via fallback SMTP');
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Email sent via fallback SMTP',
            method: 'production-smtp-sender'
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Email sent via primary SMTP');
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email sent successfully',
          method: 'smtp-email-sender'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (smtpError) {
      console.error('All SMTP methods failed:', smtpError);
      throw smtpError;
    }

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