import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

// Enhanced CORS headers with proper methods
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Max-Age': '86400',
};

serve(async (req) => {
  // Handle CORS preflight requests properly
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: corsHeaders,
      status: 200
    });
  }

  try {
    console.log(`Processing ${req.method} request to paystack-verify`);

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    // Support both POST body and GET query parameter for reference
    let reference = '';
    if (req.method === 'POST') {
      const body = await req.json().catch(() => ({}));
      reference = body?.reference || '';
    } else if (req.method === 'GET') {
      const url = new URL(req.url);
      reference = url.searchParams.get('reference') ?? '';
    }

    if (!reference) {
      return new Response(JSON.stringify({
        success: false,
        error: 'Payment reference is required'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      });
    }

    console.log(`Verifying payment reference: ${reference}`);

    // Get Paystack secret key from environment
    const paystackSecretKey = Deno.env.get('PAYSTACK_SECRET_KEY');
    if (!paystackSecretKey) {
      throw new Error('Paystack secret key not configured');
    }

    // Verify with Paystack API
    const paystackResponse = await fetch(`https://api.paystack.co/transaction/verify/${reference}`, {
      headers: {
        'Authorization': `Bearer ${paystackSecretKey}`,
        'Content-Type': 'application/json'
      }
    });

    if (!paystackResponse.ok) {
      const errText = await paystackResponse.text();
      console.error(`Paystack API error: ${paystackResponse.status} - ${errText}`);
      throw new Error(`Paystack verification failed: ${paystackResponse.status}`);
    }

    const verification = await paystackResponse.json();
    console.log('Paystack verification response:', verification);

    if (!verification.status) {
      throw new Error(verification.message || 'Verification failed');
    }

    const ps = verification.data;
    const isSuccess = ps?.status === 'success';

    // Update order status if payment successful
    let orderInfo: { order_id: string; order_number: string; customer_name: string } | null = null;
    if (isSuccess) {
      // Try to find and update the order
      const { data: foundOrder, error: findOrderError } = await supabaseClient
        .from('orders')
        .select('id, order_number, customer_name, customer_email')
        .or(`payment_reference.eq.${reference},id.eq.${reference}`)
        .single();

      if (foundOrder && !findOrderError) {
        await supabaseClient
          .from('orders')
          .update({
            payment_status: 'paid',
            status: 'confirmed',
            updated_at: new Date().toISOString()
          })
          .eq('id', foundOrder.id);

        orderInfo = {
          order_id: foundOrder.id,
          order_number: foundOrder.order_number,
          customer_name: foundOrder.customer_name
        };

        console.log('Order updated successfully:', orderInfo);
      }
    }

    console.log('Payment verification completed:', {
      reference,
      status: ps?.status,
      amount: (ps?.amount ?? 0) / 100,
      success: isSuccess
    });

    // Return simplified, consistent response
    return new Response(JSON.stringify({
      success: isSuccess,
      status: ps?.status,
      data: {
        reference: ps?.reference,
        amount: (ps?.amount ?? 0) / 100,
        currency: ps?.currency,
        status: ps?.status,
        paid_at: ps?.paid_at,
        channel: ps?.channel,
        gateway_response: ps?.gateway_response
      },
      order_id: orderInfo?.order_id || null,
      order_number: orderInfo?.order_number || null,
      message: isSuccess ? 'Payment verified successfully' : `Payment ${ps?.status}`
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error: any) {
    console.error('Paystack verification error:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message || 'Verification failed',
      message: 'Payment verification failed. Please contact support.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});