/**
 * React Hook for Alert System Integration
 * Provides real-time alert monitoring and management
 */

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { sendAlert, sendCriticalAlert, getAlertSystemStatus } from '@/utils/alertSystem';
import { useToast } from '@/hooks/use-toast';

export interface AlertMetrics {
  totalAlerts: number;
  criticalAlerts: number;
  warningAlerts: number;
  alertsLast24h: number;
  topAlertTypes: Array<{
    type: string;
    count: number;
    severity: string;
  }>;
}

export interface WebhookStatus {
  name: string;
  url: string;
  lastDelivery?: string;
  successRate: number;
  recentFailures: number;
}

export const useAlertSystem = () => {
  const [alertMetrics, setAlertMetrics] = useState<AlertMetrics | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<WebhookStatus[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch alert metrics from database
  const fetchAlertMetrics = useCallback(async () => {
    try {
      const { data: notifications, error } = await supabase
        .from('alert_notifications')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      const alerts = notifications || [];
      const now = Date.now();
      const last24h = alerts.filter(a => 
        new Date(a.created_at).getTime() > now - 24 * 60 * 60 * 1000
      );

      // Calculate alert type frequency
      const typeFreq = alerts.reduce((acc, alert) => {
        const key = `${alert.message.split(':')[0]}`;
        if (!acc[key]) {
          acc[key] = { count: 0, severity: alert.severity };
        }
        acc[key].count++;
        return acc;
      }, {} as Record<string, { count: number; severity: string }>);

      const topAlertTypes = Object.entries(typeFreq)
        .map(([type, data]) => ({
          type,
          count: data.count,
          severity: data.severity
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      setAlertMetrics({
        totalAlerts: alerts.length,
        criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
        warningAlerts: alerts.filter(a => a.severity === 'warning' || a.severity === 'medium').length,
        alertsLast24h: last24h.length,
        topAlertTypes
      });
    } catch (err: any) {
      console.error('Failed to fetch alert metrics:', err);
      setError(err.message);
    }
  }, []);

  // Fetch webhook delivery status
  const fetchWebhookStatus = useCallback(async () => {
    try {
      const { data: deliveries, error } = await supabase
        .from('webhook_deliveries')
        .select('*')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Group by webhook URL and calculate metrics
      const webhookGroups = (deliveries || []).reduce((acc, delivery) => {
        const url = delivery.webhook_url;
        if (!acc[url]) {
          acc[url] = {
            deliveries: [],
            name: url.includes('slack') ? 'Slack' : 
                  url.includes('discord') ? 'Discord' : 'Generic Webhook'
          };
        }
        acc[url].deliveries.push(delivery);
        return acc;
      }, {} as Record<string, { deliveries: any[]; name: string }>);

      const status = Object.entries(webhookGroups).map(([url, group]) => {
        const successful = group.deliveries.filter(d => d.status === 'delivered').length;
        const total = group.deliveries.length;
        const recentFailures = group.deliveries
          .filter(d => d.status === 'failed')
          .filter(d => new Date(d.created_at).getTime() > Date.now() - 60 * 60 * 1000)
          .length;

        const lastDelivery = group.deliveries
          .filter(d => d.status === 'delivered')
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        return {
          name: group.name,
          url,
          lastDelivery: lastDelivery?.created_at,
          successRate: total > 0 ? (successful / total) * 100 : 100,
          recentFailures
        };
      });

      setWebhookStatus(status);
    } catch (err: any) {
      console.error('Failed to fetch webhook status:', err);
    }
  }, []);

  // Send test alert
  const sendTestAlert = useCallback(async (severity: 'medium' | 'high' | 'critical' = 'medium') => {
    try {
      await sendAlert(
        'Test Alert',
        `Test alert sent from Alert Dashboard at ${new Date().toLocaleString()}`,
        severity,
        { source: 'alert_dashboard', test: true }
      );

      toast({
        title: "Test Alert Sent",
        description: "Test alert has been sent to configured webhooks"
      });
    } catch (error: any) {
      console.error('Failed to send test alert:', error);
      toast({
        title: "Error",
        description: "Failed to send test alert",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Trigger specific alert types
  const triggerAlert = useCallback(async (
    alertType: string, 
    message: string, 
    severity: 'low' | 'medium' | 'high' | 'critical' = 'medium',
    metadata?: Record<string, any>
  ) => {
    try {
      if (severity === 'critical') {
        await sendCriticalAlert(alertType, message, metadata);
      } else {
        await sendAlert(alertType, message, severity, metadata);
      }

      toast({
        title: "Alert Triggered",
        description: `${severity.toUpperCase()} alert sent: ${alertType}`
      });
    } catch (error: any) {
      console.error('Failed to trigger alert:', error);
      toast({
        title: "Error",
        description: "Failed to trigger alert",
        variant: "destructive"
      });
    }
  }, [toast]);

  // Check system health and trigger alerts if needed
  const checkAndAlert = useCallback(async () => {
    try {
      const { data: healthCheck, error } = await supabase.functions.invoke(
        'admin-orders-manager',
        { method: 'GET' }
      );

      if (error) throw error;

      if (!healthCheck.healthy) {
        const criticalChecks = healthCheck.checks?.filter(c => c.status === 'fail') || [];
        
        for (const check of criticalChecks) {
          await sendCriticalAlert(
            'System Health Check Failed',
            `Health check "${check.name}" failed: ${check.error || 'Unknown error'}`,
            { 
              healthCheck: check,
              systemStatus: 'unhealthy',
              timestamp: new Date().toISOString()
            }
          );
        }
      }
    } catch (error: any) {
      console.error('Health check failed:', error);
    }
  }, []);

  // Get alert system status
  const getSystemStatus = useCallback(async () => {
    try {
      return getAlertSystemStatus();
    } catch (error: any) {
      console.error('Failed to get alert system status:', error);
      return null;
    }
  }, []);

  // Initialize and set up polling
  useEffect(() => {
    const loadData = async () => {
      setIsLoading(true);
      setError(null);
      
      try {
        await Promise.all([
          fetchAlertMetrics(),
          fetchWebhookStatus()
        ]);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setIsLoading(false);
      }
    };

    loadData();

    // Refresh every 30 seconds
    const interval = setInterval(loadData, 30000);
    
    return () => clearInterval(interval);
  }, [fetchAlertMetrics, fetchWebhookStatus]);

  // Set up real-time subscriptions for alerts
  useEffect(() => {
    const alertSubscription = supabase
      .channel('alert_notifications')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'alert_notifications' },
        (payload) => {
          console.log('New alert notification:', payload.new);
          // Refresh metrics when new alert is inserted
          fetchAlertMetrics();
          
          // Show toast for critical alerts
          if (payload.new.severity === 'critical') {
            toast({
              title: "Critical Alert",
              description: payload.new.message,
              variant: "destructive"
            });
          }
        }
      )
      .subscribe();

    return () => {
      alertSubscription.unsubscribe();
    };
  }, [fetchAlertMetrics, toast]);

  return {
    // State
    alertMetrics,
    webhookStatus,
    isLoading,
    error,
    
    // Actions
    sendTestAlert,
    triggerAlert,
    checkAndAlert,
    getSystemStatus,
    refreshData: () => {
      fetchAlertMetrics();
      fetchWebhookStatus();
    }
  };
};