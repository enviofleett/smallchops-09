import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface DeliveryMonitoringMetrics {
  activeDeliveries: number;
  overdueDeliveries: number;
  avgDeliveryTime: number;
  completionRate: number;
}

export const useDeliveryMonitoring = () => {
  
  useEffect(() => {
    const monitorDeliveries = async () => {
      try {
        // Check for active deliveries - simple count
        const { count: activeDeliveries } = await supabase
          .from('orders')
          .select('*', { count: 'exact', head: true })
          .eq('order_type', 'delivery')
          .in('status', ['confirmed', 'preparing', 'ready', 'out_for_delivery']);

        if (activeDeliveries && activeDeliveries > 15) {
          toast.info(`${activeDeliveries} active deliveries`, {
            description: 'High delivery volume detected',
            duration: 5000
          });
        }

        // Simple performance check using raw query to avoid type issues
        const today = new Date().toISOString().split('T')[0];
        
        // Use rpc to avoid complex type inference
        const { data: metrics } = await supabase.rpc('calculate_delivery_metrics', {
          target_date: today
        });

        // Log successful monitoring check
        console.log('Delivery monitoring check completed:', { activeDeliveries, date: today });

      } catch (error) {
        console.error('Delivery monitoring error:', error);
      }
    };

    // Monitor every 5 minutes
    const interval = setInterval(monitorDeliveries, 5 * 60 * 1000);
    
    // Initial check after 10 seconds
    const timeout = setTimeout(monitorDeliveries, 10000);

    return () => {
      clearInterval(interval);
      clearTimeout(timeout);
    };
  }, []);

  const sendDeliveryAlert = async (type: string, message: string, orderId?: string) => {
    try {
      await supabase
        .from('audit_logs')
        .insert({
          action: 'delivery_alert',
          category: 'Delivery Monitoring',
          message,
          entity_id: orderId,
          new_values: { alert_type: type, triggered_at: new Date().toISOString() }
        });

      console.log('Delivery alert sent:', { type, message, orderId });

    } catch (error) {
      console.error('Failed to send delivery alert:', error);
    }
  };

  return {
    sendDeliveryAlert
  };
};