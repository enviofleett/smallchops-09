import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Play, RefreshCw, Trash2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

export const EmailQueueManager: React.FC = () => {
  const [processing, setProcessing] = useState(false);
  const queryClient = useQueryClient();

  // Get queue statistics
  const { data: queueStats, isLoading } = useQuery({
    queryKey: ['email-queue-stats'],
    queryFn: async () => {
      const { count: queuedCount } = await supabase
        .from('communication_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued');

      const { count: failedCount } = await supabase
        .from('communication_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'failed');

      const { count: nullTemplateCount } = await supabase
        .from('communication_events')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'queued')
        .is('template_key', null);

      return {
        queued: queuedCount || 0,
        failed: failedCount || 0,
        nullTemplates: nullTemplateCount || 0
      };
    },
    refetchInterval: 10000 // Refresh every 10 seconds
  });

  // Manual process trigger
  const processMutation = useMutation({
    mutationFn: async (batchSize: number = 50) => {
      const { data, error } = await supabase.functions.invoke('process-communication-events-enhanced', {
        body: { batchSize, immediate_processing: true }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Processed ${data.processed} emails, ${data.failed} failed`);
      queryClient.invalidateQueries({ queryKey: ['email-queue-stats'] });
      queryClient.invalidateQueries({ queryKey: ['email-delivery-monitor'] });
    },
    onError: (error: any) => {
      toast.error(`Processing failed: ${error.message}`);
    }
  });

  // Fix NULL template keys
  const fixNullTemplatesMutation = useMutation({
    mutationFn: async () => {
      // Call a new edge function to fix null templates
      const { data, error } = await supabase.functions.invoke('fix-email-template-keys', {
        body: { dry_run: false }
      });

      if (error) throw error;
      return data;
    },
    onSuccess: (data) => {
      toast.success(`Fixed ${data.fixed_count} template keys`);
      queryClient.invalidateQueries({ queryKey: ['email-queue-stats'] });
    },
    onError: (error: any) => {
      toast.error(`Fix failed: ${error.message}`);
    }
  });

  // Clear failed emails (delete permanently after review)
  const clearFailedMutation = useMutation({
    mutationFn: async () => {
      // Delete failed emails older than 7 days
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      const { error } = await supabase
        .from('communication_events')
        .delete()
        .eq('status', 'failed')
        .lt('created_at', sevenDaysAgo.toISOString());
        
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('Old failed emails cleared');
      queryClient.invalidateQueries({ queryKey: ['email-queue-stats'] });
    },
    onError: (error: any) => {
      toast.error(`Clear failed: ${error.message}`);
    }
  });

  const handleProcessQueue = async () => {
    setProcessing(true);
    try {
      await processMutation.mutateAsync(50);
    } finally {
      setProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  const hasIssues = (queueStats?.nullTemplates || 0) > 0 || (queueStats?.queued || 0) > 100;

  return (
    <div className="space-y-6">
      {/* Alert Banner */}
      {hasIssues && (
        <Card className="p-4 border-orange-200 bg-orange-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-orange-600 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-orange-900 mb-2">Action Required</h4>
              <ul className="text-sm text-orange-800 space-y-1">
                {queueStats.nullTemplates > 0 && (
                  <li>• {queueStats.nullTemplates} emails have missing template keys (will fail)</li>
                )}
                {queueStats.queued > 100 && (
                  <li>• {queueStats.queued} emails in queue (should be processed)</li>
                )}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Queue Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-muted-foreground">Queued</p>
              <p className="text-3xl font-bold">{queueStats?.queued || 0}</p>
            </div>
            <RefreshCw className="h-8 w-8 text-blue-600" />
          </div>
        </Card>

        <Card className="p-4 border-red-200 bg-red-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-700">Failed</p>
              <p className="text-3xl font-bold text-red-900">{queueStats?.failed || 0}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-red-600" />
          </div>
        </Card>

        <Card className="p-4 border-orange-200 bg-orange-50">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-orange-700">Missing Templates</p>
              <p className="text-3xl font-bold text-orange-900">{queueStats?.nullTemplates || 0}</p>
            </div>
            <AlertCircle className="h-8 w-8 text-orange-600" />
          </div>
        </Card>
      </div>

      {/* Actions */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Queue Management</h3>
        
        <div className="space-y-3">
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div>
              <h4 className="font-medium">Process Queue Now</h4>
              <p className="text-sm text-muted-foreground">
                Manually trigger email processing (batch of 50)
              </p>
            </div>
            <Button
              onClick={handleProcessQueue}
              disabled={processing || (queueStats?.queued || 0) === 0}
            >
              <Play className="h-4 w-4 mr-2" />
              {processing ? 'Processing...' : 'Process Now'}
            </Button>
          </div>

          {queueStats.nullTemplates > 0 && (
            <div className="flex items-center justify-between p-4 border border-orange-200 rounded-lg bg-orange-50">
              <div>
                <h4 className="font-medium text-orange-900">Fix Missing Template Keys</h4>
                <p className="text-sm text-orange-700">
                  Auto-assign correct templates to {queueStats.nullTemplates} emails
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => fixNullTemplatesMutation.mutate()}
                disabled={fixNullTemplatesMutation.isPending}
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Fix Now
              </Button>
            </div>
          )}

          {queueStats.failed > 0 && (
            <div className="flex items-center justify-between p-4 border border-red-200 rounded-lg bg-red-50">
              <div>
                <h4 className="font-medium text-red-900">Clear Old Failed Emails</h4>
                <p className="text-sm text-red-700">
                  Delete failed emails older than 7 days ({queueStats.failed} total failed)
                </p>
              </div>
              <Button
                variant="outline"
                onClick={() => clearFailedMutation.mutate()}
                disabled={clearFailedMutation.isPending}
              >
                <Trash2 className="h-4 w-4 mr-2" />
                Clear Old
              </Button>
            </div>
          )}
        </div>
      </Card>

      {/* Setup Instructions */}
      <Card className="p-6 border-blue-200 bg-blue-50">
        <h3 className="font-semibold text-blue-900 mb-3">🔧 Setup Automated Processing</h3>
        <div className="text-sm text-blue-800 space-y-2">
          <p><strong>To enable automatic email processing:</strong></p>
          <ol className="list-decimal ml-5 space-y-1">
            <li>Set up a cron job to call <code className="bg-blue-100 px-1 rounded">email-queue-processor-cron</code> every 5 minutes</li>
            <li>Or use an external service like <a href="https://cron-job.org" className="underline" target="_blank">cron-job.org</a></li>
            <li>Endpoint: <code className="bg-blue-100 px-1 rounded">https://your-project.supabase.co/functions/v1/email-queue-processor-cron</code></li>
          </ol>
        </div>
      </Card>
    </div>
  );
};
