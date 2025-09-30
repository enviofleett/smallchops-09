import React, { useState, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { OrderFilters } from './OrderFilters';
import { NewOrderDetailsModal } from '@/components/orders/NewOrderDetailsModal';
import { useOrdersQuery } from '@/hooks/useOrdersQuery';
import { useOrderFilters } from '@/hooks/useOrderFilters';
import { useIsMobile } from '@/hooks/use-mobile';
import { OrderStatus } from '@/types/orders';
import { OrderWithItems } from '@/api/orders';
import { ResponsiveTable, MobileCard, MobileCardHeader, MobileCardContent, MobileCardRow, MobileCardActions } from '@/components/ui/responsive-table';
import { format } from 'date-fns';
import { Eye, Clock, MapPin, User, Phone, Package, AlertTriangle, Truck } from 'lucide-react';
import { Loader2 } from 'lucide-react';

interface OrderFilters {
  status: OrderStatus | 'all';
  searchQuery: string;
  startDate?: string;
  endDate?: string;
}

const defaultFilters: OrderFilters = {
  status: 'all',
  searchQuery: '',
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'pending': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'confirmed': return 'bg-blue-100 text-blue-800 border-blue-200';
    case 'preparing': return 'bg-orange-100 text-orange-800 border-orange-200';
    case 'ready': return 'bg-green-100 text-green-800 border-green-200';
    case 'out_for_delivery': return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'delivered': return 'bg-emerald-100 text-emerald-800 border-emerald-200';
    case 'cancelled': return 'bg-red-100 text-red-800 border-red-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const OrderManagementDashboard = () => {
  const isMobile = useIsMobile();
  const [filters, setFilters] = useState<OrderFilters>(defaultFilters);
  const [activeTab, setActiveTab] = useState<string>('all');
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false);

  const {
    data: ordersData,
    isLoading,
    error,
    refetch
  } = useOrdersQuery({ 
    filters: {
      status: 'all', // Always fetch all orders for tab filtering
      searchQuery: filters.searchQuery,
      startDate: filters.startDate,
      endDate: filters.endDate,
    }
  });

  const orders = ordersData?.orders || [];

  // Use the order filters hook for consistent filtering logic
  const { filteredOrders, metrics } = useOrderFilters({
    orders,
    status: activeTab,
    searchQuery: filters.searchQuery,
    selectedDate: filters.startDate ? new Date(filters.startDate) : undefined,
  });

  // Calculate tab counts
  const tabCounts = useMemo(() => {
    const counts = {
      all: orders.length,
      pending: 0,
      confirmed: 0,
      preparing: 0,
      ready: 0,
      out_for_delivery: 0,
      delivered: 0,
      cancelled: 0,
      overdue: 0,
    };

    orders.forEach(order => {
      if (order.status in counts) {
        counts[order.status as keyof typeof counts]++;
      }
      // Add overdue logic here if needed
    });

    return counts;
  }, [orders]);

  const handleOrderSelect = (order: OrderWithItems) => {
    setSelectedOrder(order);
    setIsDetailsModalOpen(true);
  };

  const handleFiltersChange = (newFilters: Partial<OrderFilters>) => {
    setFilters(prev => ({ ...prev, ...newFilters }));
  };

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  const renderMobileOrderCard = (order: OrderWithItems) => (
    <MobileCard key={order.id} onClick={() => handleOrderSelect(order)} className="border hover:shadow-md transition-shadow">
      <MobileCardHeader>
        <div className="flex items-center justify-between w-full">
          <div>
            <h3 className="font-semibold text-base">#{order.order_number}</h3>
            <p className="text-sm text-muted-foreground">
              {format(new Date(order.created_at), 'MMM dd, HH:mm')}
            </p>
          </div>
          <div className="flex flex-col gap-1 items-end">
            <Badge className={getStatusColor(order.status)} variant="secondary">
              {order.status.replace('_', ' ').toUpperCase()}
            </Badge>
            <Badge variant={order.order_type === 'delivery' ? 'default' : 'outline'} className="text-xs">
              {order.order_type === 'delivery' ? (
                <><Truck className="w-3 h-3 mr-1" />Delivery</>
              ) : (
                <><Package className="w-3 h-3 mr-1" />Pickup</>
              )}
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
              <p className="text-xs text-muted-foreground">{order.customer_email}</p>
            </div>
          } 
        />
        <MobileCardRow 
          label="Phone" 
          value={<span className="text-sm">{order.customer_phone || 'N/A'}</span>} 
        />
        <MobileCardRow 
          label="Amount" 
          value={<span className="font-bold text-lg">₦{order.total_amount.toLocaleString()}</span>} 
        />
        <MobileCardRow 
          label="Payment" 
          value={
            <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
              {order.payment_status}
            </Badge>
          } 
        />
      </MobileCardContent>

      <MobileCardActions>
        <Button size="sm" variant="outline" onClick={(e) => {
          e.stopPropagation();
          handleOrderSelect(order);
        }}>
          <Eye className="w-4 h-4 mr-1" />
          View Details
        </Button>
      </MobileCardActions>
    </MobileCard>
  );

  const renderDesktopOrderRow = (order: OrderWithItems) => (
    <div 
      key={order.id} 
      className="border border-border rounded-lg p-4 hover:bg-accent/50 transition-colors cursor-pointer"
      onClick={() => handleOrderSelect(order)}
    >
      <div className="flex justify-between items-start mb-3">
        <div>
          <h3 className="font-semibold text-lg flex items-center gap-2">
            #{order.order_number}
            {order.order_type === 'delivery' ? (
              <Truck className="w-4 h-4 text-muted-foreground" />
            ) : (
              <Package className="w-4 h-4 text-muted-foreground" />
            )}
          </h3>
          <p className="text-muted-foreground">{order.customer_name}</p>
        </div>
        <Badge className={getStatusColor(order.status)}>
          {order.status.replace('_', ' ').toUpperCase()}
        </Badge>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
        <div className="flex items-center gap-2">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm truncate">{order.customer_email}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Phone className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">{order.customer_phone || 'N/A'}</span>
        </div>
        
        <div className="flex items-center gap-2">
          <Clock className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm">
            {format(new Date(order.created_at), 'MMM dd, yyyy HH:mm')}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          <Badge variant={order.payment_status === 'paid' ? 'default' : 'secondary'}>
            {order.payment_status}
          </Badge>
        </div>
      </div>
      
      <div className="flex justify-between items-center">
        <span className="font-semibold text-lg">₦{order.total_amount.toLocaleString()}</span>
        <Button onClick={(e) => {
          e.stopPropagation();
          handleOrderSelect(order);
        }} size="sm">
          <Eye className="h-4 w-4 mr-2" />
          View Details
        </Button>
      </div>
    </div>
  );

  const renderOrdersList = () => {
    if (isLoading) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      );
    }

    if (error) {
      return (
        <div className="text-center py-12">
          <p className="text-destructive mb-4">Error loading orders: {error.message}</p>
          <Button onClick={() => refetch()} variant="outline">
            Try Again
          </Button>
        </div>
      );
    }

    if (filteredOrders.length === 0) {
      return (
        <div className="text-center py-12">
          <Package className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Orders Found</h3>
          <p className="text-muted-foreground">
            {activeTab === 'all' 
              ? 'No orders match your current filters.' 
              : `No ${activeTab.replace('_', ' ')} orders found.`
            }
          </p>
        </div>
      );
    }

    return (
      <div className="space-y-4">
        {filteredOrders.map(order => 
          isMobile ? renderMobileOrderCard(order) : renderDesktopOrderRow(order)
        )}
      </div>
    );
  };

  if (error && !orders.length) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="text-center text-destructive">
            Error loading orders: {error.message}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4 p-4 md:p-6">
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-xl md:text-2xl">Order Management</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Search and Filters */}
          <div className="space-y-4">
            <OrderFilters 
              filters={filters} 
              onChange={handleFiltersChange}
            />
          </div>

          {/* Responsive Tab System */}
          <Tabs value={activeTab} onValueChange={handleTabChange} className="w-full">
            {/* Tab Navigation */}
            <div className={`${isMobile ? 'overflow-x-auto pb-2' : ''}`}>
              <TabsList className={`${isMobile ? 'flex w-max min-w-full gap-1 p-1' : 'grid w-full grid-cols-8'} bg-muted rounded-lg`}>
                <TabsTrigger 
                  value="all" 
                  className={`${isMobile ? 'text-xs whitespace-nowrap px-3 py-2' : 'text-sm'} data-[state=active]:bg-background`}
                >
                  All ({tabCounts.all})
                </TabsTrigger>
                <TabsTrigger 
                  value="pending" 
                  className={`${isMobile ? 'text-xs whitespace-nowrap px-3 py-2' : 'text-sm'} data-[state=active]:bg-background`}
                >
                  {isMobile ? 'Pend' : 'Pending'} ({tabCounts.pending})
                </TabsTrigger>
                <TabsTrigger 
                  value="confirmed" 
                  className={`${isMobile ? 'text-xs whitespace-nowrap px-3 py-2' : 'text-sm'} data-[state=active]:bg-background`}
                >
                  {isMobile ? 'Conf' : 'Confirmed'} ({tabCounts.confirmed})
                </TabsTrigger>
                <TabsTrigger 
                  value="preparing" 
                  className={`${isMobile ? 'text-xs whitespace-nowrap px-3 py-2' : 'text-sm'} data-[state=active]:bg-background`}
                >
                  {isMobile ? 'Prep' : 'Preparing'} ({tabCounts.preparing})
                </TabsTrigger>
                <TabsTrigger 
                  value="ready" 
                  className={`${isMobile ? 'text-xs whitespace-nowrap px-3 py-2' : 'text-sm'} data-[state=active]:bg-background`}
                >
                  Ready ({tabCounts.ready})
                </TabsTrigger>
                <TabsTrigger 
                  value="out_for_delivery" 
                  className={`${isMobile ? 'text-xs whitespace-nowrap px-3 py-2' : 'text-sm'} data-[state=active]:bg-background`}
                >
                  {isMobile ? 'Out' : 'Out for Delivery'} ({tabCounts.out_for_delivery})
                </TabsTrigger>
                <TabsTrigger 
                  value="delivered" 
                  className={`${isMobile ? 'text-xs whitespace-nowrap px-3 py-2' : 'text-sm'} data-[state=active]:bg-background`}
                >
                  {isMobile ? 'Del' : 'Delivered'} ({tabCounts.delivered})
                </TabsTrigger>
                <TabsTrigger 
                  value="cancelled" 
                  className={`${isMobile ? 'text-xs whitespace-nowrap px-3 py-2' : 'text-sm'} data-[state=active]:bg-background text-destructive`}
                >
                  {isMobile ? 'Can' : 'Cancelled'} ({tabCounts.cancelled})
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Tab Content */}
            {['all', 'pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'cancelled'].map(status => (
              <TabsContent key={status} value={status} className="mt-6">
                {renderOrdersList()}
              </TabsContent>
            ))}
          </Tabs>
        </CardContent>
      </Card>

      {/* Order Details Modal */}
      <NewOrderDetailsModal
        order={selectedOrder}
        open={isDetailsModalOpen && selectedOrder !== null}
        onClose={() => {
          setIsDetailsModalOpen(false);
          setSelectedOrder(null);
          refetch();
        }}
      />
    </div>
  );
};