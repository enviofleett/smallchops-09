import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DebugRequest {
  action: 'check' | 'verify';
  reference: string;
}

interface PaystackResponse {
  status: boolean;
  message: string;
  data?: any;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const url = new URL(req.url);
  const startTime = Date.now();

  try {
    // Health check endpoint
    if (url.searchParams.get('health') === '1') {
      const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY_TEST') || Deno.env.get('PAYSTACK_SECRET_KEY');
      const environment = secretKey?.startsWith('sk_test_') ? 'test' : 
                         secretKey?.startsWith('sk_live_') ? 'live' : 'unknown';
      
      console.log(`🏥 Health check - Environment: ${environment}, Key present: ${!!secretKey}`);
      
      return new Response(JSON.stringify({
        environment,
        keyPresent: !!secretKey,
        keyPrefix: secretKey ? secretKey.substring(0, 8) + '...' : null,
        timestamp: new Date().toISOString()
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Parse request body for debug actions
    if (req.method !== 'POST') {
      throw new Error('Only POST requests supported for debug actions');
    }

    const body: DebugRequest = await req.json();
    const { action, reference } = body;

    if (!reference?.trim()) {
      throw new Error('Reference is required');
    }

    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY_TEST') || Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      throw new Error('Paystack secret key not configured');
    }

    console.log(`🔍 Debug action: ${action} for reference: ${reference}`);

    const paystackResponse = await makePaystackRequest(secretKey, reference);
    const latency = Date.now() - startTime;

    let result;
    if (action === 'check') {
      // Simplified check response
      result = {
        exists: paystackResponse.status && paystackResponse.data,
        status: paystackResponse.data?.status,
        amount: paystackResponse.data?.amount,
        currency: paystackResponse.data?.currency,
        paid_at: paystackResponse.data?.paid_at,
        gateway_response: paystackResponse.data?.gateway_response,
        latency_ms: latency
      };
    } else if (action === 'verify') {
      // Full verification response (read-only)
      result = {
        success: paystackResponse.status && paystackResponse.data?.status === 'success',
        data: paystackResponse.data ? {
          status: paystackResponse.data.status,
          amount: paystackResponse.data.amount,
          customer: paystackResponse.data.customer,
          metadata: paystackResponse.data.metadata,
          paid_at: paystackResponse.data.paid_at,
          channel: paystackResponse.data.channel,
          reference: paystackResponse.data.reference
        } : null,
        debug: {
          gateway_response: paystackResponse.data?.gateway_response,
          fees: paystackResponse.data?.fees,
          authorization: paystackResponse.data?.authorization,
          latency_ms: latency,
          paystack_status_code: 200 // We only get here if request succeeded
        }
      };
    } else {
      throw new Error(`Unknown action: ${action}`);
    }

    console.log(`✅ Debug ${action} completed in ${latency}ms - exists: ${result.exists || result.success}`);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    const latency = Date.now() - startTime;
    console.error(`❌ Debug request failed in ${latency}ms:`, error.message);

    return new Response(JSON.stringify({
      error: error.message,
      latency_ms: latency,
      timestamp: new Date().toISOString()
    }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

async function makePaystackRequest(secretKey: string, reference: string): Promise<PaystackResponse> {
  const url = `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`;
  
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${secretKey}`,
      'Content-Type': 'application/json',
      'User-Agent': 'PaystackDebugHandler/1.0'
    }
  });

  if (!response.ok) {
    throw new Error(`Paystack API error: ${response.status} ${response.statusText}`);
  }

  const data: PaystackResponse = await response.json();
  
  if (!data.status) {
    throw new Error(data.message || 'Transaction verification failed');
  }

  return data;
}