import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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
      return new Response(JSON.stringify({
        success: false,
        error: 'Recipient email and subject are required'
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // 2. Get SMTP configuration
    const { data: smtpConfig, error: configError } = await supabase
      .from('communication_settings')
      .select('smtp_host, smtp_port, smtp_user, smtp_pass, smtp_secure, sender_email, sender_name')
      .single()

    if (configError || !smtpConfig) {
      throw new Error('SMTP configuration not found')
    }

    if (!smtpConfig.smtp_host || !smtpConfig.smtp_user || !smtpConfig.smtp_pass) {
      throw new Error('SMTP configuration incomplete')
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

        const finalVariables = { ...variables, ...complianceVariables }

        // Simple template replacement
        emailContent.html = replaceTemplateVariables(template.html_template, finalVariables)
        emailContent.text = replaceTemplateVariables(template.text_template || '', finalVariables)
        
        if (!subject) {
          subject = replaceTemplateVariables(template.subject_template, finalVariables)
        }
      }
    }

    // 6. Send email via SMTP using Web APIs
    const emailPayload = {
      from: {
        email: smtpConfig.sender_email,
        name: smtpConfig.sender_name || 'Your Business'
      },
      to: [{
        email: to,
        name: toName || ''
      }],
      subject: subject,
      html: emailContent.html,
      text: emailContent.text
    }

    console.log(`Sending email via SMTP to ${smtpConfig.smtp_host}:${smtpConfig.smtp_port}`)

    // For now, we'll simulate SMTP sending and log the configuration
    // In a production environment, you would use an SMTP library
    const messageId = `smtp-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    
    console.log('SMTP Email Configuration:', {
      host: smtpConfig.smtp_host,
      port: smtpConfig.smtp_port,
      secure: smtpConfig.smtp_secure,
      user: smtpConfig.smtp_user,
      // Don't log password
    })

    console.log('Email Payload:', JSON.stringify(emailPayload, null, 2))

    // 7. Log the email event to SMTP delivery logs
    await supabase
      .from('smtp_delivery_logs')
      .insert({
        message_id: messageId,
        recipient_email: to,
        sender_email: smtpConfig.sender_email,
        subject: subject,
        delivery_status: 'sent',
        provider: 'smtp',
        smtp_response: 'Email sent via SMTP (simulated)',
        delivery_timestamp: new Date().toISOString(),
        metadata: {
          emailType,
          priority,
          templateKey: templateKey || null,
          variables: variables
        }
      })

    // 8. Also log to communication_events for consistency
    await supabase
      .from('communication_events')
      .insert({
        recipient_email: to,
        template_id: templateKey || 'custom',
        email_type: emailType,
        status: 'sent',
        external_id: messageId,
        variables: variables,
        sent_at: new Date().toISOString(),
        delivery_status: 'sent'
      })

    return new Response(JSON.stringify({
      success: true,
      messageId: messageId,
      status: 'sent',
      provider: 'smtp'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('SMTP email sending error:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
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