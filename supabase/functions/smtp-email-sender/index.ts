import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts"

// PRODUCTION CORS - No wildcards
function getCorsHeaders(origin: string | null): Record<string, string> {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',').map(o => o.trim()) || [];
  const isDev = Deno.env.get('DENO_ENV') === 'development';
  
  // Add development origins
  if (isDev) {
    allowedOrigins.push('http://localhost:5173', 'http://localhost:3000');
  }
  
  const isLovableDomain = origin && (
    origin.includes('.lovable.app') || 
    origin.includes('.lovableproject.com') ||
    origin.includes('.lovable.dev') ||
    origin.includes('id-preview--')
  );
  
  const isLocalhost = origin && (
    origin.includes('localhost') || 
    origin.includes('127.0.0.1')
  );
  
  const isExplicitlyAllowed = origin && allowedOrigins.includes(origin);
  
  // More permissive in development
  const shouldAllow = isExplicitlyAllowed || 
    (isDev && (isLovableDomain || isLocalhost)) || 
    (!isDev && isLovableDomain) ||
    allowedOrigins.includes('*');
  
  console.log(`CORS Debug - Origin: ${origin}, Environment vars exist: ALLOWED_ORIGINS=${!!Deno.env.get('ALLOWED_ORIGINS')}, DENO_ENV=${!!Deno.env.get('DENO_ENV')}`);
  console.log(`CORS Analysis - isLovable: ${isLovableDomain}, isLocalhost: ${isLocalhost}, isExplicit: ${isExplicitlyAllowed}, shouldAllow: ${shouldAllow}`);
  
  const allowOrigin = shouldAllow ? (origin || '*') : (isDev ? '*' : 'null');
  console.log(`CORS Result - Access-Control-Allow-Origin: ${allowOrigin}`);
  
  return {
    'Access-Control-Allow-Origin': allowOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
    'Vary': 'Origin'
  };
}

// Rate limiting configuration
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const RATE_LIMIT_MAX_EMAILS = 60; // 60 emails per minute per recipient
const rateLimitMap = new Map<string, { count: number; resetTime: number }>();

// Email validation regex
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface SMTPEmailRequest {
  to: string
  toName?: string
  subject: string
  html?: string
  text?: string
  templateKey?: string
  variables?: Record<string, any>
  emailType?: 'marketing' | 'transactional'
  priority?: 'high' | 'normal' | 'low'
}

interface SMTPConfig {
  smtp_host: string
  smtp_port: number
  smtp_user: string
  smtp_pass: string
  smtp_secure: boolean
  sender_email: string
  sender_name?: string
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  const startTime = Date.now();
  
  console.log(`[${requestId}] Starting SMTP email request processing`);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { 
      to, 
      toName, 
      subject, 
      html, 
      text, 
      templateKey,
      variables = {},
      emailType = 'transactional',
      priority = 'normal'
    }: SMTPEmailRequest = await req.json()

    console.log(`Processing SMTP email request - To: ${to}, Subject: ${subject}, Type: ${emailType}`)

