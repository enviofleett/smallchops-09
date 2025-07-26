import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.7';

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
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get Paystack configuration from database
    const { data: config, error: configError } = await supabaseClient
      .from('payment_integrations')
      .select('*')
      .eq('provider', 'paystack')
      .eq('is_active', true)
      .single();

    if (configError || !config) {
      console.error('Configuration error:', configError);
      return new Response(JSON.stringify({
        status: false,
        error: 'Payment configuration not found'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 500,
      });
    }

    // Fetch Nigerian banks from Paystack
    const response = await fetch('https://api.paystack.co/bank?currency=NGN', {
      headers: {
        'Authorization': `Bearer ${config.secret_key}`,
        'Content-Type': 'application/json',
      }
    });

    if (!response.ok) {
      throw new Error(`Paystack API error: ${response.statusText}`);
    }

    const data = await response.json();

    if (!data.status) {
      throw new Error(data.message || 'Failed to fetch banks');
    }

    // Cache the result for better performance
    const banks = data.data.map((bank: any) => ({
      name: bank.name,
      code: bank.code,
      active: bank.active,
      is_deleted: bank.is_deleted,
      country: bank.country,
      currency: bank.currency,
      type: bank.type,
      slug: bank.slug
    }));

    return new Response(JSON.stringify({
      status: true,
      data: banks,
      count: banks.length
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Banks fetch error:', error);
    return new Response(JSON.stringify({
      status: false,
      error: error.message || 'Failed to fetch banks'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});