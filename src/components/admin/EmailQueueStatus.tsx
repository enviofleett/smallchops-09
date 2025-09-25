import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { RefreshCw, Mail, AlertTriangle, CheckCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface EmailQueueStats {
  queued: number;
  processing: number;
  sent: number;
  failed: number;
  missingTemplates: number;
}

export const EmailQueueStatus: React.FC = () => {
  const [stats, setStats] = useState<EmailQueueStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const fetchEmailStats = async () => {
    setIsLoading(true);
    try {
      // Get communication events stats
      const { data: eventStats, error: eventError } = await supabase
        .from('communication_events')
        .select('status, template_key');

      if (eventError) throw eventError;

      // Get recent SMTP delivery logs
      const { data: deliveryLogs, error: deliveryError } = await supabase
        .from('smtp_delivery_logs')
        .select('delivery_status')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

      if (deliveryError) {
        console.warn('SMTP delivery logs not available:', deliveryError);
      }

      // Calculate stats
      const queueStats: EmailQueueStats = {
        queued: eventStats.filter(e => e.status === 'queued').length,
        processing: eventStats.filter(e => e.status === 'processing').length,
        sent: eventStats.filter(e => e.status === 'sent').length,
        failed: eventStats.filter(e => e.status === 'failed').length,
        missingTemplates: eventStats.filter(e => !e.template_key).length
      };

      setStats(queueStats);
    } catch (error: any) {
      console.error('Failed to fetch email stats:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchEmailStats();
  }, []);

  const retryFailedEmails = async () => {
    try {
      const { error } = await supabase
        .from('communication_events')
        .update({ status: 'queued', retry_count: 0 })
        .eq('status', 'failed')
        .lt('retry_count', 3);

      if (error) throw error;

      await fetchEmailStats();
    } catch (error: any) {
      console.error('Failed to retry failed emails:', error);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Queue Status
        </CardTitle>
        <CardDescription>
          Monitor communication events and email delivery queue
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-amber-600">{stats.queued}</div>
              <div className="text-sm text-muted-foreground">Queued</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{stats.processing}</div>
              <div className="text-sm text-muted-foreground">Processing</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{stats.sent}</div>
              <div className="text-sm text-muted-foreground">Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{stats.failed}</div>
              <div className="text-sm text-muted-foreground">Failed</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{stats.missingTemplates}</div>
              <div className="text-sm text-muted-foreground">Missing Templates</div>
            </div>
          </div>
        )}

        <div className="flex gap-2">
          <Button 
            onClick={fetchEmailStats} 
            disabled={isLoading}
            variant="outline"
            size="sm"
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          
          {stats && stats.failed > 0 && (
            <Button 
              onClick={retryFailedEmails}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Retry Failed ({stats.failed})
            </Button>
          )}
        </div>

        {/* Status Indicators */}
        <div className="space-y-2">
          {stats && stats.queued > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-amber-500" />
              <span>{stats.queued} emails waiting to be processed</span>
            </div>
          )}
          
          {stats && stats.failed > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-red-500" />
              <span>{stats.failed} emails failed delivery (likely due to SMTP issues)</span>
            </div>
          )}
          
          {stats && stats.missingTemplates > 0 && (
            <div className="flex items-center gap-2 text-sm">
              <AlertTriangle className="h-4 w-4 text-orange-500" />
              <span>{stats.missingTemplates} events missing template keys</span>
            </div>
          )}
          
          {stats && stats.queued === 0 && stats.failed === 0 && (
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <span>Email queue is healthy</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};