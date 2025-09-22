// Server-Authoritative Order Calculation Function
// Provides definitive order totals for client-server consistency

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

interface CalculationRequest {
  order_id?: string;
  items: Array<{
    product_id: string;
    quantity: number;
    unit_price: number;
  }>;
  delivery_zone_id?: string;
  fulfillment_type: 'delivery' | 'pickup';
  promotion_code?: string;
  customer_id?: string;
  customer_email?: string;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const request: CalculationRequest = await req.json();
    console.log('🔢 Server calculation request:', {
      orderId: request.order_id,
      itemCount: request.items.length,
      fulfillmentType: request.fulfillment_type,
      promotionCode: request.promotion_code
    });

    // Validate request
    if (!request.items || request.items.length === 0) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Items are required for calculation'
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Step 1: Calculate items subtotal using server precision
    let subtotalCents = 0;
    let subtotalCostCents = 0;
    let totalVatCents = 0;

    const VAT_RATE = 7.5; // 7.5%

    for (const item of request.items) {
      if (!item.product_id || item.quantity <= 0 || item.unit_price <= 0) {
        return new Response(
          JSON.stringify({
            success: false,
            error: `Invalid item data: ${JSON.stringify(item)}`
          }),
          { 
            status: 400, 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
          }
        );
      }

      const itemPriceCents = Math.round(item.unit_price * 100);
      const itemTotalCents = itemPriceCents * item.quantity;
      
      // Calculate VAT breakdown
      const totalPriceCents = itemTotalCents;
      const costPriceCents = Math.round(totalPriceCents / (1 + VAT_RATE / 100));
      const vatAmountCents = totalPriceCents - costPriceCents;
      
      subtotalCents += totalPriceCents;
      subtotalCostCents += costPriceCents;
      totalVatCents += vatAmountCents;
    }

    // Step 2: Calculate delivery fee
    let deliveryFeeCents = 0;
    if (request.fulfillment_type === 'delivery' && request.delivery_zone_id) {
      const { data: deliveryZone } = await supabase
        .from('delivery_zones')
        .select('base_fee')
        .eq('id', request.delivery_zone_id)
        .eq('is_active', true)
        .maybeSingle();

      if (deliveryZone?.base_fee) {
        deliveryFeeCents = Math.round(deliveryZone.base_fee * 100);
      }
    }

    // Step 3: Apply promotions if code provided
    let discountCents = 0;
    let deliveryDiscountCents = 0;
    let appliedPromotion = null;

    if (request.promotion_code) {
      // Validate promotion code
      const { data: promotionResult } = await supabase.rpc('validate_promotion_code_secure', {
        p_code: request.promotion_code.trim().toUpperCase(),
        p_order_amount: subtotalCents / 100, // Convert to Naira
        p_customer_email: request.customer_email,
        p_customer_id: request.customer_id,
        p_ip_address: 'server-calculation',
        p_user_agent: 'server-calculation'
      });

      if (promotionResult?.valid && promotionResult.promotion) {
        const promotion = promotionResult.promotion;
        appliedPromotion = promotion;

        switch (promotion.type) {
          case 'percentage':
            if (promotion.value) {
              const cappedPercentage = Math.min(promotion.value, 100);
              discountCents = Math.round((subtotalCents * cappedPercentage) / 100);
            }
            break;
            
          case 'fixed_amount':
            if (promotion.value) {
              discountCents = Math.min(Math.round(promotion.value * 100), subtotalCents);
            }
            break;
            
          case 'free_delivery':
            deliveryDiscountCents = deliveryFeeCents;
            break;

          case 'buy_one_get_one':
            // BOGO discount calculation
            if (promotion.value) {
              discountCents = Math.round((subtotalCents * promotion.value) / 100);
            }
            break;
        }

        console.log('✅ Promotion applied:', {
          code: request.promotion_code,
          type: promotion.type,
          value: promotion.value,
          discountCents,
          deliveryDiscountCents
        });
      } else {
        console.log('❌ Invalid promotion code:', request.promotion_code);
      }
    }

    // Step 4: Calculate final totals
    const finalTotalCents = subtotalCents + deliveryFeeCents - discountCents - deliveryDiscountCents;

    // Convert back to Naira
    const calculation = {
      subtotal: subtotalCents / 100,
      subtotal_cost: subtotalCostCents / 100,
      total_vat: totalVatCents / 100,
      delivery_fee: deliveryFeeCents / 100,
      discount_amount: discountCents / 100,
      delivery_discount: deliveryDiscountCents / 100,
      total_amount: finalTotalCents / 100,
      applied_promotions: appliedPromotion ? [{
        id: appliedPromotion.id,
        name: appliedPromotion.name,
        code: appliedPromotion.code,
        type: appliedPromotion.type,
        value: appliedPromotion.value,
        discount_amount: discountCents / 100,
        free_delivery: appliedPromotion.type === 'free_delivery'
      }] : [],
      calculation_breakdown: {
        subtotal_cents: subtotalCents,
        delivery_fee_cents: deliveryFeeCents,
        discount_cents: discountCents,
        total_cents: finalTotalCents,
        precision_adjustments: 0
      }
    };

    console.log('✅ Server calculation completed:', {
      subtotal: calculation.subtotal,
      deliveryFee: calculation.delivery_fee,
      discount: calculation.discount_amount,
      total: calculation.total_amount
    });

    return new Response(
      JSON.stringify({
        success: true,
        calculation,
        server_timestamp: new Date().toISOString()
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Server calculation error:', error);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: 'Internal calculation error'
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});