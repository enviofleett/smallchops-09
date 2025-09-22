import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusUpdateButton } from './StatusUpdateButton';
import { OrderDetailsDialog } from './OrderDetailsDialog';
import { formatCurrency } from '@/lib/utils';
import { safeFormatDate } from '@/utils/safeDateFormat';
import { Eye, Phone, Mail, MapPin } from 'lucide-react';

interface OrderCardProps {
  order: any;
  onConflict: (conflict: any) => void;
}

export function OrderCard({ order, onConflict }: OrderCardProps) {
  const [showDetails, setShowDetails] = useState(false);

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
    <>
      <Card className="hover:shadow-lg transition-shadow">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg font-semibold">
              #{order.order_number}
            </CardTitle>
            <Badge className={getStatusColor(order.status)}>
              {getStatusLabel(order.status)}
            </Badge>
          </div>
          <div className="text-sm text-muted-foreground">
            {safeFormatDate(order.created_at, 'MMM dd, yyyy - HH:mm')}
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Customer Info */}
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm">
              <div className="font-medium">{order.customer_name}</div>
            </div>
            
            {order.customer_phone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone className="h-4 w-4" />
                {order.customer_phone}
              </div>
            )}
            
            {order.customer_email && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Mail className="h-4 w-4" />
                {order.customer_email}
              </div>
            )}
            
            {order.order_type === 'delivery' && order.delivery_address && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" />
                <span className="truncate">
                  {typeof order.delivery_address === 'object' 
                    ? (order.delivery_address.address_line_1 || order.delivery_address.city || 'Delivery Address')
                    : (order.delivery_address || 'Delivery Address')
                  }
                </span>
              </div>
            )}
          </div>

          {/* Order Summary */}
          <div className="space-y-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Items:</span>
              <span className="text-sm font-medium">
                {order.order_items_new?.length || 0} items
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Total:</span>
              <span className="text-lg font-bold text-primary">
                {formatCurrency(order.total_amount)}
              </span>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-2">
            <StatusUpdateButton 
              order={order} 
              onConflict={onConflict}
              className="flex-1"
            />
            
            <button
              onClick={() => setShowDetails(true)}
              className="px-3 py-2 text-sm border border-gray-200 rounded-md hover:bg-gray-50 dark:border-gray-700 dark:hover:bg-gray-800"
            >
              <Eye className="h-4 w-4" />
            </button>
          </div>

          {/* Last Updated Info */}
          {order.updated_by_name && (
            <div className="text-xs text-muted-foreground pt-2 border-t">
              Last updated by {order.updated_by_name}
              {order.updated_at && (
                <span className="ml-1">
                  ({safeFormatDate(order.updated_at, 'HH:mm')})
                </span>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Order Details Dialog */}
      {showDetails && (
        <OrderDetailsDialog
          order={order}
          isOpen={showDetails}
          onClose={() => setShowDetails(false)}
        />
      )}
    </>
  );
}