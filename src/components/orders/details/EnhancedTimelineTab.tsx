import React from 'react';
import { Clock, CheckCircle, AlertCircle, User, Package, Truck, MapPin } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';

interface TimelineEvent {
  event: string;
  timestamp?: string | null;
  status: 'completed' | 'pending' | 'active';
  user?: string;
  details?: string;
  category?: string;
}

interface EnhancedTimelineTabProps {
  detailedOrderData: any;
  isLoading?: boolean;
  error?: any;
  order?: any;
}

/**
 * Enhanced Timeline Tab for Order Details
 * Displays a comprehensive chronological view of order events including:
 * - Order status progression
 * - Payment milestones  
 * - Communication events
 * - Admin actions from audit logs
 * - Processing timestamps
 * 
 * @param detailedOrderData - Comprehensive order data with timeline, audit logs, and communication events
 * @param isLoading - Loading state indicator
 * @param error - Error state if data fetching fails
 * @param order - Core order information
 */
export const EnhancedTimelineTab: React.FC<EnhancedTimelineTabProps> = ({
  detailedOrderData,
  isLoading,
  error,
  order
}) => {
  const formatDateTime = (dateString: string | null) => {
    if (!dateString) return 'Not set';
    return new Date(dateString).toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getEventIcon = (event: string, status: string) => {
    if (status === 'completed') {
      return <CheckCircle className="h-4 w-4 text-green-500" />;
    } else if (status === 'active') {
      return <Clock className="h-4 w-4 text-blue-500" />;
    } else {
      return <AlertCircle className="h-4 w-4 text-gray-400" />;
    }
  };

  const getCategoryIcon = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'order management':
        return <Package className="h-4 w-4" />;
      case 'payment':
        return <User className="h-4 w-4" />;
      case 'delivery':
        return <Truck className="h-4 w-4" />;
      case 'pickup':
        return <MapPin className="h-4 w-4" />;
      default:
        return <Clock className="h-4 w-4" />;
    }
  };

  const buildComprehensiveTimeline = (): TimelineEvent[] => {
    const events: TimelineEvent[] = [];

    // Add core timeline events from detailedOrderData
    if (detailedOrderData?.timeline) {
      detailedOrderData.timeline.forEach((event: any) => {
        events.push({
          event: event.event,
          timestamp: event.timestamp,
          status: event.status,
          category: 'Order Management'
        });
      });
    }

    // Add audit log events for more detailed tracking
    if (detailedOrderData?.audit_logs) {
      detailedOrderData.audit_logs.forEach((log: any) => {
        // Only include significant events
        if (log.action?.includes('status') || log.action?.includes('payment') || log.action?.includes('admin')) {
          events.push({
            event: log.message || log.action,
            timestamp: log.created_at,
            status: 'completed',
            user: log.user_name || 'System',
            details: log.category,
            category: log.category
          });
        }
      });
    }

    // Add communication events
    if (detailedOrderData?.communication_events) {
      detailedOrderData.communication_events.slice(0, 5).forEach((comm: any) => {
        events.push({
          event: `${comm.event_type} - ${comm.status}`,
          timestamp: comm.sent_at || comm.created_at,
          status: comm.status === 'sent' ? 'completed' : 'pending',
          details: `Email to ${comm.recipient_email}`,
          category: 'Communication'
        });
      });
    }

    // Sort events by timestamp (most recent first)
    return events
      .filter(event => event.timestamp)
      .sort((a, b) => new Date(b.timestamp!).getTime() - new Date(a.timestamp!).getTime());
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Order Timeline
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center p-8">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Clock className="h-4 w-4 animate-spin" />
              Loading timeline...
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5 text-red-500" />
            Timeline Error
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-red-600">
            Unable to load timeline data: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  const timelineEvents = buildComprehensiveTimeline();

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Enhanced Order Timeline
          <Badge variant="secondary" className="ml-2">
            {timelineEvents.length} events
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {/* Order Key Details */}
        <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 p-4 bg-muted/50 rounded-lg">
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Created</div>
            <div className="font-medium">{formatDateTime(order?.created_at)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Last Updated</div>
            <div className="font-medium">{formatDateTime(order?.updated_at)}</div>
          </div>
          <div className="text-center">
            <div className="text-sm text-muted-foreground">Order Type</div>
            <Badge variant="outline" className="capitalize">
              {order?.order_type || 'Unknown'}
            </Badge>
          </div>
        </div>

        {/* Timeline Events */}
        <div className="space-y-4">
          {timelineEvents.length > 0 ? (
            timelineEvents.map((event, index) => (
              <div key={index} className="flex gap-4 pb-4 border-b border-border/50 last:border-0">
                <div className="flex flex-col items-center">
                  {getEventIcon(event.event, event.status)}
                  {index < timelineEvents.length - 1 && (
                    <div className="w-px h-8 bg-border mt-2" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    {event.category && getCategoryIcon(event.category)}
                    <h4 className="font-medium text-sm">{event.event}</h4>
                    <Badge 
                      variant={event.status === 'completed' ? 'default' : 'secondary'}
                      className="text-xs"
                    >
                      {event.status}
                    </Badge>
                  </div>
                  <div className="text-xs text-muted-foreground mb-1">
                    {formatDateTime(event.timestamp)}
                  </div>
                  {event.user && (
                    <div className="text-xs text-muted-foreground">
                      By: {event.user}
                    </div>
                  )}
                  {event.details && (
                    <div className="text-xs text-muted-foreground mt-1">
                      {event.details}
                    </div>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <div className="text-sm">No timeline events found</div>
              <div className="text-xs mt-1">Timeline data will appear as the order progresses</div>
            </div>
          )}
        </div>

        {/* Processing Information */}
        {(order?.processing_started_at || order?.updated_by) && (
          <div className="mt-6 p-4 bg-muted/30 rounded-lg">
            <h5 className="font-medium text-sm mb-3 flex items-center gap-2">
              <User className="h-4 w-4" />
              Processing Information
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {order.processing_started_at && (
                <div>
                  <span className="text-muted-foreground">Processing Started:</span>
                  <div className="font-medium">{formatDateTime(order.processing_started_at)}</div>
                </div>
              )}
              {order.updated_by && (
                <div>
                  <span className="text-muted-foreground">Last Updated By:</span>
                  <div className="font-medium">Admin User</div>
                </div>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};