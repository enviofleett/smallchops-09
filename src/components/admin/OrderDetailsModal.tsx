import React from 'react';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { OrderItemsBreakdown } from '@/components/orders/OrderItemsBreakdown';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { ResponsiveCard } from '@/components/layout/ResponsiveCard';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { StatusBadge } from '@/components/ui/status-badge';
import { 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  Mail, 
  Package, 
  Printer,
  CreditCard,
  CheckCircle,
  Truck 
} from 'lucide-react';

interface OrderDetailsModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

const formatCurrency = (amount: number) => 
  new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);

const formatDateTime = (dateString: string) => {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
    return date.toLocaleString('en-NG', {
      year: 'numeric', 
      month: 'short', 
      day: 'numeric', 
      hour: '2-digit', 
      minute: '2-digit'
    });
  } catch {
    return dateString;
  }
};

const formatAddress = (address: any) => {
  if (!address || typeof address !== 'object') return 'N/A';
  const parts = [
    address.address_line_1, 
    address.address_line_2, 
    address.city, 
    address.state
  ].filter(Boolean);
  return parts.join(', ') || 'N/A';
};

const getStatusVariant = (status: string) => {
  switch (status) {
    case 'confirmed': return 'default';
    case 'preparing': return 'warning';
    case 'ready': return 'success';
    case 'out_for_delivery': return 'info';
    case 'delivered': return 'success';
    case 'cancelled': return 'destructive';
    default: return 'outline';
  }
};

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ 
  order, 
  isOpen, 
  onClose 
}) => {
  const { data: detailedOrderData, isLoading: isLoadingDetailed } = useDetailedOrderData(order?.id);
  
  if (!order) {
    return null;
  }

  const orderToDisplay = detailedOrderData?.order || order;
  const itemsToDisplay = detailedOrderData?.items || order.order_items || [];

  const handlePrint = () => {
    window.print();
  };

  const deliveryFee = Number(order.delivery_fee || 0);

  return (
    <AdaptiveDialog
      open={isOpen}
      onOpenChange={onClose}
      title=""
      description=""
      size="lg"
      className="h-full"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-6 p-0">
          {/* Header Section */}
          <div className="border-b bg-gradient-subtle p-4 md:p-6 -m-0">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div className="space-y-1">
                <h1 className="text-lg md:text-xl font-bold text-foreground">
                  Order Details - #{order.order_number}
                </h1>
                <p className="text-sm text-muted-foreground">
                  Complete order information and status
                </p>
              </div>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handlePrint}
                  className="print:hidden"
                >
                  <Printer className="w-4 h-4 mr-2" />
                  <span className="hidden sm:inline">PDF</span>
                  <span className="sm:hidden">Print</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Status Section - Mobile Optimized */}
          <div className="px-4 md:px-6 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* Status Card */}
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Status</span>
                  <Clock className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <StatusBadge status={order.status} />
                  <p className="text-xs text-muted-foreground">
                    {formatDateTime(order.created_at)}
                  </p>
                </div>
              </div>

              {/* Type Card */}
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">Type</span>
                  <Truck className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="space-y-2">
                  <Badge variant="outline" className="text-sm">
                    {order.order_type?.toUpperCase() || 'DELIVERY'}
                  </Badge>
                  {deliveryFee > 0 && (
                    <p className="text-xs text-muted-foreground">
                      Delivery Fee: {formatCurrency(deliveryFee)}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Customer Information Section */}
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="border-b bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-sm">Customer Information</h2>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div>
                  <h3 className="font-medium text-base">{order.customer_name}</h3>
                </div>
                <div className="space-y-2">
                  <div className="flex items-center gap-3">
                    <Phone className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm">{order.customer_phone}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <Mail className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-sm break-all">{order.customer_email}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Delivery Address Section */}
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="border-b bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-sm">
                    {order.order_type === 'delivery' ? 'Delivery Address' : 'Pickup Information'}
                  </h2>
                </div>
              </div>
              <div className="p-4 space-y-3">
                <div className="text-sm leading-relaxed">
                  {order.order_type === 'delivery' 
                    ? formatAddress(order.delivery_address)
                    : 'Customer pickup at store location'
                  }
                </div>
                {order.special_instructions && (
                  <div className="bg-muted/50 rounded-md p-3">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Special Instructions:</p>
                    <p className="text-sm">{order.special_instructions}</p>
                  </div>
                )}
              </div>
            </div>

            {/* Order Information Section */}
            <div className="bg-card border rounded-lg overflow-hidden">
              <div className="border-b bg-muted/50 px-4 py-3">
                <div className="flex items-center gap-2">
                  <Package className="h-4 w-4 text-primary" />
                  <h2 className="font-semibold text-sm">Order Information</h2>
                </div>
              </div>
              <div className="p-4 space-y-4">
                {/* Status and Payment Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="bg-success/10 border border-success/20 rounded-lg p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-medium text-muted-foreground uppercase">Status</span>
                      <CheckCircle className="h-4 w-4 text-success" />
                    </div>
                    <div className="text-lg font-semibold text-success capitalize">
                      {order.status}
                    </div>
                  </div>
                  
                  {order.payment_status && (
                    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-xs font-medium text-muted-foreground uppercase">Payment</span>
                        <CreditCard className="h-4 w-4 text-primary" />
                      </div>
                      <div className="text-lg font-semibold text-primary capitalize">
                        {order.payment_status}
                      </div>
                    </div>
                  )}
                </div>

                {/* Order ID */}
                <div className="border-t pt-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs font-medium text-muted-foreground uppercase">Order ID</span>
                  </div>
                  <p className="font-mono text-sm text-primary font-medium">
                    {order.order_number}
                  </p>
                </div>
              </div>
            </div>

            {/* Order Items */}
            {isLoadingDetailed ? (
              <div className="bg-card border rounded-lg p-4">
                <div className="flex items-center gap-2 mb-4">
                  <Package className="h-4 w-4 text-primary" />
                  <span className="font-semibold text-sm">Loading Order Items...</span>
                </div>
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <Skeleton key={i} className="h-16 w-full" />
                  ))}
                </div>
              </div>
            ) : (
              <div className="bg-card border rounded-lg overflow-hidden">
                <OrderItemsBreakdown
                  items={itemsToDisplay}
                  subtotal={orderToDisplay.total_amount - (orderToDisplay.delivery_fee || 0)}
                  deliveryFee={orderToDisplay.delivery_fee}
                  totalVat={0}
                  totalDiscount={0}
                  grandTotal={orderToDisplay.total_amount}
                  showDetailed={true}
                  className="border-0"
                />
              </div>
            )}

            {/* Payment Information */}
            {order.payment_method && (
              <div className="bg-card border rounded-lg overflow-hidden">
                <div className="border-b bg-muted/50 px-4 py-3">
                  <div className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4 text-primary" />
                    <h2 className="font-semibold text-sm">Payment Information</h2>
                  </div>
                </div>
                <div className="p-4 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase">Method</span>
                      <div className="font-medium text-sm mt-1">{order.payment_method}</div>
                    </div>
                    <div>
                      <span className="text-xs font-medium text-muted-foreground uppercase">Status</span>
                      <div className="font-medium text-sm mt-1 capitalize">{order.payment_status}</div>
                    </div>
                  </div>
                  {order.payment_reference && (
                    <div className="border-t pt-3">
                      <span className="text-xs font-medium text-muted-foreground uppercase">Reference</span>
                      <div className="font-mono text-xs text-primary mt-1 break-all bg-muted/50 p-2 rounded">
                        {order.payment_reference}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </AdaptiveDialog>
  );
};