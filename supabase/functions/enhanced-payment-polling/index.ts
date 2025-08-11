import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PollingRequest {
  reference: string;
  orderId?: string;
  maxRetries?: number;
  intervalSeconds?: number;
}

interface PollingResponse {
  success: boolean;
  status: 'pending' | 'success' | 'failed' | 'timeout';
  data?: any;
  message?: string;
  nextPollIn?: number; // seconds
  retriesLeft?: number;
}

// Exponential backoff intervals: 10s -> 30s -> 2m -> 5m -> 10m
const POLLING_INTERVALS = [10, 30, 120, 300, 600];
const MAX_POLLING_DURATION = 24 * 60 * 60; // 24 hours in seconds

async function verifyPaymentWithPaystack(reference: string, secretKey: string): Promise<any> {
  try {
    const response = await fetch(
      `https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`,
      {
        headers: {
          'Authorization': `Bearer ${secretKey}`,
          'Content-Type': 'application/json'
        },
        signal: AbortSignal.timeout(10000) // 10 second timeout
      }
    );
    
    if (!response.ok) {
      throw new Error(`Paystack API error: ${response.status} ${response.statusText}`);
    }
    
    const data = await response.json();
    return data;
  } catch (error) {
    console.error('Paystack verification error:', error);
    throw error;
  }
}

async function updatePaymentStatus(
  supabase: any, 
  reference: string, 
  paystackData: any
): Promise<void> {
  const { data: paymentData, status } = paystackData;
  
  if (status && paymentData?.status === 'success') {
    // Use the same RPC function as webhooks for consistency
    await supabase.rpc('handle_successful_payment', {
      p_reference: reference,
      p_paid_at: paymentData.paid_at ? new Date(paymentData.paid_at).toISOString() : new Date().toISOString(),
      p_gateway_response: paymentData.gateway_response,
      p_fees: paymentData.fees ? paymentData.fees / 100 : 0,
      p_channel: paymentData.channel,
      p_authorization_code: paymentData.authorization?.authorization_code,
      p_card_type: paymentData.authorization?.card_type,
      p_last4: paymentData.authorization?.last4,
      p_exp_month: paymentData.authorization?.exp_month,
      p_exp_year: paymentData.authorization?.exp_year,
      p_bank: paymentData.authorization?.bank
    });
    
    console.log(`Payment ${reference} verified and processed via polling`);
  } else if (paymentData?.status === 'failed') {
    // Update payment as failed
    await supabase
      .from('payment_transactions')
      .update({
        status: 'failed',
        gateway_response: paymentData.gateway_response,
        updated_at: new Date().toISOString()
      })
      .eq('provider_reference', reference);
    
    console.log(`Payment ${reference} marked as failed via polling`);
  }
}

async function getPollingState(
  supabase: any, 
  reference: string
): Promise<{ retryCount: number; startTime: string; lastPolled: string | null }> {
  const { data } = await supabase
    .from('payment_polling_state')
    .select('retry_count, start_time, last_polled')
    .eq('reference', reference)
    .maybeSingle();
  
  if (!data) {
    // Initialize polling state
    const startTime = new Date().toISOString();
    await supabase
      .from('payment_polling_state')
      .insert({
        reference,
        retry_count: 0,
        start_time: startTime,
        last_polled: null,
        status: 'active'
      });
    
    return { retryCount: 0, startTime, lastPolled: null };
  }
  
  return {
    retryCount: data.retry_count,
    startTime: data.start_time,
    lastPolled: data.last_polled
  };
}

async function updatePollingState(
  supabase: any,
  reference: string,
  retryCount: number,
  status: 'active' | 'completed' | 'timeout' | 'failed'
): Promise<void> {
  await supabase
    .from('payment_polling_state')
    .update({
      retry_count: retryCount,
      last_polled: new Date().toISOString(),
      status
    })
    .eq('reference', reference);
}

