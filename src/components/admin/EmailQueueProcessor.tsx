import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Play, RefreshCw } from 'lucide-react';

export const EmailQueueProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueStats, setQueueStats] = useState<any>(null);
  const { toast } = useToast();

  const fetchQueueStats = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_events')
        .select('status')
        .eq('status', 'queued');

      if (error) throw error;

      setQueueStats({
        queued: data?.length || 0
      });
    } catch (error: any) {
      console.error('Error fetching queue stats:', error);
    }
  };

  const processQueue = async (functionName: string, description: string) => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke(functionName);

      if (error) throw error;

      toast({
        title: "Processing Complete",
        description: `${description}: ${data?.processed || 0} emails processed, ${data?.failed || 0} failed`,
      });

      // Refresh stats
      await fetchQueueStats();
    } catch (error: any) {
      console.error(`Error processing with ${functionName}:`, error);
      toast({
        title: "Processing Failed",
        description: error.message || `Failed to process emails with ${functionName}`,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Queue Processor
        </CardTitle>
        <CardDescription>
          Manually trigger email processing for queued welcome emails
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <Button
            onClick={fetchQueueStats}
            variant="outline"
            size="sm"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Check Queue
          </Button>
          {queueStats && (
            <div className="text-sm text-muted-foreground">
              {queueStats.queued} emails queued
            </div>
          )}
        </div>

        <div className="grid gap-2">
          <Button
            onClick={() => processQueue('process-communication-events-enhanced', 'Enhanced Processor')}
            disabled={isProcessing}
            className="w-full"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Process All Queued Emails (Enhanced)
          </Button>

          <Button
            onClick={() => processQueue('instant-email-processor', 'Instant Processor')}
            disabled={isProcessing}
            variant="outline"
            className="w-full"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Process with Instant Processor
          </Button>

          <Button
            onClick={() => processQueue('instant-welcome-processor', 'Welcome Processor')}
            disabled={isProcessing}
            variant="outline"
            className="w-full"
          >
            {isProcessing ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Play className="h-4 w-4 mr-2" />
            )}
            Process Welcome Emails Only
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};