import React, { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, CheckCircle, Clock, Mail, Zap, X, Trash2, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface EmailStats {
  queued: number;
  processing: number;
  sent: number;
  failed: number;
}

export const RealTimeEmailProcessor: React.FC = () => {
  const [emailStats, setEmailStats] = useState<EmailStats>({ queued: 0, processing: 0, sent: 0, failed: 0 });
  const [isProcessing, setIsProcessing] = useState(false);
  const [lastProcessed, setLastProcessed] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch current email queue statistics
  const fetchEmailStats = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_events')
        .select('status')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const stats = data.reduce((acc, event) => {
        acc[event.status as keyof EmailStats] = (acc[event.status as keyof EmailStats] || 0) + 1;
        return acc;
      }, { queued: 0, processing: 0, sent: 0, failed: 0 });

      setEmailStats(stats);
    } catch (error: any) {
      console.error('Error fetching email stats:', error);
    }
  };

  // Process email queue instantly
  const processEmailQueue = async () => {
    try {
      setIsProcessing(true);
      
      // Call the instant email processor
      const { data, error } = await supabase.functions.invoke('instant-email-processor', {
        body: { immediate: true }
      });

      if (error) throw error;

      setLastProcessed(new Date().toLocaleTimeString());
      await fetchEmailStats();
      
      toast({
        title: 'Email Queue Processed',
        description: `Processed ${data.processed || 0} emails successfully`,
      });
    } catch (error: any) {
      toast({
        title: 'Processing Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Process enhanced communication events
  const processEnhancedQueue = async () => {
    try {
      setIsProcessing(true);
      
      const { data, error } = await supabase.functions.invoke('process-communication-events-enhanced', {
        body: { batchSize: 50 }
      });

      if (error) throw error;

      setLastProcessed(new Date().toLocaleTimeString());
      await fetchEmailStats();
      
      toast({
        title: 'Enhanced Processing Complete',
        description: `Enhanced processor handled ${data.processed || 0} events`,
      });
    } catch (error: any) {
      toast({
        title: 'Enhanced Processing Failed',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearQueuedEmails = async () => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('clear-email-queue', {
        body: {
          action: 'clear_queue',
          statuses: ['queued']
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Queued Emails Cleared",
        description: `Successfully cleared ${data?.cleared_count || 0} queued emails`,
      });
      
      await fetchEmailStats();
    } catch (error) {
      console.error('Failed to clear queued emails:', error);
      toast({
        title: "Clear Failed",
        description: error instanceof Error ? error.message : 'Failed to clear queued emails',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const clearFailedEmails = async () => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('clear-email-queue', {
        body: {
          action: 'clear_queue',
          statuses: ['failed']
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Failed Emails Cleared",
        description: `Successfully cleared ${data?.cleared_count || 0} failed emails`,
      });
      
      await fetchEmailStats();
    } catch (error) {
      console.error('Failed to clear failed emails:', error);
      toast({
        title: "Clear Failed",
        description: error instanceof Error ? error.message : 'Failed to clear failed emails',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const retryFailedEmails = async () => {
    try {
      setIsProcessing(true);
      const { data, error } = await supabase.functions.invoke('clear-email-queue', {
        body: {
          action: 'retry_failed',
          statuses: ['failed']
        }
      });
      
      if (error) throw error;
      
      toast({
        title: "Failed Emails Reset for Retry",
        description: `Successfully reset ${data?.retry_count || 0} failed emails back to queue`,
      });
      
      await fetchEmailStats();
    } catch (error) {
      console.error('Failed to retry failed emails:', error);
      toast({
        title: "Retry Failed",
        description: error instanceof Error ? error.message : 'Failed to retry failed emails',
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  // Set up real-time subscription for email status updates
  useEffect(() => {
    fetchEmailStats();

    const channel = supabase
      .channel('email-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'communication_events'
        },
        () => {
          fetchEmailStats();
        }
      )
      .subscribe();

    // Auto-refresh every 30 seconds
    const interval = setInterval(fetchEmailStats, 30000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued': return 'bg-blue-500';
      case 'processing': return 'bg-yellow-500';
      case 'sent': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued': return <Clock className="h-4 w-4" />;
      case 'processing': return <Zap className="h-4 w-4" />;
      case 'sent': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <AlertTriangle className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Zap className="h-5 w-5" />
          Real-Time Email Processing
        </CardTitle>
        <CardDescription>
          Monitor and control email queue processing in real-time
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Email Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Object.entries(emailStats).map(([status, count]) => (
            <div key={status} className="flex items-center gap-2 p-3 rounded-lg border">
              <div className={`p-2 rounded-full text-white ${getStatusColor(status)}`}>
                {getStatusIcon(status)}
              </div>
              <div>
                <div className="text-2xl font-bold">{count}</div>
                <div className="text-sm text-muted-foreground capitalize">{status}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Processing Controls */}
        <div className="flex flex-col sm:flex-row gap-3">
          <Button 
            onClick={processEmailQueue}
            disabled={isProcessing}
            variant="default"
            className="flex-1"
          >
            <Zap className="h-4 w-4 mr-2" />
            {isProcessing ? 'Processing...' : 'Process Queue Instantly'}
          </Button>
          
          <Button 
            onClick={processEnhancedQueue}
            disabled={isProcessing}
            variant="outline"
            className="flex-1"
          >
            <Mail className="h-4 w-4 mr-2" />
            Enhanced Processing
          </Button>
        </div>

        {/* Queue Management Controls */}
        <div className="flex flex-col sm:flex-row gap-3 pt-3 border-t">
          <Button 
            onClick={clearQueuedEmails}
            disabled={isProcessing || emailStats.queued === 0}
            variant="destructive"
            className="flex-1"
          >
            <Trash2 className="h-4 w-4 mr-2" />
            Clear Queued ({emailStats.queued})
          </Button>
          
          <Button 
            onClick={clearFailedEmails}
            disabled={isProcessing || emailStats.failed === 0}
            variant="destructive"
            className="flex-1"
          >
            <X className="h-4 w-4 mr-2" />
            Clear Failed ({emailStats.failed})
          </Button>
          
          <Button 
            onClick={retryFailedEmails}
            disabled={isProcessing || emailStats.failed === 0}
            variant="outline"
            className="flex-1"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Retry Failed
          </Button>
        </div>

        {/* Status Indicators */}
        <div className="flex flex-wrap gap-2">
          <Badge variant={emailStats.queued > 0 ? "destructive" : "secondary"}>
            {emailStats.queued} Queued
          </Badge>
          <Badge variant={emailStats.processing > 0 ? "default" : "secondary"}>
            {emailStats.processing} Processing
          </Badge>
          <Badge variant="secondary">
            {emailStats.sent} Sent
          </Badge>
          {emailStats.failed > 0 && (
            <Badge variant="destructive">
              {emailStats.failed} Failed
            </Badge>
          )}
        </div>

        {/* Last Processed Info */}
        {lastProcessed && (
          <div className="text-sm text-muted-foreground">
            Last processed: {lastProcessed}
          </div>
        )}

        {/* Alert for pending emails */}
        {emailStats.queued > 0 && (
          <div className="flex items-center gap-2 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
            <AlertTriangle className="h-4 w-4 text-yellow-600" />
            <span className="text-sm text-yellow-800 dark:text-yellow-200">
              {emailStats.queued} emails waiting to be processed
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};