import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface SMTPConfig {
  smtp_host: string;
  smtp_port: number;
  smtp_user: string;
  smtp_pass: string;
  smtp_secure: boolean;
  sender_email: string;
  sender_name?: string;
}

interface EmailRequest {
  to: string;
  subject: string;
  html?: string;
  text?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { to, subject, html, text } = await req.json() as EmailRequest;

    if (!to || !subject) {
      throw new Error('Missing required fields: to, subject');
    }

    // Initialize Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    // Get the authorization header
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      throw new Error('Missing authorization header');
    }

    // Set the auth for the client
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(
      authHeader.replace('Bearer ', '')
    );

    if (authError || !user) {
      throw new Error('Unauthorized');
    }

    console.log('User authenticated:', user.id);

    // Fetch SMTP settings from database
    const { data: smtpSettings, error: settingsError } = await supabaseClient
      .from('communication_settings')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching SMTP settings:', settingsError);
      throw new Error('Failed to fetch SMTP configuration');
    }

    if (!smtpSettings || !smtpSettings.use_smtp) {
      throw new Error('SMTP is not enabled or configured');
    }

    // Validate SMTP configuration
    const config: SMTPConfig = {
      smtp_host: smtpSettings.smtp_host,
      smtp_port: smtpSettings.smtp_port || 587,
      smtp_user: smtpSettings.smtp_user,
      smtp_pass: smtpSettings.smtp_pass,
      smtp_secure: smtpSettings.smtp_secure !== false,
      sender_email: smtpSettings.sender_email,
      sender_name: smtpSettings.sender_name || 'System',
    };

    // Validate required SMTP fields
    if (!config.smtp_host || !config.smtp_user || !config.smtp_pass || !config.sender_email) {
      throw new Error('Incomplete SMTP configuration. Please check host, user, password, and sender email.');
    }

    // Critical validation: ensure password is not same as username
    if (config.smtp_pass === config.smtp_user) {
      throw new Error('SMTP password cannot be the same as username. Please use your actual password or app-specific password.');
    }

    console.log('SMTP Config loaded:', {
      host: config.smtp_host,
      port: config.smtp_port,
      user: config.smtp_user,
      secure: config.smtp_secure,
      sender: config.sender_email,
      // Never log the password for security
    });

    // Import nodemailer dynamically
    const { default: nodemailer } = await import('https://esm.sh/nodemailer@6.9.7');

    // Create transporter with proper configuration
    const transporter = nodemailer.createTransporter({
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_port === 465, // true for 465, false for other ports
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass,
      },
      // Additional options for better compatibility
      tls: {
        ciphers: 'SSLv3',
        rejectUnauthorized: false, // Only use this in development
      },
      // Connection timeout
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    });

    console.log('Transporter created, attempting to send email...');

    // Verify SMTP connection before sending
    try {
      await transporter.verify();
      console.log('SMTP connection verified successfully');
    } catch (verifyError) {
      console.error('SMTP verification failed:', verifyError);
      throw new Error(`SMTP connection failed: ${verifyError.message}`);
    }

    // Prepare email options
    const mailOptions = {
      from: config.sender_name 
        ? `"${config.sender_name}" <${config.sender_email}>`
        : config.sender_email,
      to: to,
      subject: subject,
      html: html,
      text: text || (html ? html.replace(/<[^>]*>/g, '') : ''),
    };

    console.log('Sending email with options:', {
      from: mailOptions.from,
      to: mailOptions.to,
      subject: mailOptions.subject,
    });

    // Send email
    const info = await transporter.sendMail(mailOptions);
    
    console.log('Email sent successfully:', {
      messageId: info.messageId,
      accepted: info.accepted,
      rejected: info.rejected,
    });

    // Close the transporter
    transporter.close();

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageId: info.messageId,
        message: 'Email sent successfully' 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error) {
    console.error('SMTP email sending error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: error.message,
        success: false 
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    );
  }
})