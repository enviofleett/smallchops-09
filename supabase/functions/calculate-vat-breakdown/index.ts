import { serve } from "https://deno.land/std@0.190.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface VATCalculationRequest {
  subtotal: number;
  vatRate?: number;
}

interface VATBreakdown {
  subtotal: number;
  vatAmount: number;
  vatRate: number;
  total: number;
  breakdown: {
    baseAmount: number;
    vatAmount: number;
    percentage: number;
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { subtotal, vatRate = 7.5 }: VATCalculationRequest = await req.json();

    if (!subtotal || subtotal < 0) {
      return new Response(
        JSON.stringify({ error: 'Valid subtotal is required' }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log('Calculating VAT breakdown:', { subtotal, vatRate });

    const vatAmount = (subtotal * vatRate) / 100;
    const total = subtotal + vatAmount;

    const breakdown: VATBreakdown = {
      subtotal: Math.round(subtotal * 100) / 100,
      vatAmount: Math.round(vatAmount * 100) / 100,
      vatRate,
      total: Math.round(total * 100) / 100,
      breakdown: {
        baseAmount: Math.round(subtotal * 100) / 100,
        vatAmount: Math.round(vatAmount * 100) / 100,
        percentage: vatRate
      }
    };

    console.log('VAT calculation complete:', breakdown);

    return new Response(
      JSON.stringify(breakdown),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('VAT calculation error:', error);
    return new Response(
      JSON.stringify({ error: 'Failed to calculate VAT breakdown' }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});