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
        <ul className="space-y-3">
          {timeline.length ? (
            timeline.map((event, i) => (
              <li key={i} className="flex items-center gap-3 text-sm">
                <Calendar className="w-4 h-4 text-primary" />
                <span className="font-medium capitalize">
                  {event.event.replace('_', ' ')}
                </span>
                <span className="text-muted-foreground">
                  {event.timestamp ? new Date(event.timestamp).toLocaleString() : ''}
                </span>
              </li>
            ))
          ) : (
            <div className="text-muted-foreground">No timeline events</div>
          )}
        </ul>
      </div>
    </Card>
  );
};