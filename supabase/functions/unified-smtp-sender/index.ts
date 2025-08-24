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
    
    // Write command helper
    const writeCommand = async (command: string): Promise<void> => {
      console.log(`SMTP CMD: ${command}`)
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
    await writeCommand(encodedUsername)
    response = await readResponse()
    if (!response.startsWith('334')) {
      throw new Error(`AUTH username failed: ${response}`)
    }
    
    // Password
    const encodedPassword = btoa(password)
    await writeCommand(encodedPassword)
    response = await readResponse()
    if (!response.startsWith('235')) {
      throw new Error(`AUTH password failed: ${response}`)
    }
    
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
    
    // Extract message ID from response if available
    const messageIdMatch = response.match(/250[- ][\d\w.@-]+/)
    const messageId = messageIdMatch ? messageIdMatch[0].substring(4) : undefined
    
    // QUIT
    await writeCommand('QUIT')
    await readResponse()
    
    return { success: true, messageId }
    
  } catch (error) {
    console.error('SMTP Error:', error)
    return { success: false, error: error.message }
  } finally {
    try {
      conn?.close()
    } catch (e) {
      console.warn('Error closing connection:', e)
    }
  }
}

serve(async (req) => {
  // CORS preflight
  const origin = req.headers.get('origin')
  const corsHeaders = getCorsHeaders(origin)
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }
  
  try {
    const { to, subject, textContent, htmlContent, templateKey, variables } = await req.json()
    
    if (!to || !subject || (!textContent && !htmlContent)) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: to, subject, and content' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }
    
    // Get SMTP settings from Supabase
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    
    const settingsResponse = await fetch(`${supabaseUrl}/rest/v1/communication_settings?use_smtp=eq.true&select=*`, {
      headers: {
        'Authorization': `Bearer ${supabaseKey}`,
        'apikey': supabaseKey
      }
    })
    
    const settings = await settingsResponse.json()
    if (!settings || settings.length === 0) {
      throw new Error('No active SMTP configuration found')
    }
    
    const config = settings[0]
    
    // Send email
    const result = await sendViaSMTP(
      config.smtp_host,
      config.smtp_port,
      config.smtp_secure,
      config.smtp_user,
      config.smtp_pass,
      config.sender_email,
      to,
      subject,
      textContent,
      htmlContent
    )
    
    // Log delivery attempt
    try {
      await fetch(`${supabaseUrl}/rest/v1/rpc/log_email_delivery`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${supabaseKey}`,
          'apikey': supabaseKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          p_message_id: result.messageId || `unified-${Date.now()}`,
          p_recipient_email: to,
          p_subject: subject,
          p_provider: 'unified-smtp',
          p_status: result.success ? 'sent' : 'failed',
          p_smtp_response: result.error || 'Success'
        })
      })
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
    console.error('Function error:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})