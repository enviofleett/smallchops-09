import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { CheckCircle, ChefHat, Package, Truck, CheckCircle2, Clock } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface CustomerOrderStatusTrackerProps {
  currentStatus: string;
  orderTime: string;
  estimatedDeliveryTime?: string;
}

const statusSteps = [
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: Package },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle2 },
];

export const CustomerOrderStatusTracker: React.FC<CustomerOrderStatusTrackerProps> = ({
  currentStatus,
  orderTime,
  estimatedDeliveryTime,
}) => {
  const currentStepIndex = statusSteps.findIndex(step => step.key === currentStatus);
  const progressPercentage = currentStepIndex >= 0 ? ((currentStepIndex + 1) / statusSteps.length) * 100 : 0;

  return (
    <Card className="rounded-lg border shadow-sm">
      <CardContent className="p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold">Order Status</h3>
            <p className="text-xs text-muted-foreground">
              Placed {formatDistanceToNow(new Date(orderTime), { addSuffix: true })}
            </p>
          </div>
          {estimatedDeliveryTime && currentStatus !== 'delivered' && (
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Clock className="h-3.5 w-3.5" />
              <span>Est. {estimatedDeliveryTime}</span>
            </div>
          )}
        </div>

        {/* Progress Bar */}
        <div className="mb-6">
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className="h-full bg-primary transition-all duration-500 ease-out rounded-full"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>

        {/* Status Steps */}
        <div className="grid grid-cols-5 gap-2">
          {statusSteps.map((step, index) => {
            const Icon = step.icon;
            const isCompleted = index <= currentStepIndex;
            const isCurrent = index === currentStepIndex;

            return (
              <div key={step.key} className="flex flex-col items-center text-center">
                <div
                  className={`
                    w-10 h-10 rounded-full flex items-center justify-center mb-1.5 transition-all duration-300
                    ${isCompleted 
                      ? isCurrent 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-primary/80 text-primary-foreground'
                      : 'bg-muted text-muted-foreground'
                    }
                  `}
                >
                  <Icon className="h-5 w-5" />
                </div>
                <span
                  className={`
                    text-xs leading-tight
                    ${isCompleted 
                      ? isCurrent 
                        ? 'text-primary font-medium' 
                        : 'text-foreground'
                      : 'text-muted-foreground'
                    }
                  `}
                >
                  {step.label}
                </span>
              </div>
            );
          })}
        </div>

        {/* Current Status Message */}
        {currentStatus === 'out_for_delivery' && (
          <div className="mt-4 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
            <p className="text-sm text-blue-600 dark:text-blue-400">
              Your order is on its way! Our driver will arrive soon.
            </p>
          </div>
        )}

        {currentStatus === 'delivered' && (
          <div className="mt-4 p-3 bg-green-500/10 border border-green-500/20 rounded-lg">
            <p className="text-sm text-green-600 dark:text-green-400">
              Your order has been delivered. Enjoy your meal!
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
