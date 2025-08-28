import React from 'react';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
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

const getStatusColor = (status: string) => {
  switch (status) {
    case 'confirmed': return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'preparing': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
    case 'ready': return 'bg-green-50 text-green-700 border-green-200';
    case 'out_for_delivery': return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'delivered': return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    case 'cancelled': return 'bg-red-50 text-red-700 border-red-200';
    default: return 'bg-muted text-muted-foreground border-border';
  }
};

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ 
  order, 
  isOpen, 
  onClose 
}) => {
  if (!order) {
    return null;
  }

  const handlePrint = () => {
    window.print();
  };

  const deliveryFee = Number(order.delivery_fee || 0);
  const subtotal = Math.max(0, Number(order.total_amount || 0) - deliveryFee);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogTitle className="flex items-center justify-between">
          <span className="text-2xl font-bold">Order Details</span>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={handlePrint}
            className="print:hidden"
          >
            <Printer className="w-4 h-4 mr-2" />
            Print
          </Button>
        </DialogTitle>
        
        <DialogDescription>
          Complete order information for order #{order.order_number}
        </DialogDescription>

        <div className="space-y-6">
          {/* Order Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span className="font-medium">Total Amount</span>
                </div>
                <div className="text-2xl font-bold text-primary">
                  {formatCurrency(order.total_amount || 0)}
                </div>
                <div className="text-sm text-muted-foreground mt-1">
                  Ordered {formatDateTime(order.created_at)}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="font-medium">Status</span>
                </div>
                <Badge className={getStatusColor(order.status)}>
                  {order.status?.replace(/_/g, ' ').toUpperCase()}
                </Badge>
                <div className="text-sm text-muted-foreground mt-1">
                  Order #{order.order_number}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Truck className="h-5 w-5 text-blue-600" />
                  <span className="font-medium">Type</span>
                </div>
                <Badge variant="outline">
                  {order.order_type?.toUpperCase() || 'DELIVERY'}
                </Badge>
                {deliveryFee > 0 && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Delivery: {formatCurrency(deliveryFee)}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Customer and Delivery Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <User className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Customer Information</span>
                </div>
                <div className="space-y-3">
                  <div>
                    <div className="font-medium">{order.customer_name}</div>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Mail className="h-4 w-4" />
                    <span>{order.customer_email}</span>
                  </div>
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Phone className="h-4 w-4" />
                    <span>{order.customer_phone}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <MapPin className="h-5 w-5 text-primary" />
                  <span className="font-semibold">
                    {order.order_type === 'delivery' ? 'Delivery Address' : 'Pickup Information'}
                  </span>
                </div>
                <div className="space-y-2">
                  <div className="text-sm">
                    {order.order_type === 'delivery' 
                      ? formatAddress(order.delivery_address)
                      : 'Customer pickup'
                    }
                  </div>
                  {order.special_instructions && (
                    <div className="text-sm text-muted-foreground p-2 bg-muted rounded">
                      <strong>Instructions:</strong> {order.special_instructions}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Order Items */}
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-5 w-5 text-primary" />
                <span className="font-semibold">
                  Order Items ({order.order_items?.length || 0})
                </span>
              </div>
              <div className="space-y-3">
                {order.order_items?.length > 0 ? (
                  order.order_items.map((item: any, index: number) => (
                    <div 
                      key={item.id || index} 
                      className="flex justify-between items-center p-3 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="font-medium">{item.product_name}</div>
                        <div className="text-sm text-muted-foreground">
                          {formatCurrency(item.unit_price)} × {item.quantity}
                        </div>
                      </div>
                      <div className="font-bold">
                        {formatCurrency(item.total_price || (item.unit_price * item.quantity))}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center text-muted-foreground py-4">
                    No items found
                  </div>
                )}
              </div>

              {/* Order Total */}
              <div className="border-t mt-4 pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span>Subtotal:</span>
                  <span>{formatCurrency(subtotal)}</span>
                </div>
                {deliveryFee > 0 && (
                  <div className="flex justify-between text-sm">
                    <span>Delivery Fee:</span>
                    <span>{formatCurrency(deliveryFee)}</span>
                  </div>
                )}
                <div className="flex justify-between font-bold text-lg border-t pt-2">
                  <span>Total:</span>
                  <span>{formatCurrency(order.total_amount || 0)}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Payment Information */}
          {order.payment_method && (
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center gap-2 mb-4">
                  <CreditCard className="h-5 w-5 text-primary" />
                  <span className="font-semibold">Payment Information</span>
                </div>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-muted-foreground">Method:</span>
                    <div className="font-medium">{order.payment_method}</div>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Status:</span>
                    <div className="font-medium">{order.payment_status}</div>
                  </div>
                  {order.payment_reference && (
                    <div className="col-span-2">
                      <span className="text-muted-foreground">Reference:</span>
                      <div className="font-medium font-mono text-xs">
                        {order.payment_reference}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};