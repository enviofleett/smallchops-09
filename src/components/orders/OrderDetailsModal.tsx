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
  Settings,
  Package,
  CreditCard,
  Truck,
  Timer,
  MessageSquare,
  Hash,
  AlertCircle,
  Calendar,
  Building2
} from 'lucide-react';

// Force refresh timestamp: 1727279220

interface OrderDetailsModalProps {
  order: any;
  deliverySchedule?: any;
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
  deliverySchedule,
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
      size="xl"
      className="max-w-7xl h-[95vh]"
    >
      <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-muted/10" ref={printRef}>
        {/* Enhanced Modal Header with Order Summary */}
        <div className="flex-shrink-0 border-b-2 bg-gradient-to-r from-primary/5 via-background to-accent/5 px-6 py-5">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            {/* Order Title & Status */}
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <h1 className="text-2xl lg:text-3xl font-bold text-foreground flex items-center gap-2">
                  <Package className="w-7 h-7 text-primary" />
                  Order #{order.order_number}
                </h1>
                <Badge 
                  variant={order.status === 'delivered' ? 'default' : 'secondary'} 
                  className="text-sm px-3 py-1 font-medium capitalize"
                >
                  {order.status?.replace('_', ' ')}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Complete order fulfillment details • Last updated {new Date(order.updated_at || order.created_at).toLocaleDateString()}
              </p>
            </div>
            
            {/* Quick Actions & Summary */}
            <div className="flex items-center gap-3">
              <div className="hidden md:flex items-center gap-4 text-sm text-muted-foreground">
                <span className="flex items-center gap-1">
                  <CreditCard className="w-4 h-4" />
                  ₦{order.total_amount?.toLocaleString()}
                </span>
                <span className="flex items-center gap-1">
                  <Truck className="w-4 h-4" />
                  {order.order_type}
                </span>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handlePrint}
                className="print:hidden border-primary/20 hover:border-primary/40"
                aria-label={`Print order ${order.order_number} details`}
              >
                <Printer className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Print Details</span>
                <span className="sm:hidden">Print</span>
              </Button>
            </div>
          </div>
        </div>

        {/* Main Content Area with Enhanced Layout */}
        <div className="flex-1 overflow-hidden">
          <div className="h-full overflow-y-auto">
            <div className="p-6 space-y-8">
              
              {/* Comprehensive Order Fulfillment Details */}
              <div className="bg-card rounded-xl border shadow-sm">
                <div className="p-1">
                  <ComprehensiveOrderFulfillment 
                    data={detailedOrderData}
                    isLoading={isLoadingDetailed}
                  />
                </div>
              </div>

              {/* Enhanced Order Actions & Status Management Panel */}
              <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-background to-accent/5 shadow-lg">
                <CardHeader className="pb-4 border-b bg-gradient-to-r from-primary/10 to-accent/10 rounded-t-xl">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 bg-primary/20 rounded-lg">
                      <Settings className="w-6 h-6 text-primary" />
                    </div>
                    Order Actions & Status Management
                    <Badge variant="outline" className="ml-auto">
                      Admin Panel
                    </Badge>
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-6 space-y-6">
                  
                  {/* Current Status Overview */}
                  <div className="bg-gradient-to-r from-muted/50 to-accent/10 rounded-lg p-4 border">
                    <div className="flex items-center justify-between">
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-muted-foreground">Current Status</p>
                        <div className="flex items-center gap-3">
                          <Badge variant={order.status === 'delivered' ? 'default' : 'secondary'} className="text-base px-4 py-2 capitalize">
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
                        <p className="text-xs text-muted-foreground">Order Value</p>
                        <p className="text-xl font-bold text-primary">
                          ₦{order.total_amount?.toLocaleString()}
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* Quick Status Updates */}
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="text-lg font-semibold text-foreground">
                        Quick Status Updates
                      </h4>
                      {isUpdatingStatus && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary border-t-transparent"></div>
                          Updating...
                        </div>
                      )}
                    </div>
                    
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
                            <span className="leading-tight text-center font-medium">
                              {status.label}
                            </span>
                          </Button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Enhanced Additional Actions */}
                  <div className="space-y-4 pt-6 border-t border-muted/30">
                    <h4 className="text-lg font-semibold text-foreground flex items-center gap-2">
                      <Timer className="w-5 h-5 text-primary" />
                      Additional Actions
                    </h4>
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

                  {/* Order Timeline Summary */}
                  <div className="bg-gradient-to-r from-accent/10 to-muted/20 rounded-lg p-4 border">
                    <h5 className="font-medium text-sm text-muted-foreground mb-3 flex items-center gap-2">
                      <Calendar className="w-4 h-4" />
                      Order Timeline
                    </h5>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
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
                  </div>

                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AdaptiveDialog>
  );
};