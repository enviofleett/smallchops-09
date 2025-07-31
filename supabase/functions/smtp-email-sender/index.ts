import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'https://esm.sh/nodemailer@6.9.7'

// Environment-aware CORS headers for production
const getAllowedOrigins = () => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS');
  const currentEnv = Deno.env.get('DENO_ENV') || 'development';
  
  if (currentEnv === 'production' && allowedOrigins) {
    return allowedOrigins.split(',').map(origin => origin.trim());
  }
  return ['*']; // Allow all in development
};

const getCorsHeaders = (origin: string | null) => {
  const allowedOrigins = getAllowedOrigins();
  const isLovable = origin?.includes('lovable') || origin?.includes('lovableproject.com');
  const isLocalhost = origin?.includes('localhost') || origin?.includes('127.0.0.1');
  const isExplicitlyAllowed = allowedOrigins.includes(origin || '');
  
  const shouldAllow = allowedOrigins.includes('*') || isLovable || isLocalhost || isExplicitlyAllowed;
  
  return {
    'Access-Control-Allow-Origin': shouldAllow ? (origin || '*') : '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
  };
};

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
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  console.log('SMTP email sender request:', req.method, 'from', origin);
  
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { to, subject, html, text } = await req.json() as EmailRequest;

    if (!to || !subject) {
      throw new Error('Missing required fields: to, subject');
    }

    console.log('Processing email request for:', to);

    // Initialize Supabase client with SERVICE ROLE for system operations
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    console.log('Supabase client initialized with service role');

    // Fetch SMTP settings from database - Fixed query logic
    const { data: smtpSettings, error: settingsError } = await supabaseClient
      .from('communication_settings')
      .select('*')
      .eq('use_smtp', true)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (settingsError) {
      console.error('Error fetching SMTP settings:', settingsError);
      throw new Error(`Failed to fetch SMTP configuration: ${settingsError.message}`);
    }

    if (!smtpSettings) {
      throw new Error('SMTP is not enabled or no active configuration found');
    }

    console.log('SMTP settings loaded successfully for provider:', smtpSettings.email_provider);

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

    // Use statically imported nodemailer to prevent Deno compatibility issues

    // Create transporter with production-ready configuration
    const isProduction = Deno.env.get('DENO_ENV') === 'production';
    
    const transporterConfig: any = {
      host: config.smtp_host,
      port: config.smtp_port,
      secure: config.smtp_port === 465, // true for 465, false for other ports
      auth: {
        user: config.smtp_user,
        pass: config.smtp_pass,
      },
      // Production-ready timeouts
      connectionTimeout: 60000,
      greetingTimeout: 30000,
      socketTimeout: 60000,
    };

    // Add TLS configuration for production SSL/TLS support
    if (config.smtp_port === 587 || (!config.smtp_secure && !isProduction)) {
      transporterConfig.tls = {
        ciphers: 'SSLv3',
        rejectUnauthorized: isProduction,
      };
    }

    const transporter = nodemailer.createTransporter(transporterConfig);

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
        message: 'Email sent successfully',
        accepted: info.accepted,
        rejected: info.rejected
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    );

  } catch (error) {
    console.error('SMTP email sending error:', error);
    
    // Enhanced error logging for production debugging
    const errorDetails = {
      error: error.message,
      success: false,
      timestamp: new Date().toISOString(),
      // Add stack trace in development only
      ...(Deno.env.get('DENO_ENV') !== 'production' && { stack: error.stack })
    };
    
    return new Response(
      JSON.stringify(errorDetails),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    );
  }
})