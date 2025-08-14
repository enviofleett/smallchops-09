import { supabase } from '@/integrations/supabase/client';

export interface DeliveryAnalytics {
  date: string;
  total_deliveries: number;
  completed_deliveries: number;
  failed_deliveries: number;
  total_delivery_fees: number;
  average_delivery_time_minutes: number;
  success_rate: number;
}

export interface DriverPerformance {
  driver_id: string;
  driver_name: string;
  total_deliveries: number;
  completed_deliveries: number;
  failed_deliveries: number;
  total_fees_collected: number;
  average_delivery_time: number;
  success_rate: number;
}

export interface ZonePerformance {
  zone_id: string;
  zone_name: string;
  total_deliveries: number;
  successful_deliveries: number;
  total_fees: number;
  success_rate: number;
}

export interface DeliveryReportSummary {
  total_revenue: number;
  total_deliveries: number;
  average_success_rate: number;
  average_delivery_time: number;
  period_start: string;
  period_end: string;
}

export interface DeliveryReportsData {
  daily_analytics: DeliveryAnalytics[];
  driver_performance: DriverPerformance[];
  zone_performance: ZonePerformance[];
  summary: DeliveryReportSummary;
}

export const getDeliveryReports = async (
  startDate: string,
  endDate: string
): Promise<DeliveryReportsData> => {
  const { data, error } = await supabase.rpc('get_delivery_reports', {
    start_date: startDate,
    end_date: endDate
  });

  if (error) throw error;
  
  // Type guard to ensure data is a valid object
  if (!data || typeof data !== 'object') {
    return {
      daily_analytics: [],
      driver_performance: [],
      zone_performance: [],
      summary: {
        total_revenue: 0,
        total_deliveries: 0,
        average_success_rate: 0,
        average_delivery_time: 0,
        period_start: startDate,
        period_end: endDate
      }
    };
  }
  
  return data as unknown as DeliveryReportsData;
};

export const calculateDailyAnalytics = async (date?: string): Promise<void> => {
  const targetDate = date || new Date().toISOString().split('T')[0];
  
  const { error } = await supabase.rpc('calculate_daily_delivery_analytics', {
    target_date: targetDate
  });

  if (error) throw error;
};

export const getReadyOrders = async (filters: {
  page?: number;
  pageSize?: number;
  searchQuery?: string;
  dateRange?: 'today' | 'tomorrow' | 'this_week';
}): Promise<{ orders: any[]; total: number }> => {
  let query = supabase
    .from('orders')
    .select(`
      *,
      order_items (
        id,
        product_id,
        product_name,
        quantity,
        unit_price,
        total_price,
        customizations,
        special_instructions
      ),
      order_delivery_schedule (
        id,
        delivery_date,
        delivery_time_start,
        delivery_time_end,
        requested_at,
        is_flexible,
        special_instructions,
        created_at,
        updated_at
      )
    `)
    .eq('order_type', 'delivery')
    .eq('status', 'ready'); // Only show orders with "ready" status

  // Date filtering
  if (filters.dateRange) {
    const today = new Date();
    let targetDate: string;
    
    switch (filters.dateRange) {
      case 'today':
        targetDate = today.toISOString().split('T')[0];
        break;
      case 'tomorrow':
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        targetDate = tomorrow.toISOString().split('T')[0];
        break;
      case 'this_week':
        // For this week, we'll get all ready orders from today onwards
        targetDate = today.toISOString().split('T')[0];
        query = query.gte('created_at', targetDate + 'T00:00:00.000Z');
        break;
      default:
        targetDate = today.toISOString().split('T')[0];
    }
    
    if (filters.dateRange !== 'this_week') {
      query = query.gte('created_at', targetDate + 'T00:00:00.000Z')
                  .lt('created_at', targetDate + 'T23:59:59.999Z');
    }
  }

  // Search query filtering
  if (filters.searchQuery) {
    const searchTerm = `%${filters.searchQuery.toLowerCase()}%`;
    query = query.or(`order_number.ilike.${searchTerm},customer_name.ilike.${searchTerm},customer_email.ilike.${searchTerm}`);
  }

  // Pagination
  const page = filters.page || 1;
  const pageSize = filters.pageSize || 50;
  const start = (page - 1) * pageSize;
  const end = start + pageSize - 1;

  query = query.range(start, end);
  query = query.order('created_at', { ascending: false });

  const { data, error, count } = await query;

  if (error) throw error;

  // Transform data to include delivery_schedule as a direct property
  const transformedData = data?.map(order => ({
    ...order,
    order_items: order.order_items || [],
    delivery_schedule: order.order_delivery_schedule?.[0] ? {
      ...order.order_delivery_schedule[0],
      order_id: order.id
    } : null
  })) || [];

  return {
    orders: transformedData,
    total: count || 0
  };
};

export const exportDeliveryReports = async (
  startDate: string,
  endDate: string,
  format: 'csv' | 'pdf' = 'csv'
): Promise<string> => {
  const data = await getDeliveryReports(startDate, endDate);
  
  if (format === 'csv') {
    // Generate CSV content
    const csvContent = [
      // Headers
      'Date,Total Deliveries,Completed,Failed,Revenue,Success Rate',
      // Data rows
      ...data.daily_analytics.map(day => 
        `${day.date},${day.total_deliveries},${day.completed_deliveries},${day.failed_deliveries},${day.total_delivery_fees},${day.success_rate}%`
      )
    ].join('\n');
    
    // Create and return blob URL
    const blob = new Blob([csvContent], { type: 'text/csv' });
    return URL.createObjectURL(blob);
  }
  
  // PDF export would be implemented here
  throw new Error('PDF export not yet implemented');
};