import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Shield, Users, Clock, AlertTriangle, CheckCircle, Mail } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export const CustomerSecurityDashboard: React.FC = () => {
  // Fetch recent customer operations
  const { data: recentOperations } = useQuery({
    queryKey: ['customer-security-operations'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          user_name,
          event_time,
          new_values,
          ip_address,
          user_agent
        `)
        .like('action', '%customer%')
        .order('event_time', { ascending: false })
        .limit(20);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  // Fetch communication events related to customer creation
  const { data: emailEvents } = useQuery({
    queryKey: ['customer-email-events'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('communication_events')
        .select(`
          id,
          event_type,
          recipient_email,
          status,
          created_at,
          variables
        `)
        .eq('event_type', 'customer_welcome')
        .order('created_at', { ascending: false })
        .limit(10);

      if (error) throw error;
      return data || [];
    },
    refetchInterval: 30000,
  });

  const getOperationBadgeVariant = (action: string) => {
    if (action.includes('created')) return 'default';
    if (action.includes('updated')) return 'secondary';
    if (action.includes('failed')) return 'destructive';
    return 'outline';
  };

  const getOperationIcon = (action: string) => {
    if (action.includes('created')) return <Users className="h-3 w-3" />;
    if (action.includes('updated')) return <CheckCircle className="h-3 w-3" />;
    if (action.includes('failed')) return <AlertTriangle className="h-3 w-3" />;
    return <Shield className="h-3 w-3" />;
  };

  const getEmailStatusBadge = (status: string) => {
    switch (status) {
      case 'sent':
        return <Badge variant="default" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Sent
        </Badge>;
      case 'queued':
        return <Badge variant="secondary" className="flex items-center gap-1">
          <Clock className="h-3 w-3" />
          Queued
        </Badge>;
      case 'failed':
        return <Badge variant="destructive" className="flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" />
          Failed
        </Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="grid gap-6 md:grid-cols-2">
      {/* Recent Customer Operations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            Recent Customer Operations
          </CardTitle>
          <CardDescription>
            Latest administrative actions performed on customer accounts
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {recentOperations?.map((operation) => (
              <div key={operation.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center gap-3">
                  {getOperationIcon(operation.action)}
                  <div>
                    <p className="font-medium text-sm">{operation.user_name || 'Unknown User'}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(operation.event_time).toLocaleString()}
                    </p>
                    {operation.ip_address && (
                      <p className="text-xs text-muted-foreground">
                        IP: {operation.ip_address}
                      </p>
                    )}
                  </div>
                </div>
                <Badge variant={getOperationBadgeVariant(operation.action)}>
                  {operation.action.replace('customer_', '').replace('_', ' ')}
                </Badge>
              </div>
            ))}
            {!recentOperations?.length && (
              <p className="text-center text-muted-foreground py-4">
                No recent customer operations found
              </p>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Welcome Email Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Mail className="h-5 w-5" />
            Welcome Email Status
          </CardTitle>
          <CardDescription>
            Status of welcome emails sent to new customers
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 max-h-96 overflow-y-auto">
            {emailEvents?.map((event) => (
              <div key={event.id} className="flex items-center justify-between p-3 bg-muted/30 rounded-lg">
                <div className="flex-1">
                  <p className="font-medium text-sm">{event.recipient_email}</p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(event.created_at).toLocaleString()}
                  </p>
                  {event.variables && typeof event.variables === 'object' && 
                   !Array.isArray(event.variables) && 'adminCreated' in event.variables && (
                    <p className="text-xs text-muted-foreground">
                      Created by admin
                    </p>
                  )}
                </div>
                {getEmailStatusBadge(event.status)}
              </div>
            ))}
            {!emailEvents?.length && (
              <p className="text-center text-muted-foreground py-4">
                No welcome emails found
              </p>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};