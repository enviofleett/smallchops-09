import { serve } from "https://deno.land/std@0.168.0/http/server.ts"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    console.log('🔐 Testing Paystack credentials...')
    
    // Get Paystack secret key from environment
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    
    if (!paystackSecretKey) {
      return new Response(JSON.stringify({
        success: false,
        error: 'PAYSTACK_SECRET_KEY environment variable not found',
        available_env_vars: Object.keys(Deno.env.toObject()).filter(key => key.includes('PAYSTACK')),
        timestamp: new Date().toISOString()
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Check key format
    const keyInfo = {
      prefix: paystackSecretKey.substring(0, 3),
      length: paystackSecretKey.length,
      is_test_key: paystackSecretKey.startsWith('sk_test_'),
      is_live_key: paystackSecretKey.startsWith('sk_live_'),
      last_4: paystackSecretKey.slice(-4)
    }

    console.log('🔑 Key info:', keyInfo)

    // Test the key by making a simple API call to Paystack
    const testResponse = await fetch('https://api.paystack.co/bank', {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json',
      },
    })

    const testData = await testResponse.json()

    return new Response(JSON.stringify({
      success: testResponse.ok,
      key_info: keyInfo,
      api_test_status: testResponse.status,
      api_response: testResponse.ok ? 'API key is valid' : testData,
      timestamp: new Date().toISOString()
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('Credential test failed:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})