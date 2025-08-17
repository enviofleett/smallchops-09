import React, { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { OrderItemsBreakdown } from './OrderItemsBreakdown';
import { PaymentDetailsCard } from './PaymentDetailsCard';
import { DeliveryScheduleDisplay } from './DeliveryScheduleDisplay';
import { ProductDetailCard } from './ProductDetailCard';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { 
  ChevronDown, 
  ChevronUp, 
  Calendar, 
  MapPin, 
  Package, 
  CreditCard,
  Clock,
  Truck,
  CheckCircle
} from 'lucide-react';
import { format } from 'date-fns';

interface EnhancedOrderCardProps {
  order: any;
  deliverySchedule?: any;
  showExpandedByDefault?: boolean;
  className?: string;
}

export function EnhancedOrderCard({ 
  order, 
  deliverySchedule, 
  showExpandedByDefault = false,
  className = "" 
}: EnhancedOrderCardProps) {
  const [isExpanded, setIsExpanded] = useState(showExpandedByDefault);
  const { data: detailedOrderData, isLoading: isLoadingDetails } = useDetailedOrderData(order.id);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'delivered':
      case 'completed':
        return { 
          label: 'Delivered', 
          className: 'bg-green-100 text-green-800',
          icon: CheckCircle,
          iconColor: 'text-green-600'
        };
      case 'out_for_delivery':
        return { 
          label: 'Out for Delivery', 
          className: 'bg-blue-100 text-blue-800',
          icon: Truck,
          iconColor: 'text-blue-600'
        };
      case 'preparing':
        return { 
          label: 'Preparing', 
          className: 'bg-yellow-100 text-yellow-800',
          icon: Package,
          iconColor: 'text-yellow-600'
        };
      case 'confirmed':
        return { 
          label: 'Confirmed', 
          className: 'bg-blue-100 text-blue-800',
          icon: CheckCircle,
          iconColor: 'text-blue-600'
        };
      case 'pending':
        return { 
          label: 'Pending', 
          className: 'bg-yellow-100 text-yellow-800',
          icon: Clock,
          iconColor: 'text-yellow-600'
        };
      default:
        return { 
          label: 'Unknown', 
          className: 'bg-gray-100 text-gray-800',
          icon: Clock,
          iconColor: 'text-gray-600'
        };
    }
  };

  const statusConfig = getStatusConfig(order.status);
  const StatusIcon = statusConfig.icon;

  // Calculate totals from order items
  const subtotal = order.order_items?.reduce((sum: number, item: any) => 
    sum + (item.total_price || 0), 0) || order.total_amount || 0;
  
  const totalVat = order.order_items?.reduce((sum: number, item: any) => 
    sum + (item.vat_amount || 0), 0) || 0;
  
  const totalDiscount = order.order_items?.reduce((sum: number, item: any) => 
    sum + (item.discount_amount || 0), 0) || 0;

  return (
    <Card className={`overflow-hidden ${className}`}>
      {/* Mobile-responsive Card Header */}
      <div className="p-4 sm:p-6 border-b bg-gray-50">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 sm:gap-3 mb-2 flex-wrap">
              <StatusIcon className={`h-4 w-4 sm:h-5 sm:w-5 ${statusConfig.iconColor} flex-shrink-0`} />
              <h3 className="text-lg sm:text-xl font-semibold text-gray-900 break-words">
                Order #{order.order_number}
              </h3>
              <Badge className={`${statusConfig.className} text-xs`}>
                {statusConfig.label}
              </Badge>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 sm:gap-4 text-xs sm:text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <Calendar className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span className="truncate">{format(new Date(order.order_time), 'MMM d, yyyy h:mm a')}</span>
              </div>
              
              {order.order_type === 'delivery' && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                  <span className="capitalize">{order.order_type}</span>
                </div>
              )}
              
              <div className="flex items-center gap-2">
                <Package className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <span>{order.order_items?.length || 0} items</span>
              </div>
              
              <div className="flex items-center gap-2">
                <CreditCard className="h-3 w-3 sm:h-4 sm:w-4 flex-shrink-0" />
                <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'} className="text-xs">
                  {order.payment_status === 'paid' ? 'Paid' : 'Pending'}
                </Badge>
              </div>
            </div>
          </div>
          
          <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-2 justify-between sm:justify-start">
            <div className="text-xl sm:text-2xl font-bold text-primary">
              {formatCurrency(order.total_amount)}
            </div>
            <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
              <CollapsibleTrigger asChild>
                <Button variant="ghost" size="sm" className="text-xs sm:text-sm">
                  {isExpanded ? (
                    <>
                      <ChevronUp className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">Hide Details</span>
                      <span className="sm:hidden">Hide</span>
                    </>
                  ) : (
                    <>
                      <ChevronDown className="h-3 w-3 sm:h-4 sm:w-4 mr-1 sm:mr-2" />
                      <span className="hidden sm:inline">View Details</span>
                      <span className="sm:hidden">Details</span>
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            </Collapsible>
          </div>
        </div>
      </div>

      {/* Expandable Content - Mobile optimized */}
      <Collapsible open={isExpanded} onOpenChange={setIsExpanded}>
        <CollapsibleContent>
          <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
            {/* Order Items Breakdown */}
            {order.order_items && order.order_items.length > 0 && (
              <OrderItemsBreakdown
                items={order.order_items}
                subtotal={subtotal}
                totalVat={totalVat}
                totalDiscount={totalDiscount}
                grandTotal={order.total_amount}
                showDetailed={true}
              />
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-6">
              {/* Payment Details */}
              <PaymentDetailsCard
                paymentStatus={order.payment_status}
                paymentMethod={order.payment_method}
                paymentReference={order.payment_reference}
                paidAt={order.paid_at}
                totalAmount={order.total_amount}
              />

              {/* Delivery Schedule */}
              {order.order_type === 'delivery' && deliverySchedule && (
                <div className="space-y-4">
                  <DeliveryScheduleDisplay 
                    schedule={deliverySchedule} 
                    className="h-fit"
                  />
                </div>
              )}
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}