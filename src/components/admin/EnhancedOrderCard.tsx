import React from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { OrderWithItems } from '@/api/orders';
import { AdminOrderStatusManager } from './AdminOrderStatusManager';
import { SimpleOrderStatusUpdater } from './SimpleOrderStatusUpdater';
import { SecureOrderStatusUpdater } from './SecureOrderStatusUpdater';
import ProductionOrderErrorBoundary from './ProductionOrderErrorBoundary';
import { PaymentConfirmationButton } from './PaymentConfirmationButton';
import { format } from 'date-fns';
import { 
  Package, 
  MapPin, 
  User, 
  Clock, 
  AlertTriangle, 
  CheckCircle, 
  Truck, 
  Phone, 
  Mail,
  DollarSign
} from 'lucide-react';
import { MiniCountdownTimer } from '@/components/orders/MiniCountdownTimer';
import { isOrderOverdue } from '@/utils/scheduleTime';

export interface EnhancedOrderCardProps {
  order: OrderWithItems;
  deliverySchedule?: any;
  onOrderSelect?: (order: OrderWithItems) => void;
  showAdvancedControls?: boolean;
  showSecurityBadge?: boolean;
  useSimpleMode?: boolean;
}

export const EnhancedOrderCard: React.FC<EnhancedOrderCardProps> = ({ 
  order, 
  deliverySchedule, 
  onOrderSelect,
  showAdvancedControls = false,
  showSecurityBadge = false,
  useSimpleMode = false
}) => {
  const isOverdue = deliverySchedule && 
    isOrderOverdue(deliverySchedule.delivery_date, deliverySchedule.delivery_time_end);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'delivered': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'out_for_delivery': return <Truck className="w-4 h-4 text-blue-600" />;
      case 'preparing': return <Clock className="w-4 h-4 text-orange-600" />;
      case 'confirmed': return <Package className="w-4 h-4 text-yellow-600" />;
      case 'pending': return <Clock className="w-4 h-4 text-gray-600" />;
      case 'cancelled': return <AlertTriangle className="w-4 h-4 text-red-600" />;
      default: return <Package className="w-4 h-4 text-gray-600" />;
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN'
    }).format(amount);
  };

  return (
    <ProductionOrderErrorBoundary 
      orderId={order.id} 
      orderNumber={order.order_number}
    >
      <Card className={`transition-all duration-200 hover:shadow-lg ${
        isOverdue ? 'border-l-4 border-l-destructive bg-red-50/20' : 
        order.payment_status === 'paid' ? 'border-[3px] border-green-600 shadow-green-200 shadow-md ring-1 ring-green-500/20' : 'border'
      }`}>
        <CardHeader className="pb-3">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                {getStatusIcon(order.status)}
                <h3 className="font-semibold text-lg">#{order.order_number}</h3>
                {isOverdue && (
                  <Badge variant="destructive" className="animate-pulse">
                    <AlertTriangle className="w-3 h-3 mr-1" />
                    Overdue
                  </Badge>
                )}
                {order.payment_status === 'paid' && (
                  <Badge variant="outline" className="bg-green-100 text-green-800 border-green-200">
                    <CheckCircle className="w-3 h-3 mr-1" />
                    Paid
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
              </p>
            </div>

            {!showAdvancedControls && (
              useSimpleMode ? (
                <SimpleOrderStatusUpdater
                  orderId={order.id}
                  currentStatus={order.status}
                  orderNumber={order.order_number}
                  size="sm"
                />
              ) : (
                <AdminOrderStatusManager
                  orderId={order.id}
                  currentStatus={order.status}
                  orderNumber={order.order_number}
                  paymentStatus={order.payment_status}
                  paymentReference={order.paystack_reference || order.payment_reference}
                  size="sm"
                />
              )
            )}
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          {/* Customer Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2 text-sm">
                <User className="w-4 h-4" />
                Customer Details
              </h4>
              <div className="space-y-1 pl-6">
                <p className="font-medium">{order.customer_name}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1">
                  <Mail className="w-3 h-3" />
                  {order.customer_email}
                </p>
                {order.customer_phone && (
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Phone className="w-3 h-3" />
                    {order.customer_phone}
                  </p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2 text-sm">
                <DollarSign className="w-4 h-4" />
                Order Summary
              </h4>
              <div className="space-y-1 pl-6">
                <p className="text-sm">Items: {order.order_items?.length || 0}</p>
                <p className="font-bold text-lg text-green-600">
                  {formatCurrency(order.total_amount)}
                </p>
                {order.delivery_fee && order.delivery_fee > 0 && (
                  <p className="text-sm text-muted-foreground">
                    Delivery: {formatCurrency(order.delivery_fee)}
                  </p>
                )}
                <Badge variant="outline" className={
                  order.order_type === 'delivery' 
                    ? 'bg-blue-100 text-blue-800 border-blue-200' 
                    : 'bg-gray-100 text-gray-800 border-gray-200'
                }>
                  {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}
                </Badge>
              </div>
            </div>
          </div>

          {/* Delivery Schedule and Countdown */}
          {deliverySchedule && (
            <div className="bg-muted/30 rounded-lg p-4 space-y-3">
              <h4 className="font-medium flex items-center gap-2 text-sm">
                <Clock className="w-4 h-4" />
                Delivery Schedule
              </h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <p className="text-xs text-muted-foreground">Date</p>
                  <p className="font-medium text-sm">
                    {format(new Date(deliverySchedule.delivery_date), 'MMM dd, yyyy')}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-muted-foreground">Time Window</p>
                  <p className="font-medium text-sm">
                    {deliverySchedule.delivery_time_start} - {deliverySchedule.delivery_time_end}
                  </p>
                </div>
              </div>
              
              {deliverySchedule.delivery_time_start && deliverySchedule.delivery_time_end && (
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">Countdown:</span>
                  <MiniCountdownTimer
                    deliveryDate={deliverySchedule.delivery_date}
                    deliveryTimeStart={deliverySchedule.delivery_time_start}
                    deliveryTimeEnd={deliverySchedule.delivery_time_end}
                    orderStatus={order.status}
                  />
                </div>
              )}
            </div>
          )}

          {/* Delivery Address */}
          {order.order_type === 'delivery' && order.delivery_address && (
            <div className="space-y-2">
              <h4 className="font-medium flex items-center gap-2 text-sm">
                <MapPin className="w-4 h-4" />
                Delivery Address
              </h4>
              <div className="bg-muted/30 rounded-lg p-3">
                <p className="text-sm">
                  {typeof order.delivery_address === 'object' && !Array.isArray(order.delivery_address)
                    ? `${(order.delivery_address as any).address_line_1 || ''}, ${(order.delivery_address as any).city || ''}`.trim()
                    : typeof order.delivery_address === 'string' 
                      ? order.delivery_address
                      : 'Address available'
                  }
                </p>
              </div>
            </div>
          )}

          {/* Advanced Controls */}
          {showAdvancedControls && (
            <div className="border-t pt-4">
              <SecureOrderStatusUpdater
                orderId={order.id}
                currentStatus={order.status}
                orderNumber={order.order_number}
                showSecurityBadge={showSecurityBadge}
              />
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-wrap gap-2 pt-2 border-t">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onOrderSelect?.(order)}
            >
              View Details
            </Button>
            <Button 
              variant="secondary" 
              size="sm"
              asChild
            >
              <a href={`/admin/order-details/${order.id}`} target="_blank" rel="noopener noreferrer">
                Full Details
              </a>
            </Button>
            
            {order.payment_status === 'pending' && (order.paystack_reference || order.payment_reference) && (
              <PaymentConfirmationButton
                orderId={order.id}
                orderNumber={order.order_number}
                paymentReference={order.paystack_reference || order.payment_reference}
                paymentStatus={order.payment_status}
              />
            )}
            
            {order.payment_status !== 'paid' && order.status === 'pending' && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800">
                Awaiting Payment
              </Badge>
            )}
          </div>
        </CardContent>
      </Card>
    </ProductionOrderErrorBoundary>
  );
};