import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// Production-ready CORS configuration
const getCorsHeaders = (origin: string | null): Record<string, string> => {
  const allowedOrigins = Deno.env.get('ALLOWED_ORIGINS')?.split(',') || [
    'https://oknnklksdiqaifhxaccs.supabase.co',
    'https://7d0e93f8-fb9a-4fff-bcf3-b56f4a3f8c37.lovableproject.com'
  ];
  
  const corsOrigin = origin && allowedOrigins.includes(origin) ? origin : allowedOrigins[0];
  
  return {
    'Access-Control-Allow-Origin': corsOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Max-Age': '86400',
  };
};

interface RateLimitRequest {
  identifier: string // email address or user_id
  emailType: 'marketing' | 'transactional'
  checkOnly?: boolean // if true, only check limits without incrementing
}

interface RateLimitResult {
  allowed: boolean
  currentCount: number
  maxAllowed: number
  resetTime: string
  retryAfter?: number
}

Deno.serve(async (req) => {
  const origin = req.headers.get('origin');
  const corsHeaders = getCorsHeaders(origin);
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { identifier, emailType, checkOnly = false }: RateLimitRequest = await req.json()

    if (!identifier || !emailType) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Identifier and emailType are required'
      }), { 
        status: 400, 
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    console.log(`Checking rate limit for ${identifier} - ${emailType}`)

    // Define rate limits based on email type
    const limits = getRateLimits(emailType)
    
    // Check all time windows
    const results = await Promise.all([
      checkRateLimit(supabase, identifier, emailType, 'minute', limits.perMinute, checkOnly),
      checkRateLimit(supabase, identifier, emailType, 'hour', limits.perHour, checkOnly),
      checkRateLimit(supabase, identifier, emailType, 'day', limits.perDay, checkOnly)
    ])

    // Find the most restrictive limit
    const blockedResult = results.find(result => !result.allowed)
    
    if (blockedResult) {
      console.log(`Rate limit exceeded for ${identifier}: ${JSON.stringify(blockedResult)}`)
      return new Response(JSON.stringify({
        success: false,
        rateLimited: true,
        ...blockedResult
      }), {
        status: 429,
        headers: { 'Content-Type': 'application/json', ...corsHeaders }
      })
    }

    // All limits passed
    const result = results.reduce((most, current) => 
      current.currentCount > most.currentCount ? current : most
    )

    console.log(`Rate limit check passed for ${identifier}`)

    return new Response(JSON.stringify({
      success: true,
      rateLimited: false,
      ...result
    }), {
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })

  } catch (error) {
    console.error('Rate limiter error:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), { 
      status: 500, 
      headers: { 'Content-Type': 'application/json', ...corsHeaders }
    })
  }
})

function getRateLimits(emailType: string) {
  if (emailType === 'marketing') {
    return {
      perMinute: 2,    // Very conservative for marketing
      perHour: 10,     // Reasonable hourly limit
      perDay: 50       // Daily marketing limit
    }
  } else {
    return {
      perMinute: 10,   // Higher for transactional emails
      perHour: 100,    // Much higher hourly limit
      perDay: 500      // High daily limit for transactional
    }
  }
}

async function checkRateLimit(
  supabase: any, 
  identifier: string, 
  emailType: string, 
  window: string, 
  maxAllowed: number,
  checkOnly: boolean
): Promise<RateLimitResult> {
  
  const windowMinutes = getWindowMinutes(window)
  const windowStart = new Date(Date.now() - windowMinutes * 60000).toISOString()
  
  // Count existing events in the window
  const { count, error: countError } = await supabase
    .from('communication_events')
    .select('*', { count: 'exact', head: true })
    .eq('recipient_email', identifier)
    .eq('email_type', emailType)
    .gte('sent_at', windowStart)
    .neq('status', 'failed') // Don't count failed sends

  if (countError) {
    console.error('Error counting events:', countError)
    throw new Error(`Failed to check rate limit: ${countError.message}`)
  }

  const currentCount = count || 0
  const allowed = currentCount < maxAllowed

  // If not just checking and limit is not exceeded, record the attempt
  if (!checkOnly && allowed) {
    const { error: insertError } = await supabase
      .from('communication_events')
      .insert({
        recipient_email: identifier,
        email_type: emailType,
        event_type: 'rate_limit_check',
        status: 'sent',
        sent_at: new Date().toISOString(),
        variables: {
          window,
          rate_limit_check: true
        }
      })

    if (insertError) {
      console.error('Error recording rate limit check:', insertError)
      // Don't fail the request for logging errors
    }
  }

  const resetTime = new Date(Date.now() + windowMinutes * 60000).toISOString()
  const retryAfter = allowed ? undefined : windowMinutes * 60

  return {
    allowed,
    currentCount: allowed && !checkOnly ? currentCount + 1 : currentCount,
    maxAllowed,
    resetTime,
    retryAfter
  }
}

function getWindowMinutes(window: string): number {
  switch (window) {
    case 'minute': return 1
    case 'hour': return 60
    case 'day': return 24 * 60
    default: return 60
  }
}