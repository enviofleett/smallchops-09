import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OrderItem {
  product_id: string;
  product_name: string;
  price: number;
  quantity: number;
  customizations?: any;
}

interface PromotionApplication {
  promotion_id: string;
  discount_amount: number;
  bogo_allocations?: Array<{
    product_id: string;
    paid_quantity: number;
    free_quantity: number;
  }>;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { 
      order_data, 
      order_items, 
      applied_promotions, 
      customer_email 
    } = await req.json();

    console.log('Processing order with promotions:', { 
      order_data, 
      applied_promotions_count: applied_promotions?.length || 0 
    });

    // Start a transaction-like operation
    let order_id: string;
    
    try {
      // 1. Create the order
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert({
          customer_name: order_data.customer_name,
          customer_email: order_data.customer_email,
          customer_phone: order_data.customer_phone,
          order_type: order_data.order_type,
          delivery_address: order_data.delivery_address,
          delivery_zone_id: order_data.delivery_zone_id,
          special_instructions: order_data.special_instructions,
          subtotal: order_data.subtotal,
          tax_amount: order_data.tax_amount,
          delivery_fee: order_data.delivery_fee,
          discount_amount: order_data.discount_amount,
          total_amount: order_data.total_amount,
          status: 'pending',
          payment_status: 'pending'
        })
        .select()
        .single();

      if (orderError) throw orderError;
      order_id = order.id;

      // 2. Create order items
      const orderItemsWithOrderId = order_items.map((item: OrderItem) => ({
        order_id: order_id,
        product_id: item.product_id,
        product_name: item.product_name,
        price: item.price,
        quantity: item.quantity,
        customizations: item.customizations
      }));

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItemsWithOrderId);

      if (itemsError) throw itemsError;

      // 3. Process applied promotions
      if (applied_promotions && applied_promotions.length > 0) {
        for (const promotion of applied_promotions) {
          // Increment promotion usage and create audit trail
          const { error: usageError } = await supabase
            .rpc('increment_promotion_usage', {
              p_promotion_id: promotion.promotion_id,
              p_order_id: order_id,
              p_customer_email: customer_email,
              p_discount_amount: promotion.discount_amount,
              p_original_amount: order_data.subtotal,
              p_final_amount: order_data.total_amount,
              p_metadata: {
                order_type: order_data.order_type,
                items_count: order_items.length,
                promotion_type: promotion.type
              }
            });

          if (usageError) {
            console.error('Error incrementing promotion usage:', usageError);
            // Don't fail the order for promotion tracking errors
          }

          // Handle BOGO allocations
          if (promotion.bogo_allocations && promotion.bogo_allocations.length > 0) {
            const bogoRecords = promotion.bogo_allocations.map((allocation: any) => ({
              promotion_id: promotion.promotion_id,
              order_id: order_id,
              product_id: allocation.product_id,
              paid_quantity: allocation.paid_quantity,
              free_quantity: allocation.free_quantity
            }));

            const { error: bogoError } = await supabase
              .from('bogo_allocations')
              .insert(bogoRecords);

            if (bogoError) {
              console.error('Error recording BOGO allocations:', bogoError);
            }
          }
        }
      }

      // 4. Log successful order processing
      console.log('Order processed successfully:', {
        order_id,
        customer_email,
        total_amount: order_data.total_amount,
        promotions_applied: applied_promotions?.length || 0
      });

      return new Response(
        JSON.stringify({ 
          success: true, 
          order_id,
          message: 'Order processed successfully with promotions'
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200 
        }
      );

    } catch (error) {
      console.error('Error processing order:', error);
      
      // If order was created but promotions failed, still return success
      // but log the promotion processing failure
      if (order_id) {
        console.log('Order created but promotion processing failed:', order_id);
        return new Response(
          JSON.stringify({ 
            success: true, 
            order_id,
            message: 'Order created successfully, but promotion tracking may be incomplete',
            warning: 'Promotion processing error'
          }),
          { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
            status: 200 
          }
        );
      }

      throw error;
    }

  } catch (error) {
    console.error('Fatal error processing order:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message || 'Failed to process order',
        details: 'Order processing failed'
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
      }
    );
  }
});