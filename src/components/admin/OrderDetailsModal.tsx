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
  // Try to get detailed order data with product information
  const { data: detailedOrderData, isLoading: isLoadingDetailed } = useDetailedOrderData(order?.id);
  
  if (!order) {
    return null;
  }

  // Use detailed data if available, otherwise fall back to the passed order data
  const orderToDisplay = detailedOrderData?.order || order;
  const itemsToDisplay = detailedOrderData?.items || order.order_items || [];

  const handlePrint = () => {
    window.print();
  };

  const deliveryFee = Number(order.delivery_fee || 0);
  const subtotal = Math.max(0, Number(order.total_amount || 0) - deliveryFee);

  return (
    <AdaptiveDialog
      open={isOpen}
      onOpenChange={onClose}
      title="Order Details"
      description={`Complete order information for order #${order.order_number}`}
      size="lg"
      className="h-full"
    >
      <div className="flex-1 overflow-y-auto">
        <div className="space-y-4 md:space-y-6 p-1">
          {/* Mobile Print Button */}
          <div className="flex justify-end md:hidden">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrint}
              className="print:hidden"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </Button>
          </div>

          {/* Order Summary Cards */}
          <ResponsiveGrid columns={3} gap="sm">
            <ResponsiveCard className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-2">
                <CreditCard className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="font-medium text-sm md:text-base">Total Amount</span>
              </div>
              <div className="text-xl md:text-2xl font-bold text-primary">
                {formatCurrency(order.total_amount || 0)}
              </div>
              <div className="text-xs md:text-sm text-muted-foreground mt-1">
                Ordered {formatDateTime(order.created_at)}
              </div>
            </ResponsiveCard>

            <ResponsiveCard className="p-3 md:p-4">
              <div className="flex items-center gap-2 mb-2">
                <CheckCircle className="h-4 w-4 md:h-5 md:w-5 text-success" />
                <span className="font-medium text-sm md:text-base">Status</span>
              </div>
              <StatusBadge 
                status={order.status} 
                className="mb-1"
              />
              <div className="text-xs md:text-sm text-muted-foreground mt-1">
                Order #{order.order_number}
              </div>
            </ResponsiveCard>

            <ResponsiveCard className="p-3 md:p-4 md:col-span-1">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="h-4 w-4 md:h-5 md:w-5 text-info" />
                <span className="font-medium text-sm md:text-base">Type</span>
              </div>
              <Badge variant="outline" className="mb-1">
                {order.order_type?.toUpperCase() || 'DELIVERY'}
              </Badge>
              {deliveryFee > 0 && (
                <div className="text-xs md:text-sm text-muted-foreground mt-1">
                  Delivery: {formatCurrency(deliveryFee)}
                </div>
              )}
            </ResponsiveCard>
          </ResponsiveGrid>

          {/* Customer and Delivery Information */}
          <ResponsiveGrid columns={2} gap="md">
            <ResponsiveCard>
              <div className="flex items-center gap-2 mb-4">
                <User className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="font-semibold text-sm md:text-base">Customer Information</span>
              </div>
              <div className="space-y-3">
                <div>
                  <div className="font-medium text-sm md:text-base">{order.customer_name}</div>
                </div>
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                  <Mail className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                  <span className="break-all">{order.customer_email}</span>
                </div>
                <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                  <Phone className="h-3 w-3 md:h-4 md:w-4 flex-shrink-0" />
                  <span>{order.customer_phone}</span>
                </div>
              </div>
            </ResponsiveCard>

            <ResponsiveCard>
              <div className="flex items-center gap-2 mb-4">
                <MapPin className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="font-semibold text-sm md:text-base">
                  {order.order_type === 'delivery' ? 'Delivery Address' : 'Pickup Information'}
                </span>
              </div>
              <div className="space-y-2">
                <div className="text-xs md:text-sm break-words">
                  {order.order_type === 'delivery' 
                    ? formatAddress(order.delivery_address)
                    : 'Customer pickup'
                  }
                </div>
                {order.special_instructions && (
                  <div className="text-xs md:text-sm text-muted-foreground p-2 bg-muted rounded">
                    <strong>Instructions:</strong> {order.special_instructions}
                  </div>
                )}
              </div>
            </ResponsiveCard>
          </ResponsiveGrid>

          {/* Order Items with enhanced details */}
          {isLoadingDetailed ? (
            <ResponsiveCard>
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="font-semibold text-sm md:text-base">Loading Order Items...</span>
              </div>
              <div className="space-y-3">
                {[1, 2, 3].map((i) => (
                  <Skeleton key={i} className="h-16 w-full" />
                ))}
              </div>
            </ResponsiveCard>
          ) : (
            <div className="rounded-lg border bg-card">
              <OrderItemsBreakdown
                items={itemsToDisplay}
                subtotal={orderToDisplay.total_amount - (orderToDisplay.delivery_fee || 0)}
                deliveryFee={orderToDisplay.delivery_fee}
                totalVat={0}
                totalDiscount={0}
                grandTotal={orderToDisplay.total_amount}
                showDetailed={true}
                className="border-0 p-3 md:p-6"
              />
            </div>
          )}

          {/* Payment Information */}
          {order.payment_method && (
            <ResponsiveCard>
              <div className="flex items-center gap-2 mb-4">
                <CreditCard className="h-4 w-4 md:h-5 md:w-5 text-primary" />
                <span className="font-semibold text-sm md:text-base">Payment Information</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs md:text-sm">
                <div>
                  <span className="text-muted-foreground">Method:</span>
                  <div className="font-medium">{order.payment_method}</div>
                </div>
                <div>
                  <span className="text-muted-foreground">Status:</span>
                  <div className="font-medium">{order.payment_status}</div>
                </div>
                {order.payment_reference && (
                  <div className="col-span-1 md:col-span-2">
                    <span className="text-muted-foreground">Reference:</span>
                    <div className="font-medium font-mono text-xs break-all">
                      {order.payment_reference}
                    </div>
                  </div>
                )}
              </div>
            </ResponsiveCard>
          )}

          {/* Desktop Print Button */}
          <div className="hidden md:flex justify-end">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={handlePrint}
              className="print:hidden"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print Order
            </Button>
          </div>
        </div>
      </div>
    </AdaptiveDialog>
  );
};