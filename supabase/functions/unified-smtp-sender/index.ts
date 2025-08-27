import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getCorsHeaders } from '../_shared/cors.ts'

const CRLF = '\r\n'

// Helper: Quoted-Printable encoding with proper line wrapping
function qpEncode(str: string): string {
  const encoded = str
    .split('')
    .map(char => {
      const code = char.charCodeAt(0)
      if (code > 126 || code < 32 || char === '=') {
        return `=${code.toString(16).toUpperCase().padStart(2, '0')}`
      }
      return char
    })
    .join('')
  
  // Soft line breaks at 76 characters
  const lines = []
  let currentLine = ''
  
  for (let i = 0; i < encoded.length; i++) {
    if (currentLine.length >= 73) { // Leave room for =CRLF
      lines.push(currentLine + '=')
      currentLine = ''
    }
    currentLine += encoded[i]
  }
  if (currentLine) lines.push(currentLine)
  
  return lines.join(CRLF)
}

// Helper: RFC 2047 Q-encoding for headers (Subject, etc.)
function encodeHeaderIfNeeded(value: string): string {
  if (!/[^\x00-\x7F]/.test(value)) return value
  
  const encoded = value
    .split('')
    .map(char => {
      const code = char.charCodeAt(0)
      if (code > 126 || code < 32 || char === '=' || char === '?' || char === '_') {
        return `=${code.toString(16).toUpperCase().padStart(2, '0')}`
      }
      if (char === ' ') return '_'
      return char
    })
    .join('')
  
  return `=?UTF-8?Q?${encoded}?=`
}

// Helper: Extract clean envelope address from header format
function sanitizeEnvelopeAddress(email: string): string {
  const match = email.match(/<([^>]+)>/)
  if (match) return match[1].trim()
  return email.replace(/[<>]/g, '').trim()
}

// Helper: Dot-stuffing for SMTP DATA
function dotStuff(data: string): string {
  return data.replace(/^\.(.*)$/gm, '..$1')
}

