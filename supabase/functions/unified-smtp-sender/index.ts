
import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { getCorsHeaders } from '../_shared/cors.ts';

// Enhanced SMTP library with better error handling
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

serve(async (req: Request) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const requestBody = await req.json();
    console.log('📧 Unified SMTP sender request received:', {
      to: requestBody.to,
      templateKey: requestBody.templateKey,
      hasVariables: !!requestBody.variables
    });

    // Enhanced SMTP Configuration with Environment Priority
    let smtpConfig;
    let configSource = 'environment';
    
    // Prioritize environment variables over database settings
    const envHost = Deno.env.get('SMTP_HOST')?.trim();
    const envPort = Deno.env.get('SMTP_PORT')?.trim();
    const envUsername = Deno.env.get('SMTP_USERNAME')?.trim();
    const envPassword = Deno.env.get('SMTP_PASSWORD')?.trim();
    const envSenderEmail = Deno.env.get('SENDER_EMAIL')?.trim();
    const envSenderName = Deno.env.get('SENDER_NAME')?.trim();

    if (envHost && envUsername && envPassword) {
      // Use environment variables (preferred for security)
      smtpConfig = {
        smtp_host: envHost,
        smtp_port: parseInt(envPort || '587'),
        smtp_secure: false, // Always use STARTTLS for port 587
        smtp_user: envUsername,
        smtp_pass: envPassword,
        sender_email: envSenderEmail || envUsername,
        sender_name: envSenderName || 'Starters Small Chops'
      };
      configSource = 'environment';
      
      console.log('🔧 Using environment SMTP configuration');
    } else {
      // Fallback to database settings
      const { data: config } = await supabase
        .from('communication_settings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!config) {
        throw new Error('No SMTP configuration found in environment or database');
      }

      smtpConfig = {
        smtp_host: config.smtp_host?.trim() || 'mail.startersmallchops.com',
        smtp_port: config.smtp_port || 587,
        smtp_secure: config.smtp_secure !== undefined ? config.smtp_secure : false,
        smtp_user: config.smtp_user?.trim() || '',
        smtp_pass: config.smtp_pass?.trim() || '',
        sender_email: config.sender_email?.trim() || config.smtp_user?.trim() || '',
        sender_name: config.sender_name?.trim() || 'Starters Small Chops'
      };
      configSource = 'database';
      
      console.log('📊 Using database SMTP configuration');
    }

    // Enhanced Security Diagnostics (with redacted sensitive info)
    console.log('🔍 SMTP Configuration Diagnostics:', {
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port,
      secure: smtpConfig.smtp_secure,
      useTLS: smtpConfig.smtp_port === 587,
      configSource: configSource,
      senderEmail: smtpConfig.sender_email,
      senderName: smtpConfig.sender_name,
      // Redacted security info
      usernameSet: !!smtpConfig.smtp_user,
      usernameLength: smtpConfig.smtp_user?.length || 0,
      passwordSet: !!smtpConfig.smtp_pass,
      passwordLength: smtpConfig.smtp_pass?.length || 0,
      usernameMatchesSender: smtpConfig.smtp_user === smtpConfig.sender_email
    });

    // Validation checks
    if (!smtpConfig.smtp_host || !smtpConfig.smtp_user || !smtpConfig.smtp_pass) {
      throw new Error(`Invalid SMTP configuration: Missing required fields (host: ${!!smtpConfig.smtp_host}, user: ${!!smtpConfig.smtp_user}, pass: ${!!smtpConfig.smtp_pass})`);
    }

    // Force STARTTLS for port 587, SSL for port 465
    if (smtpConfig.smtp_port === 587) {
      smtpConfig.smtp_secure = false; // Use STARTTLS
    } else if (smtpConfig.smtp_port === 465) {
      smtpConfig.smtp_secure = true; // Use SSL
    }

    console.log(`🔐 Authentication mode: Port ${smtpConfig.smtp_port} with ${smtpConfig.smtp_secure ? 'SSL' : 'STARTTLS'}`);

    // Ensure sender email matches SMTP user for authentication
    const fromAddress = smtpConfig.sender_email || smtpConfig.smtp_user;
    
    // Create SMTP client with enhanced configuration
    const client = new SMTPClient({
      connection: {
        hostname: smtpConfig.smtp_host,
        port: smtpConfig.smtp_port,
        tls: smtpConfig.smtp_secure,
        auth: {
          username: smtpConfig.smtp_user,
          password: smtpConfig.smtp_pass,
        },
      },
    });

    let htmlContent = requestBody.htmlContent || '';
    let textContent = requestBody.textContent || '';
    let subject = requestBody.subject || 'Notification';

    // Template processing if templateKey is provided
    if (requestBody.templateKey) {
      console.log(`📄 Processing template: ${requestBody.templateKey}`);
      
      try {
        const { data: template } = await supabase
          .from('email_templates')
          .select('*')
          .eq('template_key', requestBody.templateKey)
          .eq('is_active', true)
          .maybeSingle();

        if (template) {
          subject = template.subject || subject;
          htmlContent = template.html_content || htmlContent;
          textContent = template.text_content || textContent;
          
          // Variable substitution
          if (requestBody.variables) {
            const variables = requestBody.variables;
            
            // Replace variables in subject, html, and text
            [subject, htmlContent, textContent].forEach((content, index) => {
              if (content) {
                let processed = content;
                Object.keys(variables).forEach(key => {
                  const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g');
                  processed = processed.replace(regex, variables[key] || '');
                });
                
                if (index === 0) subject = processed;
                else if (index === 1) htmlContent = processed;
                else textContent = processed;
              }
            });
          }
          
          console.log(`✅ Template processed: ${template.template_key}`);
        } else {
          console.log(`⚠️ Template not found: ${requestBody.templateKey}, using fallback content`);
        }
      } catch (templateError) {
        console.error('Template processing error:', templateError);
        // Continue with provided content as fallback
      }
    }

    // Prepare email message
    const emailMessage = {
      from: `${smtpConfig.sender_name} <${fromAddress}>`,
      to: requestBody.to,
      subject: subject,
      content: htmlContent || textContent || 'No content provided',
      html: htmlContent || undefined,
    };

    console.log('📤 Sending email:', {
      to: emailMessage.to,
      from: emailMessage.from,
      subject: emailMessage.subject,
      hasHtml: !!emailMessage.html,
      contentLength: emailMessage.content.length
    });

    try {
      // Attempt primary connection
      await client.send(emailMessage);
      console.log('✅ Email sent successfully via primary configuration');

      // Log successful delivery
      await supabase.from('smtp_delivery_logs').insert({
        recipient_email: requestBody.to,
        subject: subject,
        delivery_status: 'sent',
        smtp_response: 'Email sent successfully',
        delivery_timestamp: new Date().toISOString(),
        sender_email: fromAddress,
        provider: 'unified-smtp',
        template_key: requestBody.templateKey || null,
        metadata: {
          smtp_host: smtpConfig.smtp_host,
          smtp_port: smtpConfig.smtp_port,
          config_source: configSource
        }
      });

      return new Response(
        JSON.stringify({
          success: true,
          messageId: `unified-${Date.now()}`,
          provider: 'unified-smtp',
          message: 'Email sent successfully'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } catch (primaryError) {
      console.error('❌ Primary SMTP send failed:', primaryError);
      
      // Check if it's a 535 authentication error on port 587
      if (primaryError.message?.includes('535') && smtpConfig.smtp_port === 587) {
        console.log('🔄 Attempting fallback to port 465 with SSL...');
        
        try {
          // Create fallback client for port 465 (SSL)
          const fallbackClient = new SMTPClient({
            connection: {
              hostname: smtpConfig.smtp_host,
              port: 465,
              tls: true, // Use SSL for port 465
              auth: {
                username: smtpConfig.smtp_user,
                password: smtpConfig.smtp_pass,
              },
            },
          });

          await fallbackClient.send(emailMessage);
          console.log('✅ Email sent successfully via fallback (port 465/SSL)');

          // Log successful delivery with fallback info
          await supabase.from('smtp_delivery_logs').insert({
            recipient_email: requestBody.to,
            subject: subject,
            delivery_status: 'sent',
            smtp_response: 'Email sent via fallback (465/SSL)',
            delivery_timestamp: new Date().toISOString(),
            sender_email: fromAddress,
            provider: 'unified-smtp-fallback',
            template_key: requestBody.templateKey || null,
            metadata: {
              smtp_host: smtpConfig.smtp_host,
              smtp_port: 465,
              config_source: configSource,
              fallback_reason: '535 auth error on 587'
            }
          });

          return new Response(
            JSON.stringify({
              success: true,
              messageId: `unified-fallback-${Date.now()}`,
              provider: 'unified-smtp-fallback',
              message: 'Email sent via fallback configuration'
            }),
            { 
              headers: { ...corsHeaders, 'Content-Type': 'application/json' },
              status: 200 
            }
          );

        } catch (fallbackError) {
          console.error('❌ Fallback SMTP send also failed:', fallbackError);
          throw new Error(`Both primary (587/STARTTLS) and fallback (465/SSL) failed. Primary: ${primaryError.message}, Fallback: ${fallbackError.message}`);
        }
      } else {
        // Re-throw the original error if it's not a 535 on 587
        throw primaryError;
      }
    }

  } catch (error) {
    console.error('💥 Unified SMTP sender error:', error);

    // Log the error
    try {
      const supabase = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
      );

      const requestBody = await req.clone().json().catch(() => ({}));
      
      await supabase.from('smtp_delivery_logs').insert({
        recipient_email: requestBody.to || 'unknown',
        subject: requestBody.subject || 'Unknown',
        delivery_status: 'failed',
        smtp_response: error.message,
        error_message: error.message,
        delivery_timestamp: new Date().toISOString(),
        sender_email: 'system',
        provider: 'unified-smtp',
        template_key: requestBody.templateKey || null,
        metadata: {
          error_type: error.name,
          error_stack: error.stack,
          function: 'unified-smtp-sender'
        }
      });
    } catch (logError) {
      console.error('Failed to log error:', logError);
    }

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        provider: 'unified-smtp',
        troubleshooting: {
          check_credentials: 'Verify SMTP_USERNAME and SMTP_PASSWORD are correct',
          check_2fa: 'If using Gmail/similar, you may need an app password',
          check_permissions: 'Verify the account has SMTP sending permissions',
          check_ip_whitelist: 'Check if Supabase IPs are whitelisted with your provider',
          common_ports: 'Try port 587 (STARTTLS) or 465 (SSL)'
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500 
      }
    );
  }
});
