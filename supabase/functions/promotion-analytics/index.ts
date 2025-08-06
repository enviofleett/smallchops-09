import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalyticsRequest {
  period?: 'day' | 'week' | 'month' | 'year';
  promotion_id?: string;
  start_date?: string;
  end_date?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { period = 'month', promotion_id, start_date, end_date }: AnalyticsRequest = await req.json();

    // Calculate date range based on period
    const endDate = end_date ? new Date(end_date) : new Date();
    let startDate: Date;
    
    switch (period) {
      case 'day':
        startDate = new Date(endDate.getTime() - 24 * 60 * 60 * 1000);
        break;
      case 'week':
        startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case 'month':
        startDate = new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case 'year':
        startDate = new Date(endDate.getTime() - 365 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = start_date ? new Date(start_date) : new Date(endDate.getTime() - 30 * 24 * 60 * 60 * 1000);
    }

    // Get promotion performance data
    const promotionAnalytics = await getPromotionAnalytics(supabase, promotion_id, startDate, endDate);
    
    // Get day-based performance
    const dayPerformance = await getDayBasedPerformance(supabase, startDate, endDate);
    
    // Get overall statistics
    const overallStats = await getOverallStats(supabase, startDate, endDate);

    return new Response(
      JSON.stringify({
        period,
        date_range: {
          start: startDate.toISOString(),
          end: endDate.toISOString()
        },
        promotion_analytics: promotionAnalytics,
        day_performance: dayPerformance,
        overall_stats: overallStats,
        generated_at: new Date().toISOString()
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Analytics error:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Internal server error', 
        details: error.message 
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function getPromotionAnalytics(supabase: any, promotionId?: string, startDate?: Date, endDate?: Date) {
  try {
    let query = supabase
      .from('promotions')
      .select(`
        id,
        name,
        type,
        status,
        usage_count,
        usage_limit,
        value,
        applicable_days,
        valid_from,
        valid_until,
        created_at
      `);

    if (promotionId) {
      query = query.eq('id', promotionId);
    }

    const { data: promotions, error } = await query;
    if (error) throw error;

    const analytics = [];

    for (const promotion of promotions || []) {
      // Calculate effectiveness metrics
      const effectiveness = calculatePromotionEffectiveness(promotion);
      
      // Get day-specific performance for this promotion
      const daySpecificPerformance = await getPromotionDayPerformance(supabase, promotion.id, startDate, endDate);
      
      analytics.push({
        ...promotion,
        effectiveness,
        day_performance: daySpecificPerformance
      });
    }

    return analytics;
  } catch (error) {
    console.error('Error getting promotion analytics:', error);
    return [];
  }
}

function calculatePromotionEffectiveness(promotion: any) {
  const usageRate = promotion.usage_limit ? 
    (promotion.usage_count / promotion.usage_limit) * 100 : 
    null;

  const daysCovered = promotion.applicable_days?.length || 7;
  const daysCoveragePercentage = (daysCovered / 7) * 100;

  const isCurrentlyActive = promotion.status === 'active' && 
    new Date() >= new Date(promotion.valid_from) &&
    (!promotion.valid_until || new Date() <= new Date(promotion.valid_until));

  let effectivenessScore = 0;
  
  // Score based on usage
  if (usageRate !== null) {
    if (usageRate > 80) effectivenessScore += 30;
    else if (usageRate > 50) effectivenessScore += 20;
    else if (usageRate > 20) effectivenessScore += 10;
  } else {
    effectivenessScore += 15; // Unlimited usage gets medium score
  }

  // Score based on day coverage
  if (daysCoveragePercentage === 100) effectivenessScore += 20;
  else if (daysCoveragePercentage >= 50) effectivenessScore += 15;
  else effectivenessScore += 10;

  // Score based on current status
  if (isCurrentlyActive) effectivenessScore += 20;

  // Score based on promotion type value
  switch (promotion.type) {
    case 'percentage':
      if (promotion.value >= 20) effectivenessScore += 15;
      else if (promotion.value >= 10) effectivenessScore += 10;
      else effectivenessScore += 5;
      break;
    case 'fixed_amount':
      if (promotion.value >= 1000) effectivenessScore += 15;
      else if (promotion.value >= 500) effectivenessScore += 10;
      else effectivenessScore += 5;
      break;
    default:
      effectivenessScore += 10;
  }

  // Score based on recent creation (newer promotions get bonus)
  const daysSinceCreation = (Date.now() - new Date(promotion.created_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceCreation <= 30) effectivenessScore += 15;
  else if (daysSinceCreation <= 90) effectivenessScore += 10;

  return {
    score: Math.min(effectivenessScore, 100),
    usage_rate: usageRate,
    days_coverage_percentage: daysCoveragePercentage,
    is_currently_active: isCurrentlyActive,
    days_since_creation: Math.round(daysSinceCreation),
    rating: effectivenessScore >= 80 ? 'excellent' : 
            effectivenessScore >= 60 ? 'good' : 
            effectivenessScore >= 40 ? 'average' : 'poor'
  };
}

async function getPromotionDayPerformance(supabase: any, promotionId: string, startDate?: Date, endDate?: Date) {
  try {
    // This would require order/usage tracking data
    // For now, return placeholder data based on applicable_days
    const { data: promotion } = await supabase
      .from('promotions')
      .select('applicable_days')
      .eq('id', promotionId)
      .single();

    const applicableDays = promotion?.applicable_days || [];
    const allDays = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    
    const dayPerformance = allDays.map(day => ({
      day,
      is_applicable: applicableDays.includes(day) || applicableDays.length === 0,
      estimated_usage: applicableDays.includes(day) || applicableDays.length === 0 ? 
        Math.floor(Math.random() * 10) + 1 : 0
    }));

    return dayPerformance;
  } catch (error) {
    console.error('Error getting day performance:', error);
    return [];
  }
}

async function getDayBasedPerformance(supabase: any, startDate: Date, endDate: Date) {
  try {
    // Get all promotions with day restrictions
    const { data: promotions, error } = await supabase
      .from('promotions')
      .select('id, name, type, applicable_days, usage_count')
      .not('applicable_days', 'is', null)
      .neq('applicable_days', '{}');

    if (error) throw error;

    const dayStats = {
      monday: { promotions: 0, total_usage: 0 },
      tuesday: { promotions: 0, total_usage: 0 },
      wednesday: { promotions: 0, total_usage: 0 },
      thursday: { promotions: 0, total_usage: 0 },
      friday: { promotions: 0, total_usage: 0 },
      saturday: { promotions: 0, total_usage: 0 },
      sunday: { promotions: 0, total_usage: 0 }
    };

    for (const promotion of promotions || []) {
      if (promotion.applicable_days) {
        for (const day of promotion.applicable_days) {
          if (dayStats[day as keyof typeof dayStats]) {
            dayStats[day as keyof typeof dayStats].promotions++;
            dayStats[day as keyof typeof dayStats].total_usage += promotion.usage_count || 0;
          }
        }
      }
    }

    return dayStats;
  } catch (error) {
    console.error('Error getting day performance:', error);
    return {};
  }
}

async function getOverallStats(supabase: any, startDate: Date, endDate: Date) {
  try {
    const { data: promotions, error } = await supabase
      .from('promotions')
      .select('*');

    if (error) throw error;

    const activePromotions = promotions?.filter(p => p.status === 'active') || [];
    const dayRestrictedPromotions = promotions?.filter(p => p.applicable_days && p.applicable_days.length > 0) || [];
    const weekendPromotions = promotions?.filter(p => 
      p.applicable_days && 
      (p.applicable_days.includes('saturday') || p.applicable_days.includes('sunday'))
    ) || [];
    const weekdayPromotions = promotions?.filter(p => 
      p.applicable_days && 
      ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].some(day => p.applicable_days.includes(day))
    ) || [];

    const totalUsage = promotions?.reduce((sum, p) => sum + (p.usage_count || 0), 0) || 0;
    const averageUsage = promotions?.length ? totalUsage / promotions.length : 0;

    return {
      total_promotions: promotions?.length || 0,
      active_promotions: activePromotions.length,
      day_restricted_promotions: dayRestrictedPromotions.length,
      weekend_promotions: weekendPromotions.length,
      weekday_promotions: weekdayPromotions.length,
      total_usage: totalUsage,
      average_usage: Math.round(averageUsage * 100) / 100,
      promotion_types: getPromotionTypeStats(promotions || []),
      day_distribution: getDayDistributionStats(promotions || [])
    };
  } catch (error) {
    console.error('Error getting overall stats:', error);
    return {};
  }
}

function getPromotionTypeStats(promotions: any[]) {
  const typeStats = promotions.reduce((acc, promotion) => {
    acc[promotion.type] = (acc[promotion.type] || 0) + 1;
    return acc;
  }, {});

  return typeStats;
}

function getDayDistributionStats(promotions: any[]) {
  const dayDistribution = {
    all_days: 0,
    specific_days: 0,
    weekends_only: 0,
    weekdays_only: 0
  };

  for (const promotion of promotions) {
    if (!promotion.applicable_days || promotion.applicable_days.length === 0) {
      dayDistribution.all_days++;
    } else {
      dayDistribution.specific_days++;
      
      const hasWeekend = promotion.applicable_days.some((day: string) => 
        ['saturday', 'sunday'].includes(day)
      );
      const hasWeekday = promotion.applicable_days.some((day: string) => 
        ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(day)
      );

      if (hasWeekend && !hasWeekday) {
        dayDistribution.weekends_only++;
      } else if (hasWeekday && !hasWeekend) {
        dayDistribution.weekdays_only++;
      }
    }
  }

  return dayDistribution;
}