// Helper: Generate RFC-compliant MIME message
function buildMimeMessage(
  from: string,
  to: string,
  subject: string,
  textContent?: string,
  htmlContent?: string
): string {
  const messageId = `<${Date.now()}-${Math.random().toString(36).substr(2, 9)}@startersmallchops.com>`
  const date = new Date().toUTCString().replace(/GMT/, '+0000')
  const boundary = `boundary-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
  
  // Headers
  const headers = [
    `Message-ID: ${messageId}`,
    `Date: ${date}`,
    `From: ${from}`,
    `To: ${to}`,
    `Subject: ${encodeHeaderIfNeeded(subject)}`,
    `MIME-Version: 1.0`
  ]
  
  let body = ''
  
  if (textContent && htmlContent) {
    // Multipart/alternative
    headers.push(`Content-Type: multipart/alternative; boundary="${boundary}"`)
    
    body = [
      'This is a multi-part message in MIME format.',
      '',
      `--${boundary}`,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      qpEncode(textContent),
      '',
      `--${boundary}`,
      'Content-Type: text/html; charset=UTF-8',
      'Content-Transfer-Encoding: quoted-printable',
      '',
      qpEncode(htmlContent),
      '',
      `--${boundary}--`
    ].join(CRLF)
  } else if (htmlContent) {
    // HTML only
    headers.push('Content-Type: text/html; charset=UTF-8')
    headers.push('Content-Transfer-Encoding: quoted-printable')
    body = qpEncode(htmlContent)
  } else {
    // Text only
    headers.push('Content-Type: text/plain; charset=UTF-8')
    headers.push('Content-Transfer-Encoding: quoted-printable')
    body = qpEncode(textContent || '')
  }
  
  // RFC-compliant: headers + CRLF + CRLF + body
  return headers.join(CRLF) + CRLF + CRLF + body
}

async function sendViaSMTP(
  host: string,
  port: number,
  secure: boolean,
  username: string,
  password: string,
  from: string,
  to: string,
  subject: string,
  textContent?: string,
  htmlContent?: string
): Promise<{ success: boolean; messageId?: string; error?: string }> {
  
  let conn: Deno.TcpConn | Deno.TlsConn
  
  try {
    console.log(`🔗 Connecting to SMTP server ${host}:${port} (secure: ${secure})`)
    
    // Connect
    if (secure && port === 465) {
      conn = await Deno.connectTls({ hostname: host, port })
    } else {
      conn = await Deno.connect({ hostname: host, port })
    }
    
    const decoder = new TextDecoder()
    const encoder = new TextEncoder()
    
    // Read response helper
    const readResponse = async (): Promise<string> => {
      const buffer = new Uint8Array(4096)
      const n = await conn.read(buffer)
      return decoder.decode(buffer.subarray(0, n || 0))
    }
    
    // Write command helper with sanitized logging
    const writeCommand = async (command: string, sensitive: boolean = false): Promise<void> => {
      if (sensitive) {
        console.log(`SMTP CMD: [REDACTED]`)
      } else {
        console.log(`SMTP CMD: ${command}`)
      }
      await conn.write(encoder.encode(command + CRLF))
    }
    
    // Initial greeting
    let response = await readResponse()
    console.log(`SMTP GREETING: ${response}`)
    if (!response.startsWith('220')) {
      throw new Error(`SMTP greeting failed: ${response}`)
    }
    
    // EHLO
    await writeCommand(`EHLO startersmallchops.com`)
    response = await readResponse()
    console.log(`SMTP EHLO: ${response}`)
    
    // Check capabilities
    const supports8BitMime = response.includes('8BITMIME')
    const supportsStartTls = response.includes('STARTTLS')
    console.log(`SMTP Capabilities - 8BITMIME: ${supports8BitMime}, STARTTLS: ${supportsStartTls}`)
    
    // STARTTLS if needed
    if (!secure && supportsStartTls && port === 587) {
      await writeCommand('STARTTLS')
      response = await readResponse()
      if (!response.startsWith('220')) {
        throw new Error(`STARTTLS failed: ${response}`)
      }
      
      // Upgrade to TLS
      conn = await Deno.startTls(conn, { hostname: host })
      
      // Re-EHLO after STARTTLS
      await writeCommand(`EHLO startersmallchops.com`)
      response = await readResponse()
      console.log(`SMTP EHLO (after STARTTLS): ${response}`)
    }
    
    // AUTH LOGIN
    await writeCommand('AUTH LOGIN')
    response = await readResponse()
    if (!response.startsWith('334')) {
      throw new Error(`AUTH LOGIN failed: ${response}`)
    }
    
    // Username
    const encodedUsername = btoa(username)
    await writeCommand(encodedUsername, true) // Mark as sensitive
    response = await readResponse()
    if (!response.startsWith('334')) {
      throw new Error(`AUTH username failed: ${response}`)
    }
    
    // Password
    const encodedPassword = btoa(password)
    await writeCommand(encodedPassword, true) // Mark as sensitive
    response = await readResponse()
    if (!response.startsWith('235')) {
      throw new Error(`AUTH password failed: ${response}`)
    }
    
    console.log('✅ SMTP authentication successful')
    
    // MAIL FROM (envelope address only)
    const envelopeFrom = sanitizeEnvelopeAddress(from)
    await writeCommand(`MAIL FROM:<${envelopeFrom}>`)
    response = await readResponse()
    if (!response.startsWith('250')) {
      throw new Error(`MAIL FROM failed: ${response}`)
    }
    
    // RCPT TO (envelope address only)
    const envelopeTo = sanitizeEnvelopeAddress(to)
    await writeCommand(`RCPT TO:<${envelopeTo}>`)
    response = await readResponse()
    if (!response.startsWith('250')) {
      throw new Error(`RCPT TO failed: ${response}`)
    }
    
    // DATA
    await writeCommand('DATA')
    response = await readResponse()
    if (!response.startsWith('354')) {
      throw new Error(`DATA command failed: ${response}`)
    }
    
    // Build RFC-compliant MIME message
    let message = buildMimeMessage(from, to, subject, textContent, htmlContent)
    
    // Ensure message ends with CRLF
    if (!message.endsWith(CRLF)) {
      message += CRLF
    }
    
    // Apply dot-stuffing to entire payload
    const stuffedMessage = dotStuff(message)
    
    // Log diagnostic headers (without body content)
    const headerLines = stuffedMessage.split(CRLF + CRLF)[0].split(CRLF)
    console.log('SMTP Message Headers:')
    headerLines.slice(0, 6).forEach(line => console.log(`  ${line}`))
    
    // Send message data
    await conn.write(encoder.encode(stuffedMessage))
    
    // End DATA with CRLF.CRLF
    await writeCommand('.')
    response = await readResponse()
    if (!response.startsWith('250')) {
      throw new Error(`DATA send failed: ${response}`)
    }
    
    console.log('✅ Email sent successfully:', response)
    
    // Extract message ID from response if available
    const messageIdMatch = response.match(/250[- ][\d\w.@-]+/)
    const messageId = messageIdMatch ? messageIdMatch[0].substring(4) : undefined
    
    // QUIT
    await writeCommand('QUIT')
    await readResponse()
    
    return { success: true, messageId }
    
  } catch (error) {
    console.error('❌ SMTP Error:', error)
    return { success: false, error: error.message }
  } finally {
    try {
      conn?.close()
    } catch (e) {
      console.warn('Error closing connection:', e)
    }
  }
}

// Server-side template processing with fallback handling
async function processTemplate(templateKey: string, variables: Record<string, any>, supabaseUrl: string, supabaseKey: string): Promise<{
  subject: string;
  html: string;
  text: string;
} | null> {
  try {
    console.log(`🎨 Processing template: ${templateKey}`)
    
    // Template key normalization - handle common variations
    const normalizedTemplateKey = normalizeTemplateKey(templateKey)
    console.log(`🔄 Normalized template key: ${normalizedTemplateKey}`)
    
    const templateResponse = await fetch(`${supabaseUrl}/rest/v1/enhanced_email_templates?template_key=eq.${normalizedTemplateKey}&is_active=eq.true&select=*`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      }
    })
    
    if (!templateResponse.ok) {
      console.warn(`❌ Template fetch failed: ${templateResponse.status}`)
      return getFallbackTemplate(templateKey, variables)
    }
    
    const templates = await templateResponse.json()
    if (!templates || templates.length === 0) {
      console.warn(`❌ Template not found: ${normalizedTemplateKey}, trying fallback template`)
      return getFallbackTemplate(templateKey, variables)
    }
    
    const template = templates[0]
    console.log(`✅ Template found: ${template.template_name}`)
    
    // Process template variables
    const processText = (text: string): string => {
      if (!text) return ''
      return text.replace(/\{\{(\w+)\}\}/g, (match, variable) => {
        return variables[variable] || match
      })
    }
    
    return {
      subject: processText(template.subject_template),
      html: processText(template.html_template),
      text: processText(template.text_template)
    }
  } catch (error) {
    console.error('❌ Template processing error:', error)
    return getFallbackTemplate(templateKey, variables)
  }
}

// Normalize template keys to handle common variations
function normalizeTemplateKey(templateKey: string): string {
  const mappings: Record<string, string> = {
    'order_confirmed': 'order_confirmation',  // Common mapping
    'order_confirm': 'order_confirmation',
    'confirm_order': 'order_confirmation',
    'payment_confirmed': 'payment_confirmation',
    'user_welcome': 'customer_welcome',
    'welcome_user': 'customer_welcome'
  }
  
  return mappings[templateKey] || templateKey
}

// Provide fallback templates when database templates are not found
function getFallbackTemplate(templateKey: string, variables: Record<string, any>): {
  subject: string;
  html: string;
  text: string;
} {
  console.log(`🔄 Generating fallback template for: ${templateKey}`)
  
  const fallbacks: Record<string, any> = {
    order_confirmed: {
      subject: `Order Confirmation - ${variables.order_number || variables.orderNumber || 'Your Order'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50;">Order Confirmed!</h2>
          <p>Dear ${variables.customer_name || variables.customerName || 'Valued Customer'},</p>
          <p>Thank you for your order! We're excited to confirm that your order <strong>${variables.order_number || variables.orderNumber || ''}</strong> has been received and confirmed.</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Order Details:</h3>
            <p><strong>Order Number:</strong> ${variables.order_number || variables.orderNumber || 'N/A'}</p>
            <p><strong>Total Amount:</strong> ₦${variables.total_amount || variables.totalAmount || 'N/A'}</p>
            <p><strong>Order Type:</strong> ${variables.order_type || variables.orderType || 'Standard'}</p>
          </div>
          <p>We'll keep you updated on your order status. Thank you for choosing us!</p>
          <p>Best regards,<br>The Starter Small Chops Team</p>
        </div>
      `,
      text: `Order Confirmed!\n\nDear ${variables.customer_name || variables.customerName || 'Valued Customer'},\n\nYour order ${variables.order_number || variables.orderNumber || ''} has been confirmed.\n\nTotal Amount: ₦${variables.total_amount || variables.totalAmount || 'N/A'}\n\nThank you for choosing us!\n\nBest regards,\nThe Starter Small Chops Team`
    },
    order_confirmation: {
      subject: `Order Confirmation - ${variables.order_number || variables.orderNumber || 'Your Order'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #2c3e50;">Order Confirmation</h2>
          <p>Dear ${variables.customer_name || variables.customerName || 'Valued Customer'},</p>
          <p>We've received your order and it's being processed!</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Order Summary:</h3>
            <p><strong>Order #:</strong> ${variables.order_number || variables.orderNumber || 'N/A'}</p>
            <p><strong>Amount:</strong> ₦${variables.total_amount || variables.totalAmount || 'N/A'}</p>
          </div>
          <p>We'll notify you when your order is ready!</p>
          <p>Best regards,<br>Starter Small Chops</p>
        </div>
      `,
      text: `Order Confirmation\n\nDear ${variables.customer_name || variables.customerName || 'Valued Customer'},\n\nOrder #: ${variables.order_number || variables.orderNumber || 'N/A'}\nAmount: ₦${variables.total_amount || variables.totalAmount || 'N/A'}\n\nWe'll notify you when ready!\n\nBest regards,\nStarter Small Chops`
    },
    payment_confirmation: {
      subject: `Payment Received - ${variables.order_number || 'Thank You'}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
          <h2 style="color: #27ae60;">Payment Confirmed!</h2>
          <p>Dear ${variables.customer_name || 'Valued Customer'},</p>
          <p>We've received your payment successfully.</p>
          <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <h3 style="margin-top: 0;">Payment Details:</h3>
            <p><strong>Order:</strong> ${variables.order_number || 'N/A'}</p>
            <p><strong>Amount:</strong> ₦${variables.amount || variables.total_amount || 'N/A'}</p>
          </div>
          <p>Your order is now being prepared!</p>
        </div>
      `,
      text: `Payment Confirmed!\n\nOrder: ${variables.order_number || 'N/A'}\nAmount: ₦${variables.amount || variables.total_amount || 'N/A'}\n\nYour order is being prepared!`
    }
  }
  
  // Default fallback if specific template not found
  const defaultFallback = {
    subject: `Notification from Starter Small Chops`,
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #2c3e50;">Hello!</h2>
        <p>Dear ${variables.customer_name || variables.customerName || 'Valued Customer'},</p>
        <p>Thank you for using our service. We'll be in touch soon!</p>
        <p>Best regards,<br>The Starter Small Chops Team</p>
      </div>
    `,
    text: `Hello ${variables.customer_name || variables.customerName || 'Valued Customer'},\n\nThank you for using our service!\n\nBest regards,\nStarter Small Chops`
  }
  
  const template = fallbacks[templateKey] || fallbacks[normalizeTemplateKey(templateKey)] || defaultFallback
  console.log(`✅ Fallback template generated for: ${templateKey}`)
  return template
}

// Email validation and rate limiting
async function validateEmailRequest(to: string, supabaseUrl: string, supabaseKey: string): Promise<{ allowed: boolean; reason?: string }> {
  try {
    // Check suppression list
    const suppressionResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/is_email_suppressed`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ email_address: to })
    })
    
    if (suppressionResponse.ok) {
      const { data: isSuppressed } = await suppressionResponse.json()
      if (isSuppressed) {
        return { allowed: false, reason: 'email_suppressed' }
      }
    }
    
    // Check rate limit
    const rateLimitResponse = await fetch(`${supabaseUrl}/rest/v1/rpc/check_email_rate_limit`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ p_recipient_email: to })
    })
    
    if (rateLimitResponse.ok) {
      const rateLimitResult = await rateLimitResponse.json()
      if (!rateLimitResult.allowed) {
        return { allowed: false, reason: 'rate_limited' }
      }
    }
    
    return { allowed: true }
  } catch (error) {
    console.warn('Validation check failed:', error)
    return { allowed: true } // Allow on validation failure
  }
}

