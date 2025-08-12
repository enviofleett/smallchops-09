import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Get Turnstile site key from environment
    const turnstileSiteKey = Deno.env.get('TURNSTILE_SITE_KEY')
    
    if (!turnstileSiteKey) {
      console.error('TURNSTILE_SITE_KEY not configured')
      return new Response(
        JSON.stringify({ 
          error: 'CAPTCHA configuration missing',
          siteKey: '1x00000000000000000000AA' // Demo key fallback
        }),
        { 
          status: 200, // Return 200 with demo key for graceful fallback
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        },
      )
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        siteKey: turnstileSiteKey,
        provider: 'cloudflare-turnstile'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  } catch (error) {
    console.error('Error in get-turnstile-key:', error)
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error',
        siteKey: '1x00000000000000000000AA' // Demo key fallback
      }),
      { 
        status: 200, // Graceful fallback
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      },
    )
  }
})