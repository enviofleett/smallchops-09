import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Fetch Nigerian banks from Paystack
    const response = await fetch('https://api.paystack.co/bank?currency=NGN');
    const data = await response.json();

    if (!data.status) {
      throw new Error(data.message || 'Failed to fetch banks');
    }

    return new Response(JSON.stringify({
      status: true,
      data: data.data
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('Banks fetch error:', error);
    return new Response(JSON.stringify({
      status: false,
      error: error.message
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});