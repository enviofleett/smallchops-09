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

      // Update promotion updated_at timestamp
      const { error: updateError } = await supabase
        .from('promotions')
        .update({ 
          updated_at: new Date().toISOString()
        })
        .eq('id', data.promotionId);

      if (updateError) {
        console.warn('⚠️ Failed to update promotion timestamp:', updateError);
      }

    } catch (error) {
      console.error('❌ Promotion tracking error:', error);
    }
  }, []);

  const getPromotionAnalytics = useCallback(async (promotionId: string, days: number = 30) => {
    try {
      const { data, error } = await supabase
        .from('promotion_usage')
        .select('*')
        .eq('promotion_id', promotionId)
        .gte('used_at', new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString())
        .order('used_at', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch promotion usage:', error);
        return null;
      }

      return data;
    } catch (error) {
      console.error('❌ Promotion usage error:', error);
      return null;
    }
  }, []);

  return {
    trackPromotionUsage,
    getPromotionAnalytics
  };
};