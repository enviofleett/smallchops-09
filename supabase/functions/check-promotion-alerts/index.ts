import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.52.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL') ?? '',
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
);

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    console.log('Checking for promotion alerts...');

    // Get active promotions
    const { data: promotions, error: promotionsError } = await supabase
      .from('promotions')
      .select(`
        id,
        name,
        description,
        type,
        value,
        applicable_products,
        valid_from,
        valid_until
      `)
      .eq('status', 'active')
      .gte('valid_until', new Date().toISOString())
      .lte('valid_from', new Date().toISOString());

    if (promotionsError) {
      console.error('Error fetching promotions:', promotionsError);
      throw promotionsError;
    }

    if (!promotions || promotions.length === 0) {
      console.log('No active promotions found');
      return new Response(JSON.stringify({ processed: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log(`Found ${promotions.length} active promotions`);

    let notificationsQueued = 0;

    for (const promotion of promotions) {
      // Check if this is a product-specific promotion
      if (promotion.applicable_products && promotion.applicable_products.length > 0) {
        // Get customers who have these products in favorites and want promotion alerts
        const { data: favoriteCustomers, error: favoritesError } = await supabase
          .from('customer_favorites')
          .select(`
            customer_id,
            product_id,
            customer_accounts!inner (
              id,
              name,
              user_id
            ),
            customer_notification_preferences!inner (
              promotion_alerts
            ),
            products!inner (
              name,
              price
            )
          `)
          .in('product_id', promotion.applicable_products)
          .eq('customer_notification_preferences.promotion_alerts', true);

        if (favoritesError) {
          console.error('Error fetching favorite customers:', favoritesError);
          continue;
        }

        if (favoriteCustomers && favoriteCustomers.length > 0) {
          console.log(`Found ${favoriteCustomers.length} customers for promotion ${promotion.name}`);

          // Check if we've already notified these customers about this promotion
          for (const customer of favoriteCustomers) {
            const { data: existingNotification } = await supabase
              .from('notification_queue')
              .select('id')
              .eq('customer_id', customer.customer_id)
              .eq('product_id', customer.product_id)
              .eq('notification_type', 'promotion_alert')
              .eq('data->promotion_id', promotion.id)
              .single();

            if (!existingNotification) {
              // Calculate discount amount
              let discountAmount = 0;
              if (promotion.type === 'percentage') {
                discountAmount = (customer.products.price * promotion.value) / 100;
              } else if (promotion.type === 'fixed_amount') {
                discountAmount = promotion.value;
              }

              // Queue promotion notification
              const { error: queueError } = await supabase
                .from('notification_queue')
                .insert({
                  customer_id: customer.customer_id,
                  product_id: customer.product_id,
                  notification_type: 'promotion_alert',
                  data: {
                    promotion_id: promotion.id,
                    promotion_name: promotion.name,
                    promotion_description: promotion.description,
                    promotion_type: promotion.type,
                    promotion_value: promotion.value,
                    product_name: customer.products.name,
                    original_price: customer.products.price,
                    discount_amount: discountAmount,
                    valid_until: promotion.valid_until
                  }
                });

              if (queueError) {
                console.error('Error queuing promotion notification:', queueError);
              } else {
                notificationsQueued++;
                console.log(`Queued promotion notification for customer ${customer.customer_id} and product ${customer.product_id}`);
              }
            }
          }
        }
      }
    }

    console.log(`Promotion alert check complete. Queued ${notificationsQueued} notifications`);

    return new Response(JSON.stringify({ 
      processed: promotions.length,
      notificationsQueued 
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in check-promotion-alerts:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});