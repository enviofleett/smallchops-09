import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
};

interface TestScenario {
  name: string;
  category: 'payment' | 'security' | 'performance' | 'integration';
  test: (supabase: any, config: any) => Promise<any>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { testType, configuration } = await req.json();
    
    console.log(`Starting Paystack test: ${testType}`);

    const testConfig = {
      testEmail: configuration?.testEmail || 'test@example.com',
      testAmount: configuration?.testAmount || 1000,
      currency: configuration?.currency || 'NGN',
      environment: configuration?.environment || 'test',
      ...configuration
    };

    let results = [];

    switch (testType) {
      case 'comprehensive':
        results = await runComprehensiveTests(supabase, testConfig);
        break;

      case 'payment_flow':
        results = await runPaymentFlowTests(supabase, testConfig);
        break;

      case 'security':
        results = await runSecurityTests(supabase, testConfig);
        break;

      case 'performance':
        results = await runPerformanceTests(supabase, testConfig);
        break;

      case 'webhooks':
        results = await runWebhookTests(supabase, testConfig);
        break;

      default:
        throw new Error(`Unknown test type: ${testType}`);
    }

    return new Response(JSON.stringify({
      success: true,
      testType,
      configuration: testConfig,
      results,
      timestamp: new Date().toISOString()
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('Paystack testing error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function runComprehensiveTests(supabase: any, config: any) {
  const allTests = [
    ...await runPaymentFlowTests(supabase, config),
    ...await runSecurityTests(supabase, config),
    ...await runWebhookTests(supabase, config),
    ...await runIntegrationTests(supabase, config)
  ];

  if (config.enablePerformanceTests) {
    allTests.push(...await runPerformanceTests(supabase, config));
  }

  return allTests;
}

async function runPaymentFlowTests(supabase: any, config: any) {
  const tests: TestScenario[] = [
    {
      name: 'Payment Initialization',
      category: 'payment',
      test: async () => {
        const { data, error } = await supabase.rpc('get_active_paystack_config');
        
        if (error || !data || data.length === 0) {
          throw new Error('No active Paystack configuration found');
        }

        const paystackConfig = Array.isArray(data) ? data[0] : data;
        
        // Test payment initialization with Paystack API
        const response = await fetch('https://api.paystack.co/transaction/initialize', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${paystackConfig.secret_key}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            email: config.testEmail,
            amount: config.testAmount,
            currency: config.currency,
            reference: `TEST_${Date.now()}`,
            callback_url: 'https://example.com/callback'
          })
        });

        const result = await response.json();
        
        if (!response.ok) {
          throw new Error(result.message || 'Payment initialization failed');
        }

        return {
          reference: result.data.reference,
          authorization_url: result.data.authorization_url,
          status: 'success'
        };
      }
    },
    {
      name: 'Banks List Retrieval',
      category: 'payment',
      test: async () => {
        const { data, error } = await supabase.functions.invoke('paystack-banks');
        
        if (error) {
          throw new Error(error.message);
        }

        if (!data?.status) {
          throw new Error('Failed to retrieve banks list');
        }

        return {
          banks_count: data.data?.length || 0,
          status: 'success'
        };
      }
    },
    {
      name: 'Configuration Validation',
      category: 'payment',
      test: async () => {
        const { data, error } = await supabase.rpc('get_active_paystack_config');
        
        if (error) {
          throw new Error(error.message);
        }

        if (!data || data.length === 0) {
          throw new Error('No Paystack configuration found');
        }

        const paystackConfig = Array.isArray(data) ? data[0] : data;
        
        const validations = {
          public_key_configured: !!paystackConfig.public_key,
          secret_key_configured: !!paystackConfig.secret_key,
          webhook_secret_configured: !!paystackConfig.webhook_secret,
          test_mode: paystackConfig.test_mode,
          environment: paystackConfig.environment
        };

        const missingConfig = Object.entries(validations)
          .filter(([key, value]) => key.includes('configured') && !value)
          .map(([key]) => key);

        if (missingConfig.length > 0) {
          throw new Error(`Missing configuration: ${missingConfig.join(', ')}`);
        }

        return validations;
      }
    }
  ];

  return await executeTests(tests);
}

async function runSecurityTests(supabase: any, config: any) {
  const tests: TestScenario[] = [
    {
      name: 'Webhook IP Validation',
      category: 'security',
      test: async () => {
        const testIPs = [
          '52.31.139.75', // Valid Paystack IP
          '192.168.1.1',  // Invalid IP
          '127.0.0.1'     // Localhost
        ];

        const results = [];
        
        for (const ip of testIPs) {
          try {
            const { data, error } = await supabase.rpc('validate_paystack_webhook_ip', {
              request_ip: ip
            });
            
            results.push({
              ip,
              valid: !error && data,
              expected: ip === '52.31.139.75' || ip === '127.0.0.1'
            });
          } catch (error) {
            results.push({
              ip,
              valid: false,
              error: error.message
            });
          }
        }

        return { ip_validation_results: results };
      }
    },
    {
      name: 'Rate Limiting Test',
      category: 'security',
      test: async () => {
        const requests = [];
        const startTime = Date.now();
        
        // Send rapid requests to test rate limiting
        for (let i = 0; i < 15; i++) {
          requests.push(
            supabase.functions.invoke('paystack-banks').catch(error => ({ error: error.message }))
          );
        }

        const responses = await Promise.all(requests);
        const endTime = Date.now();
        
        const successCount = responses.filter(r => !r.error).length;
        const rateLimitedCount = responses.filter(r => 
          r.error && r.error.includes('rate')
        ).length;

        return {
          total_requests: requests.length,
          successful_requests: successCount,
          rate_limited_requests: rateLimitedCount,
          duration_ms: endTime - startTime,
          rate_limiting_active: rateLimitedCount > 0
        };
      }
    },
    {
      name: 'Input Validation',
      category: 'security',
      test: async () => {
        const invalidInputs = [
          { email: 'not-an-email', amount: -1000 },
          { email: '', amount: 'not-a-number' },
          { email: 'test@example.com', amount: 0 }
        ];

        const results = [];

        for (const input of invalidInputs) {
          try {
            const { data, error } = await supabase.functions.invoke('paystack-secure', {
              body: {
                action: 'initialize',
                ...input,
                currency: config.currency
              }
            });

            results.push({
              input,
              handled_gracefully: !!error,
              error_message: error?.message || 'No error'
            });
          } catch (error) {
            results.push({
              input,
              handled_gracefully: true,
              error_message: error.message
            });
          }
        }

        return { input_validation_results: results };
      }
    }
  ];

  return await executeTests(tests);
}

async function runWebhookTests(supabase: any, config: any) {
  const tests: TestScenario[] = [
    {
      name: 'Webhook Signature Validation',
      category: 'security',
      test: async () => {
        const testPayload = {
          event: 'charge.success',
          data: {
            reference: 'test-ref-123',
            amount: 100000,
            status: 'success'
          }
        };

        // Test with invalid signature
        try {
          const { data, error } = await supabase.functions.invoke('paystack-webhook-secure', {
            body: testPayload,
            headers: {
              'x-paystack-signature': 'invalid-signature'
            }
          });

          return {
            signature_validation_working: !!error,
            error_message: error?.message || 'No error - potential vulnerability'
          };
        } catch (error) {
          return {
            signature_validation_working: true,
            error_message: error.message
          };
        }
      }
    },
    {
      name: 'Webhook Event Processing',
      category: 'integration',
      test: async () => {
        // Check if webhook logging is working
        const { data, error } = await supabase
          .from('webhook_logs')
          .select('*')
          .limit(5);

        if (error) {
          throw new Error(`Webhook logs query failed: ${error.message}`);
        }

        return {
          webhook_logging_active: true,
          recent_webhooks: data?.length || 0,
          status: 'configured'
        };
      }
    }
  ];

  return await executeTests(tests);
}

async function runPerformanceTests(supabase: any, config: any) {
  const tests: TestScenario[] = [
    {
      name: 'API Response Time',
      category: 'performance',
      test: async () => {
        const times = [];
        const iterations = 10;

        for (let i = 0; i < iterations; i++) {
          const start = Date.now();
          
          try {
            await supabase.functions.invoke('paystack-banks');
            times.push(Date.now() - start);
          } catch (error) {
            times.push(Date.now() - start);
          }
        }

        const avgTime = times.reduce((a, b) => a + b, 0) / times.length;
        const maxTime = Math.max(...times);
        const minTime = Math.min(...times);

        return {
          average_response_time: avgTime,
          max_response_time: maxTime,
          min_response_time: minTime,
          total_requests: times.length,
          performance_rating: avgTime < 1000 ? 'excellent' : avgTime < 2000 ? 'good' : 'needs_improvement'
        };
      }
    },
    {
      name: 'Concurrent Requests',
      category: 'performance',
      test: async () => {
        const concurrency = config.concurrentUsers || 5;
        const requests = [];
        
        const startTime = Date.now();
        
        for (let i = 0; i < concurrency; i++) {
          requests.push(
            supabase.functions.invoke('paystack-banks')
              .then(() => ({ status: 'success' }))
              .catch(error => ({ status: 'failed', error: error.message }))
          );
        }

        const results = await Promise.all(requests);
        const endTime = Date.now();
        
        const successCount = results.filter(r => r.status === 'success').length;
        const totalTime = endTime - startTime;

        return {
          concurrent_requests: concurrency,
          successful_requests: successCount,
          failed_requests: concurrency - successCount,
          total_time_ms: totalTime,
          requests_per_second: (concurrency / totalTime) * 1000,
          success_rate: (successCount / concurrency) * 100
        };
      }
    }
  ];

  return await executeTests(tests);
}

async function runIntegrationTests(supabase: any, config: any) {
  const tests: TestScenario[] = [
    {
      name: 'Database Integration',
      category: 'integration',
      test: async () => {
        // Test payment transactions table
        const { data: transactions, error: transError } = await supabase
          .from('payment_transactions')
          .select('*')
          .limit(1);

        if (transError) {
          throw new Error(`Payment transactions table error: ${transError.message}`);
        }

        // Test payment integrations table
        const { data: integrations, error: intError } = await supabase
          .from('payment_integrations')
          .select('*')
          .eq('provider', 'paystack')
          .limit(1);

        if (intError) {
          throw new Error(`Payment integrations table error: ${intError.message}`);
        }

        return {
          payment_transactions_accessible: true,
          payment_integrations_accessible: true,
          recent_transactions: transactions?.length || 0,
          paystack_config_exists: integrations?.length > 0
        };
      }
    },
    {
      name: 'Environment Configuration',
      category: 'integration',
      test: async () => {
        const { data, error } = await supabase.rpc('get_environment_config');
        
        if (error) {
          throw new Error(`Environment config error: ${error.message}`);
        }

        const envConfig = Array.isArray(data) ? data[0] : data;
        
        return {
          environment_configured: !!envConfig,
          is_live_mode: envConfig?.is_live_mode || false,
          webhook_url_configured: !!envConfig?.webhook_url,
          environment: envConfig?.environment || 'unknown'
        };
      }
    }
  ];

  return await executeTests(tests);
}

async function executeTests(tests: TestScenario[]) {
  const results = [];

  for (const test of tests) {
    const startTime = Date.now();
    
    try {
      const result = await test.test();
      const duration = Date.now() - startTime;
      
      results.push({
        test_name: test.name,
        category: test.category,
        status: 'passed',
        duration,
        result,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      const duration = Date.now() - startTime;
      
      results.push({
        test_name: test.name,
        category: test.category,
        status: 'failed',
        duration,
        error: error.message,
        timestamp: new Date().toISOString()
      });
    }
  }

  return results;
}