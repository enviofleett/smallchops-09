
import { supabase } from '@/integrations/supabase/client';

export interface DeliveryPerformanceMetrics {
  id?: string;
  metric_date: string; // Date string
  driver_id?: string;
  zone_id?: string;
  total_deliveries: number;
  successful_deliveries: number;
  failed_deliveries: number;
  average_delivery_time?: number; // in minutes
  total_distance?: number;
  fuel_cost?: number;
  customer_rating?: number;
  on_time_deliveries: number;
  created_at?: string;
}

export interface CustomerSatisfactionRating {
  id?: string;
  order_id?: string;
  customer_id?: string;
  driver_id?: string;
  delivery_rating?: number;
  driver_rating?: number;
  overall_rating?: number;
  feedback?: string;
  delivery_time_rating?: number;
  created_at?: string;
}

export interface DeliveryAnalyticsData {
  totalDeliveries: number;
  successfulDeliveries: number;
  failedDeliveries: number;
  averageDeliveryTime: number;
  onTimeDeliveryRate: number;
  customerSatisfactionScore: number;
  dailyMetrics: Array<{
    date: string;
    deliveries: number;
    successRate: number;
    avgTime: number;
  }>;
  driverPerformance: Array<{
    driverId: string;
    driverName: string;
    totalDeliveries: number;
    successRate: number;
    avgRating: number;
  }>;
  zonePerformance: Array<{
    zoneId: string;
    zoneName: string;
    totalDeliveries: number;
    avgDeliveryTime: number;
    successRate: number;
  }>;
}

// Performance Metrics API
export const getDeliveryMetrics = async (filters?: {
  startDate?: string;
  endDate?: string;
  driverId?: string;
  zoneId?: string;
}): Promise<DeliveryPerformanceMetrics[]> => {
  let query = (supabase as any)
    .from('delivery_performance_metrics')
    .select('*')
    .order('metric_date', { ascending: false });

  if (filters?.startDate) {
    query = query.gte('metric_date', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('metric_date', filters.endDate);
  }

  if (filters?.driverId) {
    query = query.eq('driver_id', filters.driverId);
  }

  if (filters?.zoneId) {
    query = query.eq('zone_id', filters.zoneId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as any;
};

export const createDeliveryMetric = async (metric: Omit<DeliveryPerformanceMetrics, 'id' | 'created_at'>): Promise<DeliveryPerformanceMetrics> => {
  const { data, error } = await (supabase as any)
    .from('delivery_performance_metrics')
    .insert(metric)
    .select()
    .single();

  if (error) throw error;
  return data as any;
};

// Customer Satisfaction API
export const getCustomerRatings = async (filters?: {
  startDate?: string;
  endDate?: string;
  driverId?: string;
  orderId?: string;
}): Promise<CustomerSatisfactionRating[]> => {
  let query = (supabase as any)
    .from('customer_satisfaction_ratings')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters?.startDate) {
    query = query.gte('created_at', filters.startDate);
  }

  if (filters?.endDate) {
    query = query.lte('created_at', filters.endDate);
  }

  if (filters?.driverId) {
    query = query.eq('driver_id', filters.driverId);
  }

  if (filters?.orderId) {
    query = query.eq('order_id', filters.orderId);
  }

  const { data, error } = await query;

  if (error) throw error;
  return (data || []) as any;
};

export const createCustomerRating = async (rating: Omit<CustomerSatisfactionRating, 'id' | 'created_at'>): Promise<CustomerSatisfactionRating> => {
  const { data, error } = await (supabase as any)
    .from('customer_satisfaction_ratings')
    .insert(rating)
    .select()
    .single();

  if (error) throw error;
  return data as any;
};

// Analytics Dashboard Data - Updated to use the new delivery_analytics table
export const getDeliveryAnalytics = async (filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<DeliveryAnalyticsData> => {
  try {
    const startDate = filters?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = filters?.endDate || new Date().toISOString().split('T')[0];

    // Get delivery analytics from the new table
    const { data: deliveryData, error: deliveryError } = await (supabase as any)
      .from('delivery_analytics')
      .select('*')
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (deliveryError) throw deliveryError;

    // Get performance metrics for driver data
    const metrics = await getDeliveryMetrics({ startDate, endDate });
    
    // Get customer ratings
    const ratings = await getCustomerRatings({ startDate, endDate });

    // Calculate totals from delivery_analytics
    const totalDeliveries = deliveryData?.reduce((sum, d) => sum + d.total_deliveries, 0) || 0;
    const successfulDeliveries = deliveryData?.reduce((sum, d) => sum + d.completed_deliveries, 0) || 0;
    const failedDeliveries = deliveryData?.reduce((sum, d) => sum + d.failed_deliveries, 0) || 0;

    // Calculate averages - Fixed column name
    const avgDeliveryTime = deliveryData?.length > 0
      ? deliveryData.reduce((sum, d) => sum + (d.average_delivery_time || 0), 0) / deliveryData.length
      : 0;

    const customerSatisfactionScore = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / ratings.length
      : 0;

    // Transform delivery_analytics data for daily metrics - Fixed column name
    const dailyMetrics = (deliveryData || []).map(data => ({
      date: data.date,
      deliveries: data.total_deliveries,
      successRate: data.total_deliveries > 0 ? (data.completed_deliveries / data.total_deliveries) * 100 : 0,
      avgTime: data.average_delivery_time || 0
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Get driver performance from performance metrics
    const driverPerformanceMap = new Map<string, {
      totalDeliveries: number;
      successful: number;
      ratings: number[];
    }>();

    metrics.forEach(metric => {
      if (metric.driver_id) {
        const existing = driverPerformanceMap.get(metric.driver_id) || { 
          totalDeliveries: 0, 
          successful: 0, 
          ratings: [] 
        };
        
        driverPerformanceMap.set(metric.driver_id, {
          totalDeliveries: existing.totalDeliveries + metric.total_deliveries,
          successful: existing.successful + metric.successful_deliveries,
          ratings: [...existing.ratings, metric.customer_rating || 0].filter(r => r > 0)
        });
      }
    });

    const driverPerformance = Array.from(driverPerformanceMap.entries()).map(([driverId, data]) => ({
      driverId,
      driverName: `Driver ${driverId.substring(0, 8)}`, // Placeholder name
      totalDeliveries: data.totalDeliveries,
      successRate: data.totalDeliveries > 0 ? (data.successful / data.totalDeliveries) * 100 : 0,
      avgRating: data.ratings.length > 0 ? data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length : 0
    }));

    // Zone performance (placeholder for now)
    const zonePerformance: any[] = [];

    return {
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      averageDeliveryTime: avgDeliveryTime,
      onTimeDeliveryRate: successfulDeliveries > 0 ? (successfulDeliveries / totalDeliveries) * 100 : 0,
      customerSatisfactionScore,
      dailyMetrics,
      driverPerformance,
      zonePerformance
    };

  } catch (error) {
    console.error('Error fetching delivery analytics:', error);
    throw error;
  }
};
