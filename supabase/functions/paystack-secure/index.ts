import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getCorsHeaders } from '../_shared/cors.ts'

serve(async (req) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'))
  
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.warn('[PAYSTACK-SECURE] DEPRECATED: This function is deprecated. Use secure-payment-processor instead.')
  
  try {
    // Redirect all requests to secure-payment-processor
    const body = await req.text()
    
    const response = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/secure-payment-processor`, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': req.headers.get('Authorization') || ''
      },
      body
    })

    const data = await response.json()
    
    return new Response(
      JSON.stringify(data),
      { 
        status: response.status,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('[PAYSTACK-SECURE] Proxy error:', error)
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Payment service temporarily unavailable. Please try again.',
        deprecated: true
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})