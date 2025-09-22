import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Mail, AlertCircle, CheckCircle, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface EmailEvent {
  id: string;
  event_type: string;
  recipient_email: string;
  status: string;
  template_key: string;
  created_at: string;
  sent_at: string | null;
  error_message: string | null;
  retry_count: number;
  order_id: string | null;
}

export function EmailStatusMonitor() {
  const [isRefreshing, setIsRefreshing] = useState(false);

  // Query recent email events
  const { data: emailEvents, isLoading, refetch } = useQuery({
    queryKey: ['email-status-monitor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return data as EmailEvent[];
    },
    staleTime: 30000, // 30 seconds
    refetchInterval: 60000, // Refetch every minute
  });

  // Query email stats
  const { data: emailStats } = useQuery({
    queryKey: ['email-stats-today'],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      
      const { data, error } = await supabase
        .from('communication_events')
        .select('status')
        .gte('created_at', today);

      if (error) throw error;

      const stats = data.reduce((acc: any, event: any) => {
        acc[event.status] = (acc[event.status] || 0) + 1;
        acc.total = (acc.total || 0) + 1;
        return acc;
      }, {});

      return stats;
    },
    staleTime: 300000, // 5 minutes
  });

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle className="h-4 w-4 text-green-500" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-500" />;
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-500" />;
      case 'queued':
        return <Mail className="h-4 w-4 text-yellow-500" />;
      default:
        return <AlertCircle className="h-4 w-4 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'sent':
        return 'bg-green-100 text-green-800';
      case 'failed':
        return 'bg-red-100 text-red-800';
      case 'processing':
        return 'bg-blue-100 text-blue-800';
      case 'queued':
        return 'bg-yellow-100 text-yellow-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Email Status Monitor
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Email Stats Summary */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Today's Email Stats
          </CardTitle>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={cn("h-4 w-4", isRefreshing && "animate-spin")} />
          </Button>
        </CardHeader>
        <CardContent>
          {emailStats ? (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold">{emailStats.total || 0}</div>
                <div className="text-sm text-muted-foreground">Total</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">{emailStats.sent || 0}</div>
                <div className="text-sm text-muted-foreground">Sent</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-yellow-600">{emailStats.queued || 0}</div>
                <div className="text-sm text-muted-foreground">Queued</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-red-600">{emailStats.failed || 0}</div>
                <div className="text-sm text-muted-foreground">Failed</div>
              </div>
            </div>
          ) : (
            <div className="text-center text-muted-foreground">No data available</div>
          )}
        </CardContent>
      </Card>

      {/* Recent Email Events */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Email Events</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {emailEvents && emailEvents.length > 0 ? (
              emailEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    {getStatusIcon(event.status)}
                    <div>
                      <div className="font-medium truncate">{event.recipient_email}</div>
                      <div className="text-sm text-muted-foreground">
                        {event.template_key} • {new Date(event.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {event.retry_count > 0 && (
                      <Badge variant="outline" className="text-xs">
                        Retry {event.retry_count}
                      </Badge>
                    )}
                    <Badge className={cn("text-xs", getStatusColor(event.status))}>
                      {event.status}
                    </Badge>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-center text-muted-foreground py-8">
                No email events found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}