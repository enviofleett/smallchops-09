import React from 'react';
import { OrderWithItems } from '@/api/orders';
import { OrderStatus } from '@/types/orders';
import { format } from 'date-fns';
import { Eye, Printer, Package, Truck, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface OrdersTableProps {
  orders: OrderWithItems[];
  onViewOrder: (order: OrderWithItems) => void;
  onDeleteOrder: (order: OrderWithItems) => void;
  selectedOrders: string[];
  onSelectOrder: (orderId: string, selected: boolean) => void;
  onSelectAll: (selected: boolean) => void;
}

const statusConfig: Record<OrderStatus, { label: string; className: string }> = {
  pending: { label: 'Pending', className: 'bg-yellow-100 text-yellow-800' },
  confirmed: { label: 'Confirmed', className: 'bg-blue-100 text-blue-800' },
  preparing: { label: 'Preparing', className: 'bg-yellow-100 text-yellow-800' },
  ready: { label: 'Ready', className: 'bg-indigo-100 text-indigo-800' },
  out_for_delivery: { label: 'Out for Delivery', className: 'bg-purple-100 text-purple-800' },
  delivered: { label: 'Delivered', className: 'bg-green-100 text-green-800' },
  completed: { label: 'Completed', className: 'bg-green-100 text-green-800' },
  cancelled: { label: 'Cancelled', className: 'bg-red-100 text-red-800' },
  refunded: { label: 'Refunded', className: 'bg-gray-100 text-gray-800' },
};

const getStatusBadge = (status: OrderStatus) => {
  return statusConfig[status] || { label: 'Unknown', className: 'bg-gray-100 text-gray-800' };
};

const OrdersTable = ({ orders, onViewOrder, onDeleteOrder, selectedOrders, onSelectOrder, onSelectAll }: OrdersTableProps) => {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left py-4 px-6 font-medium text-gray-600">
                <Checkbox
                  checked={selectedOrders.length === orders.length && orders.length > 0}
                  onCheckedChange={onSelectAll}
                />
              </th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Order ID</th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Customer</th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Order Time</th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Amount</th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Method</th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Status</th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                <td className="py-4 px-6">
                  <Checkbox
                    checked={selectedOrders.includes(order.id)}
                    onCheckedChange={(checked) => onSelectOrder(order.id, checked as boolean)}
                  />
                </td>
                <td className="py-4 px-6">
                  <span className="font-medium text-blue-600">{order.order_number}</span>
                </td>
                <td className="py-4 px-6">
                  <div>
                    <p className="font-medium text-gray-800">{order.customer_name}</p>
                    <p className="text-sm text-gray-600">{order.customer_phone}</p>
                  </div>
                </td>
                <td className="py-4 px-6 text-gray-600">
                  {format(new Date(order.order_time), 'MMM d, yyyy h:mm a')}
                </td>
                <td className="py-4 px-6 font-medium text-gray-800">{formatCurrency(order.total_amount)}</td>
                <td className="py-4 px-6">
                  <div className="flex items-center space-x-2">
                    {order.order_type === 'delivery' ? (
                      <Truck className="h-4 w-4 text-gray-500" />
                    ) : (
                      <Package className="h-4 w-4 text-gray-500" />
                    )}
                    <span className="text-gray-600 capitalize">{order.order_type}</span>
                  </div>
                </td>
                <td className="py-4 px-6">
                  <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(order.status).className}`}>
                    {getStatusBadge(order.status).label}
                  </span>
                </td>
                <td className="py-4 px-6">
                  <TooltipProvider>
                    <div className="flex items-center space-x-1">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => onViewOrder(order)}
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
                            onClick={() => console.log('Print order:', order.id)}
                          >
                            <Printer className="h-4 w-4" />
                            <span className="sr-only">Print Order</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Print Order</p>
                        </TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 hover:text-red-700 hover:bg-red-50"
                            onClick={() => onDeleteOrder(order)}
                          >
                            <Trash2 className="h-4 w-4" />
                            <span className="sr-only">Delete Order</span>
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>
                          <p>Delete Order</p>
                        </TooltipContent>
                      </Tooltip>
                    </div>
                  </TooltipProvider>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default OrdersTable;
