import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package, MapPin, User, Clock, AlertTriangle } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import { ResponsiveTable, MobileCard, MobileCardHeader, MobileCardContent, MobileCardRow, MobileCardActions } from '@/components/ui/responsive-table';
import { OrderWithItems } from '@/api/orders';
import { format } from 'date-fns';
import { MiniCountdownTimer } from '@/components/orders/MiniCountdownTimer';
import { isOrderOverdue } from '@/utils/scheduleTime';

interface MobileOrderTabsProps {
  orders: OrderWithItems[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOrderSelect?: (order: OrderWithItems) => void;
  deliverySchedules: Record<string, any>;
  orderCounts: {
    all: number;
    confirmed: number;
    preparing: number;
    ready: number;
    out_for_delivery: number;
    delivered: number;
    overdue: number;
  };
}

export const MobileOrderTabs = ({ 
  orders, 
  activeTab, 
  onTabChange, 
  onOrderSelect,
  deliverySchedules,
  orderCounts
}: MobileOrderTabsProps) => {
  const isMobile = useIsMobile();

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-100 text-green-800';
      case 'out_for_delivery': return 'bg-blue-100 text-blue-800';
      case 'preparing': return 'bg-orange-100 text-orange-800';
      case 'ready': return 'bg-purple-100 text-purple-800';
      case 'confirmed': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getOrdersByStatus = (status: string) => {
    if (status === 'all') return orders;
    if (status === 'overdue') {
      return orders.filter(order => {
        const schedule = deliverySchedules[order.id];
        if (!schedule || !schedule.delivery_date || !schedule.delivery_time_end) return false;
        
        try {
          // Only show paid orders that are overdue and haven't been delivered
          return order.payment_status === 'paid' && 
                 isOrderOverdue(schedule.delivery_date, schedule.delivery_time_end) && 
                 ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status);
        } catch (error) {
          console.warn('Error checking overdue status in mobile tabs:', order.id, error);
          return false;
        }
      });
    }
    return orders.filter(o => o.status === status);
  };

  const renderOrderCard = (order: OrderWithItems) => {
    const schedule = deliverySchedules[order.id];
    const isOverdue = schedule && isOrderOverdue(schedule.delivery_date, schedule.delivery_time_end);
    
    return (
      <MobileCard key={order.id} onClick={() => onOrderSelect?.(order)}>
        <MobileCardHeader>
          <div className="flex items-center justify-between w-full">
            <div>
              <h3 className="font-semibold text-sm">#{order.order_number}</h3>
              <p className="text-xs text-muted-foreground">
                {format(new Date(order.created_at), 'MMM dd, HH:mm')}
              </p>
            </div>
            <div className="flex flex-col gap-1 items-end">
              <Badge className={getStatusColor(order.status)} variant="secondary">
                {order.status.replace('_', ' ')}
              </Badge>
              <Badge variant={order.order_type === 'delivery' ? 'default' : 'outline'}>
                {order.order_type}
              </Badge>
              {isOverdue && (
                <Badge variant="destructive" className="text-xs">
                  <AlertTriangle className="w-3 h-3 mr-1" />
                  Overdue
                </Badge>
              )}
            </div>
          </div>
        </MobileCardHeader>
        
        <MobileCardContent>
          <MobileCardRow 
            label="Customer" 
            value={
              <div className="text-right">
                <p className="font-medium text-sm">{order.customer_name}</p>
                <p className="text-xs text-muted-foreground">{order.customer_email}</p>
              </div>
            } 
          />
          <MobileCardRow 
            label="Amount" 
            value={<span className="font-bold">₦{order.total_amount.toLocaleString()}</span>} 
          />
          <MobileCardRow 
            label="Payment" 
            value={
              <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
                {order.payment_status}
              </Badge>
            } 
          />
          {schedule && (
            <>
              <MobileCardRow 
                label="Delivery Date" 
                value={format(new Date(schedule.delivery_date), 'MMM dd, yyyy')} 
              />
              <MobileCardRow 
                label="Time Window" 
                value={`${schedule.delivery_time_start} - ${schedule.delivery_time_end}`} 
              />
              {schedule.delivery_time_end && schedule.delivery_time_start && (
                <MobileCardRow 
                  label="Countdown" 
                  value={
                    <MiniCountdownTimer 
                      deliveryDate={schedule.delivery_date}
                      deliveryTimeStart={schedule.delivery_time_start}
                      deliveryTimeEnd={schedule.delivery_time_end}
                      orderStatus={order.status}
                    />
                  } 
                />
              )}
            </>
          )}
          {order.order_type === 'delivery' && order.delivery_address && (
            <MobileCardRow 
              label="Address" 
              value={
                <span className="text-xs">
                  {typeof order.delivery_address === 'object' && !Array.isArray(order.delivery_address)
                    ? `${(order.delivery_address as any).address_line_1 || ''}, ${(order.delivery_address as any).city || ''}`.trim()
                    : typeof order.delivery_address === 'string' 
                      ? order.delivery_address
                      : 'Address available'
                  }
                </span>
              } 
            />
          )}
        </MobileCardContent>

        <MobileCardActions>
          <Button size="sm" variant="outline">
            View Details
          </Button>
          {order.status === 'confirmed' && (
            <Button size="sm">
              Start Preparing
            </Button>
          )}
          {order.status === 'preparing' && (
            <Button size="sm">
              Mark Ready
            </Button>
          )}
          {order.status === 'ready' && (
            <Button size="sm">
              Out for Delivery
            </Button>
          )}
        </MobileCardActions>
      </MobileCard>
    );
  };

  const renderOrderList = (orderList: OrderWithItems[]) => {
    if (orderList.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Package className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Orders Found</h3>
            <p className="text-muted-foreground">
              No orders match the current filter criteria.
            </p>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-3">
        {orderList.map(renderOrderCard)}
      </div>
    );
  };

  if (!isMobile) {
    return null; // Use regular table on desktop
  }

  return (
    <div className="space-y-3">
      {orders.map(renderOrderCard)}
    </div>
  );
};