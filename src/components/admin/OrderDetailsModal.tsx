import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { ComprehensiveOrderFulfillment } from '@/components/orders/details/ComprehensiveOrderFulfillment';
import { 
  Printer,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Settings
} from 'lucide-react';

// Force refresh timestamp: 1727279220

interface OrderDetailsModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

// Order status update options
const STATUS_OPTIONS = [
  { value: 'pending', label: 'Pending', icon: Clock, color: 'text-yellow-600' },
  { value: 'confirmed', label: 'Confirmed', icon: CheckCircle2, color: 'text-blue-600' },
  { value: 'preparing', label: 'Preparing', icon: Settings, color: 'text-orange-600' },
  { value: 'ready', label: 'Ready', icon: CheckCircle2, color: 'text-green-600' },
  { value: 'out_for_delivery', label: 'Out for Delivery', icon: ArrowRight, color: 'text-purple-600' },
  { value: 'delivered', label: 'Delivered', icon: CheckCircle2, color: 'text-green-700' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'text-red-600' }
];

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ 
  order, 
  isOpen, 
  onClose 
}) => {
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  const { data: detailedOrderData, isLoading: isLoadingDetailed, error } = useDetailedOrderData(order?.id);
  
  if (!order) {
    return null;
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Order-${order.order_number}`,
    onAfterPrint: () => toast.success('Order details printed successfully'),
    onPrintError: () => toast.error('Failed to print order details')
  });

  const handleStatusUpdate = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      // TODO: Implement status update logic here
      // await updateOrderStatus(order.id, newStatus);
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update order status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Show error toast but don't block UI
  if (error) {
    toast.error('Failed to load detailed order information');
  }

  return (
    <AdaptiveDialog
      open={isOpen}
      onOpenChange={onClose}
      title=""
      description=""
      size="lg"
      className="max-w-6xl h-full"
    >
      <div className="flex flex-col h-full" ref={printRef}>
        {/* Modal Header - NEW DESIGN ACTIVE */}
        <div className="flex-shrink-0 border-b bg-gradient-to-r from-background to-muted/20 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="space-y-1">
              <h1 className="text-2xl font-bold text-foreground">
                📋 Order #{order.order_number}
              </h1>
              <p className="text-sm text-muted-foreground">
                Complete order fulfillment details and management
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrint}
                className="print:hidden"
                aria-label={`Print order ${order.order_number} details`}
              >
                <Printer className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Print Details</span>
                <span className="sm:hidden">Print</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="p-6 space-y-6">
            {/* Comprehensive Order Fulfillment Details */}
            <ComprehensiveOrderFulfillment 
              data={detailedOrderData}
              isLoading={isLoadingDetailed}
            />

            {/* Order Actions & Status Management Panel */}
            <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-background">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <Settings className="w-5 h-5 text-primary" />
                  Order Actions & Status Management
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Quick Status Updates */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Quick Status Updates
                  </h4>
                  <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2">
                    {STATUS_OPTIONS.map((status) => {
                      const Icon = status.icon;
                      const isActive = order.status === status.value;
                      const isDisabled = isUpdatingStatus;
                      
                      return (
                        <Button
                          key={status.value}
                          variant={isActive ? "default" : "outline"}
                          size="sm"
                          disabled={isDisabled}
                          onClick={() => handleStatusUpdate(status.value)}
                          className={`
                            h-auto py-3 px-2 flex flex-col items-center gap-1 text-xs
                            ${isActive ? 'ring-2 ring-primary ring-offset-2' : ''}
                            ${isDisabled ? 'opacity-50 cursor-not-allowed' : ''}
                          `}
                        >
                          <Icon className={`w-4 h-4 ${isActive ? 'text-primary-foreground' : status.color}`} />
                          <span className="leading-tight text-center">
                            {status.label}
                          </span>
                        </Button>
                      );
                    })}
                  </div>
                </div>

                {/* Additional Actions */}
                <div className="space-y-3 pt-4 border-t">
                  <h4 className="text-sm font-medium text-muted-foreground uppercase tracking-wide">
                    Additional Actions
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" size="sm">
                      Send Update to Customer
                    </Button>
                    <Button variant="outline" size="sm">
                      Generate Invoice
                    </Button>
                    <Button variant="outline" size="sm">
                      View Full History
                    </Button>
                    <Button variant="outline" size="sm" className="text-destructive hover:text-destructive">
                      Cancel Order
                    </Button>
                  </div>
                </div>

                {/* Current Status Info */}
                <div className="bg-muted/50 rounded-lg p-4 mt-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-1">
                      <p className="text-sm font-medium">Current Status</p>
                      <div className="flex items-center gap-2">
                        <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className="capitalize">
                          {order.status?.replace('_', ' ')}
                        </Badge>
                        {order.payment_status && (
                          <Badge variant="outline" className="capitalize">
                            Payment: {order.payment_status}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-right space-y-1">
                      <p className="text-xs text-muted-foreground">Last Updated</p>
                      <p className="text-sm font-medium">
                        {new Date(order.updated_at || order.created_at).toLocaleDateString('en-NG', {
                          month: 'short',
                          day: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </p>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </AdaptiveDialog>
  );
};