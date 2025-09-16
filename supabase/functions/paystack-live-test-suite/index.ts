import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { getPaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface TestResult {
  test_name: string
  status: 'pass' | 'fail' | 'skip'
  message: string
  details?: any
  duration_ms?: number
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    console.log('🧪 Starting Paystack Live Test Suite...')
    
    const testResults: TestResult[] = []
    const testStartTime = Date.now()

    // Test 1: Configuration Validation
    console.log('🔧 Test 1: Configuration Validation')
    const testStart1 = Date.now()
    try {
      const paystackConfig = getPaystackConfig(req)
      logPaystackConfigStatus(paystackConfig)

      if (!paystackConfig.secretKey) {
        testResults.push({
          test_name: 'configuration_validation',
          status: 'fail',
          message: 'No secret key found',
          duration_ms: Date.now() - testStart1
        })
      } else if (paystackConfig.secretKey.startsWith('sk_test_')) {
        testResults.push({
          test_name: 'configuration_validation',
          status: 'fail',
          message: 'Using test keys instead of live keys',
          details: { key_type: 'test', environment: paystackConfig.environment },
          duration_ms: Date.now() - testStart1
        })
      } else {
        testResults.push({
          test_name: 'configuration_validation',
          status: 'pass',
          message: 'Live configuration validated successfully',
          details: { 
            environment: paystackConfig.environment,
            has_webhook_secret: !!paystackConfig.webhookSecret
          },
          duration_ms: Date.now() - testStart1
        })
      }
    } catch (error) {
      testResults.push({
        test_name: 'configuration_validation',
        status: 'fail',
        message: `Configuration error: ${error.message}`,
        duration_ms: Date.now() - testStart1
      })
    }

    // Test 2: Database Connectivity
    console.log('🗄️ Test 2: Database Connectivity')
    const testStart2 = Date.now()
    try {
      const { data, error } = await supabase
        .from('payment_transactions')
        .select('id')
        .limit(1)

      if (error) {
        testResults.push({
          test_name: 'database_connectivity',
          status: 'fail',
          message: `Database error: ${error.message}`,
          duration_ms: Date.now() - testStart2
        })
      } else {
        testResults.push({
          test_name: 'database_connectivity',
          status: 'pass',
          message: 'Database connection successful',
          duration_ms: Date.now() - testStart2
        })
      }
    } catch (error) {
      testResults.push({
        test_name: 'database_connectivity',
        status: 'fail',
        message: `Database connection failed: ${error.message}`,
        duration_ms: Date.now() - testStart2
      })
    }

    // Test 3: Paystack API Connectivity
    console.log('💳 Test 3: Paystack API Connectivity')
    const testStart3 = Date.now()
    try {
      const paystackConfig = getPaystackConfig(req)
      
      if (!paystackConfig.secretKey) {
        testResults.push({
          test_name: 'paystack_api_connectivity',
          status: 'skip',
          message: 'No secret key available for API test',
          duration_ms: Date.now() - testStart3
        })
      } else {
        // Test Paystack API by fetching banks
        const response = await fetch('https://api.paystack.co/bank', {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${paystackConfig.secretKey}`,
            'Content-Type': 'application/json'
          }
        })

        if (response.ok) {
          const data = await response.json()
          testResults.push({
            test_name: 'paystack_api_connectivity',
            status: 'pass',
            message: 'Paystack API connection successful',
            details: { 
              banks_count: data.data?.length || 0,
              api_mode: paystackConfig.secretKey.startsWith('sk_test_') ? 'test' : 'live'
            },
            duration_ms: Date.now() - testStart3
          })
        } else {
          const errorData = await response.text()
          testResults.push({
            test_name: 'paystack_api_connectivity',
            status: 'fail',
            message: `Paystack API error: ${response.status}`,
            details: { error_response: errorData },
            duration_ms: Date.now() - testStart3
          })
        }
      }
    } catch (error) {
      testResults.push({
        test_name: 'paystack_api_connectivity',
        status: 'fail',
        message: `Paystack API test failed: ${error.message}`,
        duration_ms: Date.now() - testStart3
      })
    }

    // Test 4: Webhook URL Accessibility
    console.log('🔗 Test 4: Webhook URL Accessibility')
    const testStart4 = Date.now()
    try {
      const webhookUrl = 'https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/enhanced-paystack-webhook'
      
      // Make a test request to the webhook (should return method not allowed for GET)
      const response = await fetch(webhookUrl, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' }
      })

      // We expect a 405 Method Not Allowed, which means the endpoint is accessible
      if (response.status === 405) {
        testResults.push({
          test_name: 'webhook_accessibility',
          status: 'pass',
          message: 'Webhook URL is accessible',
          details: { webhook_url: webhookUrl },
          duration_ms: Date.now() - testStart4
        })
      } else {
        testResults.push({
          test_name: 'webhook_accessibility',
          status: 'fail',
          message: `Unexpected webhook response: ${response.status}`,
          details: { webhook_url: webhookUrl, status: response.status },
          duration_ms: Date.now() - testStart4
        })
      }
    } catch (error) {
      testResults.push({
        test_name: 'webhook_accessibility',
        status: 'fail',
        message: `Webhook test failed: ${error.message}`,
        duration_ms: Date.now() - testStart4
      })
    }

    // Test 5: Production Metrics Logging
    console.log('📊 Test 5: Production Metrics Logging')
    const testStart5 = Date.now()
    try {
      const { error } = await supabase.rpc('log_production_metric', {
        p_metric_name: 'test_suite_run',
        p_metric_value: 1,
        p_metric_type: 'counter',
        p_dimensions: { test_timestamp: new Date().toISOString() }
      })

      if (error) {
        testResults.push({
          test_name: 'production_metrics_logging',
          status: 'fail',
          message: `Metrics logging failed: ${error.message}`,
          duration_ms: Date.now() - testStart5
        })
      } else {
        testResults.push({
          test_name: 'production_metrics_logging',
          status: 'pass',
          message: 'Production metrics logging successful',
          duration_ms: Date.now() - testStart5
        })
      }
    } catch (error) {
      testResults.push({
        test_name: 'production_metrics_logging',
        status: 'fail',
        message: `Metrics test failed: ${error.message}`,
        duration_ms: Date.now() - testStart5
      })
    }

    // Compile test summary
    const totalTests = testResults.length
    const passedTests = testResults.filter(r => r.status === 'pass').length
    const failedTests = testResults.filter(r => r.status === 'fail').length
    const skippedTests = testResults.filter(r => r.status === 'skip').length
    const totalDuration = Date.now() - testStartTime

    const testSummary = {
      timestamp: new Date().toISOString(),
      summary: {
        total_tests: totalTests,
        passed: passedTests,
        failed: failedTests,
        skipped: skippedTests,
        success_rate: Math.round((passedTests / (totalTests - skippedTests)) * 100),
        total_duration_ms: totalDuration
      },
      results: testResults,
      production_ready: failedTests === 0,
      recommendations: failedTests > 0 ? [
        'Fix all failed tests before proceeding with live payments',
        'Review Paystack configuration and API keys',
        'Ensure webhook URL is properly configured in Paystack dashboard'
      ] : [
        'All tests passed - system is ready for live payments',
        'Configure webhook in Paystack dashboard if not already done',
        'Monitor payment success rates and system health'
      ]
    }

    console.log(`✅ Test suite completed: ${passedTests}/${totalTests} tests passed in ${totalDuration}ms`)

    return new Response(
      JSON.stringify(testSummary),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )
  } catch (error) {
    console.error('🚨 Test suite failed:', error)
    
    return new Response(
      JSON.stringify({
        error: error.message,
        timestamp: new Date().toISOString(),
        status: 'test_suite_failed'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      },
    )
  }
})