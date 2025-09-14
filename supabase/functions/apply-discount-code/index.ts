import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ApplyDiscountRequest {
  discount_code_id: string;
  order_id?: string;
  customer_email: string;
  discount_amount: number;
  original_amount: number;
  final_amount: number;
  ip_address?: string;
  user_agent?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      discount_code_id, 
      order_id, 
      customer_email, 
      discount_amount, 
      original_amount, 
      final_amount,
      ip_address,
      user_agent 
    }: ApplyDiscountRequest = await req.json();

    if (!discount_code_id || !customer_email || !discount_amount || !original_amount || !final_amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // First, get the actual discount code record by code to get the UUID
    const { data: discountCodeData, error: lookupError } = await supabase
      .from('discount_codes')
      .select('id')
      .eq('code', discount_code_id.toUpperCase())
      .single();

    if (lookupError || !discountCodeData) {
      console.error('Discount code lookup error:', lookupError);
      return new Response(
        JSON.stringify({ error: 'Invalid discount code - not found in database' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const actualDiscountCodeId = discountCodeData.id;

    // Record the discount usage with proper UUID
    const { data: usage, error: usageError } = await supabase
      .from('discount_code_usage')
      .insert({
        discount_code_id: actualDiscountCodeId,
        order_id,
        customer_email,
        discount_amount,
        original_amount,
        final_amount,
        ip_address,
        user_agent
      })
      .select()
      .single();

    if (usageError) {
      console.error('Usage recording error:', usageError);
      return new Response(
        JSON.stringify({ error: 'Failed to record discount usage' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update usage count on discount code using actual UUID
    const { error: updateError } = await supabase
      .from('discount_codes')
      .update({ 
        usage_count: supabase.raw('usage_count + 1') 
      })
      .eq('id', actualDiscountCodeId);

    if (updateError) {
      console.error('Usage count update error:', updateError);
      // Don't return error as usage was already recorded
    }

    // Log the application for audit trail with proper UUID
    await supabase.from('audit_logs').insert({
      action: 'discount_code_applied',
      category: 'Promotion Processing',
      message: `Discount code ${discount_code_id} applied for customer ${customer_email}`,
      entity_id: actualDiscountCodeId,
      new_values: {
        discount_code: discount_code_id,
        customer_email,
        discount_amount,
        original_amount,
        final_amount,
        order_id
      }
    });

    return new Response(
      JSON.stringify({
        success: true,
        usage_id: usage.id,
        message: 'Discount applied successfully'
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Apply discount error:', error);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});