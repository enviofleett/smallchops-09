import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CartItem {
  product_id: string;
  product_name?: string;
  quantity: number;
}

interface MOQViolation {
  product_id: string;
  product_name: string;
  current_quantity: number;
  minimum_required: number;
  shortfall: number;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { items } = await req.json() as { items: CartItem[] };

    if (!items || !Array.isArray(items) || items.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'No items provided for validation'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get all product IDs
    const productIds = items.map(item => item.product_id);

    // Fetch products with their MOQ requirements
    const { data: products, error: productsError } = await supabase
      .from('products')
      .select('id, name, minimum_order_quantity, stock_quantity')
      .in('id', productIds);

    if (productsError) {
      console.error('Error fetching products:', productsError);
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Failed to fetch product information'
        }),
        {
          status: 500,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Validate each item against MOQ
    const violations: MOQViolation[] = [];
    
    for (const item of items) {
      const product = products?.find(p => p.id === item.product_id);
      
      if (!product) {
        violations.push({
          product_id: item.product_id,
          product_name: item.product_name || 'Unknown Product',
          current_quantity: item.quantity,
          minimum_required: 1,
          shortfall: 1 - item.quantity
        });
        continue;
      }

      const moq = product.minimum_order_quantity || 1;
      
      if (item.quantity < moq) {
        violations.push({
          product_id: product.id,
          product_name: product.name,
          current_quantity: item.quantity,
          minimum_required: moq,
          shortfall: moq - item.quantity
        });
      }

      // Also check stock availability
      if (product.stock_quantity !== null && item.quantity > product.stock_quantity) {
        violations.push({
          product_id: product.id,
          product_name: product.name,
          current_quantity: item.quantity,
          minimum_required: product.stock_quantity,
          shortfall: item.quantity - product.stock_quantity
        });
      }
    }

    if (violations.length > 0) {
      return new Response(
        JSON.stringify({
          success: false,
          valid: false,
          violations,
          message: `${violations.length} product(s) do not meet minimum order requirements`
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        valid: true,
        message: 'All products meet minimum order requirements'
      }),
      {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('MOQ validation error:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal server error during MOQ validation'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
