import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface ComplianceRequest {
  action: 'check_consent' | 'record_consent' | 'unsubscribe' | 'get_preferences'
  email: string
  data?: {
    type?: string
    source?: string
    ip?: string
    userAgent?: string
    unsubscribeToken?: string
  }
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

    const { action, email, data }: ComplianceRequest = await req.json()

    if (!email) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Email address is required'
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    console.log(`Processing compliance action: ${action} for email: ${email}`)

    switch (action) {
      case 'check_consent':
        return await checkEmailConsent(supabase, email)
      
      case 'record_consent':
        return await recordEmailConsent(supabase, email, data)
      
      case 'unsubscribe':
        return await processUnsubscribe(supabase, email, data)
      
      case 'get_preferences':
        return await getEmailPreferences(supabase, email)
      
      default:
        return new Response(JSON.stringify({
          success: false,
          error: 'Invalid action'
        }), {
          status: 400,
          headers: { 'Content-Type': 'application/json', ...corsHeaders }
        })
    }

  } catch (error) {
    console.error('Compliance manager error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})

async function checkEmailConsent(supabase: any, email: string) {
  // Check for active consent
  const { data: consent } = await supabase
    .from('email_consents')
    .select('*')
    .eq('email_address', email)
    .eq('is_active', true)
    .order('created_at', { ascending: false })
    .limit(1)

  // Check suppression list
  const { data: suppressed } = await supabase
    .from('email_suppression_list')
    .select('*')
    .eq('email_address', email)
    .limit(1)

  const hasConsent = consent && consent.length > 0
  const isSuppressed = suppressed && suppressed.length > 0

  return new Response(JSON.stringify({
    success: true,
    canSendMarketing: hasConsent && !isSuppressed,
    canSendTransactional: !isSuppressed, // Transactional emails don't need explicit consent
    consentDate: hasConsent ? consent[0].created_at : null,
    suppressionReason: isSuppressed ? suppressed[0].reason : null,
    consentType: hasConsent ? consent[0].consent_type : null
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}

async function recordEmailConsent(supabase: any, email: string, data: any = {}) {
  console.log(`Recording consent for email: ${email}`)

  const { error } = await supabase
    .from('email_consents')
    .upsert({
      email_address: email,
      consent_type: data.type || 'marketing',
      consent_source: data.source || 'website',
      ip_address: data.ip || null,
      user_agent: data.userAgent || null,
      is_active: true,
      created_at: new Date().toISOString()
    })

  if (error) {
    console.error('Error recording consent:', error)
    throw error
  }

  // Remove from suppression list if they're re-consenting
  await supabase
    .from('email_suppression_list')
    .delete()
    .eq('email_address', email)
    .eq('reason', 'unsubscribe')

  return new Response(JSON.stringify({ 
    success: true,
    message: 'Consent recorded successfully'
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}

async function processUnsubscribe(supabase: any, email: string, data: any = {}) {
  console.log(`Processing unsubscribe for email: ${email}`)

  // Deactivate all consent
  await supabase
    .from('email_consents')
    .update({ 
      is_active: false, 
      unsubscribed_at: new Date().toISOString() 
    })
    .eq('email_address', email)

  // Add to suppression list
  const { error } = await supabase
    .from('email_suppression_list')
    .upsert({
      email_address: email,
      reason: 'unsubscribe',
      event_data: data || {},
      created_at: new Date().toISOString()
    })

  if (error) {
    console.error('Error processing unsubscribe:', error)
    throw error
  }

  return new Response(JSON.stringify({ 
    success: true, 
    message: 'Successfully unsubscribed from all email communications'
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}

async function getEmailPreferences(supabase: any, email: string) {
  // Get current consent status
  const { data: consents } = await supabase
    .from('email_consents')
    .select('*')
    .eq('email_address', email)
    .order('created_at', { ascending: false })

  // Check suppression status
  const { data: suppressed } = await supabase
    .from('email_suppression_list')
    .select('*')
    .eq('email_address', email)

  const activeConsents = consents?.filter(c => c.is_active) || []
  const isSuppressed = suppressed && suppressed.length > 0

  return new Response(JSON.stringify({
    success: true,
    preferences: {
      email: email,
      marketingEmails: activeConsents.some(c => c.consent_type === 'marketing') && !isSuppressed,
      transactionalEmails: !isSuppressed,
      suppressionReason: isSuppressed ? suppressed[0].reason : null,
      lastConsentDate: activeConsents.length > 0 ? activeConsents[0].created_at : null,
      consents: activeConsents
    }
  }), {
    headers: { 'Content-Type': 'application/json', ...corsHeaders }
  })
}