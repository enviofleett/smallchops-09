import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { getPaystackConfig, validatePaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts'

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
    
    // Test environment-specific configuration
    let testResults = []
    const availableEnvVars = Object.keys(Deno.env.toObject()).filter(key => key.includes('PAYSTACK'))
    
    console.log('📋 Available Paystack environment variables:', availableEnvVars)
    
    // Test current environment configuration
    try {
      const envConfig = getPaystackConfig(req)
      const validation = validatePaystackConfig(envConfig)
      
      logPaystackConfigStatus(envConfig)
      
      if (validation.isValid) {
        // Test the current environment key
        const testResponse = await fetch('https://api.paystack.co/bank', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${envConfig.secretKey}`,
            'Content-Type': 'application/json',
          },
        })
        
        const testData = testResponse.ok ? 'API key is valid' : await testResponse.json()
        
        testResults.push({
          environment: envConfig.environment,
          key_type: envConfig.isTestMode ? 'test' : 'live',
          success: testResponse.ok,
          api_status: testResponse.status,
          api_response: testData,
          key_info: {
            prefix: envConfig.secretKey.substring(0, 8),
            length: envConfig.secretKey.length,
            is_test_key: envConfig.secretKey.startsWith('sk_test_'),
            is_live_key: envConfig.secretKey.startsWith('sk_live_'),
            last_4: envConfig.secretKey.slice(-4)
          }
        })
      } else {
        testResults.push({
          environment: envConfig.environment,
          success: false,
          error: 'Configuration validation failed',
          validation_errors: validation.errors
        })
      }
    } catch (envError) {
      console.error('Environment config error:', envError)
      testResults.push({
        environment: 'auto-detect',
        success: false,
        error: envError.message
      })
    }
    
    // Test fallback legacy key if available
    const legacyKey = Deno.env.get('PAYSTACK_SECRET_KEY')
    if (legacyKey) {
      try {
        const testResponse = await fetch('https://api.paystack.co/bank', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${legacyKey}`,
            'Content-Type': 'application/json',
          },
        })
        
        const testData = testResponse.ok ? 'API key is valid' : await testResponse.json()
        
        testResults.push({
          environment: 'legacy_fallback',
          key_type: legacyKey.startsWith('sk_test_') ? 'test' : 'live',
          success: testResponse.ok,
          api_status: testResponse.status,
          api_response: testData,
          key_info: {
            prefix: legacyKey.substring(0, 8),
            length: legacyKey.length,
            is_test_key: legacyKey.startsWith('sk_test_'),
            is_live_key: legacyKey.startsWith('sk_live_'),
            last_4: legacyKey.slice(-4)
          }
        })
      } catch (legacyError) {
        testResults.push({
          environment: 'legacy_fallback',
          success: false,
          error: legacyError.message
        })
      }
    }

    return new Response(JSON.stringify({
      overall_success: testResults.some(result => result.success),
      test_results: testResults,
      available_env_vars: availableEnvVars,
      recommendations: generateRecommendations(testResults, availableEnvVars),
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
      available_env_vars: Object.keys(Deno.env.toObject()).filter(key => key.includes('PAYSTACK')),
      timestamp: new Date().toISOString()
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

function generateRecommendations(testResults: any[], availableEnvVars: string[]): string[] {
  const recommendations = []
  
  const hasWorkingKey = testResults.some(result => result.success)
  
  if (!hasWorkingKey) {
    recommendations.push('❌ No working Paystack keys found. Please check your configuration.')
    
    if (availableEnvVars.length === 0) {
      recommendations.push('🔧 No Paystack environment variables configured. Please add PAYSTACK_SECRET_KEY_TEST and PAYSTACK_SECRET_KEY_LIVE.')
    } else {
      recommendations.push('🔧 Available keys: ' + availableEnvVars.join(', '))
    }
  } else {
    recommendations.push('✅ At least one working Paystack key found.')
  }
  
  const hasTestKey = availableEnvVars.some(key => key.includes('TEST'))
  const hasLiveKey = availableEnvVars.some(key => key.includes('LIVE'))
  
  if (!hasTestKey) {
    recommendations.push('⚠️ No test key configured. Add PAYSTACK_SECRET_KEY_TEST for development.')
  }
  
  if (!hasLiveKey) {
    recommendations.push('⚠️ No live key configured. Add PAYSTACK_SECRET_KEY_LIVE for production.')
  }
  
  if (hasTestKey && hasLiveKey) {
    recommendations.push('🎉 Both test and live keys are configured. Environment switching will work automatically.')
  }
  
  return recommendations
}