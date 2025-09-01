
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export interface WeeklyFulfillmentStats {
  week: string;
  delivery: number;
  pickup: number;
  total: number;
}

export const useFulfillmentStats = () => {
  const [data, setData] = useState<WeeklyFulfillmentStats[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchFulfillmentStats = async () => {
    try {
      setIsLoading(true);
      setError(null);
      
      console.log('Fetching weekly fulfillment statistics...');
      
      // Get orders from the last 8 weeks
      const eightWeeksAgo = new Date();
      eightWeeksAgo.setDate(eightWeeksAgo.getDate() - 56);
      
      const { data: orders, error: ordersError } = await supabase
        .from('orders')
        .select('order_type, order_time, status')
        .gte('order_time', eightWeeksAgo.toISOString())
        .in('order_type', ['delivery', 'pickup'])
        .not('status', 'eq', 'cancelled');

      if (ordersError) {
        throw ordersError;
      }

      console.log('Raw orders data:', orders?.length || 0, 'orders');

      // Group orders by week
      const weeklyStats = new Map<string, { delivery: number; pickup: number }>();
      
      orders?.forEach(order => {
        const orderDate = new Date(order.order_time);
        
        // Get the start of the week (Sunday)
        const startOfWeek = new Date(orderDate);
        startOfWeek.setDate(orderDate.getDate() - orderDate.getDay());
        
        // Format as "MMM DD" for the week start
        const weekKey = startOfWeek.toLocaleDateString('en-US', { 
          month: 'short', 
          day: '2-digit' 
        });
        
        if (!weeklyStats.has(weekKey)) {
          weeklyStats.set(weekKey, { delivery: 0, pickup: 0 });
        }
        
        const stats = weeklyStats.get(weekKey)!;
        if (order.order_type === 'delivery') {
          stats.delivery++;
        } else if (order.order_type === 'pickup') {
          stats.pickup++;
        }
      });

      // Convert to array and sort by date
      const statsArray: WeeklyFulfillmentStats[] = Array.from(weeklyStats.entries())
        .map(([week, stats]) => ({
          week,
          delivery: stats.delivery,
          pickup: stats.pickup,
          total: stats.delivery + stats.pickup
        }))
        .sort((a, b) => {
          // Parse dates for proper sorting
          const dateA = new Date(a.week + ', 2024');
          const dateB = new Date(b.week + ', 2024');
          return dateA.getTime() - dateB.getTime();
        })
        .slice(-6); // Keep only the last 6 weeks

      console.log('Processed fulfillment stats:', statsArray);
      setData(statsArray);
      
    } catch (err) {
      console.error('Error fetching fulfillment stats:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to load fulfillment statistics';
      setError(errorMessage);
      
      // Set fallback empty data
      setData([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchFulfillmentStats();
  }, []);

  const refresh = () => {
    fetchFulfillmentStats();
  };

  return {
    data,
    isLoading,
    error,
    refresh
  };
};
