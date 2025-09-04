import { useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface PromotionUsageData {
  promotionId: string;
  promotionCode: string;
  orderId: string;
  customerEmail: string;
  customerId?: string;
  discountAmount: number;
  originalOrderAmount: number;
  finalOrderAmount: number;
}

export const usePromotionTracking = () => {
  
  const trackPromotionUsage = useCallback(async (data: PromotionUsageData) => {
    try {
      console.log('📊 Tracking promotion usage:', data);

      // Record usage in promotion_usage table
      const { error: usageError } = await supabase
        .from('promotion_usage')
        .insert({
          promotion_id: data.promotionId,
          order_id: data.orderId,
          customer_email: data.customerEmail,
          discount_amount: data.discountAmount,
          used_at: new Date().toISOString()
        });

      if (usageError) {
        console.error('❌ Failed to record promotion usage:', usageError);
      } else {
        console.log('✅ Promotion usage recorded successfully');
      }

      // Record audit entry
      const { error: auditError } = await supabase
        .from('promotion_usage_audit')
        .insert({
          promotion_id: data.promotionId,
          order_id: data.orderId,
          customer_email: data.customerEmail,
          usage_type: 'order_completion',
          discount_amount: data.discountAmount,
          original_order_amount: data.originalOrderAmount,
          final_order_amount: data.finalOrderAmount,
          metadata: {
            promotion_code: data.promotionCode,
            customer_id: data.customerId,
            tracked_at: new Date().toISOString()
          }
        });

      if (auditError) {
        console.error('❌ Failed to record promotion audit:', auditError);
      } else {
        console.log('✅ Promotion audit recorded successfully');
      }

      // Update promotion usage count - fetch current count and increment
      const { data: currentPromotion, error: fetchError } = await supabase
        .from('promotions')
        .select('usage_count')
        .eq('id', data.promotionId)
        .single();

      if (!fetchError && currentPromotion) {
        const { error: countError } = await supabase
          .from('promotions')
          .update({ 
            usage_count: (currentPromotion.usage_count || 0) + 1,
            updated_at: new Date().toISOString()
          })
          .eq('id', data.promotionId);

        if (countError) {
          console.warn('⚠️ Failed to update promotion usage count:', countError);
        }
      }

    } catch (error) {
      console.error('❌ Promotion tracking error:', error);
    }
  }, []);

  const getPromotionAnalytics = useCallback(async (promotionId: string, days: number = 30) => {
    try {
      const { data, error } = await supabase
        .from('promotion_analytics')
        .select('*')
        .eq('promotion_id', promotionId)
        .gte('date', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
        .order('date', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch promotion analytics:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Promotion analytics error:', error);
      return null;
    }
  }, []);

  return {
    trackPromotionUsage,
    getPromotionAnalytics
  };
};