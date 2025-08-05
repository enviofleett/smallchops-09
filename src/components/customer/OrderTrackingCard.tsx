import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { 
  Clock, 
  Package, 
  ChefHat, 
  Truck, 
  CheckCircle, 
  XCircle,
  Eye,
  RotateCcw,
  MapPin,
  Timer
} from 'lucide-react';
import { OrderStatus } from '@/types/orders';
import { format } from 'date-fns';

interface OrderItem {
  id: string;
  product_name: string;
  quantity: number;
  price: number;
  total_price: number;
  products?: {
    name: string;
    image_url?: string;
  };
}

interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  order_time: string;
  total_amount: number;
  customer_email: string;
  customer_name: string;
  customer_phone?: string;
  delivery_address?: string;
  estimated_completion_time?: string;
  order_items: OrderItem[];
}

interface OrderTrackingCardProps {
  order: Order;
  onViewDetails?: (orderId: string) => void;
  onReorder?: (order: Order) => void;
  onTrackDelivery?: (orderId: string) => void;
}

const orderSteps = [
  { key: 'pending', label: 'Order Received', icon: Clock },
  { key: 'confirmed', label: 'Confirmed', icon: CheckCircle },
  { key: 'preparing', label: 'Preparing', icon: ChefHat },
  { key: 'ready', label: 'Ready', icon: Package },
  { key: 'out_for_delivery', label: 'Out for Delivery', icon: Truck },
  { key: 'delivered', label: 'Delivered', icon: CheckCircle },
];

export function OrderTrackingCard({ 
  order, 
  onViewDetails, 
  onReorder, 
  onTrackDelivery 
}: OrderTrackingCardProps) {
  const getCurrentStepIndex = (status: OrderStatus) => {
    if (status === 'cancelled') return -1;
    if (status === 'completed') return orderSteps.length - 1;
    return orderSteps.findIndex(step => step.key === status);
  };

  const currentStepIndex = getCurrentStepIndex(order.status);
  const isDeliverable = ['out_for_delivery', 'delivered'].includes(order.status);
  const canReorder = ['delivered', 'completed'].includes(order.status);
  const isCancelled = order.status === 'cancelled';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
    }).format(amount);
  };

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return 'default';
      case 'out_for_delivery':
        return 'secondary';
      case 'preparing':
      case 'ready':
        return 'outline';
      case 'cancelled':
        return 'destructive';
      default:
        return 'secondary';
    }
  };

  const getEstimatedTime = () => {
    if (order.estimated_completion_time) {
      return format(new Date(order.estimated_completion_time), 'p');
    }
    
    switch (order.status) {
      case 'preparing':
        return '15-20 min';
      case 'ready':
        return 'Ready for pickup';
      case 'out_for_delivery':
        return '10-15 min';
      default:
        return null;
    }
  };

  return (
    <Card className="w-full">
      <CardContent className="p-6">
        {/* Order Header */}
        <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-6 gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h3 className="text-lg font-semibold">Order #{order.order_number}</h3>
              <Badge variant={getStatusColor(order.status)}>
                {order.status.replace('_', ' ').toUpperCase()}
              </Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Placed on {format(new Date(order.order_time), 'PPP')} at {format(new Date(order.order_time), 'p')}
            </p>
            {getEstimatedTime() && !isCancelled && (
              <div className="flex items-center gap-2 text-sm text-primary">
                <Timer className="w-4 h-4" />
                <span>Expected: {getEstimatedTime()}</span>
              </div>
            )}
          </div>
          <div className="text-left sm:text-right">
            <p className="text-2xl font-bold">{formatCurrency(order.total_amount)}</p>
            <p className="text-sm text-muted-foreground">{order.order_items.length} items</p>
          </div>
        </div>

        {/* Order Progress Tracking */}
        {!isCancelled && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-4">
              {orderSteps.map((step, index) => {
                const StepIcon = step.icon;
                const isCompleted = index <= currentStepIndex;
                const isCurrent = index === currentStepIndex;
                
                return (
                  <div key={step.key} className="flex flex-col items-center flex-1">
                    <div className={`
                      w-10 h-10 rounded-full flex items-center justify-center border-2 transition-colors
                      ${isCompleted 
                        ? 'bg-primary border-primary text-primary-foreground' 
                        : isCurrent
                        ? 'border-primary text-primary'
                        : 'border-muted text-muted-foreground'
                      }
                    `}>
                      <StepIcon className="w-5 h-5" />
                    </div>
                    <span className={`
                      text-xs mt-2 text-center max-w-16
                      ${isCompleted || isCurrent ? 'text-foreground font-medium' : 'text-muted-foreground'}
                    `}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
            
            {/* Progress Bar */}
            <div className="relative">
              <div className="absolute top-5 left-5 right-5 h-0.5 bg-muted -z-10" />
              <div 
                className="absolute top-5 left-5 h-0.5 bg-primary transition-all duration-500 -z-10"
                style={{ 
                  width: currentStepIndex >= 0 
                    ? `${(currentStepIndex / (orderSteps.length - 1)) * 100}%` 
                    : '0%' 
                }}
              />
            </div>
          </div>
        )}

        {/* Delivery Status for Out for Delivery orders */}
        {order.status === 'out_for_delivery' && (
          <div className="bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Truck className="w-5 h-5 text-blue-600" />
                <span className="font-medium text-blue-900 dark:text-blue-100">
                  Your order is on the way!
                </span>
              </div>
              {onTrackDelivery && (
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => onTrackDelivery(order.id)}
                  className="border-blue-300 text-blue-700 hover:bg-blue-100"
                >
                  <MapPin className="w-4 h-4 mr-1" />
                  Track
                </Button>
              )}
            </div>
            <div className="w-full bg-blue-200 dark:bg-blue-800 rounded-full h-2">
              <div className="bg-blue-600 h-2 rounded-full w-3/4 animate-pulse"></div>
            </div>
          </div>
        )}

        {/* Order Items Preview */}
        <div className="mb-6">
          <h4 className="font-medium mb-3">Order Items</h4>
          <div className="space-y-3">
            {order.order_items.slice(0, 3).map((item) => (
              <div key={item.id} className="flex items-center gap-3">
                {item.products?.image_url && (
                  <img
                    src={item.products.image_url}
                    alt={item.products.name}
                    className="w-12 h-12 rounded-lg object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">
                    {item.products?.name || item.product_name}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Qty: {item.quantity} × {formatCurrency(item.price)}
                  </p>
                </div>
                <p className="font-medium">{formatCurrency(item.total_price)}</p>
              </div>
            ))}
            {order.order_items.length > 3 && (
              <p className="text-sm text-muted-foreground text-center py-2">
                +{order.order_items.length - 3} more items
              </p>
            )}
          </div>
        </div>

        <Separator className="mb-4" />

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-2">
          {onViewDetails && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onViewDetails(order.id)}
              className="flex-1 sm:flex-none"
            >
              <Eye className="w-4 h-4 mr-2" />
              View Details
            </Button>
          )}
          
          {canReorder && onReorder && (
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => onReorder(order)}
              className="flex-1 sm:flex-none"
            >
              <RotateCcw className="w-4 h-4 mr-2" />
              Reorder
            </Button>
          )}

          {isCancelled && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <XCircle className="w-4 h-4 text-destructive" />
              Order was cancelled
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}