import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface BatchVerificationRequest {
  batch_size?: number;
  max_age_hours?: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return new Response('Method not allowed', { 
      status: 405, 
      headers: corsHeaders 
    });
  }

  try {
    const { 
      batch_size = 50, 
      max_age_hours = 24 
    }: BatchVerificationRequest = await req.json();

    console.log('🔄 Starting batch payment verification:', { batch_size, max_age_hours });

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get Paystack configuration
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Payment service not configured' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    // Fetch pending payments for reconciliation
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - max_age_hours);

    const { data: pendingTransactions, error: fetchError } = await supabase
      .from('payment_transactions')
      .select('id, provider_reference, amount_kobo, order_id, status, created_at')
      .in('status', ['pending', 'processing'])
      .gte('created_at', cutoffTime.toISOString())
      .order('created_at', { ascending: true })
      .limit(batch_size);

    if (fetchError) {
      console.error('❌ Failed to fetch pending transactions:', fetchError);
      return new Response(JSON.stringify({ 
        success: false, 
        error: 'Failed to fetch pending transactions' 
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log(`📋 Found ${pendingTransactions?.length || 0} pending transactions to verify`);

    if (!pendingTransactions || pendingTransactions.length === 0) {
      return new Response(JSON.stringify({
        success: true,
        processed: 0,
        verified: 0,
        failed: 0,
        message: 'No pending transactions to verify'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    let processed = 0;
    let verified = 0;
    let failed = 0;
    const errors: string[] = [];

    // Process each transaction with rate limiting
    for (const transaction of pendingTransactions) {
      try {
        console.log(`🔍 Verifying transaction: ${transaction.provider_reference}`);

        // Rate limiting: 10 requests per second max
        if (processed > 0 && processed % 10 === 0) {
          await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // Verify with Paystack
        const paystackResponse = await fetch(
          `https://api.paystack.co/transaction/verify/${transaction.provider_reference}`,
          {
            method: 'GET',
            headers: {
              'Authorization': `Bearer ${paystackSecretKey}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (!paystackResponse.ok) {
          console.warn(`⚠️  Paystack verification failed for ${transaction.provider_reference}: ${paystackResponse.statusText}`);
          failed++;
          errors.push(`${transaction.provider_reference}: Paystack API error`);
          continue;
        }

        const paystackData = await paystackResponse.json();
        
        if (paystackData.status && paystackData.data?.status === 'success') {
          // Payment successful - use atomic processing with idempotency
          const idempotencyKey = `batch_verify_${transaction.id}_${Date.now()}`;
          
          try {
            const { error: processError } = await supabase
              .rpc('process_payment_atomically', {
                p_payment_reference: transaction.provider_reference,
                p_idempotency_key: idempotencyKey,
                p_amount_kobo: paystackData.data.amount,
                p_status: 'confirmed'
              });

            if (processError) {
              console.error(`❌ Atomic processing failed for ${transaction.provider_reference}:`, processError);
              failed++;
              errors.push(`${transaction.provider_reference}: Processing error - ${processError.message}`);
            } else {
              verified++;
              console.log(`✅ Verified and processed: ${transaction.provider_reference}`);
            }
          } catch (processErr) {
            console.error(`❌ Critical processing error for ${transaction.provider_reference}:`, processErr);
            failed++;
            errors.push(`${transaction.provider_reference}: Critical processing error`);
          }
          
        } else if (paystackData.data?.status === 'failed' || paystackData.data?.status === 'abandoned') {
          // Payment failed - mark as failed
          const idempotencyKey = `batch_verify_failed_${transaction.id}_${Date.now()}`;
          
          try {
            await supabase
              .rpc('process_payment_atomically', {
                p_payment_reference: transaction.provider_reference,
                p_idempotency_key: idempotencyKey,
                p_amount_kobo: paystackData.data.amount || transaction.amount_kobo,
                p_status: 'failed'
              });

            console.log(`❌ Marked as failed: ${transaction.provider_reference}`);
          } catch (failedProcessErr) {
            console.error(`❌ Failed to process failed payment ${transaction.provider_reference}:`, failedProcessErr);
          }
        } else {
          console.log(`⏳ Still pending: ${transaction.provider_reference} (status: ${paystackData.data?.status})`);
        }

        processed++;

      } catch (error) {
        console.error(`❌ Error processing transaction ${transaction.provider_reference}:`, error);
        failed++;
        errors.push(`${transaction.provider_reference}: ${error.message}`);
        processed++;
      }
    }

    // Log batch verification results
    await supabase.from('audit_logs').insert({
      action: 'batch_payment_verification_completed',
      category: 'Payment Reconciliation',
      message: `Batch verification completed: ${processed} processed, ${verified} verified, ${failed} failed`,
      new_values: {
        processed,
        verified,
        failed,
        batch_size,
        max_age_hours,
        errors: errors.slice(0, 10), // Limit error details
        timestamp: new Date().toISOString()
      }
    });

    console.log('✅ Batch verification completed:', { processed, verified, failed });

    return new Response(JSON.stringify({
      success: true,
      processed,
      verified,
      failed,
      errors: errors.slice(0, 5), // Return first 5 errors only
      message: `Batch verification completed: ${verified} verified, ${failed} failed out of ${processed} processed`
    }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('❌ Batch verification error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Batch verification failed'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});