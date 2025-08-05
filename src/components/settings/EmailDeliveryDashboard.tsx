import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Mail, Clock, CheckCircle2, AlertCircle, XCircle } from 'lucide-react';
import { useEmailService } from '@/hooks/useEmailService';

export const EmailDeliveryDashboard = () => {
  const { deliveryLogs, isLoadingLogs } = useEmailService();

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Delivery Logs
        </CardTitle>
        <CardDescription>
          Recent email delivery status and logs from SMTP provider.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoadingLogs ? (
          <div className="text-center py-4">Loading delivery logs...</div>
        ) : deliveryLogs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            No email delivery logs found. Send some emails to see delivery status here.
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-3">
              {deliveryLogs.map((log) => (
                <div key={log.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(log.delivery_status)}
                    <div>
                      <div className="font-medium text-sm">
                        {log.recipient_email}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {log.subject} • {new Date(log.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {log.provider}
                    </Badge>
                    <Badge className={`text-xs ${getStatusColor(log.delivery_status)}`}>
                      {log.delivery_status}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};