import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Mail, Clock, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface QueueStats {
  queued: number;
  processing: number;
  completed: number;
  failed: number;
  high_priority: number;
}

export const EnhancedEmailProcessor = () => {
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessed, setLastProcessed] = useState<Date | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  const fetchQueueStats = async () => {
    try {
      // Use the communication_events table directly instead of email_processing_queue
      const { data, error } = await (supabase as any)
        .from('communication_events')
        .select('status, priority, event_type');

      if (error) throw error;

      const stats = {
        queued: data.filter(item => item.status === 'queued').length,
        processing: data.filter(item => item.status === 'processing').length,
        completed: data.filter(item => item.status === 'sent').length,
        failed: data.filter(item => item.status === 'failed').length,
        high_priority: data.filter(item => item.priority === 'high').length,
      };

      setQueueStats(stats);
    } catch (error: any) {
      console.error('Error fetching queue stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const processQueue = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-email-processor', {
        body: { 
          action: 'process_queue',
          priority: 'all' 
        }
      });

      if (error) throw error;

      toast({
        title: "Email Queue Processed",
        description: `Processed ${data.processed || 0} emails successfully.`,
      });

      setLastProcessed(new Date());
      fetchQueueStats();
    } catch (error: any) {
      console.error('Error processing queue:', error);
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process email queue",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const processHighPriority = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-email-processor', {
        body: { 
          action: 'process_queue',
          priority: 'high' 
        }
      });

      if (error) throw error;

      toast({
        title: "High Priority Emails Processed",
        description: `Processed ${data.processed || 0} high priority emails.`,
      });

      setLastProcessed(new Date());
      fetchQueueStats();
    } catch (error: any) {
      console.error('Error processing high priority:', error);
      toast({
        title: "Processing Failed",
        description: error.message || "Failed to process high priority emails",
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    fetchQueueStats();
    const interval = setInterval(fetchQueueStats, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed':
        return 'bg-green-500';
      case 'failed':
        return 'bg-red-500';
      case 'processing':
        return 'bg-blue-500';
      case 'queued':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return CheckCircle;
      case 'failed':
        return XCircle;
      case 'processing':
        return Loader2;
      case 'queued':
        return Clock;
      default:
        return Mail;
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-6">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="ml-2">Loading queue stats...</span>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Enhanced Email Processing Queue
          </CardTitle>
          <CardDescription>
            Real-time email queue monitoring and instant processing controls
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {queueStats && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {Object.entries(queueStats).map(([status, count]) => {
                const Icon = getStatusIcon(status);
                return (
                  <div key={status} className="text-center">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full ${getStatusColor(status)} text-white mb-2`}>
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="text-2xl font-bold">{count}</div>
                    <div className="text-sm text-muted-foreground capitalize">
                      {status.replace('_', ' ')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-4">
            <Button
              onClick={processHighPriority}
              disabled={isProcessing || !queueStats?.high_priority}
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <AlertTriangle className="h-4 w-4 mr-2" />
              )}
              Process High Priority ({queueStats?.high_priority || 0})
            </Button>

            <Button
              onClick={processQueue}
              disabled={isProcessing || !queueStats?.queued}
              variant="outline"
              className="flex-1"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Mail className="h-4 w-4 mr-2" />
              )}
              Process All Queue ({queueStats?.queued || 0})
            </Button>

            <Button
              onClick={fetchQueueStats}
              variant="ghost"
              size="sm"
              className="flex-shrink-0"
            >
              Refresh
            </Button>
          </div>

          {lastProcessed && (
            <div className="text-sm text-muted-foreground text-center">
              Last processed: {lastProcessed.toLocaleTimeString()}
            </div>
          )}

          {queueStats && queueStats.failed > 0 && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex items-center gap-2 text-red-700">
                <XCircle className="h-5 w-5" />
                <span className="font-medium">
                  {queueStats.failed} emails failed to send
                </span>
              </div>
              <p className="text-sm text-red-600 mt-1">
                Check the SMTP configuration and retry failed emails.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};