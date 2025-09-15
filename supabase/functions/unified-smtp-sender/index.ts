import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to?: string;
  subject?: string;
  html?: string;
  text?: string;
  content?: string;
  from?: string;
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
  metadata?: Record<string, any>;
  // Template-based email fields
  recipient_email?: string;
  email?: string;
  template_key?: string;
  template_variables?: Record<string, any>;
}

// Helper function to mask SMTP config for logging
function maskSMTPConfig(config: any) {
  return {
    ...config,
    username: config.username ? config.username.replace(/.(?=.{2})/g, '*') : undefined,
    password: config.password ? '***MASKED***' : undefined
  };
}

// Helper function to provide troubleshooting guidance
function troubleshootingGuide(error: any) {
  let tips = [];
  if (error && error.code === 'ECONNECTION') {
    tips.push('Check SMTP host and port configuration.');
    tips.push('If using port 587, ensure STARTTLS is enabled on provider.');
    tips.push('Try alternate SMTP provider host if available.');
  }
  if (error && error.code === 'EAUTH') {
    tips.push('Validate SMTP username and password.');
    tips.push('Check sender email matches provider requirements.');
  }
  tips.push('See runbook for escalation steps.');
  return tips.join(' ');
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const emailRequest: EmailRequest = await req.json();
    
    // Handle different request formats - both direct and template-based
    console.log('📧 Raw email request:', JSON.stringify(emailRequest, null, 2));
    
    // Extract email fields from different possible formats
    const emailTo = emailRequest.to || emailRequest.recipient_email || emailRequest.email;
    const emailSubject = emailRequest.subject || emailRequest.template_key || 'Order Notification';
    const emailContent = emailRequest.content || emailRequest.html || emailRequest.text || '';
    
    console.log('📧 Extracted fields:', { 
      to: emailTo, 
      subject: emailSubject, 
      hasContent: !!emailContent,
      templateKey: emailRequest.template_key,
      hasVariables: !!emailRequest.template_variables
    });
    
    // Validate required fields
    if (!emailTo) {
      throw new Error('Missing required field: recipient email (to/recipient_email/email)');
    }
    
    if (!emailSubject && !emailRequest.template_key) {
      throw new Error('Missing required field: subject or template_key');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get SMTP configuration from database first, fallback to env vars
    let smtpConfig;
    try {
      const { data: commSettings } = await supabase
        .from('communication_settings')
        .select('*')
        .eq('use_smtp', true)
        .single();
        
      if (commSettings) {
        smtpConfig = {
          hostname: commSettings.smtp_host,
          port: commSettings.smtp_port || 587,
          username: commSettings.smtp_user,
          password: commSettings.smtp_pass,
          senderEmail: commSettings.sender_email,
          senderName: commSettings.sender_name || 'Starters'
        };
        console.log('✅ Using SMTP config from database:', { 
          host: smtpConfig.hostname, 
          port: smtpConfig.port,
          sender: smtpConfig.senderEmail 
        });
      }
    } catch (dbError) {
      console.warn('Failed to get SMTP config from database:', dbError);
    }

    // Fallback to environment variables
    if (!smtpConfig) {
      const smtpHost = Deno.env.get('SMTP_HOST');
      const smtpUser = Deno.env.get('SMTP_USER');
      const smtpPass = Deno.env.get('SMTP_PASS');
      const smtpSender = Deno.env.get('SMTP_SENDER_EMAIL');

      if (!smtpHost || !smtpUser || !smtpPass || !smtpSender) {
        throw new Error('Missing SMTP configuration in both database and environment variables');
      }

      smtpConfig = {
        hostname: smtpHost,
        port: 587,
        username: smtpUser,
        password: smtpPass,
        senderEmail: smtpSender,
        senderName: 'Starters'
      };
    }

    // Prepare email content - handle template-based emails
    let finalSubject = emailSubject;
    let finalContent = emailContent;
    
    // If template-based email, generate content from template
    if (emailRequest.template_key && emailRequest.template_variables) {
      console.log('📧 Processing template-based email:', emailRequest.template_key);
      
      // Generate content based on template key
      switch (emailRequest.template_key) {
        case 'order_status_update':
          const vars = emailRequest.template_variables;
          finalSubject = `Order ${vars.orderNumber || 'Update'} - Status Updated`;
          finalContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">Order Status Update</h2>
              <p>Dear ${vars.customerName || 'Customer'},</p>
              <p>Your order <strong>#${vars.orderNumber || 'N/A'}</strong> status has been updated to:</p>
              <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 15px 0;">
                <strong style="color: #f59e0b; font-size: 18px;">${vars.newStatus || 'Updated'}</strong>
              </div>
              <p><strong>Order Date:</strong> ${vars.orderDate ? new Date(vars.orderDate).toLocaleDateString() : 'N/A'}</p>
              <p>We'll keep you updated on any further changes to your order.</p>
              <hr style="margin: 20px 0; border: none; border-top: 1px solid #eee;">
              <p style="color: #666; font-size: 14px;">Thank you for choosing Starters!</p>
              <p style="color: #666; font-size: 12px;">If you have any questions, please contact us.</p>
            </div>
          `;
          break;
        case 'order_confirmation':
          const confVars = emailRequest.template_variables;
          finalSubject = `Order Confirmation - ${confVars.orderNumber || 'Thank you!'}`;
          finalContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333; border-bottom: 2px solid #22c55e; padding-bottom: 10px;">Order Confirmed!</h2>
              <p>Dear ${confVars.customerName || 'Customer'},</p>
              <p>Thank you for your order! We've received it and are now processing it.</p>
              <div style="background: #f0f9ff; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #22c55e;">
                <p><strong>Order Number:</strong> ${confVars.orderNumber || 'N/A'}</p>
                <p><strong>Total Amount:</strong> ₦${confVars.totalAmount || '0'}</p>
              </div>
              <p>We'll keep you updated on your order status via email and SMS.</p>
              <p style="color: #666; margin-top: 20px;">Thank you for choosing Starters!</p>
            </div>
          `;
          break;
        case 'order_ready':
          const readyVars = emailRequest.template_variables;
          finalSubject = `Order Ready - ${readyVars.orderNumber || 'Ready for pickup!'}`;
          finalContent = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
              <h2 style="color: #333; border-bottom: 2px solid #3b82f6; padding-bottom: 10px;">Order Ready!</h2>
              <p>Great news ${readyVars.customerName || 'Customer'}!</p>
              <p>Your order <strong>#${readyVars.orderNumber || 'N/A'}</strong> is ready.</p>
              <div style="background: #ecfdf5; padding: 15px; border-radius: 5px; margin: 15px 0; border-left: 4px solid #22c55e;">
                <p style="margin: 0; color: #166534; font-weight: bold;">✅ Your order is ready for ${readyVars.orderType === 'delivery' ? 'delivery' : 'pickup'}!</p>
              </div>
              <p>Thank you for your business!</p>
            </div>
          `;
          break;
        default:
          finalSubject = emailSubject || `Notification from Starters`;
          finalContent = emailContent || `<p>You have a new notification.</p>`;
      }
    }

    console.log('📧 Final email details:', { 
      to: emailTo, 
      subject: finalSubject, 
      contentLength: finalContent.length 
    });

    console.log('Attempting SMTP connection with config:', maskSMTPConfig(smtpConfig));

    // Initialize SMTP client
    const client = new SMTPClient({
      hostname: smtpConfig.hostname,
      port: smtpConfig.port,
      username: smtpConfig.username,
      password: smtpConfig.password,
    });

    try {
      // Connect to SMTP server
      await client.connect();
      console.log('SMTP connection established successfully');

      // Prepare email content
      const emailContentObj = {
        from: emailRequest.from || `${smtpConfig.senderName} <${smtpConfig.senderEmail}>`,
        to: emailTo,
        subject: finalSubject,
        content: finalContent,
        html: finalContent,
      };

      // Add reply-to if specified
      if (emailRequest.replyTo) {
        emailContentObj['replyTo'] = emailRequest.replyTo;
      }

      console.log(`Sending email to: ${emailTo}, Subject: ${finalSubject}`);

      // Send the email
      await client.send(emailContentObj);
      
      console.log('Email sent successfully via SMTP');

      // Log successful email
      await supabase.from('audit_logs').insert({
        action: 'smtp_email_sent',
        category: 'Email System',
        message: `Email sent successfully via SMTP to ${emailTo}`,
        new_values: {
          recipient: emailTo,
          subject: finalSubject,
          provider: 'smtp',
          smtp_host: smtpConfig.hostname,
          priority: emailRequest.priority || 'normal',
          metadata: emailRequest.metadata,
          template_key: emailRequest.template_key
        }
      });

      return new Response(JSON.stringify({
        success: true,
        message: 'Email sent successfully via SMTP',
        messageId: `smtp-${Date.now()}`,
        provider: 'smtp',
        timestamp: new Date().toISOString()
      }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });

    } catch (smtpError) {
      console.error('SMTP sending failed:', smtpError);
      
      // Log the error with troubleshooting guidance
      const troubleshooting = troubleshootingGuide(smtpError);
      
      await supabase.from('audit_logs').insert({
        action: 'smtp_email_failed',
        category: 'Email System',
        message: `SMTP email failed: ${smtpError.message}`,
        new_values: {
          recipient: emailTo,
          subject: finalSubject,
          error: smtpError.message,
          smtp_config: maskSMTPConfig(smtpConfig),
          troubleshooting_tips: troubleshooting,
          template_key: emailRequest.template_key
        }
      });

      return new Response(JSON.stringify({
        success: false,
        error: `SMTP delivery failed: ${smtpError.message}`,
        troubleshooting_tips: troubleshooting,
        provider: 'smtp',
        timestamp: new Date().toISOString()
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...corsHeaders,
        },
      });
    } finally {
      // Always close the SMTP connection
      try {
        await client.close();
        console.log('SMTP connection closed');
      } catch (closeError) {
        console.warn('Warning: Failed to close SMTP connection:', closeError);
      }
    }

  } catch (error) {
    console.error('Email processing error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        ...corsHeaders,
      },
    });
  }
};

serve(handler);