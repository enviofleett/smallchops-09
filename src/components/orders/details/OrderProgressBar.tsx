import React from 'react';
import { 
  Clock, CheckCircle2, Settings, ArrowRight, XCircle 
} from 'lucide-react';

interface OrderStep {
  status: string;
  timestamp?: string;
}

interface OrderProgressBarProps {
  steps: OrderStep[];
}

// Status options configuration
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-600' },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-blue-600' },
  { value: 'preparing', label: 'Preparing', icon: Settings, color: 'text-orange-600' },
  { value: 'ready', label: 'Ready', icon: CheckCircle2, color: 'text-green-600' },
  { value: 'out_for_delivery', label: 'Out for Delivery', icon: ArrowRight, color: 'text-purple-600' },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle2, color: 'text-green-700' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-600' }
];

/**
 * OrderProgressBar component displays visual progress of order status steps
 * 
 * @param steps - Array of order steps with status and timestamp
 * 
 * @example
 * ```tsx
 * const steps = [
 *   { status: "confirmed", timestamp: "2025-09-25T18:30:00Z" },
 *   { status: "preparing", timestamp: "2025-09-25T19:00:00Z" },
 *   { status: "ready", timestamp: "2025-09-25T19:30:00Z" }
 * ];
 * 
 * <OrderProgressBar steps={steps} />
 * ```
 */
export const OrderProgressBar: React.FC<OrderProgressBarProps> = ({ steps }) => {
  const statusOrder = [
    'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'
  ];

  return (
    <div className="flex gap-4 items-center">
      {statusOrder.map((status, idx) => {
        const step = steps?.find(s => s.status === status);
        const Icon = STATUS_OPTIONS.find(opt => opt.value === status)?.icon || Clock;
        const active = !!step;
        
        return (
          <div key={status} className="flex flex-col items-center">
            <Icon className={`w-6 h-6 ${active ? 'text-primary' : 'text-muted-foreground'}`} />
            <div className={`text-xs mt-1 capitalize ${active ? 'font-bold text-primary' : 'text-muted-foreground'}`}>
              {status.replace('_', ' ')}
            </div>
            {step && step.timestamp && (
              <div className="text-[10px] text-muted-foreground mt-1">
                {new Date(step.timestamp).toLocaleString()}
              </div>
            )}
            {idx < statusOrder.length - 1 && (
              <div className="h-8 border-l-2 border-muted/60 mx-auto"></div>
            )}
          </div>
        );
      })}
    </div>
  );
};