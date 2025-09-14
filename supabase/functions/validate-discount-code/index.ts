import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface DiscountValidationRequest {
  code: string;
  customer_email: string;
  order_amount: number;
  is_new_customer?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { code, customer_email, order_amount, is_new_customer = false }: DiscountValidationRequest = await req.json();

    if (!code || !customer_email || !order_amount) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: code, customer_email, order_amount' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Get discount code details
    const { data: discountCode, error: codeError } = await supabase
      .from('discount_codes')
      .select('*')
      .eq('code', code.toUpperCase())
      .eq('is_active', true)
      .single();

    if (codeError || !discountCode) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Invalid or inactive discount code' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check validity dates
    const now = new Date();
    const validFrom = new Date(discountCode.valid_from);
    const validUntil = discountCode.valid_until ? new Date(discountCode.valid_until) : null;

    if (now < validFrom) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Discount code is not yet active' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (validUntil && now > validUntil) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Discount code has expired' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check applicable days
    const dayName = now.toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
    if (!discountCode.applicable_days.includes(dayName)) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Discount code is not valid today' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check minimum order amount
    if (order_amount < discountCode.min_order_amount) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: `Minimum order amount of ₦${discountCode.min_order_amount.toLocaleString()} required` 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check new customer requirement
    if (discountCode.new_customers_only) {
      const { data: existingOrders } = await supabase
        .from('orders')
        .select('id')
        .eq('customer_email', customer_email)
        .eq('payment_status', 'paid')
        .limit(1);

      if (existingOrders && existingOrders.length > 0) {
        return new Response(
          JSON.stringify({ 
            valid: false, 
            error: 'This discount is only for new customers' 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    // Check usage limit
    if (discountCode.usage_limit && discountCode.usage_count >= discountCode.usage_limit) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'Discount code usage limit reached' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Check if customer already used this code
    const { data: previousUsage } = await supabase
      .from('discount_code_usage')
      .select('id')
      .eq('discount_code_id', discountCode.id)
      .eq('customer_email', customer_email)
      .limit(1);

    if (previousUsage && previousUsage.length > 0) {
      return new Response(
        JSON.stringify({ 
          valid: false, 
          error: 'You have already used this discount code' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate discount amount
    let discountAmount = 0;
    if (discountCode.type === 'percentage') {
      discountAmount = (order_amount * discountCode.value) / 100;
      if (discountCode.max_discount_amount) {
        discountAmount = Math.min(discountAmount, discountCode.max_discount_amount);
      }
    } else {
      discountAmount = discountCode.value;
    }

    // Ensure discount doesn't exceed order amount
    discountAmount = Math.min(discountAmount, order_amount);

    const finalAmount = order_amount - discountAmount;

    return new Response(
      JSON.stringify({
        valid: true,
        discount_code_id: discountCode.id,
        discount_amount: discountAmount,
        final_amount: finalAmount,
        code_details: {
          name: discountCode.name,
          description: discountCode.description,
          type: discountCode.type,
          value: discountCode.value
        }
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Discount validation error:', error);
    return new Response(
      JSON.stringify({ 
        valid: false,
        error: 'Internal server error' 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});