serve(async (req) => {
  // Initialize variables for proper error handling
  let requestBody: any = undefined
  let corsHeaders: Record<string, string>
  
  try {
    // CORS preflight
    const origin = req.headers.get('origin')
    corsHeaders = getCorsHeaders(origin)
    
    if (req.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders, status: 200 })
    }

    console.log('📧 Processing SMTP email request...')
    
    // Robust JSON parsing
    try {
      requestBody = await req.json()
    } catch (parseError) {
      console.error('❌ JSON parsing failed:', parseError)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Invalid JSON payload',
          details: parseError?.message || 'Request body is not valid JSON'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('📦 Raw request payload:', JSON.stringify(requestBody, null, 2))
    
    // Normalize payload - handle different input shapes
    let normalizedPayload: {
      to: string;
      subject?: string;
      textContent?: string;
      htmlContent?: string;
      templateKey?: string;
      templateId?: string;
      variables?: Record<string, any>;
      emailType?: string;
    }
    
    // Handle different payload structures
    if (requestBody.to || requestBody.recipient?.email) {
      normalizedPayload = {
        to: requestBody.to || requestBody.recipient?.email,
        subject: requestBody.subject,
        textContent: requestBody.textContent || requestBody.text,
        htmlContent: requestBody.htmlContent || requestBody.html,
        templateKey: requestBody.templateKey || requestBody.templateId,
        variables: requestBody.variables || {},
        emailType: requestBody.emailType || 'transactional'
      }
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields',
          details: 'Either "to" or "recipient.email" must be provided',
          received_keys: Object.keys(requestBody)
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log('🔄 Normalized payload:', JSON.stringify(normalizedPayload, null, 2))
    
    // Get Supabase credentials and validate them
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    // Validate environment variables first
    if (!supabaseUrl || !supabaseKey) {
      console.error('❌ Missing required environment variables')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Server configuration error',
          details: 'Missing required environment variables'
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Validate email request
    console.log('🔒 Validating email request...')
    const validation = await validateEmailRequest(normalizedPayload.to, supabaseUrl, supabaseKey)
    if (!validation.allowed) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email request blocked',
          reason: validation.reason 
        }),
        { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Process template if templateKey provided
    let finalSubject = normalizedPayload.subject
    let finalTextContent = normalizedPayload.textContent
    let finalHtmlContent = normalizedPayload.htmlContent
    
    if (normalizedPayload.templateKey) {
      console.log(`🎨 Processing template: ${normalizedPayload.templateKey}`)
      const processed = await processTemplate(normalizedPayload.templateKey, normalizedPayload.variables || {}, supabaseUrl, supabaseKey)
      
      if (processed) {
        finalSubject = processed.subject
        finalTextContent = processed.text
        finalHtmlContent = processed.html
        console.log('✅ Template processed successfully')
      } else {
        console.warn('⚠️ Template processing failed, using provided content')
      }
    }
    
    // Final validation
    if (!finalSubject || (!finalTextContent && !finalHtmlContent)) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing content after processing',
          details: 'Subject and at least one content type (text or HTML) required'
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Get SMTP settings from Supabase with environment variable fallback
    console.log('🔧 Fetching SMTP configuration...')
    let config: any = null
    
    try {
      const settingsResponse = await fetch(`${supabaseUrl}/rest/v1/communication_settings?select=*&order=created_at.desc&limit=1`, {
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey
        }
      })
      
      if (settingsResponse.ok) {
        const settings = await settingsResponse.json()
        if (settings && settings.length > 0) {
          config = settings[0]
        }
      }
    } catch (dbError) {
      console.warn('⚠️ Database SMTP config fetch failed, using environment variables:', dbError.message)
    }
    
    // Build SMTP configuration with environment variable fallbacks
    const smtpConfig = {
      smtp_host: (config?.smtp_host) || Deno.env.get('SMTP_HOST') || 'mail.startersmallchops.com',
      smtp_port: (config?.smtp_port) || parseInt(Deno.env.get('SMTP_PORT') || '587'),
      smtp_secure: config?.smtp_secure !== undefined ? config.smtp_secure : false, // Always use STARTTLS for port 587
      smtp_user: (config?.smtp_user) || Deno.env.get('SMTP_USERNAME') || 'store@startersmallchops.com',
      smtp_pass: (config?.smtp_pass) || Deno.env.get('SMTP_PASSWORD') || '',
      sender_email: (config?.sender_email) || Deno.env.get('SENDER_EMAIL') || 'store@startersmallchops.com',
      sender_name: (config?.sender_name) || Deno.env.get('SENDER_NAME') || 'Starter Small Chops'
    }
    
    // Force STARTTLS for port 587 (never use direct SSL)
    if (smtpConfig.smtp_port === 587) {
      smtpConfig.smtp_secure = false
    }
    
    // Validate essential configuration
    if (!smtpConfig.smtp_host || !smtpConfig.smtp_user || !smtpConfig.smtp_pass) {
      console.error('❌ Incomplete SMTP configuration')
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Incomplete SMTP configuration',
          details: 'Missing required SMTP settings (host, user, or password)'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    console.log(`📡 Using SMTP config: ${smtpConfig.smtp_host}:${smtpConfig.smtp_port}`)
    
    // Send email
    console.log('📤 Sending email via SMTP...')
    const result = await sendViaSMTP(
      smtpConfig.smtp_host,
      smtpConfig.smtp_port,
      smtpConfig.smtp_secure,
      smtpConfig.smtp_user,
      smtpConfig.smtp_pass,
      smtpConfig.sender_email,
      normalizedPayload.to,
      finalSubject,
      finalTextContent,
      finalHtmlContent
    )
    
    // Log delivery attempt to smtp_delivery_logs table
    try {
      console.log('📝 Logging email delivery attempt...')
      const logData = {
        email_id: result.messageId || `unified-${Date.now()}`,
        recipient_email: normalizedPayload.to,
        subject: finalSubject,
        delivery_status: result.success ? 'sent' : 'failed',
        provider: 'unified-smtp',
        template_key: normalizedPayload.templateKey || null,
        variables: normalizedPayload.variables || {},
        smtp_response: result.error || 'Success',
        created_at: new Date().toISOString()
      }
      
      const logResponse = await fetch(`${supabaseUrl}/rest/v1/smtp_delivery_logs`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(logData)
      })
      
      if (!logResponse.ok) {
        const errorText = await logResponse.text()
        console.error('Failed to log delivery:', errorText)
      } else {
        console.log('✅ Delivery logged successfully')
      }
    } catch (logError) {
      console.error('Failed to log delivery:', logError)
    }
    
    if (result.success) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Email sent successfully',
          messageId: result.messageId 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    } else {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: result.error 
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
  } catch (error) {
    console.error('❌ SMTP Function error:', error)
    
    // Enhanced error logging
    const errorDetails = {
      message: error.message,
      stack: error.stack,
      requestBody: requestBody ? JSON.stringify(requestBody, null, 2) : 'undefined',
      timestamp: new Date().toISOString()
    }
    
    console.error('💥 Full error context:', JSON.stringify(errorDetails, null, 2))
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        timestamp: new Date().toISOString()
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})