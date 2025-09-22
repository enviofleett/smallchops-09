import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { formatCurrency } from '@/lib/utils';
import { format } from 'date-fns';
import { Phone, Mail, MapPin, Package, Calendar, User } from 'lucide-react';

interface OrderDetailsDialogProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

export function OrderDetailsDialog({ order, isOpen, onClose }: OrderDetailsDialogProps) {
  const getStatusColor = (status: string) => {
    const colors = {
      pending: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300',
      confirmed: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300',
      preparing: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300',
      ready: 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300',
      out_for_delivery: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300',
      delivered: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300',
      cancelled: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300',
      completed: 'bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300'
    };
    return colors[status as keyof typeof colors] || colors.pending;
  };

  const getStatusLabel = (status: string) => {
    const labels = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      preparing: 'Preparing',
      ready: 'Ready',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      completed: 'Completed'
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>Order #{order.order_number}</span>
            <Badge className={getStatusColor(order.status)}>
              {getStatusLabel(order.status)}
            </Badge>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Order Info */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm">
                <Calendar className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">Created:</span>
                <span>{format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}</span>
              </div>
              
              {order.updated_at && (
                <div className="flex items-center gap-2 text-sm">
                  <Calendar className="h-4 w-4 text-muted-foreground" />
                  <span className="font-medium">Updated:</span>
                  <span>{format(new Date(order.updated_at), 'MMM dd, yyyy HH:mm')}</span>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <div className="text-sm">
                <span className="font-medium">Order Type:</span>
                <Badge variant="outline" className="ml-2">
                  {order.order_type === 'delivery' ? 'Delivery' : 'Pickup'}
                </Badge>
              </div>
              
              <div className="text-sm">
                <span className="font-medium">Payment:</span>
                <Badge variant="outline" className="ml-2">
                  {order.payment_status}
                </Badge>
              </div>
            </div>
          </div>

          <Separator />

          {/* Customer Info */}
          <div>
            <h4 className="font-semibold mb-3">Customer Information</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{order.customer_name}</span>
              </div>
              
              {order.customer_phone && (
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <span>{order.customer_phone}</span>
                </div>
              )}
              
              {order.customer_email && (
                <div className="flex items-center gap-2">
                  <Mail className="h-4 w-4 text-muted-foreground" />
                  <span>{order.customer_email}</span>
                </div>
              )}
              
              {order.order_type === 'delivery' && order.delivery_address && (
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <span>{order.delivery_address.address || 'Delivery Address'}</span>
                </div>
              )}
            </div>
          </div>

          <Separator />

          {/* Order Items */}
          <div>
            <h4 className="font-semibold mb-3 flex items-center gap-2">
              <Package className="h-4 w-4" />
              Order Items
            </h4>
            
            {order.order_items_new && order.order_items_new.length > 0 ? (
              <div className="space-y-3">
                {order.order_items_new.map((item: any, index: number) => (
                  <div key={index} className="flex justify-between items-center p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                    <div>
                      <div className="font-medium">{item.product_name}</div>
                      <div className="text-sm text-muted-foreground">
                        Qty: {item.quantity} × {formatCurrency(item.unit_price)}
                      </div>
                    </div>
                    <div className="font-medium">
                      {formatCurrency(item.total_price)}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-muted-foreground">No items found</p>
            )}
          </div>

          <Separator />

          {/* Delivery Schedule */}
          {order.order_delivery_schedule && order.order_delivery_schedule.length > 0 && (
            <>
              <div>
                <h4 className="font-semibold mb-3">Delivery Schedule</h4>
                {order.order_delivery_schedule.map((schedule: any, index: number) => (
                  <div key={index} className="space-y-2">
                    <div className="text-sm">
                      <span className="font-medium">Date:</span> {schedule.delivery_date}
                    </div>
                    {schedule.delivery_time_start && (
                      <div className="text-sm">
                        <span className="font-medium">Time:</span> 
                        {schedule.delivery_time_start} - {schedule.delivery_time_end}
                      </div>
                    )}
                    {schedule.assigned_rider_name && (
                      <div className="text-sm">
                        <span className="font-medium">Rider:</span> {schedule.assigned_rider_name}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <Separator />
            </>
          )}

          {/* Special Instructions */}
          {order.special_instructions && (
            <>
              <div>
                <h4 className="font-semibold mb-2">Special Instructions</h4>
                <p className="text-sm text-muted-foreground bg-gray-50 dark:bg-gray-800 p-3 rounded-lg">
                  {order.special_instructions}
                </p>
              </div>
              <Separator />
            </>
          )}

          {/* Total */}
          <div className="flex justify-between items-center text-lg font-bold">
            <span>Total Amount:</span>
            <span className="text-primary">{formatCurrency(order.total_amount)}</span>
          </div>

          {/* Last Updated Info */}
          {order.updated_by_name && (
            <div className="text-sm text-muted-foreground border-t pt-3">
              Last updated by {order.updated_by_name} on{' '}
              {format(new Date(order.updated_at), 'MMM dd, yyyy HH:mm')}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}