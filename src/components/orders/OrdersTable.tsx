import React from 'react';
import { OrderWithItems } from '@/api/orders';
import { OrderStatus } from '@/types/orders';
import { format } from 'date-fns';
import { Eye, Printer, Package, Truck, Trash2, Calendar, Clock } from 'lucide-react';
import { useOrderDeliverySchedules } from '@/hooks/useOrderDeliverySchedules';
import { MiniCountdownTimer } from './MiniCountdownTimer';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { ResponsiveTable, MobileCard, MobileCardHeader, MobileCardContent, MobileCardRow, MobileCardActions } from '@/components/ui/responsive-table';
import { formatDeliveryInstructionsForDisplay, getDeliveryInstructionsFromAddress } from '@/utils/deliveryInstructions';

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
  returned: { label: 'Returned', className: 'bg-orange-100 text-orange-800' },
};

const getStatusBadge = (status: OrderStatus) => {
  return statusConfig[status] || { label: 'Unknown', className: 'bg-gray-100 text-gray-800' };
};

const OrdersTable = ({ orders, onViewOrder, onDeleteOrder, selectedOrders, onSelectOrder, onSelectAll }: OrdersTableProps) => {
  const orderIds = orders.map(order => order.id);
  const { schedules, loading: schedulesLoading } = useOrderDeliverySchedules(orderIds);
  
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
  };

  const renderDeliverySchedule = (orderId: string, orderStatus: OrderStatus) => {
    const schedule = schedules[orderId];
    
    if (!schedule) {
      return (
        <div className="flex items-center gap-2 text-gray-500">
          <Calendar className="h-3 w-3" />
          <span className="text-xs">No schedule</span>
        </div>
      );
    }

    return (
      <div className="space-y-1">
        <MiniCountdownTimer
          deliveryDate={schedule.delivery_date}
          deliveryTimeStart={schedule.delivery_time_start}
          deliveryTimeEnd={schedule.delivery_time_end}
          orderStatus={orderStatus}
        />
        <div className="text-xs text-gray-500">
          {format(new Date(schedule.delivery_date), 'MMM d')} • {format(new Date(`2000-01-01T${schedule.delivery_time_start}`), 'h:mm a')}
        </div>
      </div>
    );
  };

  const mobileComponent = (
    <div className="space-y-2">
      {selectedOrders.length > 0 && (
        <div className="bg-primary/10 border border-primary/20 rounded-lg p-2 mb-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-primary">
              {selectedOrders.length} selected
            </span>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onSelectAll(false)}
              className="text-primary border-primary/20 hover:bg-primary/5 h-6 px-2 text-xs"
            >
              Clear
            </Button>
          </div>
        </div>
      )}
      
      {orders.map((order) => (
        <MobileCard key={order.id} className="p-2 md:p-3">
          <MobileCardHeader className="pb-2">
            <div className="flex items-start gap-2">
              <Checkbox
                checked={selectedOrders.includes(order.id)}
                onCheckedChange={(checked) => onSelectOrder(order.id, checked as boolean)}
                className="mt-0.5 h-3 w-3 md:h-4 md:w-4"
              />
              <div className="min-w-0 flex-1">
                <p className="font-medium text-primary text-xs md:text-sm truncate">#{order.order_number}</p>
                <p className="text-xs text-muted-foreground truncate">{order.customer_name}</p>
                <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
              </div>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <span className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded-full ${getStatusBadge(order.status).className}`}>
                {getStatusBadge(order.status).label}
              </span>
              <span className={`inline-block px-1.5 py-0.5 text-xs font-medium rounded-full ${
                order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 
                order.payment_status === 'failed' ? 'bg-red-100 text-red-800' : 
                'bg-yellow-100 text-yellow-800'
              }`}>
                {order.payment_status === 'paid' ? 'paid' : 
                 order.payment_status === 'failed' ? 'failed' : 
                 'pending'}
              </span>
            </div>
          </MobileCardHeader>
          
          <MobileCardContent className="space-y-1">
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Amount</span>
              <span className="font-semibold text-sm">{formatCurrency(order.total_amount)}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Time</span>
              <span className="text-xs">{format(new Date(order.order_time), 'MMM d, h:mm a')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-xs text-muted-foreground">Type</span>
              <div className="flex items-center gap-1">
                {order.order_type === 'delivery' ? (
                  <Truck className="h-3 w-3 text-muted-foreground" />
                ) : (
                  <Package className="h-3 w-3 text-muted-foreground" />
                )}
                <span className="capitalize text-xs">{order.order_type}</span>
              </div>
            </div>
            {order.order_type === 'delivery' && (order as any).delivery_zones && (
              <div className="flex justify-between items-center">
                <span className="text-xs text-muted-foreground">Zone</span>
                <span className="text-xs">{(order as any).delivery_zones.name}</span>
              </div>
            )}
            <div className="border-t pt-1 mt-1">
              {renderDeliverySchedule(order.id, order.status)}
            </div>
          </MobileCardContent>
          
          <MobileCardActions className="pt-2 gap-1">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onViewOrder(order)}
              className="flex items-center gap-1 h-6 px-2 text-xs"
            >
              <Eye className="h-3 w-3" />
              View
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => console.log('Print order:', order.id)}
              className="flex items-center gap-1 h-6 px-2 text-xs"
            >
              <Printer className="h-3 w-3" />
              Print
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDeleteOrder(order)}
              className="flex items-center gap-1 h-6 px-2 text-xs text-destructive border-destructive/20 hover:bg-destructive/5"
            >
              <Trash2 className="h-3 w-3" />
            </Button>
          </MobileCardActions>
        </MobileCard>
      ))}
    </div>
  );

  return (
    <ResponsiveTable
      className="bg-background rounded-lg shadow-sm border border-border overflow-hidden"
      mobileComponent={mobileComponent}
    >
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-muted/50 border-b border-border">
            <tr>
              <th className="text-left py-3 md:py-4 px-3 md:px-6 font-medium text-foreground text-sm">
                <Checkbox
                  checked={selectedOrders.length === orders.length && orders.length > 0}
                  onCheckedChange={onSelectAll}
                />
              </th>
              <th className="text-left py-3 md:py-4 px-3 md:px-6 font-medium text-foreground text-sm min-w-[120px]">Order ID</th>
              <th className="text-left py-3 md:py-4 px-3 md:px-6 font-medium text-foreground text-sm min-w-[180px]">Customer</th>
              <th className="text-left py-3 md:py-4 px-3 md:px-6 font-medium text-foreground text-sm min-w-[140px]">Order Time</th>
              <th className="text-left py-3 md:py-4 px-3 md:px-6 font-medium text-foreground text-sm min-w-[120px]">Amount</th>
              <th className="text-left py-3 md:py-4 px-3 md:px-6 font-medium text-foreground text-sm min-w-[140px]">Type/Zone</th>
              <th className="text-left py-3 md:py-4 px-3 md:px-6 font-medium text-foreground text-sm min-w-[160px]">Schedule</th>
              <th className="text-left py-3 md:py-4 px-3 md:px-6 font-medium text-foreground text-sm min-w-[100px]">Status</th>
              <th className="text-left py-3 md:py-4 px-3 md:px-6 font-medium text-foreground text-sm min-w-[120px]">Payment</th>
              <th className="text-left py-3 md:py-4 px-3 md:px-6 font-medium text-foreground text-sm min-w-[200px]">Actions</th>
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
                  <span className="font-medium text-blue-600">Order ID: {order.order_number}</span>
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
                     <div>
                       <span className="text-gray-600 capitalize">{order.order_type}</span>
                       {order.order_type === 'delivery' && (order as any).delivery_zones && (
                         <p className="text-xs text-gray-500">
                           {(order as any).delivery_zones.name}
                         </p>
                       )}
                       {getDeliveryInstructionsFromAddress((order as any).delivery_address) && (
                         <p className="text-xs text-blue-600 mt-1" title={getDeliveryInstructionsFromAddress((order as any).delivery_address) || ''}>
                           📝 {formatDeliveryInstructionsForDisplay(getDeliveryInstructionsFromAddress((order as any).delivery_address))}
                         </p>
                       )}
                     </div>
                  </div>
                 </td>
                 <td className="py-4 px-6">
                   {renderDeliverySchedule(order.id, order.status)}
                 </td>
                 <td className="py-4 px-6">
                   <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(order.status).className}`}>
                     {getStatusBadge(order.status).label}
                   </span>
                 </td>
                <td className="py-4 px-6">
                  <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${
                    order.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 
                    order.payment_status === 'failed' ? 'bg-red-100 text-red-800' : 
                    'bg-yellow-100 text-yellow-800'
                  }`}>
                    {order.payment_status === 'paid' ? 'Paid' : 
                     order.payment_status === 'failed' ? 'Failed' : 
                     'Pending'}
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
    </ResponsiveTable>
  );
};

export default OrdersTable;
