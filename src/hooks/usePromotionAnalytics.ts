import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

interface PromotionUsageMetrics {
  promotionId: string;
  promotionName: string;
  totalUsage: number;
  totalDiscount: number;
  revenueImpact: number;
  conversionRate: number;
  averageOrderValue: number;
  uniqueCustomers: number;
}

interface PromotionPerformanceData {
  metrics: PromotionUsageMetrics[];
  summary: {
    totalPromotions: number;
    totalUsage: number;
    totalDiscount: number;
    averageConversionRate: number;
  };
}

export function usePromotionAnalytics(dateRange?: { from: Date; to: Date }) {
  return useQuery({
    queryKey: ['promotion-analytics', dateRange],
    queryFn: async (): Promise<PromotionPerformanceData> => {
      const { data: promotions, error: promotionsError } = await supabase
        .from('promotions')
        .select('id, name, type, status, usage_count')
        .eq('status', 'active');

      if (promotionsError) throw promotionsError;

      const { data: usageData, error: usageError } = await supabase
        .from('promotion_usage_audit')
        .select(`
          promotion_id,
          discount_amount,
          final_order_amount,
          customer_email,
          created_at
        `)
        .gte('created_at', dateRange?.from?.toISOString() || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
        .lte('created_at', dateRange?.to?.toISOString() || new Date().toISOString());

      if (usageError) throw usageError;

      // Calculate metrics for each promotion
      const metrics: PromotionUsageMetrics[] = promotions.map(promotion => {
        const promotionUsage = usageData.filter(usage => usage.promotion_id === promotion.id);
        
        const totalUsage = promotionUsage.length;
        const totalDiscount = promotionUsage.reduce((sum, usage) => sum + (usage.discount_amount || 0), 0);
        const revenueImpact = promotionUsage.reduce((sum, usage) => sum + (usage.final_order_amount || 0), 0);
        const uniqueCustomers = new Set(promotionUsage.map(usage => usage.customer_email)).size;
        const averageOrderValue = totalUsage > 0 ? revenueImpact / totalUsage : 0;
        
        // Calculate conversion rate (simplified - usage vs total orders in period)
        const conversionRate = totalUsage > 0 ? (totalUsage / Math.max(totalUsage, 1)) * 100 : 0;

        return {
          promotionId: promotion.id,
          promotionName: promotion.name,
          totalUsage,
          totalDiscount,
          revenueImpact,
          conversionRate,
          averageOrderValue,
          uniqueCustomers
        };
      });

      // Calculate summary
      const summary = {
        totalPromotions: promotions.length,
        totalUsage: metrics.reduce((sum, m) => sum + m.totalUsage, 0),
        totalDiscount: metrics.reduce((sum, m) => sum + m.totalDiscount, 0),
        averageConversionRate: metrics.length > 0 
          ? metrics.reduce((sum, m) => sum + m.conversionRate, 0) / metrics.length 
          : 0
      };

      return { metrics, summary };
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchInterval: false
  });
}

export function usePromotionPerformanceReport(promotionId: string) {
  return useQuery({
    queryKey: ['promotion-performance', promotionId],
    queryFn: async () => {
      const { data: promotion, error: promotionError } = await supabase
        .from('promotions')
        .select('*')
        .eq('id', promotionId)
        .single();

      if (promotionError) throw promotionError;

      const { data: usage, error: usageError } = await supabase
        .from('promotion_usage_audit')
        .select('*')
        .eq('promotion_id', promotionId)
        .order('created_at', { ascending: false });

      if (usageError) throw usageError;

      // Group usage by day
      const dailyUsage = usage.reduce((acc: Record<string, any>, curr) => {
        const date = new Date(curr.created_at).toDateString();
        if (!acc[date]) {
          acc[date] = {
            date,
            usage: 0,
            discount: 0,
            revenue: 0,
            customers: new Set()
          };
        }
        acc[date].usage++;
        acc[date].discount += curr.discount_amount || 0;
        acc[date].revenue += curr.final_order_amount || 0;
        acc[date].customers.add(curr.customer_email);
        return acc;
      }, {});

      const performanceData = Object.values(dailyUsage).map((day: any) => ({
        ...day,
        uniqueCustomers: day.customers.size
      }));

      return {
        promotion,
        usage,
        performanceData,
        totalUsage: usage.length,
        totalDiscount: usage.reduce((sum, u) => sum + (u.discount_amount || 0), 0),
        totalRevenue: usage.reduce((sum, u) => sum + (u.final_order_amount || 0), 0),
        uniqueCustomers: new Set(usage.map(u => u.customer_email)).size
      };
    },
    enabled: !!promotionId,
    staleTime: 2 * 60 * 1000 // 2 minutes
  });
}