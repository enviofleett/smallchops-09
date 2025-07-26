import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { auth: { persistSession: false } }
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: userData } = await supabaseClient.auth.getUser(token);
    const user = userData.user;

    const body = await req.json();
    const { email, amount, currency = 'NGN', reference, callback_url, metadata = {}, orderId } = body;

    // Get Paystack configuration
    const { data: config } = await supabaseClient
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .eq('connection_status', 'connected')
      .single();

    if (!config) {
      throw new Error('Paystack not configured');
    }

    // Create transaction record
    const { data: transaction, error: dbError } = await supabaseClient
      .from('payment_transactions')
      .insert({
        transaction_reference: reference,
        provider: 'paystack',
        order_id: orderId,
        amount: parseFloat(amount),
        currency,
        customer_email: email,
        metadata,
        status: 'pending'
      })
      .select()
      .single();

    if (dbError) {
      throw new Error('Failed to create transaction record');
    }

    // Initialize with Paystack
    const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.secret_key}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        email,
        amount: Math.round(amount * 100), // Convert to kobo
        currency,
        reference,
        callback_url: callback_url || `${req.headers.get('origin')}/payment/callback`,
        metadata: { ...metadata, orderId },
        channels: ['card', 'bank', 'ussd', 'qr', 'mobile_money', 'bank_transfer']
      })
    });

    const paystackData = await paystackResponse.json();

    if (!paystackData.status) {
      throw new Error(paystackData.message || 'Failed to initialize payment');
    }

    // Update transaction with Paystack reference
    await supabaseClient
      .from('payment_transactions')
      .update({ provider_reference: paystackData.data.reference })
      .eq('id', transaction.id);

    return new Response(JSON.stringify({
      status: true,
      data: {
        authorization_url: paystackData.data.authorization_url,
        access_code: paystackData.data.access_code,
        reference: paystackData.data.reference
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Paystack initialization error:', error);
    return new Response(JSON.stringify({
      status: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});