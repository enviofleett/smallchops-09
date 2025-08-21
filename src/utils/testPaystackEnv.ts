// Test Paystack Environment Variable Access
import { supabase } from '@/integrations/supabase/client';

export const testPaystackEnvironmentAccess = async () => {
  try {
    console.log('🔍 Testing Paystack environment variable access...');
    
    // Create a simple test function call to check environment variables
    const { data, error } = await supabase.functions.invoke('paystack-secure', {
      body: {
        action: 'initialize',
        email: 'test@example.com',
        amount: 100, // 1 NGN
        reference: `env_test_${Date.now()}`
      }
    });

    console.log('📡 Raw response:', { data, error });

    if (error) {
      if (error.message.includes('Paystack secret key not configured')) {
        return {
          status: 'environment_missing',
          message: 'Environment variable PAYSTACK_SECRET_KEY_TEST not accessible',
          details: error.message,
          solution: 'The environment variable exists in Supabase but the function cannot access it'
        };
      } else if (error.message.includes('Paystack API error')) {
        return {
          status: 'environment_accessible',
          message: 'Environment variable is accessible, but API call failed',
          details: error.message,
          solution: 'Check if the secret key value is correct'
        };
      } else {
        return {
          status: 'other_error',
          message: 'Different error occurred',
          details: error.message,
          solution: 'Check function logs for more details'
        };
      }
    }

    if (data?.status === true) {
      return {
        status: 'working',
        message: 'Environment variable accessible and working correctly',
        details: data,
        solution: 'No action needed'
      };
    } else {
      return {
        status: 'api_issue',
        message: 'Environment accessible but payment initialization failed',
        details: data,
        solution: 'Check Paystack API response'
      };
    }
  } catch (error) {
    return {
      status: 'function_error',
      message: 'Failed to call paystack-secure function',
      details: error.message,
      solution: 'Check if the function is deployed and accessible'
    };
  }
};

export const debugPaystackEnvironment = async () => {
  console.log('🧪 Running Paystack environment debug...');
  
  const result = await testPaystackEnvironmentAccess();
  
  console.log('🔍 Environment test result:', result);
  
  const recommendations = [];
  
  switch (result.status) {
    case 'environment_missing':
      recommendations.push('1. Verify PAYSTACK_SECRET_KEY_TEST is set in Supabase Edge Functions environment');
      recommendations.push('2. Check the variable name is exactly: PAYSTACK_SECRET_KEY_TEST');
      recommendations.push('3. Redeploy the paystack-secure function after adding the variable');
      break;
      
    case 'environment_accessible':
      recommendations.push('1. Check if the secret key value is correct (should start with sk_test_ or sk_live_)');
      recommendations.push('2. Verify the key has not expired or been revoked');
      recommendations.push('3. Check Paystack dashboard for any account issues');
      break;
      
    case 'working':
      recommendations.push('1. Environment is working correctly');
      recommendations.push('2. The original error might be elsewhere in the checkout flow');
      break;
      
    case 'api_issue':
      recommendations.push('1. Check Paystack API response for specific error details');
      recommendations.push('2. Verify account status and API limits');
      break;
      
    case 'function_error':
      recommendations.push('1. Check if paystack-secure function is deployed');
      recommendations.push('2. Verify function permissions and configuration');
      break;
  }
  
  return {
    ...result,
    recommendations
  };
};
