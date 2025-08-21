import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS'
};

serve(async (req: Request) => {
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { action, reference } = await req.json();
    
    console.log('🔍 Paystack Debug Helper called:', { action, reference });

    if (action === 'check_key_health') {
      return await checkKeyHealth();
    }

    if (action === 'check_reference' && reference) {
      return await checkReference(reference);
    }

    return new Response(JSON.stringify({
      success: false,
      error: 'Invalid action. Use "check_key_health" or "check_reference"'
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Paystack Debug Helper error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Internal server error',
      message: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Deterministic Paystack key selection (matching payment-callback logic)
function getPaystackSecretKey(): string | null {
  const testKey = Deno.env.get('PAYSTACK_SECRET_KEY_TEST');
  const generalKey = Deno.env.get('PAYSTACK_SECRET_KEY');
  const liveKey = Deno.env.get('PAYSTACK_SECRET_KEY_LIVE');

  let selectedKey = testKey || generalKey || liveKey;

  if (!selectedKey || !selectedKey.startsWith('sk_')) {
    return null;
  }

  return selectedKey;
}

async function checkKeyHealth() {
  const secretKey = getPaystackSecretKey();
  
  const healthCheck = {
    key_configured: !!secretKey,
    key_format_valid: secretKey?.startsWith('sk_') || false,
    key_environment: secretKey?.includes('test') ? 'TEST' : (secretKey?.includes('live') ? 'LIVE' : 'UNKNOWN'),
    key_prefix: secretKey ? secretKey.substring(0, 10) + '...' : null,
    timestamp: new Date().toISOString()
  };

  console.log('🔍 Paystack Key Health Check:', healthCheck);

  // Test API connectivity if key is present
  if (secretKey && healthCheck.key_format_valid) {
    try {
      const testResponse = await fetch('https://api.paystack.co/transaction/verify/invalid_ref_test_connectivity', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        }
      });

      healthCheck.api_connectivity = testResponse.status === 404; // Expected for invalid ref
      healthCheck.api_status_code = testResponse.status;
      
    } catch (apiError) {
      healthCheck.api_connectivity = false;
      healthCheck.api_error = apiError.message;
    }
  }

  return new Response(JSON.stringify({
    success: true,
    health_check: healthCheck
  }), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' }
  });
}

async function checkReference(reference: string) {
  const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
  
  if (!secretKey) {
    return new Response(JSON.stringify({
      success: false,
      error: 'Paystack secret key not configured'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }

  console.log('🔍 Checking reference existence (non-mutating):', reference);

  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${secretKey}`,
        'Content-Type': 'application/json'
      }
    });

    const responseText = await response.text();
    let responseData = null;
    
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      responseData = { raw_response: responseText };
    }

    const debugInfo = {
      reference,
      exists: response.ok && responseData?.status === true,
      http_status: response.status,
      paystack_status: responseData?.status || false,
      paystack_message: responseData?.message || 'No message',
      transaction_status: responseData?.data?.status || null,
      amount: responseData?.data?.amount ? responseData.data.amount / 100 : null,
      currency: responseData?.data?.currency || null,
      customer_email: responseData?.data?.customer?.email || null,
      created_at: responseData?.data?.created_at || null,
      key_environment: secretKey.includes('test') ? 'TEST' : 'LIVE',
      timestamp: new Date().toISOString()
    };

    console.log('🔍 Reference check result:', debugInfo);

    return new Response(JSON.stringify({
      success: true,
      debug_info: debugInfo,
      raw_response: responseData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Reference check failed:', error);
    return new Response(JSON.stringify({
      success: false,
      error: 'Reference check failed',
      message: error.message,
      reference
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}
