import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { AlertTriangle, Clock, CheckCircle2, RefreshCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmailWarning {
  id: string;
  order_id?: string;
  event_type: string;
  attempted_recipient_email?: string;
  error_reason: string;
  original_payload: any;
  created_at: string;
  resolved_at?: string;
  resolution_notes?: string;
}

export const EmailWarningsMonitor: React.FC = () => {
  const [warnings, setWarnings] = useState<EmailWarning[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);

  const fetchWarnings = async () => {
    try {
      const { data, error } = await supabase
        .from('communication_event_warnings')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      setWarnings(data || []);
    } catch (error: any) {
      console.error('Failed to fetch email warnings:', error);
      toast.error('Failed to load email warnings');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  const resolveWarning = async (warningId: string, notes: string) => {
    try {
      const { error } = await supabase
        .from('communication_event_warnings')
        .update({
          resolved_at: new Date().toISOString(),
          resolution_notes: notes
        })
        .eq('id', warningId);

      if (error) throw error;
      
      toast.success('Warning resolved');
      fetchWarnings();
    } catch (error: any) {
      console.error('Failed to resolve warning:', error);
      toast.error('Failed to resolve warning');
    }
  };

  const handleRefresh = () => {
    setIsRefreshing(true);
    fetchWarnings();
  };

  useEffect(() => {
    fetchWarnings();
    
    // Set up real-time subscription for new warnings
    const channel = supabase
      .channel('email_warnings')
      .on('postgres_changes', 
        { event: 'INSERT', schema: 'public', table: 'communication_event_warnings' },
        () => {
          fetchWarnings();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const unresolvedWarnings = warnings.filter(w => !w.resolved_at);
  const recentWarnings = warnings.filter(w => {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    return new Date(w.created_at) > oneHourAgo;
  });

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5" />
            Email System Warnings
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8">
            <RefreshCw className="h-6 w-6 animate-spin" />
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5" />
              Email System Warnings
            </CardTitle>
            <CardDescription>
              Monitor blocked and failed communication events
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handleRefresh}
            disabled={isRefreshing}
          >
            <RefreshCw className={`h-4 w-4 mr-2 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Summary Stats */}
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-red-50 rounded-lg border border-red-200">
            <div className="text-2xl font-bold text-red-600">{unresolvedWarnings.length}</div>
            <div className="text-sm text-red-700">Unresolved</div>
          </div>
          <div className="text-center p-3 bg-yellow-50 rounded-lg border border-yellow-200">
            <div className="text-2xl font-bold text-yellow-600">{recentWarnings.length}</div>
            <div className="text-sm text-yellow-700">Last Hour</div>
          </div>
          <div className="text-center p-3 bg-green-50 rounded-lg border border-green-200">
            <div className="text-2xl font-bold text-green-600">{warnings.filter(w => w.resolved_at).length}</div>
            <div className="text-sm text-green-700">Resolved</div>
          </div>
        </div>

        {/* Warnings List */}
        <div className="space-y-3 max-h-96 overflow-y-auto">
          {warnings.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-2 text-green-500" />
              <p>No email warnings found</p>
              <p className="text-sm">All communication events are processing normally</p>
            </div>
          ) : (
            warnings.map((warning) => (
              <div
                key={warning.id}
                className={`p-4 border rounded-lg ${
                  warning.resolved_at 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant={warning.resolved_at ? 'default' : 'destructive'}>
                        {warning.event_type}
                      </Badge>
                      {warning.order_id && (
                        <Badge variant="outline">
                          Order: {warning.order_id.slice(-8)}
                        </Badge>
                      )}
                      <div className="flex items-center text-sm text-muted-foreground">
                        <Clock className="h-3 w-3 mr-1" />
                        {new Date(warning.created_at).toLocaleString()}
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <div>
                        <span className="font-medium">Error:</span> {warning.error_reason}
                      </div>
                      {warning.attempted_recipient_email && (
                        <div>
                          <span className="font-medium">Email:</span> {warning.attempted_recipient_email}
                        </div>
                      )}
                      {warning.original_payload && (
                        <details className="text-sm">
                          <summary className="cursor-pointer text-muted-foreground hover:text-foreground">
                            View Original Payload
                          </summary>
                          <pre className="mt-2 p-2 bg-muted rounded text-xs overflow-x-auto">
                            {JSON.stringify(warning.original_payload, null, 2)}
                          </pre>
                        </details>
                      )}
                      {warning.resolution_notes && (
                        <div className="text-sm text-green-700">
                          <span className="font-medium">Resolution:</span> {warning.resolution_notes}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {!warning.resolved_at && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => resolveWarning(warning.id, 'Reviewed and acknowledged')}
                    >
                      Mark Resolved
                    </Button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
};