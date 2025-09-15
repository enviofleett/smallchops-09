import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EmailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  priority?: 'high' | 'normal' | 'low';
  metadata?: Record<string, any>;
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

    if (!emailRequest.html && !emailRequest.text) {
      throw new Error('Either html or text content is required');
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get SMTP configuration from environment
    const smtpHost = Deno.env.get('SMTP_HOST');
    const smtpUser = Deno.env.get('SMTP_USER');
    const smtpPass = Deno.env.get('SMTP_PASS');
    const smtpSender = Deno.env.get('SMTP_SENDER_EMAIL');

    if (!smtpHost || !smtpUser || !smtpPass || !smtpSender) {
      throw new Error('Missing SMTP configuration. Please configure SMTP settings.');
    }

    // Create SMTP client configuration
    const smtpConfig = {
      hostname: smtpHost,
      port: 587,
      username: smtpUser,
      password: smtpPass,
    };

    console.log('Attempting SMTP connection with config:', maskSMTPConfig(smtpConfig));

    // Initialize SMTP client
    const client = new SMTPClient(smtpConfig);

    try {
      // Connect to SMTP server
      await client.connect();
      console.log('SMTP connection established successfully');

      // Prepare email content
      const emailContent = {
        from: emailRequest.from || smtpSender,
        to: emailRequest.to,
        subject: emailRequest.subject,
        content: emailRequest.html || emailRequest.text,
        html: emailRequest.html,
      };

      // Add reply-to if specified
      if (emailRequest.replyTo) {
        emailContent['replyTo'] = emailRequest.replyTo;
      }

      console.log(`Sending email to: ${emailRequest.to}, Subject: ${emailRequest.subject}`);

      // Send the email
      await client.send(emailContent);
      
      console.log('Email sent successfully via SMTP');

      // Log successful email
      await supabase.from('audit_logs').insert({
        action: 'smtp_email_sent',
        category: 'Email System',
        message: `Email sent successfully via SMTP to ${emailRequest.to}`,
        new_values: {
          recipient: emailRequest.to,
          subject: emailRequest.subject,
          provider: 'smtp',
          smtp_host: smtpHost,
          priority: emailRequest.priority || 'normal',
          metadata: emailRequest.metadata
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
          recipient: emailRequest.to,
          subject: emailRequest.subject,
          error: smtpError.message,
          smtp_config: maskSMTPConfig(smtpConfig),
          troubleshooting_tips: troubleshooting
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