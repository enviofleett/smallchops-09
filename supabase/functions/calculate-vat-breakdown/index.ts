import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  vat_rate?: number;
}

interface VATBreakdownRequest {
  cart_items: CartItem[];
  delivery_fee?: number;
  promotion_code?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const { cart_items, delivery_fee = 0, promotion_code }: VATBreakdownRequest = await req.json();

    // Get product VAT rates from database
    const productIds = cart_items.map(item => item.product_id);
    const { data: products, error: productsError } = await supabaseClient
      .from('products')
      .select('id, vat_rate, cost_price, vat_amount')
      .in('id', productIds);

    if (productsError) {
      throw new Error(`Failed to fetch products: ${productsError.message}`);
    }

    // Calculate VAT breakdown for each item
    let subtotal_cost = 0;
    let total_vat = 0;
    let subtotal_price = 0;

    const items_breakdown = cart_items.map(item => {
      const product = products?.find(p => p.id === item.product_id);
      const vatRate = product?.vat_rate || item.vat_rate || 7.5;
      
      // Calculate breakdown
      const unit_cost = Math.round((item.price / (1 + (vatRate / 100))) * 100) / 100;
      const unit_vat = Math.round((item.price - unit_cost) * 100) / 100;
      
      const total_cost = Math.round(unit_cost * item.quantity * 100) / 100;
      const total_vat_item = Math.round(unit_vat * item.quantity * 100) / 100;
      const total_price = Math.round(item.price * item.quantity * 100) / 100;

      subtotal_cost += total_cost;
      total_vat += total_vat_item;
      subtotal_price += total_price;

      return {
        product_id: item.product_id,
        product_name: item.product_name,
        quantity: item.quantity,
        unit_cost,
        unit_vat,
        unit_price: item.price,
        total_cost,
        total_vat: total_vat_item,
        total_price,
        vat_rate: vatRate
      };
    });

    // Apply promotions if any
    let discount_amount = 0;
    if (promotion_code) {
      // Get promotion details
      const { data: promotion } = await supabaseClient
        .from('promotions')
        .select('*')
        .eq('code', promotion_code)
        .eq('is_active', true)
        .gte('end_date', new Date().toISOString())
        .single();

      if (promotion) {
        if (promotion.discount_type === 'percentage') {
          discount_amount = Math.round((subtotal_price * (promotion.discount_value / 100)) * 100) / 100;
        } else if (promotion.discount_type === 'fixed_amount') {
          discount_amount = Math.min(promotion.discount_value, subtotal_price);
        }
      }
    }

    const vat_breakdown = {
      subtotal_cost: Math.round(subtotal_cost * 100) / 100,
      total_vat: Math.round(total_vat * 100) / 100,
      subtotal_price: Math.round(subtotal_price * 100) / 100,
      delivery_fee,
      discount_amount,
      grand_total: Math.round((subtotal_price + delivery_fee - discount_amount) * 100) / 100,
      items_breakdown
    };

    return new Response(JSON.stringify(vat_breakdown), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 200,
    });

  } catch (error) {
    console.error('VAT calculation error:', error);
    return new Response(JSON.stringify({ 
      error: 'Failed to calculate VAT breakdown',
      details: error.message 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 500,
    });
  }
});