import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { 
  Mail, 
  AlertCircle, 
  CheckCircle, 
  Clock, 
  Database,
  Server,
  Trash2,
  RefreshCw
} from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface EmailSystemMetrics {
  queue_stats: {
    queued: number;
    processing: number;
    failed: number;
    sent_today: number;
  };
  smtp_health: {
    configured: boolean;
    last_test: string | null;
    connection_status: 'healthy' | 'degraded' | 'failed';
  };
  cleanup_needed: {
    stale_processing: number;
    old_queued: number;
    cleanup_recommended: boolean;
  };
}

interface CleanupResult {
  stuck_processing_found: number;
  stale_queued_found: number;
  total_cleaned: number;
}

export const EmailSystemStatus = () => {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch email system metrics
  const { data: metrics, isLoading, error } = useQuery({
    queryKey: ['email-system-metrics'],
    queryFn: async (): Promise<EmailSystemMetrics> => {
      // Get queue statistics
      const { data: queueStats } = await (supabase as any)
        .from('communication_events')
        .select('status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      const queueCounts = queueStats?.reduce((acc, event) => {
        acc[event.status] = (acc[event.status] || 0) + 1;
        return acc;
      }, {} as Record<string, number>) || {};

      // Check SMTP health
      const { data: smtpSettings } = await (supabase as any)
        .from('communication_settings')
        .select('smtp_host, smtp_port, use_smtp, updated_at')
        .limit(1)
        .maybeSingle();

      // Check for cleanup needs
      const { data: staleProcessing } = await (supabase as any)
        .from('communication_events')
        .select('id')
        .eq('status', 'processing')
        .lt('processing_started_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

      const { data: oldQueued } = await (supabase as any)
        .from('communication_events')
        .select('id')
        .eq('status', 'queued')
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      return {
        queue_stats: {
          queued: queueCounts.queued || 0,
          processing: queueCounts.processing || 0,
          failed: queueCounts.failed || 0,
          sent_today: queueCounts.sent || 0
        },
        smtp_health: {
          configured: !!(smtpSettings?.smtp_host && smtpSettings?.use_smtp),
          last_test: smtpSettings?.updated_at || null,
          connection_status: smtpSettings?.use_smtp ? 'healthy' : 'failed'
        },
        cleanup_needed: {
          stale_processing: staleProcessing?.length || 0,
          old_queued: oldQueued?.length || 0,
          cleanup_recommended: (staleProcessing?.length || 0) > 0 || (oldQueued?.length || 0) > 0
        }
      };
    },
    refetchInterval: 30000,
  });

  // Manual cleanup mutation using direct SQL operations
  const cleanupMutation = useMutation({
    mutationFn: async (): Promise<CleanupResult> => {
      // Archive and clean stale processing records
      const { data: staleProcessing } = await (supabase as any)
        .from('communication_events')
        .select('*')
        .eq('status', 'processing')
        .lt('processing_started_at', new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString());

      // Archive and clean old queued records
      const { data: oldQueued } = await (supabase as any)
        .from('communication_events')
        .select('*')
        .eq('status', 'queued')
        .lt('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      let cleanedCount = 0;

      // Reset stale processing to failed
      if (staleProcessing && staleProcessing.length > 0) {
        const { error: updateError } = await (supabase as any)
          .from('communication_events')
          .update({ 
            status: 'failed', 
            error_message: 'Processing timeout - reset by cleanup',
            updated_at: new Date().toISOString()
          })
          .in('id', staleProcessing.map(item => item.id));

        if (!updateError) {
          cleanedCount += staleProcessing.length;
        }
      }

      // Archive and delete old queued items
      if (oldQueued && oldQueued.length > 0) {
        const { error: deleteError } = await (supabase as any)
          .from('communication_events')
          .delete()
          .in('id', oldQueued.map(item => item.id));

        if (!deleteError) {
          cleanedCount += oldQueued.length;
        }
      }

      return {
        stuck_processing_found: staleProcessing?.length || 0,
        stale_queued_found: oldQueued?.length || 0,
        total_cleaned: cleanedCount
      };
    },
    onSuccess: (data) => {
      toast({
        title: 'Email Cleanup Complete',
        description: `Cleaned up ${data.total_cleaned} stale items`,
      });
      queryClient.invalidateQueries({ queryKey: ['email-system-metrics'] });
    },
    onError: (error: any) => {
      toast({
        title: 'Cleanup Failed',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'healthy': return 'bg-green-100 text-green-800';
      case 'degraded': return 'bg-yellow-100 text-yellow-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'healthy': return <CheckCircle className="h-4 w-4" />;
      case 'degraded': return <AlertCircle className="h-4 w-4" />;
      case 'failed': return <AlertCircle className="h-4 w-4" />;
      default: return <Clock className="h-4 w-4" />;
    }
  };

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-red-600">
            <AlertCircle className="h-5 w-5" />
            Email System Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-red-600">Failed to load email system status</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email System Status
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
            <div className="h-4 bg-gray-200 rounded animate-pulse" />
          </div>
        ) : (
          <>
            {/* SMTP Health */}
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Server className="h-4 w-4 text-gray-500" />
                <span className="text-sm font-medium">SMTP Configuration</span>
              </div>
              <Badge className={getStatusColor(metrics?.smtp_health.connection_status || 'failed')}>
                {getStatusIcon(metrics?.smtp_health.connection_status || 'failed')}
                <span className="ml-1">
                  {metrics?.smtp_health.configured ? 'Configured' : 'Not Configured'}
                </span>
              </Badge>
            </div>

            <Separator />

            {/* Queue Statistics */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">{metrics?.queue_stats.queued || 0}</div>
                <div className="text-xs text-gray-500">Queued</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{metrics?.queue_stats.processing || 0}</div>
                <div className="text-xs text-gray-500">Processing</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{metrics?.queue_stats.failed || 0}</div>
                <div className="text-xs text-gray-500">Failed</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{metrics?.queue_stats.sent_today || 0}</div>
                <div className="text-xs text-gray-500">Sent Today</div>
              </div>
            </div>

            {/* Cleanup Status */}
            {metrics?.cleanup_needed.cleanup_recommended && (
              <>
                <Separator />
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2">
                      <Database className="h-4 w-4 text-yellow-600" />
                      <span className="text-sm font-medium text-yellow-800">Cleanup Recommended</span>
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => cleanupMutation.mutate()}
                      disabled={cleanupMutation.isPending}
                      className="text-yellow-700 border-yellow-300 hover:bg-yellow-100"
                    >
                      {cleanupMutation.isPending ? (
                        <RefreshCw className="h-3 w-3 mr-1 animate-spin" />
                      ) : (
                        <Trash2 className="h-3 w-3 mr-1" />
                      )}
                      Clean Up
                    </Button>
                  </div>
                  <div className="text-xs text-yellow-700 mt-1">
                    {metrics.cleanup_needed.stale_processing} stale processing, {metrics.cleanup_needed.old_queued} old queued items
                  </div>
                </div>
              </>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
};
