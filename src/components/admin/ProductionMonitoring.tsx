import React, { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { RefreshCw, AlertTriangle, CheckCircle, XCircle, Clock } from 'lucide-react';
import { toast } from 'sonner';

interface CommunicationEventStats {
  total_events: number;
  queued_count: number;
  sent_count: number;
  failed_count: number;
  processing_count: number;
  recent_failures: Array<{
    id: string;
    event_type: string;
    recipient_email: string;
    error_message: string;
    created_at: string;
  }>;
}

interface SystemHealth {
  communication_events: CommunicationEventStats;
  recent_errors: Array<{
    id: string;
    action: string;
    message: string;
    created_at: string;
    new_values: any;
  }>;
}

export const ProductionMonitoring: React.FC = () => {
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchSystemHealth = async () => {
    try {
      setRefreshing(true);
      
      // Fetch communication events stats
      const { data: eventsData, error: eventsError } = await supabase
        .from('communication_events')
        .select('id, status, event_type, recipient_email, error_message, created_at')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false });

      if (eventsError) throw eventsError;

      // Process events stats
      const stats: CommunicationEventStats = {
        total_events: eventsData?.length || 0,
        queued_count: eventsData?.filter(e => e.status === 'queued').length || 0,
        sent_count: eventsData?.filter(e => e.status === 'sent').length || 0,
        failed_count: eventsData?.filter(e => e.status === 'failed').length || 0,
        processing_count: eventsData?.filter(e => e.status === 'processing').length || 0,
        recent_failures: eventsData?.filter(e => e.status === 'failed' && e.error_message).slice(0, 5) || []
      };

      // Fetch recent system errors from audit logs
      const { data: errorsData, error: errorsError } = await supabase
        .from('audit_logs')
        .select('id, action, message, created_at, new_values')
        .in('action', [
          'communication_event_failed',
          'communication_event_creation_failed',
          'communication_event_exception',
          'communication_event_dedupe_collision'
        ])
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .order('created_at', { ascending: false })
        .limit(10);

      setSystemHealth({
        communication_events: stats,
        recent_errors: errorsData || []
      });

    } catch (error: any) {
      console.error('Failed to fetch system health:', error);
      toast.error('Failed to load system health data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    fetchSystemHealth();
    
    // Set up real-time subscription for communication events
    const subscription = supabase
      .channel('system_monitoring')
      .on('postgres_changes', 
        { event: '*', schema: 'public', table: 'communication_events' }, 
        () => fetchSystemHealth()
      )
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'audit_logs' },
        (payload) => {
          if (payload.new.action?.includes('communication_event')) {
            fetchSystemHealth();
          }
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const getHealthStatus = () => {
    if (!systemHealth) return { status: 'unknown', color: 'gray' };
    
    const { communication_events } = systemHealth;
    const failureRate = communication_events.total_events > 0 
      ? communication_events.failed_count / communication_events.total_events 
      : 0;

    if (failureRate > 0.1) return { status: 'critical', color: 'red' };
    if (failureRate > 0.05) return { status: 'warning', color: 'yellow' };
    if (communication_events.processing_count > 20) return { status: 'warning', color: 'yellow' };
    return { status: 'healthy', color: 'green' };
  };

  const healthStatus = getHealthStatus();

  if (loading) {
    return (
      <Card className="p-6">
        <div className="flex items-center justify-center">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading system health...</span>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-2xl font-bold">Production System Health</h2>
        <Button 
          onClick={fetchSystemHealth} 
          disabled={refreshing}
          variant="outline"
          size="sm"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* System Status Overview */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Overall System Status</h3>
          <Badge 
            variant={healthStatus.color === 'green' ? 'default' : 'destructive'}
            className="capitalize"
          >
            {healthStatus.color === 'green' && <CheckCircle className="h-4 w-4 mr-1" />}
            {healthStatus.color === 'yellow' && <AlertTriangle className="h-4 w-4 mr-1" />}
            {healthStatus.color === 'red' && <XCircle className="h-4 w-4 mr-1" />}
            {healthStatus.status}
          </Badge>
        </div>
        
        {systemHealth && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {systemHealth.communication_events.total_events}
              </div>
              <div className="text-sm text-gray-600">Total Events (24h)</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {systemHealth.communication_events.sent_count}
              </div>
              <div className="text-sm text-gray-600">Sent</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">
                {systemHealth.communication_events.queued_count}
              </div>
              <div className="text-sm text-gray-600">Queued</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">
                {systemHealth.communication_events.failed_count}
              </div>
              <div className="text-sm text-gray-600">Failed</div>
            </div>
          </div>
        )}
      </Card>

      {/* Recent Communication Failures */}
      {systemHealth?.communication_events.recent_failures.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <AlertTriangle className="h-5 w-5 mr-2 text-yellow-500" />
            Recent Communication Failures
          </h3>
          <div className="space-y-3">
            {systemHealth.communication_events.recent_failures.map((failure) => (
              <Alert key={failure.id}>
                <XCircle className="h-4 w-4" />
                <AlertDescription>
                  <div className="flex justify-between items-start">
                    <div>
                      <strong>{failure.event_type}</strong> to {failure.recipient_email}
                      <br />
                      <span className="text-sm text-gray-600">{failure.error_message}</span>
                    </div>
                    <span className="text-xs text-gray-500">
                      {new Date(failure.created_at).toLocaleString()}
                    </span>
                  </div>
                </AlertDescription>
              </Alert>
            ))}
          </div>
        </Card>
      )}

      {/* Recent System Errors */}
      {systemHealth?.recent_errors.length > 0 && (
        <Card className="p-6">
          <h3 className="text-lg font-semibold mb-4 flex items-center">
            <Clock className="h-5 w-5 mr-2 text-blue-500" />
            Recent System Events
          </h3>
          <div className="space-y-2 max-h-60 overflow-y-auto">
            {systemHealth.recent_errors.map((error) => (
              <div key={error.id} className="p-3 bg-gray-50 rounded-lg text-sm">
                <div className="flex justify-between items-start">
                  <div>
                    <Badge variant="outline" className="mb-1">
                      {error.action.replace('communication_event_', '')}
                    </Badge>
                    <div>{error.message}</div>
                    {error.new_values?.order_id && (
                      <div className="text-gray-600 mt-1">
                        Order: {error.new_values.order_id}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-gray-500">
                    {new Date(error.created_at).toLocaleString()}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Health Status Explanation */}
      <Alert>
        <CheckCircle className="h-4 w-4" />
        <AlertDescription>
          <strong>System Health Status:</strong>
          <ul className="mt-2 space-y-1 text-sm">
            <li>• <strong>Healthy:</strong> &lt;5% failure rate, normal processing queue</li>
            <li>• <strong>Warning:</strong> 5-10% failure rate or high queue backlog</li>
            <li>• <strong>Critical:</strong> &gt;10% failure rate - immediate attention required</li>
          </ul>
        </AlertDescription>
      </Alert>
    </div>
  );
};