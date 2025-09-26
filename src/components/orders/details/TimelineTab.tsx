import React from 'react';
import { Card } from '@/components/ui/card';
import { Calendar, Building2, Truck } from 'lucide-react';

interface TimelineEvent {
  event: string;
  timestamp?: string;
}

interface TimelineTabProps {
  detailedOrderData?: {
    timeline?: TimelineEvent[];
  };
  isLoading: boolean;
  error?: any;
  order: {
    created_at: string;
    updated_at?: string;
    order_type: string;
  };
}

/**
 * TimelineTab component displays order timeline and chronological events
 * 
 * @param detailedOrderData - Detailed order data containing timeline events
 * @param isLoading - Loading state for data fetching
 * @param error - Error state for data fetching
 * @param order - Order object with creation/update timestamps and type
 * 
 * @example
 * ```tsx
 * const detailedOrderData = {
 *   timeline: [
 *     { event: "order_created", timestamp: "2025-09-25T18:00:00Z" },
 *     { event: "payment_confirmed", timestamp: "2025-09-25T18:30:00Z" },
 *     { event: "status_updated", timestamp: "2025-09-25T19:00:00Z" }
 *   ]
 * };
 * 
 * const order = {
 *   created_at: "2025-09-25T18:00:00Z",
 *   updated_at: "2025-09-25T19:00:00Z", 
 *   order_type: "delivery"
 * };
 * 
 * <TimelineTab 
 *   detailedOrderData={detailedOrderData}
 *   isLoading={false}
 *   order={order}
 * />
 * ```
 */
export const TimelineTab: React.FC<TimelineTabProps> = ({ 
  detailedOrderData, 
  isLoading, 
  error, 
  order 
}) => {
  if (isLoading) {
    return <div className="text-center py-10">Loading timeline...</div>;
  }
  
  if (error) {
    return <div className="text-destructive">Error loading timeline.</div>;
  }
  
  const timeline = detailedOrderData?.timeline || [];

  const getEventIcon = (status: string) => {
    if (status === 'completed') return '✓';
    if (status === 'pending') return '○';
    return '○';
  };

  const getEventColor = (status: string) => {
    if (status === 'completed') return 'text-green-600';
    if (status === 'pending') return 'text-muted-foreground';
    return 'text-muted-foreground';
  };

  return (
    <Card className="rounded-xl border shadow-sm mb-6">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Order Timeline</h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm mb-6">
          <div>
            <p className="text-xs text-muted-foreground">Created</p>
            <p className="font-medium">
              {new Date(order.created_at).toLocaleDateString('en-NG', { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Last Updated</p>
            <p className="font-medium">
              {new Date(order.updated_at || order.created_at).toLocaleDateString('en-NG', { 
                month: 'short', 
                day: 'numeric', 
                hour: '2-digit', 
                minute: '2-digit' 
              })}
            </p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Type</p>
            <p className="font-medium capitalize flex items-center gap-1">
              {order.order_type === 'pickup' ? (
                <Building2 className="w-3 h-3" />
              ) : (
                <Truck className="w-3 h-3" />
              )}
              {order.order_type}
            </p>
          </div>
        </div>
        
        <div className="space-y-4">
          {timeline.length ? (
            timeline.map((event: any, i: number) => (
              <div key={i} className="flex items-start gap-4">
                <div className={`w-8 h-8 rounded-full border-2 flex items-center justify-center text-sm font-bold ${
                  event.status === 'completed' 
                    ? 'border-green-500 bg-green-50 text-green-600' 
                    : 'border-gray-300 bg-gray-50 text-gray-400'
                }`}>
                  {getEventIcon(event.status)}
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-3">
                    <span className={`font-medium ${getEventColor(event.status)}`}>
                      {event.event}
                    </span>
                    {event.timestamp && (
                      <span className="text-xs text-muted-foreground">
                        {new Date(event.timestamp).toLocaleString('en-NG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    )}
                  </div>
                  {event.status === 'pending' && (
                    <p className="text-xs text-muted-foreground mt-1">Waiting to be processed</p>
                  )}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              <Calendar className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No timeline events available</p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
};