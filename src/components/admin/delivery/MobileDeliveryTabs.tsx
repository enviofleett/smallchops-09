import React from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Package } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';
import {
  MobileCard,
  MobileCardHeader,
  MobileCardContent,
  MobileCardRow,
  MobileCardActions,
} from '@/components/ui/responsive-table';

interface DeliveryOrder {
  id: string;
  order_number: string;
  customer_name: string;
  customer_email: string;
  customer_phone: string;
  total_amount: number;
  status: string;
  order_type: 'delivery' | 'pickup';
  delivery_address?: any;
  delivery_schedule?: {
    delivery_date: string;
    delivery_time_start: string;
    delivery_time_end: string;
  };
  created_at: string;
}

interface MobileDeliveryTabsProps {
  orders: DeliveryOrder[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOrderSelect?: (order: DeliveryOrder) => void;
}

export const MobileDeliveryTabs = ({
  orders,
  activeTab,
  onTabChange,
  onOrderSelect,
}: MobileDeliveryTabsProps) => {
  const isMobile = useIsMobile();

  // Responsive status color utility
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ready':
        return 'bg-green-100 text-green-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'confirmed':
        return 'bg-yellow-100 text-yellow-800';
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800';
      case 'delivered':
        return 'bg-emerald-100 text-emerald-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  // Orders grouped by status
  const ordersByStatus = {
    all: orders,
    ready: orders.filter((o) => o.status === 'ready'),
    preparing: orders.filter((o) => o.status === 'preparing'),
    confirmed: orders.filter((o) => o.status === 'confirmed'),
    out_for_delivery: orders.filter((o) => o.status === 'out_for_delivery'),
    delivered: orders.filter((o) => o.status === 'delivered'),
  };

  // Responsive order card for mobile/tablet
  const renderOrderCard = (order: DeliveryOrder) => (
    <MobileCard key={order.id} onClick={() => onOrderSelect?.(order)}>
      <MobileCardHeader>
        <div className="flex items-center justify-between w-full">
          <div>
            <h3 className="font-semibold text-sm">#{order.order_number}</h3>
            <p className="text-xs text-muted-foreground">
              {new Date(order.created_at).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Badge className={getStatusColor(order.status)} variant="secondary">
              {order.status.replace('_', ' ')}
            </Badge>
            <Badge variant={order.order_type === 'delivery' ? 'default' : 'outline'}>
              {order.order_type}
            </Badge>
          </div>
        </div>
      </MobileCardHeader>

      <MobileCardContent>
        <MobileCardRow
          label="Customer"
          value={
            <div className="text-right">
              <p className="font-medium text-sm">{order.customer_name}</p>
              <p className="text-xs text-muted-foreground">{order.customer_phone}</p>
            </div>
          }
        />
        <MobileCardRow
          label="Amount"
          value={<span className="font-bold">₦{order.total_amount.toLocaleString()}</span>}
        />
        {order.delivery_schedule && (
          <MobileCardRow
            label="Time"
            value={`${order.delivery_schedule.delivery_time_start} - ${order.delivery_schedule.delivery_time_end}`}
          />
        )}
        {order.order_type === 'delivery' && order.delivery_address && (
          <MobileCardRow
            label="Address"
            value={
              <span className="text-xs">
                {typeof order.delivery_address === 'object' && !Array.isArray(order.delivery_address)
                  ? `${order.delivery_address.address_line_1 || ''}, ${order.delivery_address.city || ''}`.trim()
                  : typeof order.delivery_address === 'string'
                  ? order.delivery_address
                  : 'Address available'}
              </span>
            }
          />
        )}
      </MobileCardContent>

      <MobileCardActions>
        <Button size="sm" variant="outline">
          View Details
        </Button>
        {order.status === 'ready' && (
          <Button size="sm">
            Assign Driver
          </Button>
        )}
      </MobileCardActions>
    </MobileCard>
  );

  // Responsive list for mobile/tablet
  const renderOrderList = (orderList: DeliveryOrder[]) => {
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

  // Only render for mobile/tablet
  if (!isMobile) {
    return null;
  }

  return (
    <div className="w-full max-w-screen-lg mx-auto px-1 sm:px-3">
      <Tabs value={activeTab} onValueChange={onTabChange}>
        {/* Tabs: horizontal scroll, mobile/tablet friendly */}
        <div className="overflow-x-auto pb-2 scrollbar-hide">
          <TabsList className="flex w-max min-w-full gap-1 p-1 bg-muted rounded-lg">
            <TabsTrigger value="all" className="text-xs whitespace-nowrap px-3 py-2">
              All ({ordersByStatus.all.length})
            </TabsTrigger>
            <TabsTrigger value="ready" className="text-xs whitespace-nowrap px-3 py-2">
              Ready ({ordersByStatus.ready.length})
            </TabsTrigger>
            <TabsTrigger value="preparing" className="text-xs whitespace-nowrap px-3 py-2">
              Preparing ({ordersByStatus.preparing.length})
            </TabsTrigger>
            <TabsTrigger value="confirmed" className="text-xs whitespace-nowrap px-3 py-2">
              Confirmed ({ordersByStatus.confirmed.length})
            </TabsTrigger>
            <TabsTrigger value="out_for_delivery" className="text-xs whitespace-nowrap px-3 py-2">
              Out ({ordersByStatus.out_for_delivery.length})
            </TabsTrigger>
            <TabsTrigger value="delivered" className="text-xs whitespace-nowrap px-3 py-2">
              Delivered ({ordersByStatus.delivered.length})
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Tab content: mobile/tablet optimized */}
        <TabsContent value="all" className="mt-4">
          {renderOrderList(ordersByStatus.all)}
        </TabsContent>
        <TabsContent value="ready" className="mt-4">
          {renderOrderList(ordersByStatus.ready)}
        </TabsContent>
        <TabsContent value="preparing" className="mt-4">
          {renderOrderList(ordersByStatus.preparing)}
        </TabsContent>
        <TabsContent value="confirmed" className="mt-4">
          {renderOrderList(ordersByStatus.confirmed)}
        </TabsContent>
        <TabsContent value="out_for_delivery" className="mt-4">
          {renderOrderList(ordersByStatus.out_for_delivery)}
        </TabsContent>
        <TabsContent value="delivered" className="mt-4">
          {renderOrderList(ordersByStatus.delivered)}
        </TabsContent>
      </Tabs>
    </div>
  );
};
