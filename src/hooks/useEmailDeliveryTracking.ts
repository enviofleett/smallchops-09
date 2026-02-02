import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';

export interface EmailDeliveryLog {
  id: string;
  message_id: string;
  recipient_email: string;
  subject: string;
  delivery_status: string;
  smtp_response: string;
  delivery_timestamp: string;
  error_message?: string;
  sender_email: string;
  provider: string;
  metadata: any;
  created_at: string;
}

export interface EmailStats {
  total_sent: number;
  delivered: number;
  bounced: number;
  complained: number;
  failed: number;
  pending: number;
  delivery_rate: number;
  bounce_rate: number;
}

export const useEmailDeliveryTracking = () => {
  // Get email delivery logs
  const deliveryLogsQuery = useQuery({
    queryKey: ['email-delivery-logs'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('smtp_delivery_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Get email statistics
  const emailStatsQuery = useQuery({
    queryKey: ['email-stats'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('smtp_delivery_logs')
        .select('delivery_status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()); // Last 24 hours

      if (error) throw error;

      const stats = data.reduce((acc, log) => {
        acc.total_sent++;
        switch (log.delivery_status) {
          case 'delivered':
            acc.delivered++;
            break;
          case 'bounced':
            acc.bounced++;
            break;
          case 'complained':
            acc.complained++;
            break;
          case 'failed':
            acc.failed++;
            break;
          default:
            acc.pending++;
        }
        return acc;
      }, {
        total_sent: 0,
        delivered: 0,
        bounced: 0,
        complained: 0,
        failed: 0,
        pending: 0,
        delivery_rate: 0,
        bounce_rate: 0
      } as EmailStats);

      if (stats.total_sent > 0) {
        stats.delivery_rate = (stats.delivered / stats.total_sent) * 100;
        stats.bounce_rate = (stats.bounced / stats.total_sent) * 100;
      }

      return stats;
    },
    refetchInterval: 60000, // Refresh every minute
  });

  const retryFailedEmail = async (emailId: string): Promise<boolean> => {
    try {
      const { error } = await supabase.functions.invoke('unified-smtp-sender', {
        body: {
          retry_email_id: emailId
        }
      });

      if (error) {
        console.error('Error retrying email:', error);
        return false;
      }

      // Refresh logs after retry
      deliveryLogsQuery.refetch();
      return true;
    } catch (error) {
      console.error('Error retrying email:', error);
      return false;
    }
  };

  return {
    deliveryLogs: deliveryLogsQuery.data || [],
    emailStats: emailStatsQuery.data || {
      total_sent: 0,
      delivered: 0,
      bounced: 0,
      complained: 0,
      failed: 0,
      pending: 0,
      delivery_rate: 0,
      bounce_rate: 0
    },
    isLoading: deliveryLogsQuery.isLoading || emailStatsQuery.isLoading,
    error: deliveryLogsQuery.error || emailStatsQuery.error,
    retryFailedEmail,
    refetch: () => {
      deliveryLogsQuery.refetch();
      emailStatsQuery.refetch();
    }
  };
};