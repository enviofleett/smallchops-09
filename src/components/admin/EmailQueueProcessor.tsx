import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Mail, Play, RefreshCw } from 'lucide-react';
export const EmailQueueProcessor = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueStats, setQueueStats] = useState<any>(null);
  const {
    toast
  } = useToast();
  const fetchQueueStats = async () => {
    try {
      const {
        data,
        error
      } = await supabase.from('communication_events').select('status').eq('status', 'queued');
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
      const {
        data,
        error
      } = await supabase.functions.invoke(functionName);
      if (error) throw error;
      toast({
        title: "Processing Complete",
        description: `${description}: ${data?.processed || 0} emails processed, ${data?.failed || 0} failed`
      });

      // Refresh stats
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
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="w-5 h-5" />
          Email Queue Processor
        </CardTitle>
        <CardDescription>
          Process queued emails and monitor email system health
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            <span className="font-medium">Queued Emails: </span>
            <span className="text-muted-foreground">
              {queueStats?.queued ?? 'Loading...'}
            </span>
          </div>
          <Button
            onClick={fetchQueueStats}
            variant="outline"
            size="sm"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Button
            onClick={() => processQueue('enhanced-email-processor', 'Enhanced Email Processor')}
            disabled={isProcessing}
            className="flex items-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Process Enhanced Queue
          </Button>
          
          <Button
            onClick={() => processQueue('instant-email-processor', 'Instant Email Processor')}
            disabled={isProcessing}
            variant="outline"
            className="flex items-center gap-2"
          >
            {isProcessing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            Process Instant Queue
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};