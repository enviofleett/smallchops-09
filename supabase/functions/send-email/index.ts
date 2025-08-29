import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';
import { getCorsHeaders } from '../_shared/cors.ts';

// Nodemailer import for Deno
import nodemailer from 'npm:nodemailer@6.9.13';

interface EmailRequest {
  to: string;
  subject: string;
  text?: string;
  html?: string;
  from?: string;
}

interface SMTPConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
}

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  // Health check endpoint
  if (req.method === 'GET') {
    return new Response(
      JSON.stringify({
        status: 'healthy',
        service: 'send-email',
        implementation: 'nodemailer',
        timestamp: new Date().toISOString()
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }

  // Only allow POST requests for sending emails
  if (req.method !== 'POST') {
    return new Response(
      JSON.stringify({ error: 'Method not allowed' }),
      { 
        status: 405,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }

  try {
    // Parse request body
    const emailData: EmailRequest = await req.json();

    // Validate required fields
    if (!emailData.to || !emailData.subject) {
      return new Response(
        JSON.stringify({ 
          error: 'Missing required fields: to, subject' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    if (!emailData.text && !emailData.html) {
      return new Response(
        JSON.stringify({ 
          error: 'Either text or html content is required' 
        }),
        { 
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        }
      );
    }

    // Get SMTP configuration from environment variables
    const smtpConfig: SMTPConfig = {
      host: Deno.env.get('SMTP_HOST') || 'localhost',
      port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
      secure: Deno.env.get('SMTP_SECURE') === 'true',
      auth: {
        user: Deno.env.get('SMTP_USER') || '',
        pass: Deno.env.get('SMTP_PASS') || ''
      }
    };

    // Validate SMTP configuration
    if (!smtpConfig.auth.user || !smtpConfig.auth.pass) {
      throw new Error('SMTP credentials not configured');
    }

    // Create nodemailer transporter
    const transporter = nodemailer.createTransporter({
      host: smtpConfig.host,
      port: smtpConfig.port,
      secure: smtpConfig.secure,
      auth: smtpConfig.auth,
      // Additional security options
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false
      }
    });

    // Prepare email options
    const mailOptions = {
      from: emailData.from || Deno.env.get('SMTP_FROM') || smtpConfig.auth.user,
      to: emailData.to,
      subject: emailData.subject,
      text: emailData.text,
      html: emailData.html
    };

    // Send email
    const info = await transporter.sendMail(mailOptions);

    // Initialize Supabase client for logging (optional)
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseServiceKey) {
      const supabase = createClient(supabaseUrl, supabaseServiceKey);
      
      // Log successful email delivery
      await supabase
        .from('email_delivery_logs')
        .insert({
          recipient_email: emailData.to,
          subject: emailData.subject,
          status: 'sent',
          message_id: info.messageId,
          provider: 'smtp',
          sent_at: new Date().toISOString()
        })
        .select()
        .maybeSingle();
    }

    // Return success response
    return new Response(
      JSON.stringify({
        success: true,
        messageId: info.messageId,
        message: 'Email sent successfully'
      }),
      { headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error) {
    console.error('Email sending error:', error);

    // Log error to Supabase if configured
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    
    if (supabaseUrl && supabaseServiceKey) {
      try {
        const supabase = createClient(supabaseUrl, supabaseServiceKey);
        const emailData: EmailRequest = await req.clone().json();
        
        await supabase
          .from('email_delivery_logs')
          .insert({
            recipient_email: emailData.to || 'unknown',
            subject: emailData.subject || 'unknown',
            status: 'failed',
            error_message: error.message,
            provider: 'smtp',
            sent_at: new Date().toISOString()
          })
          .select()
          .maybeSingle();
      } catch (logError) {
        console.error('Failed to log error:', logError);
      }
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Failed to send email'
      }),
      { 
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      }
    );
  }
});