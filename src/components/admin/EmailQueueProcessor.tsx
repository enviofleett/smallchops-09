import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Play, RefreshCw, Shield, CheckCircle, XCircle, Clock, AlertTriangle } from 'lucide-react';
interface QueueStats {
  queued: number;
  processing: number;
  sent: number;
  failed: number;
  total: number;
}

export const EmailQueueProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [queueStats, setQueueStats] = useState<QueueStats | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);
  const { toast } = useToast();

  const fetchQueueStats = async () => {
    try {
      console.log('Fetching queue statistics...');
      
      // Get all communication events with their statuses
      const { data, error } = await supabase
        .from('communication_events')
        .select('status, retry_count, error_message');
      
      if (error) {
        console.error('Supabase error:', error);
        throw error;
      }

      if (!data) {
        console.log('No communication events found');
        setQueueStats({ queued: 0, processing: 0, sent: 0, failed: 0, total: 0 });
        setLastRefresh(new Date());
        return;
      }

      // Calculate statistics
      const stats = data.reduce((acc, event) => {
        const status = event.status;
        acc.total++;
        
        switch (status) {
          case 'queued':
            acc.queued++;
            break;
          case 'processing':
            acc.processing++;
            break;
          case 'sent':
            acc.sent++;
            break;
          case 'failed':
            acc.failed++;
            break;
        }
        
        return acc;
      }, { queued: 0, processing: 0, sent: 0, failed: 0, total: 0 });

      console.log('Queue statistics:', stats);
      setQueueStats(stats);
      setLastRefresh(new Date());
      
    } catch (error: any) {
      console.error('Error fetching queue stats:', error);
      toast({
        title: "Failed to fetch queue stats",
        description: error.message,
        variant: "destructive"
      });
    }
  };

  const processQueue = async (functionName: string, description: string) => {
    setIsProcessing(true);
    try {
      console.log(`Starting email processing with ${functionName}...`);
      
      const { data, error } = await supabase.functions.invoke(functionName);
      
      if (error) throw error;

      const processed = data?.processed || 0;
      const failed = data?.failed || 0;
      
      console.log(`Processing complete: ${processed} processed, ${failed} failed`);
      
      toast({
        title: "Processing Complete",
        description: `${description}: ${processed} emails processed, ${failed} failed`,
        variant: processed > 0 ? "default" : "destructive"
      });

      // Refresh stats after processing
      await fetchQueueStats();
      
    } catch (error: any) {
      console.error(`Error processing with ${functionName}:`, error);
      toast({
        title: "Processing Failed",
        description: error.message || `Failed to process emails with ${functionName}`,
        variant: "destructive"
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const testSMTPConnection = async () => {
    setIsTesting(true);
    try {
      console.log('Testing SMTP connection...');
      
      // Test with a sample email to verify SMTP connectivity
      const testPayload = {
        templateId: 'smtp_test',
        recipient: 'test@example.com',
        variables: {
          test_message: 'SMTP Connection Test',
          timestamp: new Date().toISOString()
        }
      };

      const { data, error } = await supabase.functions.invoke('smtp-email-sender', {
        body: testPayload
      });

      if (error) throw error;

      console.log('SMTP test result:', data);
      
      toast({
        title: "SMTP Test Successful",
        description: "SMTP connection is working properly",
        variant: "default"
      });
      
    } catch (error: any) {
      console.error('SMTP test failed:', error);
      toast({
        title: "SMTP Test Failed",
        description: error.message || "Failed to connect to SMTP server",
        variant: "destructive"
      });
    } finally {
      setIsTesting(false);
    }
  };

  // Auto-refresh every 30 seconds
  useEffect(() => {
    fetchQueueStats();
    
    const interval = setInterval(fetchQueueStats, 3 * 60 * 1000); // Reduced to 3 minutes
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent': return 'bg-green-100 text-green-800 border-green-200';
      case 'failed': return 'bg-red-100 text-red-800 border-red-200';
      case 'processing': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'queued': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent': return <CheckCircle className="h-3 w-3" />;
      case 'failed': return <XCircle className="h-3 w-3" />;
      case 'processing': return <Loader2 className="h-3 w-3 animate-spin" />;
      case 'queued': return <Clock className="h-3 w-3" />;
      default: return <AlertTriangle className="h-3 w-3" />;
    }
  };

  const getQueueHealth = () => {
    if (!queueStats) return { status: 'unknown', color: 'gray' };
    
    const { failed, total } = queueStats;
    const failureRate = total > 0 ? (failed / total) * 100 : 0;
    
    if (failureRate > 20) return { status: 'poor', color: 'red' };
    if (failureRate > 10) return { status: 'warning', color: 'yellow' };
    return { status: 'healthy', color: 'green' };
  };
  const health = getQueueHealth();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Queue Processor
          <Badge className={`ml-auto ${health.color === 'green' ? 'bg-green-100 text-green-800' : health.color === 'yellow' ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'}`}>
            {health.status}
          </Badge>
        </CardTitle>
        <CardDescription>
          Process queued emails and monitor queue status
          {lastRefresh && (
            <span className="text-xs text-muted-foreground block mt-1">
              Last updated: {lastRefresh.toLocaleTimeString()}
            </span>
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Queue Statistics */}
        {queueStats ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon('queued')}
                <span className="text-sm font-medium">Queued</span>
              </div>
              <div className="text-2xl font-bold text-yellow-600">{queueStats.queued}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon('processing')}
                <span className="text-sm font-medium">Processing</span>
              </div>
              <div className="text-2xl font-bold text-blue-600">{queueStats.processing}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon('sent')}
                <span className="text-sm font-medium">Sent</span>
              </div>
              <div className="text-2xl font-bold text-green-600">{queueStats.sent}</div>
            </div>
            
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon('failed')}
                <span className="text-sm font-medium">Failed</span>
              </div>
              <div className="text-2xl font-bold text-red-600">{queueStats.failed}</div>
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center p-6">
            <Loader2 className="h-6 w-6 animate-spin mr-2" />
            <span>Loading queue statistics...</span>
          </div>
        )}

        {/* Queue Health Summary */}
        {queueStats && (
          <div className="bg-muted/50 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">Total Events: {queueStats.total}</span>
              <Button
                variant="outline"
                size="sm"
                onClick={fetchQueueStats}
                disabled={isProcessing || isTesting}
              >
                <RefreshCw className="h-4 w-4 mr-2" />
                Refresh
              </Button>
            </div>
          </div>
        )}
        
        {/* Processing Actions */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">Queue Processing</h4>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <Button
              onClick={() => processQueue('production-email-processor', 'Production Email Processor')}
              disabled={isProcessing || isTesting}
              className="justify-start"
              size="sm"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Process (Production)
            </Button>
            
            <Button
              onClick={() => processQueue('enhanced-email-processor', 'Enhanced Email Processor')}
              disabled={isProcessing || isTesting}
              variant="outline"
              className="justify-start"
              size="sm"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Process (Enhanced)
            </Button>
            
            <Button
              onClick={() => processQueue('instant-email-processor', 'Instant Email Processor')}
              disabled={isProcessing || isTesting}
              variant="outline"
              className="justify-start"
              size="sm"
            >
              {isProcessing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <Play className="h-4 w-4 mr-2" />
              )}
              Process (Instant)
            </Button>
          </div>
        </div>

        {/* SMTP Connection Test */}
        <div className="space-y-3">
          <h4 className="text-sm font-medium">SMTP Diagnostics</h4>
          <Button
            onClick={testSMTPConnection}
            disabled={isProcessing || isTesting}
            variant="outline"
            className="w-full justify-start"
            size="sm"
          >
            {isTesting ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            Test SMTP Connection
          </Button>
        </div>

        {/* Queue Health Warnings */}
        {queueStats && queueStats.failed > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-2 text-red-800">
              <AlertTriangle className="h-4 w-4" />
              <span className="font-medium">Queue Issues Detected</span>
            </div>
            <p className="text-sm text-red-700 mt-1">
              {queueStats.failed} emails failed to send. Check SMTP settings and logs.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};