import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.53.0'

// Test Paystack configuration
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    console.log('🧪 Testing Paystack configuration...')
    
    // Check environment variables
    const envVars = {
      PAYSTACK_SECRET_KEY: !!Deno.env.get('PAYSTACK_SECRET_KEY'),
      PAYSTACK_PUBLIC_KEY: !!Deno.env.get('PAYSTACK_PUBLIC_KEY'),
      PAYSTACK_WEBHOOK_SECRET: !!Deno.env.get('PAYSTACK_WEBHOOK_SECRET'),
      PAYSTACK_SECRET_KEY_TEST: !!Deno.env.get('PAYSTACK_SECRET_KEY_TEST'),
      PAYSTACK_SECRET_KEY_LIVE: !!Deno.env.get('PAYSTACK_SECRET_KEY_LIVE'),
    }
    
    console.log('📋 Environment variables status:', envVars)
    
    // Check database configuration
    const { data: config, error } = await supabase
      .from('environment_config')
      .select('*')
      .single()
    
    console.log('💾 Database config:', { config, error })
    
    // Test actual Paystack API call
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY') || Deno.env.get('PAYSTACK_SECRET_KEY_TEST')
    
    if (!secretKey) {
      throw new Error('No Paystack secret key found')
    }
    
    console.log('🔑 Using key:', secretKey.substring(0, 10) + '...')
    
    // Test Paystack API
    const testResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email: 'test@example.com',
        amount: 100000, // 1000 NGN in kobo
        reference: `test_${Date.now()}`,
      })
    })
    
    const paystackResult = await testResponse.json()
    console.log('🎯 Paystack API test:', paystackResult)
    
    return new Response(JSON.stringify({
      success: true,
      environment_variables: envVars,
      database_config: config,
      paystack_test: {
        status: testResponse.status,
        result: paystackResult
      }
    }, null, 2), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('❌ Configuration test failed:', error)
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }, null, 2), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})