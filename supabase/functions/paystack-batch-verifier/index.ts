import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getCorsHeaders } from '../_shared/cors.ts';
import { getPaystackConfig, validatePaystackConfig, logPaystackConfigStatus } from '../_shared/paystack-config.ts';

const VERSION = "v2025-08-22-batch-verifier";

// Enhanced logging function
function log(level: 'info' | 'warn' | 'error', message: string, data?: any) {
  const timestamp = new Date().toISOString();
  const logMessage = `[${timestamp}] [batch-verifier ${VERSION}] ${level.toUpperCase()}: ${message}`;
  
  if (data) {
    console.log(logMessage, data);
  } else {
    console.log(logMessage);
  }
}

serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req.headers.get('origin'));
  
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    log('info', '🔄 Batch payment verifier started');
    
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Paystack configuration
    let paystackConfig;
    try {
      paystackConfig = getPaystackConfig(req);
      const validation = validatePaystackConfig(paystackConfig);
      
      if (!validation.isValid) {
        log('error', '❌ Paystack configuration invalid', { errors: validation.errors });
        return new Response(JSON.stringify({
          success: false,
          error: 'Payment service configuration error',
          details: validation.errors
        }), {
          status: 503,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        });
      }
      
      logPaystackConfigStatus(paystackConfig);
    } catch (configError) {
      log('error', '❌ Configuration error', { error: configError.message });
      return new Response(JSON.stringify({
        success: false,
        error: 'Configuration error',
        details: configError.message
      }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Get pending payments that need verification
    const { data: pendingPayments, error: fetchError } = await supabase
      .from('payment_transactions')
      .select('reference, provider_reference, order_id, amount, created_at')
      .in('status', ['pending', 'initialized'])
      .lt('created_at', new Date(Date.now() - 5 * 60 * 1000).toISOString()) // At least 5 minutes old
      .limit(50);

    if (fetchError) {
      log('error', '❌ Failed to fetch pending payments', { error: fetchError });
      return new Response(JSON.stringify({
        success: false,
        error: 'Database error',
        details: fetchError.message
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    if (!pendingPayments || pendingPayments.length === 0) {
      log('info', '✅ No pending payments to verify');
      return new Response(JSON.stringify({
        success: true,
        message: 'No pending payments found',
        verified_count: 0
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    log('info', `🔍 Found ${pendingPayments.length} pending payments to verify`);

    const results = {
      total: pendingPayments.length,
      verified: 0,
      failed: 0,
      errors: [] as string[]
    };

    // Process each payment with rate limiting
    for (const payment of pendingPayments) {
      const reference = payment.provider_reference || payment.reference;
      
      try {
        log('info', `🔍 Verifying payment: ${reference}`);
        
        // Verify with Paystack
        const verificationResult = await verifyPaymentWithPaystack(reference, paystackConfig);
        
        if (verificationResult.success) {
          // Use the verify-payment function to handle the update
          const { error: updateError } = await supabase.functions.invoke('verify-payment', {
            body: { reference },
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`
            }
          });

          if (!updateError) {
            results.verified++;
            log('info', `✅ Payment verified: ${reference}`);
          } else {
            results.failed++;
            results.errors.push(`Update failed for ${reference}: ${updateError.message}`);
            log('error', `❌ Update failed for ${reference}`, { error: updateError });
          }
        } else {
          results.failed++;
          results.errors.push(`Verification failed for ${reference}: ${verificationResult.error}`);
          log('error', `❌ Verification failed for ${reference}`, { error: verificationResult.error });
        }
        
        // Rate limiting: wait 100ms between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
      } catch (error) {
        results.failed++;
        results.errors.push(`Exception for ${reference}: ${error.message}`);
        log('error', `❌ Exception verifying ${reference}`, { error: error.message });
      }
    }

    log('info', '✅ Batch verification completed', results);

    return new Response(JSON.stringify({
      success: true,
      results,
      message: `Verified ${results.verified}/${results.total} payments`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    log('error', '❌ Batch verifier error', { error: error.message, stack: error.stack });
    return new Response(JSON.stringify({
      success: false,
      error: 'Batch verification failed',
      details: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});

// Verify payment with Paystack API
async function verifyPaymentWithPaystack(reference: string, paystackConfig: any) {
  try {
    const response = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${paystackConfig.secretKey}`,
        'Content-Type': 'application/json',
        'User-Agent': `PaystackBatchVerifier/${VERSION}`
      },
      signal: AbortSignal.timeout(15000)
    });

    const responseText = await response.text();
    
    if (!response.ok) {
      return {
        success: false,
        error: `Paystack API error: ${response.status} - ${responseText}`
      };
    }

    let data;
    try {
      data = JSON.parse(responseText);
    } catch (parseError) {
      return {
        success: false,
        error: 'Invalid response format from Paystack'
      };
    }

    if (!data.status) {
      return {
        success: false,
        error: data.message || 'Paystack verification failed'
      };
    }

    if (data.data.status !== 'success') {
      return {
        success: false,
        error: `Payment status is ${data.data.status}`
      };
    }

    return {
      success: true,
      data: data.data
    };

  } catch (error) {
    return {
      success: false,
      error: `Verification failed: ${error.message}`
    };
  }
}