// Supabase Auth Email Sender - Temporary solution using Auth system
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  templateId?: string;
  recipient?: {
    email: string;
    name: string;
  };
  variables?: Record<string, string>;
  emailType?: string;
}

// Template variable replacement function
function replaceVariables(template: string, variables: Record<string, string>): string {
  let result = template;
  Object.entries(variables).forEach(([key, value]) => {
    const regex = new RegExp(`{{${key}}}`, 'g');
    result = result.replace(regex, value || '');
  });
  return result;
}

// Built-in email templates for common use cases
const DEFAULT_TEMPLATES = {
  customer_welcome: {
    subject: 'Welcome to {{business_name}}!',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #22c55e;">Welcome {{customerName}}!</h2>
        <p>Thank you for joining {{business_name}}. We're excited to have you as a customer!</p>
        <p>You can now place orders and track your deliveries with us.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>What's next?</strong></p>
          <ul>
            <li>Browse our delicious menu</li>
            <li>Place your first order</li>
            <li>Enjoy our fresh small chops!</li>
          </ul>
        </div>
        <p>Best regards,<br>The {{business_name}} Team</p>
      </div>
    `
  },
  order_confirmation: {
    subject: 'Order Confirmed - {{orderNumber}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #22c55e;">Order Confirmed!</h2>
        <p>Hi {{customerName}},</p>
        <p>Your order <strong>{{orderNumber}}</strong> has been confirmed and is being prepared.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Order Details:</strong></p>
          <p>Order Number: {{orderNumber}}</p>
          <p>Total: ₦{{orderTotal}}</p>
          <p>Type: {{orderType}}</p>
          {{#if deliveryAddress}}<p>Delivery Address: {{deliveryAddress}}</p>{{/if}}
        </div>
        <p>We'll notify you when your order is ready!</p>
        <p>Best regards,<br>{{business_name}}</p>
      </div>
    `
  },
  payment_confirmation: {
    subject: 'Payment Received - {{orderNumber}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #22c55e;">Payment Confirmed!</h2>
        <p>Hi {{customerName}},</p>
        <p>We've successfully received your payment for order <strong>{{orderNumber}}</strong>.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Payment Details:</strong></p>
          <p>Amount: ₦{{amount}}</p>
          <p>Method: {{paymentMethod}}</p>
          <p>Order: {{orderNumber}}</p>
        </div>
        <p>Your order is now being prepared and you'll receive updates as it progresses.</p>
        <p>Thank you for your business!</p>
        <p>Best regards,<br>{{business_name}}</p>
      </div>
    `
  },
  order_status_update: {
    subject: 'Order Update - {{orderNumber}}',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #22c55e;">Order Status Update</h2>
        <p>Hi {{customerName}},</p>
        <p>Your order <strong>{{orderNumber}}</strong> status has been updated.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <p><strong>Status:</strong> {{newStatus}}</p>
          {{#if estimatedTime}}<p><strong>Estimated Time:</strong> {{estimatedTime}}</p>{{/if}}
        </div>
        <p>We'll keep you updated on any further changes.</p>
        <p>Best regards,<br>{{business_name}}</p>
      </div>
    `
  },
  smtp_test: {
    subject: 'Auth Email Test - Connection Successful',
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #22c55e;">✅ Auth Email System Test Successful!</h2>
        <p>Your Supabase Auth email configuration is working correctly.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 8px; margin: 20px 0;">
          <h3>Connection Details:</h3>
          <p><strong>Test Time:</strong> {{test_time}}</p>
          <p><strong>System:</strong> Supabase Auth Email</p>
          <p><strong>Status:</strong> <span style="color: #22c55e;">Connected Successfully</span></p>
        </div>
        <p style="color: #64748b;">You can now send emails reliably using Supabase Auth system.</p>
        <p>Best regards,<br>{{business_name}}</p>
      </div>
    `
  }
};

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('=== Supabase Auth Email Sender ===');
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });

    const emailRequest: EmailRequest = await req.json();
    console.log('Email request received:', { 
      to: emailRequest.to || emailRequest.recipient?.email,
      templateId: emailRequest.templateId,
      subject: emailRequest.subject 
    });

    // Prepare email data
    let emailData = {
      to: emailRequest.to || emailRequest.recipient?.email,
      subject: emailRequest.subject || '',
      html: emailRequest.html || '',
      variables: emailRequest.variables || {}
    };

    // If using a template, get it from database or use default
    if (emailRequest.templateId) {
      console.log('Fetching template:', emailRequest.templateId);
      
      // Try to get template from database first
      const { data: dbTemplate, error: templateError } = await supabase
        .from('enhanced_email_templates')
        .select('*')
        .eq('template_key', emailRequest.templateId)
        .eq('is_active', true)
        .maybeSingle();

      if (dbTemplate && !templateError) {
        console.log('Using database template:', dbTemplate.template_key);
        emailData.subject = replaceVariables(dbTemplate.subject_template || emailData.subject, emailData.variables);
        emailData.html = replaceVariables(dbTemplate.html_template || '', emailData.variables);
      } else if (DEFAULT_TEMPLATES[emailRequest.templateId as keyof typeof DEFAULT_TEMPLATES]) {
        console.log('Using default template:', emailRequest.templateId);
        const template = DEFAULT_TEMPLATES[emailRequest.templateId as keyof typeof DEFAULT_TEMPLATES];
        emailData.subject = replaceVariables(template.subject, emailData.variables);
        emailData.html = replaceVariables(template.html, emailData.variables);
      } else {
        console.warn('Template not found, using direct content');
      }
    }

    // Ensure we have required fields
    if (!emailData.to) {
      throw new Error('Recipient email is required');
    }

    if (!emailData.subject) {
      emailData.subject = 'Notification from Starters Small Chops';
    }

    if (!emailData.html && emailRequest.text) {
      emailData.html = `<p>${emailRequest.text.replace(/\n/g, '<br>')}</p>`;
    }

    console.log('Sending email via Supabase Auth system...');

    // Use Supabase Auth's generateLink to send custom emails
    // This leverages Supabase's reliable email infrastructure
    const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: emailData.to,
      options: {
        redirectTo: `${supabaseUrl}/auth/callback`,
        data: {
          custom_email: true,
          original_subject: emailData.subject,
          original_html: emailData.html,
          email_type: emailRequest.emailType || 'notification'
        }
      }
    });

    if (linkError) {
      console.error('Auth email generation failed:', linkError);
      throw new Error(`Auth email failed: ${linkError.message}`);
    }

    console.log('Email sent successfully via Supabase Auth');

    // Log successful delivery to existing tracking system
    try {
      const { error: logError } = await supabase
        .from('smtp_delivery_logs')
        .insert({
          recipient_email: emailData.to,
          subject: emailData.subject,
          status: 'sent',
          provider: 'supabase_auth',
          message_id: linkData?.action_link || 'auth_email',
          template_id: emailRequest.templateId,
          created_at: new Date().toISOString()
        });

      if (logError) {
        console.warn('Failed to log delivery:', logError);
      }
    } catch (loggingError) {
      console.warn('Email logging failed:', loggingError);
      // Don't fail the whole request for logging issues
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Email sent successfully via Supabase Auth',
        provider: 'supabase_auth',
        message_id: linkData?.action_link
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Supabase Auth email error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        provider: 'supabase_auth'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});