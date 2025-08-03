import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TrackCartRequest {
  sessionId: string;
  customerEmail?: string;
  customerPhone?: string;
  cartData: any[];
  totalItems: number;
  totalValue: number;
  customerId?: string;
}

const handler = async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const {
      sessionId,
      customerEmail,
      customerPhone,
      cartData,
      totalItems,
      totalValue,
      customerId
    }: TrackCartRequest = await req.json();

    console.log('Tracking cart session:', { sessionId, totalItems, totalValue });

    // Upsert cart session
    const { data, error } = await supabase
      .from('cart_sessions')
      .upsert({
        session_id: sessionId,
        customer_id: customerId,
        customer_email: customerEmail,
        customer_phone: customerPhone,
        cart_data: cartData,
        total_items: totalItems,
        total_value: totalValue,
        last_activity: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        is_abandoned: false
      }, {
        onConflict: 'session_id'
      })
      .select()
      .single();

    if (error) {
      console.error('Error tracking cart session:', error);
      throw error;
    }

    // Run abandonment detection
    await supabase.rpc('detect_abandoned_carts');

    return new Response(JSON.stringify({ success: true, data }), {
      status: 200,
      headers: { 'Content-Type': 'application/json', ...corsHeaders },
    });

  } catch (error: any) {
    console.error('Error in track-cart-session:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', ...corsHeaders },
      }
    );
  }
};

serve(handler);