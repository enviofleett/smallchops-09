import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { format } from 'date-fns';
import { Package, User, MapPin, Clock, Phone, Mail } from 'lucide-react';

interface OrderDetailsModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDetailsModal({ order, isOpen, onClose }: OrderDetailsModalProps) {
  const formatAddress = (address: any) => {
    if (!address) return 'No address provided';
    
    const parts = [
      address.address_line_1,
      address.address_line_2,
      address.city,
      address.state,
      address.postal_code,
    ].filter(Boolean);
    
    return parts.join(', ');
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3">
            <Package className="w-6 h-6" />
            Order Details - #{order.order_number}
          </DialogTitle>
          <DialogDescription>
            Complete order information and delivery details
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Status and Type */}
          <div className="flex items-center gap-4">
            <Badge 
              variant={order.status === 'ready' ? 'default' : 'secondary'}
              className="text-sm"
            >
              {order.status.replace('_', ' ').toUpperCase()}
            </Badge>
            <Badge 
              variant={order.order_type === 'delivery' ? 'outline' : 'secondary'}
            >
              {order.order_type.toUpperCase()}
            </Badge>
            <span className="text-sm text-muted-foreground">
              Placed on {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
            </span>
          </div>

          {/* Customer Information */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Information
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
              <div>
                <p className="font-medium">{order.customer_name}</p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Mail className="w-3 h-3" />
                  {order.customer_email}
                </p>
                <p className="text-sm text-muted-foreground flex items-center gap-1 mt-1">
                  <Phone className="w-3 h-3" />
                  {order.customer_phone}
                </p>
              </div>
            </div>
          </div>

          {/* Delivery Information */}
          {order.order_type === 'delivery' && (
            <div className="space-y-3">
              <h3 className="text-lg font-semibold flex items-center gap-2">
                <MapPin className="w-5 h-5" />
                Delivery Information
              </h3>
              <div className="p-4 bg-muted/30 rounded-lg space-y-3">
                <div>
                  <p className="font-medium mb-1">Delivery Address:</p>
                  <p className="text-sm">{formatAddress(order.delivery_address)}</p>
                </div>
                
                {order.delivery_schedule && (
                  <div>
                    <p className="font-medium mb-1 flex items-center gap-1">
                      <Clock className="w-4 h-4" />
                      Delivery Window:
                    </p>
                    <p className="text-sm">
                      {format(new Date(order.delivery_schedule.delivery_date), 'MMM dd, yyyy')} - {' '}
                      {order.delivery_schedule.delivery_time_start} to {order.delivery_schedule.delivery_time_end}
                    </p>
                    {order.delivery_schedule.is_flexible && (
                      <p className="text-xs text-muted-foreground mt-1">
                        ✓ Flexible delivery time
                      </p>
                    )}
                  </div>
                )}
                
                {order.delivery_schedule?.special_instructions && (
                  <div>
                    <p className="font-medium mb-1">Special Instructions:</p>
                    <p className="text-sm bg-background p-2 rounded border">
                      {order.delivery_schedule.special_instructions}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Order Items */}
          <div className="space-y-3">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order Items ({order.order_items.length})
            </h3>
            <div className="space-y-2">
              {order.order_items.map((item: any, index: number) => (
                <div key={index} className="flex justify-between items-center p-3 bg-muted/30 rounded-lg">
                  <div className="flex-1">
                    <p className="font-medium">{item.product_name}</p>
                    <p className="text-sm text-muted-foreground">
                      Quantity: {item.quantity} × ₦{item.unit_price.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-medium">₦{item.total_price.toLocaleString()}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <Separator />

          {/* Order Summary */}
          <div className="space-y-2">
            <h3 className="text-lg font-semibold">Order Summary</h3>
            <div className="flex justify-between items-center text-lg font-bold">
              <span>Total Amount:</span>
              <span>₦{order.total_amount.toLocaleString()}</span>
            </div>
            <p className="text-sm text-muted-foreground">
              Payment Status: {order.payment_status || 'Pending'}
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}