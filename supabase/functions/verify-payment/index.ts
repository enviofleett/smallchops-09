import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VerifyPaymentRequest {
  reference: string;
  idempotency_key?: string;
}

serve(async (req: Request) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');

    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    const { reference, idempotency_key }: VerifyPaymentRequest = await req.json();

    if (!reference) {
      return new Response(
        JSON.stringify({ success: false, error: 'Payment reference is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    console.log(`🔍 Verifying payment for reference: ${reference}`);

    // Check if payment has already been verified (idempotency check)
    if (idempotency_key) {
      const { data: existingTransaction } = await supabase
        .from('payment_transactions')
        .select('*')
        .eq('reference', reference)
        .eq('status', 'completed')
        .single();

      if (existingTransaction) {
        console.log(`✅ Payment ${reference} already verified and completed`);
        return new Response(
          JSON.stringify({
            success: true,
            data: existingTransaction,
            message: 'Payment already verified',
            already_processed: true
          }),
          { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
        );
      }
    }

    // Verify payment with Paystack
    const paystackResponse = await fetch(
      `https://api.paystack.co/transaction/verify/${reference}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${paystackSecretKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!paystackResponse.ok) {
      const errorText = await paystackResponse.text();
      console.error(`❌ Paystack API error:`, errorText);
      throw new Error(`Paystack verification failed: ${paystackResponse.status}`);
    }

    const verificationData = await paystackResponse.json();

    if (!verificationData.status) {
      console.error(`❌ Payment verification failed:`, verificationData.message);
      return new Response(
        JSON.stringify({
          success: false,
          error: verificationData.message || 'Payment verification failed'
        }),
        { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
      );
    }

    const paymentData = verificationData.data;

    // Update or create payment transaction record
    const transactionData = {
      reference: paymentData.reference,
      amount: paymentData.amount / 100, // Convert from kobo to naira
      currency: paymentData.currency,
      status: paymentData.status === 'success' ? 'completed' : 'failed',
      gateway_response: paymentData.gateway_response,
      paid_at: paymentData.paid_at,
      channel: paymentData.channel,
      fees: paymentData.fees / 100,
      customer_email: paymentData.customer.email,
      authorization_code: paymentData.authorization?.authorization_code,
      last4: paymentData.authorization?.last4,
      card_type: paymentData.authorization?.card_type,
      bank: paymentData.authorization?.bank,
      metadata: paymentData.metadata,
      updated_at: new Date().toISOString()
    };

    // Upsert transaction record
    const { data: transaction, error: transactionError } = await supabase
      .from('payment_transactions')
      .upsert(transactionData, { onConflict: 'reference', ignoreDuplicates: false })
      .select()
      .single();

    if (transactionError) {
      console.error('❌ Database transaction error:', transactionError);
      throw new Error(`Failed to update transaction: ${transactionError.message}`);
    }

    // If payment is successful, update related order
    if (paymentData.status === 'success') {
      console.log(`✅ Payment successful, updating order for reference: ${reference}`);
      
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          payment_status: 'paid',
          payment_reference: reference,
          updated_at: new Date().toISOString()
        })
        .eq('payment_reference', reference);

      if (orderError) {
        console.error('❌ Order update error:', orderError);
      } else {
        console.log(`✅ Order updated successfully for reference: ${reference}`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: { ...transaction, paystack_data: paymentData },
        message: 'Payment verified successfully'
      }),
      { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );

  } catch (error: any) {
    console.error('❌ Payment verification error:', error);
    
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Payment verification failed' }),
      { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } }
    );
  }
});