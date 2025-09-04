import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PromotionUsageRequest {
  promotion_id: string;
  order_id: string;
  customer_email: string;
  customer_id?: string;
  discount_amount: number;
  original_order_amount: number;
  final_order_amount: number;
  promotion_code: string;
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

    const requestData: PromotionUsageRequest = await req.json();
    const { 
      promotion_id, 
      order_id, 
      customer_email, 
      customer_id,
      discount_amount,
      original_order_amount,
      final_order_amount,
      promotion_code
    } = requestData;

    console.log(`📊 Tracking promotion usage: ${promotion_code} for order ${order_id}`);

    // Record promotion usage
    const { error: usageError } = await supabase
      .from('promotion_usage')
      .insert({
        promotion_id,
        order_id,
        customer_email,
        discount_amount,
        used_at: new Date().toISOString()
      });

    if (usageError) {
      console.error('❌ Failed to record promotion usage:', usageError);
      throw usageError;
    }

    // Record detailed audit entry
    const { error: auditError } = await supabase
      .from('promotion_usage_audit')
      .insert({
        promotion_id,
        order_id,
        customer_email,
        usage_type: 'order_completion',
        discount_amount,
        original_order_amount,
        final_order_amount,
        metadata: {
          promotion_code,
          customer_id,
          tracked_at: new Date().toISOString(),
          user_agent: req.headers.get('user-agent'),
          ip_address: req.headers.get('cf-connecting-ip') || req.headers.get('x-forwarded-for')
        }
      });

    if (auditError) {
      console.error('❌ Failed to record promotion audit:', auditError);
    }

    // Update promotion usage count
    const { data: currentPromotion } = await supabase
      .from('promotions')
      .select('usage_count')
      .eq('id', promotion_id)
      .single();

    if (currentPromotion) {
      await supabase
        .from('promotions')
        .update({ 
          usage_count: (currentPromotion.usage_count || 0) + 1,
          updated_at: new Date().toISOString()
        })
        .eq('id', promotion_id);
    }

    // Generate analytics data for the day
    const today = new Date().toISOString().split('T')[0];
    
    // Check if analytics record exists for today
    const { data: existingAnalytics } = await supabase
      .from('promotion_analytics')
      .select('*')
      .eq('promotion_id', promotion_id)
      .eq('date', today)
      .single();

    if (existingAnalytics) {
      // Update existing analytics
      const { data: currentAnalytics } = await supabase
        .from('promotion_analytics')
        .select('total_usage, total_discount_given, total_revenue_impact')
        .eq('id', existingAnalytics.id)
        .single();

      if (currentAnalytics) {
        await supabase
          .from('promotion_analytics')
          .update({
            total_usage: (currentAnalytics.total_usage || 0) + 1,
            total_discount_given: (currentAnalytics.total_discount_given || 0) + discount_amount,
            total_revenue_impact: (currentAnalytics.total_revenue_impact || 0) + (original_order_amount - final_order_amount),
            updated_at: new Date().toISOString()
          })
          .eq('id', existingAnalytics.id);
      }
    } else {
      // Create new analytics record
      await supabase
        .from('promotion_analytics')
        .insert({
          promotion_id,
          date: today,
          total_usage: 1,
          total_discount_given: discount_amount,
          total_revenue_impact: original_order_amount - final_order_amount,
          unique_customers: 1,
          avg_order_value: final_order_amount
        });
    }

    console.log('✅ Promotion usage tracking completed');

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Promotion usage tracked successfully' 
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('❌ Promotion tracking error:', error);
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: 'Failed to track promotion usage' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );
  }
});