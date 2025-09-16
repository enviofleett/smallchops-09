import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useEmailDeliveryTracking } from '@/hooks/useEmailDeliveryTracking';
import { formatDistanceToNow } from 'date-fns';
import { 
  Mail, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertTriangle, 
  RefreshCw,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export const EmailDeliveryDashboard = () => {
  const { 
    deliveryLogs, 
    emailStats, 
    isLoading, 
    error, 
    retryFailedEmail, 
    refetch 
  } = useEmailDeliveryTracking();
  const { toast } = useToast();

  const handleRetryEmail = async (messageId: string) => {
    const success = await retryFailedEmail(messageId);
    if (success) {
      toast({
        title: "Email Retry Initiated",
        description: "The failed email has been queued for retry",
      });
    } else {
      toast({
        title: "Retry Failed",
        description: "Unable to retry the email. Please try again.",
        variant: "destructive",
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered':
        return <CheckCircle className="w-4 h-4 text-green-500" />;
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
      bounced: "destructive",
      failed: "destructive",
      complained: "secondary",
      sent: "outline"
    };

    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  if (isLoading) {
    return <div>Loading email delivery data...</div>;
  }

  if (error) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-red-500">
            Error loading email delivery data
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-semibold">Email Delivery Dashboard</h3>
          <p className="text-sm text-muted-foreground">
            Monitor email delivery status and performance
          </p>
        </div>
        <Button onClick={refetch} variant="outline" size="sm">
          <RefreshCw className="w-4 h-4 mr-2" />
          Refresh
        </Button>
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
              <Mail className="w-8 h-8 text-blue-500" />
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
              <TrendingUp className="w-8 h-8 text-green-500" />
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
              <TrendingDown className="w-8 h-8 text-red-500" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Email Logs */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Email Deliveries</CardTitle>
          <CardDescription>
            Last 100 email delivery attempts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {deliveryLogs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No email delivery logs found
              </div>
            ) : (
              deliveryLogs.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    {getStatusIcon(log.delivery_status)}
                    <div>
                      <p className="font-medium">{log.subject}</p>
                      <p className="text-sm text-muted-foreground">
                        To: {log.recipient_email}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {formatDistanceToNow(new Date(log.delivery_timestamp || log.created_at), { addSuffix: true })}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <Badge variant="outline" className="text-xs">
                      {log.provider}
                    </Badge>
                    {getStatusBadge(log.delivery_status)}
                    
                    {(log.delivery_status === 'failed' || log.delivery_status === 'bounced') && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleRetryEmail(log.message_id)}
                      >
                        <RefreshCw className="w-3 h-3 mr-1" />
                        Retry
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};