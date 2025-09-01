
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface FulfillmentWeekData {
  week: string;
  delivery: number;
  pickup: number;
}

export const useFulfillmentStats = () => {
  return useQuery({
    queryKey: ['fulfillment-stats'],
    queryFn: async (): Promise<FulfillmentWeekData[]> => {
      // Get orders from the last 6 weeks
      const sixWeeksAgo = new Date();
      sixWeeksAgo.setDate(sixWeeksAgo.getDate() - 42);

      const { data: orders, error } = await supabase
        .from('orders')
        .select('created_at, order_type, status')
        .gte('created_at', sixWeeksAgo.toISOString())
        .in('status', ['completed', 'delivered']);

      if (error) {
        console.error('Error fetching fulfillment stats:', error);
        throw new Error(`Failed to fetch fulfillment statistics: ${error.message}`);
      }

      // Group by week and fulfillment type
      const weeklyData: Record<string, { delivery: number; pickup: number }> = {};

      orders?.forEach(order => {
        const orderDate = new Date(order.created_at);
        const weekStart = new Date(orderDate);
        weekStart.setDate(orderDate.getDate() - orderDate.getDay()); // Start of week (Sunday)
        
        const weekKey = weekStart.toISOString().split('T')[0]; // YYYY-MM-DD format
        
        if (!weeklyData[weekKey]) {
          weeklyData[weekKey] = { delivery: 0, pickup: 0 };
        }
        
        if (order.order_type === 'delivery') {
          weeklyData[weekKey].delivery++;
        } else if (order.order_type === 'pickup') {
          weeklyData[weekKey].pickup++;
        }
      });

      // Convert to array and sort by date
      const result: FulfillmentWeekData[] = Object.entries(weeklyData)
        .map(([week, data]) => ({
          week: new Date(week).toLocaleDateString('en-US', { 
            month: 'short', 
            day: 'numeric' 
          }),
          delivery: data.delivery,
          pickup: data.pickup
        }))
        .sort((a, b) => new Date(a.week).getTime() - new Date(b.week).getTime())
        .slice(-6); // Last 6 weeks

      return result;
    },
    refetchOnWindowFocus: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};
