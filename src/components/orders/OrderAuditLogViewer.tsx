import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Clock, User, Activity, ChevronDown, ChevronRight, Shield } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface AuditLogEntry {
  id: string;
  action: string;
  category: string;
  message: string;
  user_id?: string;
  user_name?: string;
  entity_id?: string;
  entity_type?: string;
  old_values?: any;
  new_values?: any;
  ip_address?: string;
  user_agent?: string;
  event_time: string;
}

interface OrderAuditLogViewerProps {
  orderId?: string;
  className?: string;
  showAllAdminActions?: boolean;
}

const ACTION_CATEGORIES = {
  'order_status_update': { label: 'Status Change', color: 'bg-blue-50 text-blue-700' },
  'admin_order_status_updated': { label: 'Admin Status Override', color: 'bg-orange-50 text-orange-700' },
  'order_created': { label: 'Order Created', color: 'bg-green-50 text-green-700' },
  'order_updated': { label: 'Order Modified', color: 'bg-yellow-50 text-yellow-700' },
  'rider_assigned': { label: 'Rider Assignment', color: 'bg-purple-50 text-purple-700' },
  'payment_status_changed': { label: 'Payment Status', color: 'bg-indigo-50 text-indigo-700' },
  'order_cancelled': { label: 'Order Cancelled', color: 'bg-red-50 text-red-700' },
  'communication_event_created': { label: 'Email Sent', color: 'bg-gray-50 text-gray-700' },
  'start_delivery': { label: 'Delivery Started', color: 'bg-emerald-50 text-emerald-700' }
};

export const OrderAuditLogViewer: React.FC<OrderAuditLogViewerProps> = ({
  orderId,
  className = '',
  showAllAdminActions = false
}) => {
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedEntries, setExpandedEntries] = useState<Set<string>>(new Set());
  const { toast } = useToast();

  useEffect(() => {
    if (orderId || showAllAdminActions) {
      fetchAuditLogs();
    }
  }, [orderId, showAllAdminActions]);

  const fetchAuditLogs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('audit_logs')
        .select('id, action, category, message, user_id, user_name, entity_id, entity_type, old_values, new_values, ip_address, user_agent, event_time')
        .order('event_time', { ascending: false })
        .limit(50);

      if (orderId) {
        // Order-specific logs
        query = query.eq('entity_id', orderId);
      } else if (showAllAdminActions) {
        // All admin order management actions
        query = query.in('category', ['Order Management', 'Delivery Management', 'Payment Management']);
      }

      const { data, error } = await query;

      if (error) throw error;
      setLogs(data || []);
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: "Error",
        description: "Failed to load audit logs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleExpanded = (logId: string) => {
    const newExpanded = new Set(expandedEntries);
    if (newExpanded.has(logId)) {
      newExpanded.delete(logId);
    } else {
      newExpanded.add(logId);
    }
    setExpandedEntries(newExpanded);
  };

  const getActionCategory = (action: string) => {
    return ACTION_CATEGORIES[action as keyof typeof ACTION_CATEGORIES] || {
      label: action.replace(/_/g, ' ').replace(/\w\S*/g, (txt) => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
      ),
      color: 'bg-gray-50 text-gray-700'
    };
  };

  const formatUserInfo = (log: AuditLogEntry) => {
    if (log.user_name) return log.user_name;
    if (log.user_id) return `User ${log.user_id.slice(0, 8)}...`;
    return 'System';
  };

  const hasDetailedInfo = (log: AuditLogEntry) => {
    return log.old_values || log.new_values || log.ip_address || log.user_agent;
  };

  if (loading) {
    return (
      <Card className={className}>
        <CardContent className="flex items-center justify-center py-8">
          <div className="text-center">
            <Activity className="h-8 w-8 animate-pulse mx-auto mb-2 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">Loading audit logs...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5" />
          {orderId ? 'Order Activity Log' : 'Admin Actions Log'}
          <Badge variant="secondary">{logs.length} entries</Badge>
        </CardTitle>
        {logs.length > 0 && (
          <Button variant="outline" size="sm" onClick={fetchAuditLogs}>
            <Activity className="h-4 w-4 mr-2" />
            Refresh
          </Button>
        )}
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2" />
            <p>No audit logs found</p>
          </div>
        ) : (
          <ScrollArea className="h-96">
            <div className="space-y-2">
              {logs.map((log, index) => {
                const actionCategory = getActionCategory(log.action);
                const isExpanded = expandedEntries.has(log.id);
                const hasDetails = hasDetailedInfo(log);

                return (
                  <div key={log.id} className="border rounded-lg p-3 bg-card">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Badge className={actionCategory.color} variant="secondary">
                            {actionCategory.label}
                          </Badge>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {format(new Date(log.event_time), 'MMM d, yyyy h:mm a')}
                          </div>
                        </div>
                        
                        <p className="text-sm font-medium mb-1">{log.message}</p>
                        
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <User className="h-3 w-3" />
                            {formatUserInfo(log)}
                          </div>
                          {log.category && (
                            <Badge variant="outline" className="text-xs">
                              {log.category}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {hasDetails && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleExpanded(log.id)}
                          className="h-6 w-6 p-0"
                        >
                          {isExpanded ? (
                            <ChevronDown className="h-4 w-4" />
                          ) : (
                            <ChevronRight className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>

                    {isExpanded && hasDetails && (
                      <>
                        <Separator className="my-2" />
                        <div className="space-y-2 text-xs">
                          {log.old_values && (
                            <div>
                              <span className="font-medium text-red-600">Before:</span>
                              <pre className="mt-1 p-2 bg-red-50 rounded text-red-700 whitespace-pre-wrap">
                                {JSON.stringify(log.old_values, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.new_values && (
                            <div>
                              <span className="font-medium text-green-600">After:</span>
                              <pre className="mt-1 p-2 bg-green-50 rounded text-green-700 whitespace-pre-wrap">
                                {JSON.stringify(log.new_values, null, 2)}
                              </pre>
                            </div>
                          )}
                          {log.ip_address && (
                            <div>
                              <span className="font-medium">IP Address:</span> {log.ip_address}
                            </div>
                          )}
                          {log.user_agent && (
                            <div>
                              <span className="font-medium">User Agent:</span>
                              <div className="mt-1 p-2 bg-gray-50 rounded text-gray-600 text-xs break-all">
                                {log.user_agent}
                              </div>
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
};