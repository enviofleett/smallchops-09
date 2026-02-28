import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEmailDeliveryTracking } from '@/hooks/useEmailDeliveryTracking';
import { formatDistanceToNow } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Send
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const EmailDeliveryDashboard: React.FC = () => {
  const { 
    deliveryLogs, 
    emailStats, 
    isLoading, 
    error, 
    retryFailedEmail, 
    refetch 
  } = useEmailDeliveryTracking();
  const { toast } = useToast();

  // Get communication events for enhanced visibility
  const { data: communicationEvents = [], isLoading: isLoadingEvents } = useQuery({
    queryKey: ['communication-events'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('communication_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const handleRetryEmail = async (messageId: string) => {
    const success = await retryFailedEmail(messageId);
    
    if (success) {
      toast({
        title: "Email Retry Successful",
        description: "The email has been queued for retry.",
      });
    } else {
      toast({
        title: "Email Retry Failed",
        description: "Unable to retry the email. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'processing':
        return <RefreshCw className="w-4 h-4 animate-spin text-blue-500" />;
      case 'queued':
        return <Clock className="w-4 h-4 text-yellow-500" />;
      case 'bounced':
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />;
      case 'complained':
        return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      default:
        return <Clock className="w-4 h-4 text-blue-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      delivered: "default",
      sent: "default",
      bounced: "destructive",
      failed: "destructive",
      complained: "secondary",
      processing: "secondary",
      queued: "outline"
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const processQueue = async () => {
    try {
      const { error } = await supabase.functions.invoke('unified-email-queue-processor');
      if (error) throw error;
      
      toast({
        title: "Email Processing Started",
        description: "The email queue is being processed.",
      });
      
      // Refresh data after processing
      setTimeout(() => {
        refetch();
      }, 2000);
    } catch (error) {
      toast({
        title: "Processing Failed",
        description: "Unable to process email queue. Please check configuration.",
        variant: "destructive",
      });
    }
  };

  if (isLoading || isLoadingEvents) {
    return (
      <div className="flex items-center justify-center p-8">
        <RefreshCw className="w-6 h-6 animate-spin mr-2" />
        Loading email delivery data...
      </div>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-red-600">Error Loading Email Data</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Unable to load email delivery information. Please try refreshing the page.
          </p>
          <Button 
            onClick={refetch} 
            className="mt-4"
            variant="outline"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Email Delivery Dashboard</h2>
          <p className="text-muted-foreground">
            Monitor email delivery status and queue processing
          </p>
        </div>
        <div className="flex gap-2">
          <Button 
            onClick={processQueue}
            className="flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Process Queue
          </Button>
          <Button 
            onClick={refetch} 
            variant="outline"
            className="flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
        </div>
      </div>

      {/* Email Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Total Sent</p>
                <p className="text-2xl font-bold">{emailStats.total_sent}</p>
              </div>
              <Mail className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delivery Rate</p>
                <p className="text-2xl font-bold">{emailStats.delivery_rate.toFixed(1)}%</p>
              </div>
              {emailStats.delivery_rate >= 95 ? (
                <TrendingUp className="w-8 h-8 text-green-500" />
              ) : (
                <TrendingDown className="w-8 h-8 text-yellow-500" />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Delivered</p>
                <p className="text-2xl font-bold">{emailStats.delivered}</p>
              </div>
              <CheckCircle className="w-8 h-8 text-green-500" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Bounce Rate</p>
                <p className="text-2xl font-bold">{emailStats.bounce_rate.toFixed(1)}%</p>
              </div>
              {emailStats.bounce_rate <= 2 ? (
                <CheckCircle className="w-8 h-8 text-green-500" />
              ) : (
                <AlertTriangle className="w-8 h-8 text-yellow-500" />
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Communication Events - Production Email Queue */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="w-5 h-5" />
            Email Queue Status (Production)
          </CardTitle>
          <CardDescription>
            Live email processing queue showing communication events
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {communicationEvents.map((event: any) => (
              <div key={event.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(event.status)}
                    <span className="text-sm font-medium">{event.template_key || event.event_type}</span>
                    {event.priority === 'high' && (
                      <Badge variant="destructive" className="text-xs">High Priority</Badge>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground">To: {event.recipient_email}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(event.created_at))} ago</span>
                    {event.retry_count > 0 && <span>Retries: {event.retry_count}</span>}
                    {event.external_id && <span>ID: {event.external_id}</span>}
                  </div>
                  {event.error_message && (
                    <p className="text-xs text-red-500 mt-1">Error: {event.error_message}</p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(event.status)}
                  {event.status === 'failed' && event.retry_count < 3 && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRetryEmail(event.id)}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {communicationEvents.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No email events found
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* SMTP Delivery Logs */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="w-5 h-5" />
            Recent Email Delivery Logs
          </CardTitle>
          <CardDescription>
            Historical email delivery tracking from SMTP provider
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {deliveryLogs.map((log: any) => (
              <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(log.delivery_status)}
                    <span className="text-sm font-medium">{log.subject}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">To: {log.recipient_email}</p>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatDistanceToNow(new Date(log.created_at))} ago</span>
                    <span>Provider: {log.provider}</span>
                    {log.message_id && <span>ID: {log.message_id.substring(0, 8)}...</span>}
                  </div>
                  {log.smtp_response && (
                    <p className="text-xs text-muted-foreground mt-1">
                      Response: {log.smtp_response}
                    </p>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  {getStatusIcon(log.delivery_status)}
                  {(log.delivery_status === 'failed' || log.delivery_status === 'bounced') && (
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRetryEmail(log.message_id)}
                    >
                      Retry
                    </Button>
                  )}
                </div>
              </div>
            ))}
            {deliveryLogs.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No delivery logs found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};