serve(async (req) => {
  // Handle CORS preflight
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
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );
    
    const { reference, orderId, maxRetries = 50 }: PollingRequest = await req.json();
    
    if (!reference) {
      return new Response(JSON.stringify({
        success: false,
        status: 'failed',
        message: 'Payment reference is required'
      }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Get or initialize polling state
    const pollingState = await getPollingState(supabase, reference);
    const currentRetry = pollingState.retryCount;
    
    // Check if polling has exceeded maximum duration
    const startTime = new Date(pollingState.startTime);
    const now = new Date();
    const elapsedSeconds = (now.getTime() - startTime.getTime()) / 1000;
    
    if (elapsedSeconds > MAX_POLLING_DURATION) {
      await updatePollingState(supabase, reference, currentRetry, 'timeout');
      return new Response(JSON.stringify({
        success: false,
        status: 'timeout',
        message: 'Payment polling timeout after 24 hours'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check if we've exceeded retry limit
    if (currentRetry >= maxRetries) {
      await updatePollingState(supabase, reference, currentRetry, 'failed');
      return new Response(JSON.stringify({
        success: false,
        status: 'failed',
        message: 'Maximum polling retries exceeded'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Check current payment status in database first
    const { data: currentTransaction } = await supabase
      .from('payment_transactions')
      .select('status, paid_at, provider_response')
      .eq('provider_reference', reference)
      .maybeSingle();
    
    if (currentTransaction?.status === 'success' || currentTransaction?.status === 'paid') {
      await updatePollingState(supabase, reference, currentRetry, 'completed');
      return new Response(JSON.stringify({
        success: true,
        status: 'success',
        data: currentTransaction,
        message: 'Payment already confirmed'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    // Verify with Paystack API
    const secretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!secretKey) {
      return new Response(JSON.stringify({
        success: false,
        status: 'failed',
        message: 'Paystack secret key not configured'
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    let paystackData;
    try {
      paystackData = await verifyPaymentWithPaystack(reference, secretKey);
    } catch (error) {
      // Increment retry count and schedule next poll
      const nextRetry = currentRetry + 1;
      await updatePollingState(supabase, reference, nextRetry, 'active');
      
      const intervalIndex = Math.min(nextRetry - 1, POLLING_INTERVALS.length - 1);
      const nextPollIn = POLLING_INTERVALS[intervalIndex];
      
      return new Response(JSON.stringify({
        success: false,
        status: 'pending',
        message: `Paystack API error: ${error.message}`,
        nextPollIn,
        retriesLeft: maxRetries - nextRetry
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
    const paymentData = paystackData?.data;
    
    if (paystackData?.status && paymentData?.status === 'success') {
      // Payment successful - update database
      await updatePaymentStatus(supabase, reference, paystackData);
      await updatePollingState(supabase, reference, currentRetry, 'completed');
      
      return new Response(JSON.stringify({
        success: true,
        status: 'success',
        data: paymentData,
        message: 'Payment verified successfully'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else if (paymentData?.status === 'failed') {
      // Payment failed
      await updatePaymentStatus(supabase, reference, paystackData);
      await updatePollingState(supabase, reference, currentRetry, 'completed');
      
      return new Response(JSON.stringify({
        success: false,
        status: 'failed',
        data: paymentData,
        message: 'Payment failed'
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    } else {
      // Payment still pending - schedule next poll with exponential backoff
      const nextRetry = currentRetry + 1;
      await updatePollingState(supabase, reference, nextRetry, 'active');
      
      const intervalIndex = Math.min(nextRetry - 1, POLLING_INTERVALS.length - 1);
      const nextPollIn = POLLING_INTERVALS[intervalIndex];
      
      return new Response(JSON.stringify({
        success: false,
        status: 'pending',
        data: paymentData,
        message: 'Payment still pending',
        nextPollIn,
        retriesLeft: maxRetries - nextRetry
      }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }
    
  } catch (error) {
    console.error('Polling function error:', error);
    
    return new Response(JSON.stringify({
      success: false,
      status: 'failed',
      message: 'Internal server error'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});