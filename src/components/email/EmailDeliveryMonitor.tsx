import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, Clock, AlertCircle, Mail, TrendingUp, TrendingDown } from 'lucide-react';
import { format } from 'date-fns';

export const EmailDeliveryMonitor: React.FC = () => {
  // Fetch recent email events
  const { data: recentEmails, isLoading } = useQuery({
    queryKey: ['email-delivery-monitor'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_events')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Calculate statistics
  const stats = React.useMemo(() => {
    if (!recentEmails) return null;

    const total = recentEmails.length;
    const sent = recentEmails.filter(e => e.status === 'sent').length;
    const failed = recentEmails.filter(e => e.status === 'failed').length;
    const queued = recentEmails.filter(e => e.status === 'queued').length;
    const processing = recentEmails.filter(e => e.status === 'processing').length;

    const successRate = total > 0 ? ((sent / total) * 100).toFixed(1) : '0';

    return {
      total,
      sent,
      failed,
      queued,
      processing,
      successRate: parseFloat(successRate)
    };
  }, [recentEmails]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'sent':
        return <CheckCircle2 className="h-4 w-4 text-green-600" />;
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'queued':
        return <Clock className="h-4 w-4 text-blue-600" />;
      case 'processing':
        return <AlertCircle className="h-4 w-4 text-yellow-600" />;
      default:
        return <Mail className="h-4 w-4 text-gray-600" />;
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, string> = {
      sent: 'bg-green-100 text-green-800 border-green-200',
      failed: 'bg-red-100 text-red-800 border-red-200',
      queued: 'bg-blue-100 text-blue-800 border-blue-200',
      processing: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    };

    return (
      <Badge className={variants[status] || 'bg-gray-100 text-gray-800'}>
        {status}
      </Badge>
    );
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/3"></div>
          <div className="h-32 bg-muted rounded"></div>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Statistics Overview */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Emails</p>
                <p className="text-2xl font-bold">{stats.total}</p>
              </div>
              <Mail className="h-8 w-8 text-muted-foreground" />
            </div>
          </Card>

          <Card className="p-4 border-green-200 bg-green-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-green-700">Sent</p>
                <p className="text-2xl font-bold text-green-900">{stats.sent}</p>
              </div>
              <CheckCircle2 className="h-8 w-8 text-green-600" />
            </div>
          </Card>

          <Card className="p-4 border-red-200 bg-red-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-red-700">Failed</p>
                <p className="text-2xl font-bold text-red-900">{stats.failed}</p>
              </div>
              <XCircle className="h-8 w-8 text-red-600" />
            </div>
          </Card>

          <Card className="p-4 border-blue-200 bg-blue-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-blue-700">Queued</p>
                <p className="text-2xl font-bold text-blue-900">{stats.queued}</p>
              </div>
              <Clock className="h-8 w-8 text-blue-600" />
            </div>
          </Card>

          <Card className={`p-4 ${stats.successRate >= 90 ? 'border-green-200 bg-green-50' : 'border-orange-200 bg-orange-50'}`}>
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-sm ${stats.successRate >= 90 ? 'text-green-700' : 'text-orange-700'}`}>
                  Success Rate
                </p>
                <p className={`text-2xl font-bold ${stats.successRate >= 90 ? 'text-green-900' : 'text-orange-900'}`}>
                  {stats.successRate}%
                </p>
              </div>
              {stats.successRate >= 90 ? (
                <TrendingUp className="h-8 w-8 text-green-600" />
              ) : (
                <TrendingDown className="h-8 w-8 text-orange-600" />
              )}
            </div>
          </Card>
        </div>
      )}

      {/* Recent Emails List */}
      <Card className="p-6">
        <h3 className="text-lg font-semibold mb-4">Recent Email Activity</h3>
        
        <div className="space-y-3 max-h-[600px] overflow-y-auto">
          {recentEmails && recentEmails.length > 0 ? (
            recentEmails.map((email) => (
              <div
                key={email.id}
                className="flex items-start justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-start gap-3 flex-1">
                  {getStatusIcon(email.status)}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium text-sm truncate">
                        {email.recipient_email}
                      </p>
                      {getStatusBadge(email.status)}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Template: {email.template_key || 'N/A'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {format(new Date(email.created_at), 'MMM d, yyyy HH:mm:ss')}
                    </p>
                    {email.status === 'failed' && email.error_message && (
                      <p className="text-xs text-red-600 mt-1 font-mono">
                        Error: {email.error_message}
                      </p>
                    )}
                  </div>
                </div>
                
                {email.retry_count > 0 && (
                  <Badge variant="outline" className="ml-2 text-xs">
                    Retry: {email.retry_count}
                  </Badge>
                )}
              </div>
            ))
          ) : (
            <div className="text-center py-12 text-muted-foreground">
              <Mail className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p>No email activity yet</p>
              <p className="text-sm mt-1">Email events will appear here as they're sent</p>
            </div>
          )}
        </div>
      </Card>

      {/* Error Summary (if any failed emails) */}
      {stats && stats.failed > 0 && (
        <Card className="p-6 border-red-200 bg-red-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5" />
            <div>
              <h4 className="font-semibold text-red-900 mb-2">
                ⚠️ {stats.failed} Failed Email{stats.failed > 1 ? 's' : ''} Detected
              </h4>
              <p className="text-sm text-red-800 mb-3">
                Common causes and solutions:
              </p>
              <ul className="text-sm text-red-800 space-y-1 ml-4 list-disc">
                <li><strong>SMTP Authentication (535):</strong> Check your SMTP credentials in Function Secrets</li>
                <li><strong>Connection timeout:</strong> Verify SMTP host and port settings</li>
                <li><strong>Invalid recipient:</strong> Check email address format and domain validity</li>
                <li><strong>Rate limiting:</strong> Your SMTP provider may have daily/hourly sending limits</li>
              </ul>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};