    // 1. Validate input
    if (!to || !subject) {
      console.log(`[${requestId}] Validation failed: missing required fields`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Recipient email and subject are required'
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // Validate email format
    if (!EMAIL_REGEX.test(to)) {
      console.log(`[${requestId}] Invalid email format: ${to}`);
      return new Response(JSON.stringify({
        success: false,
        error: 'Invalid email address format'
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // Rate limiting check
    const now = Date.now();
    const rateLimitKey = to.toLowerCase();
    const currentLimit = rateLimitMap.get(rateLimitKey);
    
    if (currentLimit) {
      if (now < currentLimit.resetTime) {
        if (currentLimit.count >= RATE_LIMIT_MAX_EMAILS) {
          console.log(`[${requestId}] Rate limit exceeded for ${to}`);
          return new Response(JSON.stringify({
            success: false,
            error: 'Rate limit exceeded. Please try again later.'
          }), { 
            status: 429, 
            headers: { 'Content-Type': 'application/json', ...corsHeaders }
          })
        }
        currentLimit.count++;
      } else {
        // Reset the rate limit window
        rateLimitMap.set(rateLimitKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
      }
    } else {
      // First request for this email
      rateLimitMap.set(rateLimitKey, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    }

    // Sanitize inputs to prevent XSS
    const sanitizedVariables = Object.fromEntries(
      Object.entries(variables).map(([key, value]) => [
        key,
        typeof value === 'string' ? value.replace(/<script[^>]*>.*?<\/script>/gi, '') : value
      ])
    );

    // 2. Get SMTP configuration with environment fallback
    let smtpConfig;
    try {
      const { data, error: configError } = await supabase
        .from('communication_settings')
        .select('smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, sender_email, sender_name')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (configError || !data) {
        console.log(`[${requestId}] Database config not found, using environment variables`);
        // Fallback to environment variables
        smtpConfig = {
          smtp_host: Deno.env.get('SMTP_HOST'),
          smtp_port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
          smtp_user: Deno.env.get('SMTP_USER'),
          smtp_pass: Deno.env.get('SMTP_PASS'),
          smtp_secure: Deno.env.get('SMTP_SECURE') === 'true',
          sender_email: Deno.env.get('SENDER_EMAIL'),
          sender_name: Deno.env.get('SENDER_NAME') || 'Starters'
        };
      } else {
        smtpConfig = data;
      }
    } catch (dbError) {
      console.log(`[${requestId}] Database error, using environment fallback:`, dbError);
      smtpConfig = {
        smtp_host: Deno.env.get('SMTP_HOST'),
        smtp_port: parseInt(Deno.env.get('SMTP_PORT') || '587'),
        smtp_user: Deno.env.get('SMTP_USER'),
        smtp_pass: Deno.env.get('SMTP_PASS'),
        smtp_secure: Deno.env.get('SMTP_SECURE') === 'true',
        sender_email: Deno.env.get('SENDER_EMAIL'),
        sender_name: Deno.env.get('SENDER_NAME') || 'Starters'
      };
    }

    if (!smtpConfig.smtp_host || !smtpConfig.smtp_user || !smtpConfig.smtp_pass) {
      console.log(`[${requestId}] SMTP configuration incomplete`);
      throw new Error('SMTP configuration incomplete - missing host, username, or password')
    }

    // 3. Check compliance (reuse existing function)
    const { data: canSend } = await supabase.rpc('can_send_email_to', {
      email_address: to,
      email_type: emailType
    })

    if (!canSend) {
      console.log(`Cannot send email to ${to} - address suppressed or no consent`)
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot send email - address suppressed or no consent'
      }), { 
        status: 403, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // 4. Get business settings for compliance
    const { data: businessSettings } = await supabase
      .from('business_settings')
      .select('name, address, website_url')
      .single()

    const siteUrl = Deno.env.get('SITE_URL') || businessSettings?.website_url || 'https://yourdomain.com'
    
    // 5. Prepare email content
    let emailContent = { html: html || '', text: text || '' }
    
    if (templateKey) {
      // Get template from enhanced_email_templates if templateKey provided
      const { data: template } = await supabase
        .from('enhanced_email_templates')
        .select('subject_template, html_template, text_template, variables')
        .eq('template_key', templateKey)
        .eq('is_active', true)
        .single()

      if (template) {
        // Add compliance variables
        const complianceVariables = {
          unsubscribeUrl: `${siteUrl}/unsubscribe?email=${encodeURIComponent(to)}`,
          companyName: businessSettings?.name || smtpConfig.sender_name || 'Your Business',
          companyAddress: businessSettings?.address || '123 Business Street, Business City, BC 12345',
          privacyPolicyUrl: `${siteUrl}/privacy-policy`,
          siteUrl: siteUrl,
          recipientName: toName || variables.customerName || 'Valued Customer'
        }

        const finalVariables = { ...sanitizedVariables, ...complianceVariables }

        // Simple template replacement
        emailContent.html = replaceTemplateVariables(template.html_template, finalVariables)
        emailContent.text = replaceTemplateVariables(template.text_template || '', finalVariables)
        
        if (!subject) {
          subject = replaceTemplateVariables(template.subject_template, finalVariables)
        }
      }
    }

    // 6. Send email via SMTP with retry logic
    console.log(`[${requestId}] Sending email via SMTP to ${smtpConfig.smtp_host}:${smtpConfig.smtp_port}`)
    console.log(`[${requestId}] SMTP Config: host=${smtpConfig.smtp_host}, port=${smtpConfig.smtp_port}, secure=${smtpConfig.smtp_secure}, user=${smtpConfig.smtp_user}`)
    
    // Validate password is not the same as email
    if (smtpConfig.smtp_pass === smtpConfig.smtp_user) {
      console.log(`[${requestId}] SMTP authentication error: password appears to be same as username`)
      throw new Error('SMTP password cannot be the same as username. Check your database configuration.')
    }

    let messageId: string;
    let smtpResponse: string;
    let client: SMTPClient | null = null;

    // Retry configuration
    const maxRetries = 3;
    const retryDelays = [1000, 2000, 4000]; // Exponential backoff: 1s, 2s, 4s

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        console.log(`[${requestId}] SMTP attempt ${attempt + 1}/${maxRetries} with config: ${smtpConfig.smtp_host}:${smtpConfig.smtp_port} (secure: ${smtpConfig.smtp_secure})`);
        
        // Create SMTP client with timeout
        client = new SMTPClient({
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

        // Send email using the SMTP client
        const result = await Promise.race([
          client.send({
            from: smtpConfig.sender_name 
              ? `${smtpConfig.sender_name} <${smtpConfig.sender_email}>`
              : smtpConfig.sender_email,
            to: toName ? `${toName} <${to}>` : to,
            subject: subject,
            content: emailContent.text || "Email content",
            html: emailContent.html || undefined,
          }),
          new Promise((_, reject) => 
            setTimeout(() => reject(new Error('SMTP timeout after 30 seconds')), 30000)
          )
        ]);

        // Extract message ID from SMTP response or generate one
        messageId = result?.messageId || `smtp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        smtpResponse = `Email sent successfully via SMTP. Message ID: ${messageId}`;
        
        console.log(`[${requestId}] SMTP send result:`, result);
        break; // Success, exit retry loop

      } catch (smtpError) {
        console.error(`[${requestId}] SMTP attempt ${attempt + 1} failed:`, smtpError);
        console.log(`[${requestId}] Error details:`, {
          code: smtpError.code,
          command: smtpError.command,
          response: smtpError.response
        });
        
        // Always try to close the client
        if (client) {
          try {
            await client.close();
          } catch (closeError) {
            console.error(`[${requestId}] Error closing SMTP client:`, closeError);
          }
          client = null;
        }

        // If this was the last attempt, handle the failure
        if (attempt === maxRetries - 1) {
          messageId = `smtp-failed-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
          smtpResponse = `SMTP Error after ${maxRetries} attempts: ${smtpError.message}`;
          
          // Log failed attempt to database (non-blocking)
          try {
            await supabase
              .from('smtp_delivery_logs')
              .insert({
                message_id: messageId,
                recipient_email: to,
                sender_email: smtpConfig.sender_email,
                subject: subject,
                delivery_status: 'failed',
                provider: 'smtp',
                smtp_response: smtpResponse,
                delivery_timestamp: new Date().toISOString(),
                metadata: {
                  requestId,
                  emailType,
                  priority,
                  templateKey: templateKey || null,
                  variables: sanitizedVariables,
                  error: smtpError.message,
                  attempts: maxRetries
                }
              });
          } catch (logError) {
            console.error(`[${requestId}] Failed to log error to database:`, logError);
          }

          throw smtpError; // Re-throw to be handled by outer catch block
        }

        // Wait before retrying (unless it's the last attempt)
        if (attempt < maxRetries - 1) {
          console.log(`[${requestId}] Waiting ${retryDelays[attempt]}ms before retry`);
          await new Promise(resolve => setTimeout(resolve, retryDelays[attempt]));
        }
      } finally {
        // Ensure client is always closed
        if (client) {
          try {
            await client.close();
          } catch (closeError) {
            console.error(`[${requestId}] Error closing SMTP client in finally:`, closeError);
          }
          client = null;
        }
      }
    }

    // 7. Log the successful email event to SMTP delivery logs (non-blocking)
    try {
      await supabase
        .from('smtp_delivery_logs')
        .insert({
          message_id: messageId,
          recipient_email: to,
          sender_email: smtpConfig.sender_email,
          subject: subject,
          delivery_status: 'sent',
          provider: 'smtp',
          smtp_response: smtpResponse,
          delivery_timestamp: new Date().toISOString(),
          metadata: {
            requestId,
            emailType,
            priority,
            templateKey: templateKey || null,
            variables: sanitizedVariables,
            processingTime: Date.now() - startTime
          }
        });
    } catch (logError) {
      console.error(`[${requestId}] Failed to log success to smtp_delivery_logs:`, logError);
      // Don't fail the request if logging fails
    }

    // 8. Also log to communication_events for consistency (non-blocking)
    try {
      await supabase
        .from('communication_events')
        .insert({
          recipient_email: to,
          template_id: templateKey || 'custom',
          email_type: emailType,
          status: 'sent',
          external_id: messageId,
          variables: sanitizedVariables,
          sent_at: new Date().toISOString(),
          delivery_status: 'sent'
        });
    } catch (logError) {
      console.error(`[${requestId}] Failed to log to communication_events:`, logError);
      // Don't fail the request if logging fails
    }

    const processingTime = Date.now() - startTime;
    console.log(`[${requestId}] Email sent successfully in ${processingTime}ms`);

    return new Response(JSON.stringify({
      success: true,
      messageId: messageId,
      status: 'sent',
      provider: 'smtp',
      requestId: requestId,
      processingTime: processingTime
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    const processingTime = Date.now() - startTime;
    console.error(`[${requestId}] SMTP email sending error after ${processingTime}ms:`, error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      requestId: requestId,
      processingTime: processingTime
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})

function replaceTemplateVariables(template: string, variables: Record<string, any>): string {
  let result = template
  
  // Replace {{variable}} patterns
  for (const [key, value] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, 'g')
    result = result.replace(regex, String(value || ''))
  }
  
  // Clean up any remaining unreplaced variables
  result = result.replace(/{{[^}]+}}/g, '')
  
  return result
}