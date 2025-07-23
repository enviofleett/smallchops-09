import React from 'react';
import { OrderWithItems } from '@/api/orders';
import { OrderStatus } from '@/types/orders';
import { format } from 'date-fns';
import { Eye, Printer, Package, Truck } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { MobileTable, MobileRow, MobileField, MobileHeader, MobileHeaderCell, MobileBody } from '@/components/ui/mobile-table';

interface OrdersTableProps {
  orders: OrderWithItems[];
  onViewOrder: (order: OrderWithItems) => void;
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-800' },
  preparing: { label: 'Preparing', className: 'bg-yellow-100 text-yellow-800' },
  ready: { label: 'Ready', className: 'bg-indigo-100 text-indigo-800' },
  out_for_delivery: { label: 'Out for Delivery', className: 'bg-purple-100 text-purple-800' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
  refunded: { label: 'Refunded', className: 'bg-gray-100 text-gray-800' },
};

const getStatusBadge = (status: OrderStatus) => {
  return statusConfig[status] || { label: 'Unknown', className: 'bg-gray-100 text-gray-800' };
};

const OrdersTable = ({ orders, onViewOrder }: OrdersTableProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  return (
    <MobileTable>
      <table className="w-full">
        <MobileHeader>
          <MobileHeaderCell>Order ID</MobileHeaderCell>
          <MobileHeaderCell>Customer</MobileHeaderCell>
          <MobileHeaderCell>Order Time</MobileHeaderCell>
          <MobileHeaderCell>Amount</MobileHeaderCell>
          <MobileHeaderCell>Method</MobileHeaderCell>
          <MobileHeaderCell>Status</MobileHeaderCell>
          <MobileHeaderCell>Actions</MobileHeaderCell>
        </MobileHeader>
        <MobileBody>
          {orders.map((order) => (
            <MobileRow key={order.id} onClick={() => onViewOrder(order)}>
              <MobileField label="Order ID">
                <span className="font-medium text-primary">{order.order_number}</span>
              </MobileField>
              
              <MobileField label="Customer">
                <div>
                  <p className="font-medium text-foreground">{order.customer_name}</p>
                  <p className="text-sm text-muted-foreground">{order.customer_phone}</p>
                </div>
              </MobileField>
              
              <MobileField label="Order Time">
                <span className="text-muted-foreground">
                  {format(new Date(order.order_time), 'MMM d, yyyy h:mm a')}
                </span>
              </MobileField>
              
              <MobileField label="Amount">
                <span className="font-medium text-foreground">{formatCurrency(order.total_amount)}</span>
              </MobileField>
              
              <MobileField label="Method">
                <div className="flex items-center space-x-2">
                  {order.order_type === 'delivery' ? (
                    <Truck className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Package className="h-4 w-4 text-muted-foreground" />
                  )}
                  <span className="text-muted-foreground capitalize">{order.order_type}</span>
                </div>
              </MobileField>
              
              <MobileField label="Status">
                <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(order.status).className}`}>
                  {getStatusBadge(order.status).label}
                </span>
              </MobileField>
              
              <MobileField label="Actions">
                <TooltipProvider>
                  <div className="flex items-center space-x-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            onViewOrder(order);
                          }}
                        >
                          <Eye className="h-4 w-4" />
                          <span className="sr-only">View Order</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>View Details</p>
                      </TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={(e) => {
                            e.stopPropagation();
                            console.log('Print order:', order.id);
                          }}
                        >
                          <Printer className="h-4 w-4" />
                          <span className="sr-only">Print Order</span>
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Print Order</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                </TooltipProvider>
              </MobileField>
            </MobileRow>
          ))}
        </MobileBody>
      </table>
    </MobileTable>
  );
};

export default OrdersTable;
