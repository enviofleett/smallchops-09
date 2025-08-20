// Minimal order creation endpoint - replaces heavy payment initialization
// Reduces Edge Function usage by creating orders without payment processing

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface OrderRequest {
  order_id: string;
  amount: number;
  customer_email: string;
  metadata?: {
    customer_name?: string;
    order_number?: string;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
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
    const { order_id, amount, customer_email, metadata }: OrderRequest = await req.json();
    
    if (!order_id || !amount || !customer_email) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: order_id, amount, customer_email' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`📝 Creating minimal order: ${order_id}`);

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Simple order record creation/update
    const { data, error } = await supabase
      .from('orders')
      .upsert({
        id: order_id,
        order_number: metadata?.order_number || `ORDER-${Date.now()}`,
        customer_email,
        customer_name: metadata?.customer_name,
        total_amount: amount,
        status: 'pending',
        payment_status: 'pending',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      })
      .select('id, order_number')
      .single();

    if (error) {
      console.error('❌ Order creation failed:', error);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Failed to create order record' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`✅ Order created: ${data.order_number}`);

    return new Response(
      JSON.stringify({
        success: true,
        order_id: data.id,
        order_number: data.order_number,
        message: 'Order created successfully'
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('❌ Order creation error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Order creation failed' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});