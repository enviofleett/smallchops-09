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
  return;
};