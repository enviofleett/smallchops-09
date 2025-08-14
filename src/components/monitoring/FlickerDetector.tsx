import React, { useEffect, useRef } from 'react';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

interface FlickerEvent {
  timestamp: number;
  type: 'layout_shift' | 'reflow' | 'repaint';
  element?: string;
  value: number;
}

export const FlickerDetector = () => {
  const [flickerEvents, setFlickerEvents] = React.useState<FlickerEvent[]>([]);
  const observerRef = useRef<ResizeObserver | null>(null);

  useEffect(() => {
    let cls = 0;

    // Cumulative Layout Shift detection
    const observer = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.entryType === 'layout-shift' && !(entry as any).hadRecentInput) {
          cls += (entry as any).value;
          
          if ((entry as any).value > 0.1) { // Significant layout shift
            setFlickerEvents(prev => [...prev, {
              timestamp: Date.now(),
              type: 'layout_shift',
              value: (entry as any).value
            }]);
          }
        }
      }
    });

    observer.observe({ entryTypes: ['layout-shift'] });

    // Monitor DOM mutations for potential flicker causes
    const mutationObserver = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === 'childList' && mutation.addedNodes.length > 5) {
          setFlickerEvents(prev => [...prev, {
            timestamp: Date.now(),
            type: 'reflow',
            element: (mutation.target as Element).tagName,
            value: mutation.addedNodes.length
          }]);
        }
      });
    });

    mutationObserver.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['style', 'class']
    });

    return () => {
      observer.disconnect();
      mutationObserver.disconnect();
    };
  }, []);

  const recentEvents = flickerEvents.slice(-10);
  const hasRecentFlicker = recentEvents.some(event => 
    Date.now() - event.timestamp < 5000
  );

  if (recentEvents.length === 0) return null;

  return (
    <Card className="p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-medium">Flicker Detection</h4>
        <Badge variant={hasRecentFlicker ? "destructive" : "secondary"}>
          {hasRecentFlicker ? "Active Issues" : "Monitoring"}
        </Badge>
      </div>
      
      {hasRecentFlicker && (
        <Alert variant="destructive" className="mb-3">
          <AlertDescription>
            Recent layout shifts detected. This may cause visual flickering.
          </AlertDescription>
        </Alert>
      )}
      
      <div className="space-y-2 text-sm">
        {recentEvents.slice(-5).map((event, index) => (
          <div key={index} className="flex justify-between items-center">
            <span className="capitalize">{event.type.replace('_', ' ')}</span>
            <div className="flex items-center gap-2">
              {event.element && (
                <span className="text-muted-foreground">
                  &lt;{event.element.toLowerCase()}&gt;
                </span>
              )}
              <Badge variant={event.value > 0.1 ? "destructive" : "secondary"}>
                {event.value.toFixed(3)}
              </Badge>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};