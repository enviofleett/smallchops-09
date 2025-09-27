import React from 'react';
import { Clock, CheckCircle, Circle, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Order, TimelineStep } from '@/types/orderDetailsModal';

interface TimelineSectionProps {
  order: Order;
}

export const TimelineSection: React.FC<TimelineSectionProps> = ({ order }) => {
  const getStepIcon = (step: TimelineStep, index: number) => {
    if (step.completed) {
      return <CheckCircle className="h-5 w-5 text-success" />;
    } else if (step.status === 'current') {
      return <Clock className="h-5 w-5 text-primary animate-pulse" />;
    } else {
      return <Circle className="h-5 w-5 text-muted-foreground" />;
    }
  };

  const getStepColor = (step: TimelineStep) => {
    if (step.completed) {
      return 'text-success';
    } else if (step.status === 'current') {
      return 'text-primary font-semibold';
    } else {
      return 'text-muted-foreground';
    }
  };

  const formatDateTime = (dateString?: string) => {
    if (!dateString) return '';
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getConnectorColor = (step: TimelineStep, nextStep?: TimelineStep) => {
    if (step.completed && nextStep?.completed) {
      return 'bg-success';
    } else if (step.completed) {
      return 'bg-gradient-to-b from-success to-border';
    } else {
      return 'bg-border';
    }
  };

  return (
    <Card className="keep-together">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5 text-primary" />
          Order Timeline
        </CardTitle>
      </CardHeader>
      <CardContent>
        {order.timeline.length === 0 ? (
          <div className="flex items-center justify-center py-8 text-muted-foreground">
            <AlertCircle className="h-5 w-5 mr-2" />
            <span>No timeline data available</span>
          </div>
        ) : (
          <div className="relative">
            {order.timeline.map((step, index) => {
              const nextStep = order.timeline[index + 1];
              const isLast = index === order.timeline.length - 1;

              return (
                <div key={step.step} className="relative flex items-start gap-4 pb-6">
                  {/* Timeline connector */}
                  {!isLast && (
                    <div 
                      className={`absolute left-2.5 top-8 w-0.5 h-6 ${getConnectorColor(step, nextStep)}`}
                    />
                  )}

                  {/* Step icon */}
                  <div className="flex-shrink-0 mt-0.5">
                    {getStepIcon(step, index)}
                  </div>

                  {/* Step content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className={`font-medium ${getStepColor(step)}`}>
                        {step.label}
                      </h4>
                      {step.datetime && (
                        <span className="text-xs text-muted-foreground shrink-0">
                          {formatDateTime(step.datetime)}
                        </span>
                      )}
                    </div>
                    
                    {step.status === 'current' && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Currently processing...
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
};