import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Loader2, Mail, Send, Clock, CheckCircle, XCircle } from 'lucide-react';

export const EmailProcessingTab = () => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [queueStats, setQueueStats] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const processEmailQueue = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-communication-events-enhanced');
      
      if (error) throw error;
      
      toast({
        title: "Email queue processed",
        description: `Processed ${data?.processed || 0} emails, ${data?.failed || 0} failed`,
      });
      
      // Refresh stats after processing
      await fetchQueueStats();
    } catch (error: any) {
      toast({
        title: "Error processing emails",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const fetchQueueStats = async () => {
    setIsLoading(true);
    try {
      const { data, error } = await supabase
        .from('communication_events')
        .select('status')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const stats = data.reduce((acc: any, event) => {
        acc[event.status] = (acc[event.status] || 0) + 1;
        return acc;
      }, {});

      setQueueStats(stats);
    } catch (error: any) {
      toast({
        title: "Error fetching stats",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'queued': return <Clock className="h-4 w-4" />;
      case 'sent': return <CheckCircle className="h-4 w-4" />;
      case 'failed': return <XCircle className="h-4 w-4" />;
      default: return <Mail className="h-4 w-4" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'queued': return 'bg-yellow-100 text-yellow-800';
      case 'sent': return 'bg-green-100 text-green-800';
      case 'failed': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Queue Management
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex gap-3">
            <Button
              onClick={processEmailQueue}
              disabled={isProcessing}
              className="flex items-center gap-2"
            >
              {isProcessing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              Process Email Queue
            </Button>
            
            <Button
              variant="outline"
              onClick={fetchQueueStats}
              disabled={isLoading}
              className="flex items-center gap-2"
            >
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Refresh Stats
            </Button>
          </div>

          {queueStats && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {Object.entries(queueStats).map(([status, count]: [string, any]) => (
                <div key={status} className="text-center p-3 border rounded-lg">
                  <div className="flex items-center justify-center gap-2 mb-1">
                    {getStatusIcon(status)}
                    <Badge className={getStatusColor(status)}>
                      {status}
                    </Badge>
                  </div>
                  <div className="text-2xl font-semibold">{count}</div>
                </div>
              ))}
            </div>
          )}

          <div className="text-sm text-muted-foreground">
            <p>• Emails are automatically processed every 5 minutes via GitHub Actions</p>
            <p>• Use "Process Email Queue" to manually trigger processing</p>
            <p>• Failed emails will be retried with exponential backoff</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};