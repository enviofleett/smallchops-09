import { useState, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { getSchedulesByOrderIds } from '@/api/deliveryScheduleApi';
import { isOrderOverdue } from '@/utils/scheduleTime';
import { toast } from 'sonner';
import { OrderWithItems } from '@/api/orders';

interface OverdueOrderStats {
  total: number;
  critical: number; // Over 2 hours late
  moderate: number; // 30min - 2 hours late
  recent: number; // Just became overdue (0-30min late)
  averageDelayMinutes: number;
}

interface OverdueOrder extends OrderWithItems {
  overdue_severity: 'critical' | 'moderate' | 'recent';
  minutes_overdue: number;
}

export const useOverdueOrdersLogic = () => {
  const [autoRefreshEnabled, setAutoRefreshEnabled] = useState(true);
  const [alertsEnabled, setAlertsEnabled] = useState(true);
  const queryClient = useQueryClient();

  // Fetch orders that are paid but not delivered after due dates
  const { data: potentialOverdueOrders = [] } = useQuery({
    queryKey: ['potential-overdue-orders'],
    queryFn: async (): Promise<OrderWithItems[]> => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(*),
          delivery_zones(*),
          delivery_schedule:order_delivery_schedule!order_delivery_schedule_order_id_fkey(*)
        `)
        .eq('payment_status', 'paid')
        .not('status', 'in', '(delivered,completed,cancelled,refunded)')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as OrderWithItems[];
    },
    refetchInterval: autoRefreshEnabled ? 60000 : false, // Check every minute
    staleTime: 30000
  });

  // Since we're fetching schedules with the order, create a map
  const deliverySchedules = useMemo(() => {
    const scheduleMap: Record<string, any> = {};
    potentialOverdueOrders.forEach(order => {
      if (order.delivery_schedule) {
        scheduleMap[order.id] = order.delivery_schedule;
      }
    });
    return scheduleMap;
  }, [potentialOverdueOrders]);

  // Process overdue orders and calculate statistics
  const overdueData = useMemo(() => {
    const now = new Date();
    const overdueOrders: OverdueOrder[] = [];
    let totalDelayMinutes = 0;
    let critical = 0, moderate = 0, recent = 0;

    potentialOverdueOrders.forEach(order => {
      const schedule = deliverySchedules[order.id];
      if (!schedule) return;

      // Check if order is overdue (past delivery end time)
      if (isOrderOverdue(schedule.delivery_date, schedule.delivery_time_end)) {
        const endTime = new Date(`${schedule.delivery_date}T${schedule.delivery_time_end}`);
        const minutesOverdue = Math.floor((now.getTime() - endTime.getTime()) / (1000 * 60));
        
        let severity: 'critical' | 'moderate' | 'recent';
        if (minutesOverdue > 120) {
          severity = 'critical';
          critical++;
        } else if (minutesOverdue > 30) {
          severity = 'moderate';
          moderate++;
        } else {
          severity = 'recent';
          recent++;
        }

        totalDelayMinutes += minutesOverdue;

        overdueOrders.push({
          ...order,
          overdue_severity: severity,
          minutes_overdue: minutesOverdue
        });
      }
    });

    const stats: OverdueOrderStats = {
      total: overdueOrders.length,
      critical,
      moderate,
      recent,
      averageDelayMinutes: overdueOrders.length > 0 ? Math.round(totalDelayMinutes / overdueOrders.length) : 0
    };

    return { overdueOrders: overdueOrders.sort((a, b) => b.minutes_overdue - a.minutes_overdue), stats };
  }, [potentialOverdueOrders, deliverySchedules]);

  // Auto-escalate critical orders
  const escalateOrderMutation = useMutation({
    mutationFn: async ({ orderId, reason }: { orderId: string; reason: string }) => {
      // Update order status and add audit log
      const [orderUpdate, auditLog] = await Promise.all([
        supabase
          .from('orders')
          .update({ 
            status: 'ready', // Escalate to ready status
            updated_at: new Date().toISOString()
          })
          .eq('id', orderId),
        
        supabase
          .from('audit_logs')
          .insert({
            action: 'order_escalated',
            category: 'Order Management',
            message: `Order escalated due to delay: ${reason}`,
            entity_id: orderId
          })
      ]);

      if (orderUpdate.error) throw orderUpdate.error;
      if (auditLog.error) throw auditLog.error;

      return orderId;
    },
    onSuccess: (orderId) => {
      queryClient.invalidateQueries({ queryKey: ['potential-overdue-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success('Order escalated successfully');
    },
    onError: (error) => {
      toast.error(`Failed to escalate order: ${error.message}`);
    }
  });

  // Send notification to customer about delay
  const notifyCustomerMutation = useMutation({
    mutationFn: async ({ orderId, message }: { orderId: string; message: string }) => {
      const order = overdueData.overdueOrders.find(o => o.id === orderId);
      if (!order) throw new Error('Order not found');

      // Insert communication event for delay notification
      const { error } = await supabase
        .from('communication_events')
        .insert({
          order_id: orderId,
          event_type: 'delivery_delay_notification',
          recipient_email: '', // Will be filled by system
          template_key: 'delivery_delay',
          email_type: 'transactional',
          status: 'queued',
          variables: {
            customerName: order.customer_name,
            orderNumber: order.order_number,
            delayMessage: message,
            newEstimatedTime: new Date(Date.now() + 30 * 60 * 1000).toLocaleTimeString()
          }
        });

      if (error) throw error;
      return orderId;
    },
    onSuccess: () => {
      toast.success('Customer notification sent');
    },
    onError: (error) => {
      toast.error(`Failed to notify customer: ${error.message}`);
    }
  });

  // Bulk update overdue orders to next status
  const bulkUpdateStatusMutation = useMutation({
    mutationFn: async (orderIds: string[]) => {
      const { data, error } = await supabase
        .from('orders')
        .update({ 
          status: 'ready',
          updated_at: new Date().toISOString()
        })
        .in('id', orderIds)
        .select();

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['potential-overdue-orders'] });
      queryClient.invalidateQueries({ queryKey: ['orders'] });
      toast.success(`${data.length} overdue orders updated`);
    }
  });

  // Show alerts for new critical overdue orders
  useEffect(() => {
    if (alertsEnabled && overdueData.stats.critical > 0) {
      const criticalOrders = overdueData.overdueOrders.filter(o => o.overdue_severity === 'critical');
      if (criticalOrders.length > 0) {
        toast.error(
          `${criticalOrders.length} order${criticalOrders.length > 1 ? 's' : ''} critically overdue!`,
          {
            duration: 10000,
            action: {
              label: 'View Orders',
              onClick: () => {
                // Could navigate to orders with overdue filter
                console.log('Navigate to overdue orders');
              }
            }
          }
        );
      }
    }
  }, [overdueData.stats.critical, alertsEnabled]);

  return {
    // Data
    overdueOrders: overdueData.overdueOrders,
    overdueStats: overdueData.stats,
    
    // Loading states
    isLoading: false, // Computed locally
    
    // Mutations
    escalateOrderMutation,
    notifyCustomerMutation,
    bulkUpdateStatusMutation,
    
    // Settings
    autoRefreshEnabled,
    setAutoRefreshEnabled,
    alertsEnabled,
    setAlertsEnabled,
    
    // Computed
    isProcessing: escalateOrderMutation.isPending || 
                  notifyCustomerMutation.isPending || 
                  bulkUpdateStatusMutation.isPending,
                  
    // Helper methods
    getCriticalOrders: () => overdueData.overdueOrders.filter(o => o.overdue_severity === 'critical'),
    getModerateOrders: () => overdueData.overdueOrders.filter(o => o.overdue_severity === 'moderate'),
    getRecentOverdueOrders: () => overdueData.overdueOrders.filter(o => o.overdue_severity === 'recent'),
  };
};