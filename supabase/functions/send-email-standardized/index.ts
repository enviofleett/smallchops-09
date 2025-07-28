import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface EmailRequest {
  templateId: string
  recipient: {
    email: string
    name?: string
  }
  variables: Record<string, any>
  emailType?: 'marketing' | 'transactional'
  priority?: 'high' | 'normal' | 'low'
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
      templateId, 
      recipient, 
      variables, 
      emailType = 'transactional',
      priority = 'normal'
    }: EmailRequest = await req.json()

    console.log(`Processing email request - Template: ${templateId}, Recipient: ${recipient.email}, Type: ${emailType}`)

    // 1. Validate input
    if (!templateId || !recipient?.email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Template ID and recipient email are required'
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // 2. Check enhanced rate limiting
    const rateLimitResponse = await supabase.functions.invoke('enhanced-email-rate-limiter', {
      body: { 
        identifier: recipient.email, 
        emailType,
        checkOnly: false
      }
    })

    if (rateLimitResponse.error) {
      throw new Error('Failed to check rate limits')
    }

    if (rateLimitResponse.data?.rateLimited) {
      console.log(`Rate limit exceeded for ${recipient.email}`)
      return new Response(JSON.stringify({
        success: false,
        error: 'Rate limit exceeded',
        retryAfter: rateLimitResponse.data.retryAfter
      }), { 
        status: 429, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // 3. Check compliance
    const complianceResponse = await supabase.functions.invoke('email-compliance-manager', {
      body: { 
        action: 'check_consent', 
        email: recipient.email 
      }
    })

    if (complianceResponse.error) {
      throw new Error('Failed to check email compliance')
    }

    const { canSendMarketing, canSendTransactional } = complianceResponse.data

    if (emailType === 'marketing' && !canSendMarketing) {
      console.log(`Cannot send marketing email to ${recipient.email} - no consent or suppressed`)
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot send marketing email - no consent or address suppressed'
      }), { 
        status: 403, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    if (emailType === 'transactional' && !canSendTransactional) {
      console.log(`Cannot send email to ${recipient.email} - address suppressed`)
      return new Response(JSON.stringify({
        success: false,
        error: 'Cannot send email - address suppressed'
      }), { 
        status: 403, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // 4. Get sender configuration
    const { data: senderConfig } = await supabase
      .from('communication_settings')
      .select('sender_email, sender_name')
      .limit(1)
      .single()

    const senderEmail = senderConfig?.sender_email || 'noreply@example.com'
    const senderName = senderConfig?.sender_name || 'Your Business'

    // 5. Standardize variables (convert snake_case to camelCase for consistency)
    const standardizedVariables = standardizeVariables(variables)

    // 6. Add required compliance variables
    const complianceVariables = {
      unsubscribeUrl: `${Deno.env.get('SITE_URL') || 'https://yourdomain.com'}/unsubscribe?email=${encodeURIComponent(recipient.email)}`,
      companyName: senderName,
      companyAddress: '123 Business Street, Business City, BC 12345', // TODO: Get from business settings
      privacyPolicyUrl: `${Deno.env.get('SITE_URL') || 'https://yourdomain.com'}/privacy-policy`
    }

    const finalVariables = {
      ...standardizedVariables,
      ...complianceVariables,
      recipientName: recipient.name || standardizedVariables.customerName || 'Valued Customer'
    }

    // 7. Send email via MailerSend
    const emailPayload = {
      from: {
        email: senderEmail,
        name: senderName
      },
      to: [recipient],
      template_id: templateId,
      variables: [
        {
          email: recipient.email,
          substitutions: Object.entries(finalVariables).map(([key, value]) => ({
            var: key,
            value: String(value || '')
          }))
        }
      ]
    }

    console.log(`Sending email via MailerSend API...`)
    
    const mailersendResponse = await fetch('https://api.mailersend.com/v1/email', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('MAILERSEND_API_TOKEN')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(emailPayload)
    })

    const result = await mailersendResponse.json()

    if (!mailersendResponse.ok) {
      console.error('MailerSend API error:', result)
      throw new Error(`MailerSend API error: ${result.message || 'Unknown error'}`)
    }

    console.log(`Email sent successfully - Message ID: ${result.message_id}`)

    // 8. Log the email event
    await supabase
      .from('communication_events')
      .insert({
        recipient_email: recipient.email,
        template_id: templateId,
        email_type: emailType,
        status: 'sent',
        external_id: result.message_id,
        variables: finalVariables,
        sent_at: new Date().toISOString(),
        created_at: new Date().toISOString()
      })

    return new Response(JSON.stringify({
      success: true,
      messageId: result.message_id,
      status: 'sent'
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('Email sending error:', error)
    
    // Try to log failed attempt if we have the recipient info
    try {
      const { recipient, templateId, emailType, variables } = await req.json()
      if (recipient?.email) {
        const supabase = createClient(
          Deno.env.get('SUPABASE_URL') ?? '',
          Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )
        
        await supabase
          .from('communication_events')
          .insert({
            recipient_email: recipient.email,
            template_id: templateId,
            email_type: emailType || 'transactional',
            status: 'failed',
            error_message: error.message,
            variables: variables,
            sent_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          })
      }
    } catch (logError) {
      console.error('Failed to log error event:', logError)
    }

    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})

function standardizeVariables(variables: Record<string, any>): Record<string, any> {
  const standardized: Record<string, any> = {}
  
  for (const [key, value] of Object.entries(variables)) {
    // Convert snake_case to camelCase for consistency
    const camelKey = key.replace(/_([a-z])/g, (match, letter) => letter.toUpperCase())
    standardized[camelKey] = value
  }
  
  return standardized
}

// Enhanced validation for template variables
function validateTemplateVariables(templateId: string, variables: Record<string, any>): { valid: boolean, missing: string[] } {
  const requiredFields: Record<string, string[]> = {
    'order_confirmation': ['customerName', 'orderNumber', 'orderTotal'],
    'order_status_update': ['customerName', 'orderNumber', 'orderStatus'],
    'price_change_alert': ['customerName', 'productName', 'oldPrice', 'newPrice'],
    'promotion_alert': ['customerName', 'promotionTitle'],
    'welcome': ['customerName'],
    'delivery_notification': ['customerName', 'orderNumber'],
    'order_ready': ['customerName', 'orderNumber'],
    'order_preparing': ['customerName', 'orderNumber'],
    'order_completed': ['customerName', 'orderNumber'],
    'order_cancelled': ['customerName', 'orderNumber']
  }

  const required = requiredFields[templateId] || []
  const missing = required.filter(field => !variables[field])

  return {
    valid: missing.length === 0,
    missing
  }
}