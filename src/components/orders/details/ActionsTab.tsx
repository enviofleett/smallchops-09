import React from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  Clock, CheckCircle2, XCircle, ArrowRight, Settings, 
  MessageSquare, Hash, AlertCircle 
} from 'lucide-react';

interface ActionsTabProps {
  order: {
    status: string;
  };
  isUpdatingStatus: boolean;
  handleStatusUpdate: (status: string) => Promise<void>;
}

// Status options for actions
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
 * ActionsTab component provides order status management and additional actions
 * 
 * @param order - Order object with current status
 * @param isUpdatingStatus - Loading state for status updates
 * @param handleStatusUpdate - Function to handle status updates
 * 
 * @example
 * ```tsx
 * const order = { status: "preparing" };
 * 
 * const handleStatusUpdate = async (status: string) => {
 *   // Update order status logic
 *   console.log('Updating to:', status);
 * };
 * 
 * <ActionsTab 
 *   order={order} 
 *   isUpdatingStatus={false}
 *   handleStatusUpdate={handleStatusUpdate}
 * />
 * ```
 */
export const ActionsTab: React.FC<ActionsTabProps> = ({ 
  order, 
  isUpdatingStatus, 
  handleStatusUpdate 
}) => {
  return (
    <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-lg mb-6">
      <div className="p-6">
        <h2 className="text-xl font-bold mb-4">Order Actions & Status Management</h2>
        <div className="mb-6">
          <div className="font-medium mb-2">Quick Status Updates</div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-3">
            {STATUS_OPTIONS.map((status) => {
              const Icon = status.icon;
              const isActive = order.status === status.value;
              const isDisabled = isUpdatingStatus;
              return (
                <Button
                  key={status.value}
                  variant={isActive ? "default" : "outline"}
                  size="lg"
                  disabled={isDisabled}
                  onClick={() => handleStatusUpdate(status.value)}
                  className={`
                    h-auto py-4 px-3 flex flex-col items-center gap-2 text-xs
                    transition-all duration-200 hover:scale-105
                    ${isActive ? 'ring-2 ring-primary ring-offset-2 shadow-lg' : 'hover:shadow-md'}
                    ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                  `}
                >
                  <Icon className={`w-5 h-5 ${isActive ? 'text-primary-foreground' : status.color}`} />
                  <span className="leading-tight text-center font-medium">{status.label}</span>
                </Button>
              );
            })}
          </div>
        </div>
        <div className="pt-6 border-t border-muted/30">
          <div className="font-medium mb-2">Additional Actions</div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Button variant="outline" size="sm" className="h-12 flex flex-col items-center gap-1">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs">Notify Customer</span>
            </Button>
            <Button variant="outline" size="sm" className="h-12 flex flex-col items-center gap-1">
              <Hash className="w-4 h-4" />
              <span className="text-xs">Generate Invoice</span>
            </Button>
            <Button variant="outline" size="sm" className="h-12 flex flex-col items-center gap-1">
              <Clock className="w-4 h-4" />
              <span className="text-xs">View History</span>
            </Button>
            <Button variant="outline" size="sm" className="h-12 flex flex-col items-center gap-1 text-destructive hover:text-destructive">
              <AlertCircle className="w-4 h-4" />
              <span className="text-xs">Cancel Order</span>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
};