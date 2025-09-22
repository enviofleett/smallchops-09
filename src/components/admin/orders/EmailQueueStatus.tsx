import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { RefreshCw, Mail, Clock, AlertTriangle, CheckCircle } from "lucide-react";
import { useState } from "react";

interface EmailNotification {
  id: string;
  order_number: string;
  new_status: string;
  customer_email: string;
  created_at: string;
  processed_at: string | null;
  retry_count: number;
  error_message: string | null;
}

export function EmailQueueStatus() {
  const [isProcessing, setIsProcessing] = useState(false);

  const { data: queueStats, isLoading, refetch } = useQuery({
    queryKey: ['email-queue-stats'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_status_notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;

      const notifications = data as EmailNotification[];
      const pending = notifications.filter(n => !n.processed_at && n.retry_count < 3);
      const failed = notifications.filter(n => !n.processed_at && n.retry_count >= 3);
      const processed = notifications.filter(n => n.processed_at);
      const recent = notifications.slice(0, 10);

      return {
        total: notifications.length,
        pending: pending.length,
        failed: failed.length,
        processed: processed.length,
        recent_notifications: recent
      };
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const handleProcessQueue = async () => {
    setIsProcessing(true);
    try {
      const { data, error } = await supabase.functions.invoke('process-email-notifications');
      if (error) throw error;
      
      // Refetch stats after processing
      setTimeout(() => {
        refetch();
        setIsProcessing(false);
      }, 2000);
    } catch (error) {
      console.error('Error processing queue:', error);
      setIsProcessing(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Queue Status
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-muted-foreground">Loading email queue status...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Queue Status
          </div>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isLoading}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleProcessQueue}
              disabled={isProcessing || !queueStats?.pending}
            >
              {isProcessing ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  Processing...
                </>
              ) : (
                <>
                  <Mail className="h-4 w-4" />
                  Process Queue
                </>
              )}
            </Button>
          </div>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Queue Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="text-center">
            <div className="text-2xl font-bold text-orange-600">{queueStats?.pending || 0}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <Clock className="h-3 w-3" />
              Pending
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-green-600">{queueStats?.processed || 0}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Sent
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-red-600">{queueStats?.failed || 0}</div>
            <div className="text-sm text-muted-foreground flex items-center justify-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Failed
            </div>
          </div>
          <div className="text-center">
            <div className="text-2xl font-bold text-blue-600">{queueStats?.total || 0}</div>
            <div className="text-sm text-muted-foreground">Total</div>
          </div>
        </div>

        {/* Recent Notifications */}
        {queueStats?.recent_notifications && queueStats.recent_notifications.length > 0 && (
          <div>
            <h4 className="font-medium mb-3">Recent Notifications</h4>
            <div className="space-y-2">
              {queueStats.recent_notifications.map((notification) => (
                <div
                  key={notification.id}
                  className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{notification.order_number}</div>
                    <div className="text-sm text-muted-foreground">
                      {notification.customer_email} • Status: {notification.new_status}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {notification.processed_at ? (
                      <Badge variant="default" className="bg-green-100 text-green-800">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Sent
                      </Badge>
                    ) : notification.retry_count >= 3 ? (
                      <Badge variant="destructive">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Failed
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <Clock className="h-3 w-3 mr-1" />
                        Pending
                      </Badge>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Status Message */}
        <div className="text-sm text-muted-foreground">
          {queueStats?.pending === 0 && queueStats?.failed === 0 ? (
            <div className="text-green-600 font-medium">✅ All email notifications are up to date</div>
          ) : queueStats?.pending > 0 ? (
            <div className="text-orange-600 font-medium">
              ⏳ {queueStats.pending} notification{queueStats.pending === 1 ? '' : 's'} waiting to be processed
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}