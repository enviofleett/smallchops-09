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
  let query = supabase
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
  const { data, error } = await supabase
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
  let query = supabase
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
  const { data, error } = await supabase
    .from('customer_satisfaction_ratings')
    .insert(rating)
    .select()
    .single();

  if (error) throw error;
  return data as any;
};

// Analytics Dashboard Data
export const getDeliveryAnalytics = async (filters?: {
  startDate?: string;
  endDate?: string;
}): Promise<DeliveryAnalyticsData> => {
  try {
    const startDate = filters?.startDate || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    const endDate = filters?.endDate || new Date().toISOString().split('T')[0];

    // Get performance metrics
    const metrics = await getDeliveryMetrics({ startDate, endDate });
    
    // Get customer ratings
    const ratings = await getCustomerRatings({ startDate, endDate });

    // Calculate totals
    const totalDeliveries = metrics.reduce((sum, m) => sum + m.total_deliveries, 0);
    const successfulDeliveries = metrics.reduce((sum, m) => sum + m.successful_deliveries, 0);
    const failedDeliveries = metrics.reduce((sum, m) => sum + m.failed_deliveries, 0);
    const onTimeDeliveries = metrics.reduce((sum, m) => sum + m.on_time_deliveries, 0);

    // Calculate averages
    const avgDeliveryTime = metrics.length > 0
      ? metrics.reduce((sum, m) => sum + (m.average_delivery_time || 0), 0) / metrics.length
      : 0;

    const customerSatisfactionScore = ratings.length > 0
      ? ratings.reduce((sum, r) => sum + (r.overall_rating || 0), 0) / ratings.length
      : 0;

    // Group metrics by date for daily trends
    const dailyMetricsMap = new Map<string, {
      deliveries: number;
      successful: number;
      avgTime: number;
      count: number;
    }>();

    metrics.forEach(metric => {
      const date = metric.metric_date;
      const existing = dailyMetricsMap.get(date) || { deliveries: 0, successful: 0, avgTime: 0, count: 0 };
      
      dailyMetricsMap.set(date, {
        deliveries: existing.deliveries + metric.total_deliveries,
        successful: existing.successful + metric.successful_deliveries,
        avgTime: existing.avgTime + (metric.average_delivery_time || 0),
        count: existing.count + 1
      });
    });

    const dailyMetrics = Array.from(dailyMetricsMap.entries()).map(([date, data]) => ({
      date,
      deliveries: data.deliveries,
      successRate: data.deliveries > 0 ? (data.successful / data.deliveries) * 100 : 0,
      avgTime: data.count > 0 ? data.avgTime / data.count : 0
    })).sort((a, b) => a.date.localeCompare(b.date));

    // Get driver performance (placeholder - would need driver names from joins)
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

    // Zone performance (placeholder)
    const zonePerformance: any[] = [];

    return {
      totalDeliveries,
      successfulDeliveries,
      failedDeliveries,
      averageDeliveryTime: avgDeliveryTime,
      onTimeDeliveryRate: totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 0,
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