import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DeliveryOrderCard } from './DeliveryOrderCard';
import { DeliveryFilters } from './DeliveryFilters';
import { useQuery } from '@tanstack/react-query';
import { getOrders, OrderWithItems } from '@/api/orders';
import { 
  Truck, 
  Package, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  BarChart3,
  RefreshCw
} from 'lucide-react';
import { toast } from 'sonner';

export function EnhancedDeliveryDashboard() {
  const [filteredOrders, setFilteredOrders] = useState<OrderWithItems[]>([]);
  const [activeTab, setActiveTab] = useState('all');

  // Fetch all delivery orders
  const { 
    data: ordersData, 
    isLoading, 
    error, 
    refetch 
  } = useQuery({
    queryKey: ['delivery-orders'],
    queryFn: () => getOrders({
      page: 1,
      pageSize: 100, // Get more orders for delivery management
      searchQuery: undefined,
      status: undefined
    }),
    refetchInterval: 30000, // Refresh every 30 seconds
  });

  const allOrders = ordersData?.orders || [];
  
  // Filter only delivery orders
  const deliveryOrders = allOrders.filter(order => order.order_type === 'delivery');

  useEffect(() => {
    setFilteredOrders(deliveryOrders);
  }, [allOrders]);

  // Get order counts by status
  const getOrderCounts = () => {
    const counts = {
      all: deliveryOrders.length,
      confirmed: deliveryOrders.filter(o => o.status === 'confirmed').length,
      preparing: deliveryOrders.filter(o => o.status === 'preparing').length,
      ready: deliveryOrders.filter(o => o.status === 'ready').length,
      out_for_delivery: deliveryOrders.filter(o => o.status === 'out_for_delivery').length,
      delivered: deliveryOrders.filter(o => o.status === 'delivered').length,
    };

    // Calculate urgent orders (within 2 hours) - using delivery info if available
    const urgent = 0; // Placeholder - will be calculated by UrgentDeliveryFilter

    return { ...counts, urgent };
  };

  const orderCounts = getOrderCounts();

  const handleRefresh = () => {
    refetch();
    toast.success('Orders refreshed');
  };

  const handleExport = () => {
    // Implement export functionality
    toast.info('Export functionality coming soon');
  };

  const getTabOrders = (status: string) => {
    if (status === 'all') return filteredOrders;
    return filteredOrders.filter(order => order.status === status);
  };

  if (error) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center p-8">
          <div className="text-center">
            <AlertTriangle className="h-8 w-8 text-red-500 mx-auto mb-2" />
            <p className="text-red-600 font-medium">Error loading orders</p>
            <button 
              onClick={handleRefresh}
              className="mt-2 text-sm text-blue-600 hover:underline"
            >
              Try again
            </button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <BarChart3 className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">{orderCounts.all}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
                <Clock className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Confirmed</p>
                <p className="text-lg font-bold">{orderCounts.confirmed}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                <Package className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Preparing</p>
                <p className="text-lg font-bold">{orderCounts.preparing}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <CheckCircle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Ready</p>
                <p className="text-lg font-bold">{orderCounts.ready}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Truck className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Out</p>
                <p className="text-lg font-bold">{orderCounts.out_for_delivery}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <AlertTriangle className="h-4 w-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Urgent</p>
                <p className="text-lg font-bold">{orderCounts.urgent}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <DeliveryFilters
        orders={deliveryOrders}
        onFilterChange={setFilteredOrders}
        onRefresh={handleRefresh}
        onExport={handleExport}
      />

      {/* Orders Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="all" className="text-xs sm:text-sm">
            All ({orderCounts.all})
          </TabsTrigger>
          <TabsTrigger value="confirmed" className="text-xs sm:text-sm">
            Confirmed ({orderCounts.confirmed})
          </TabsTrigger>
          <TabsTrigger value="preparing" className="text-xs sm:text-sm">
            Preparing ({orderCounts.preparing})
          </TabsTrigger>
          <TabsTrigger value="ready" className="text-xs sm:text-sm">
            Ready ({orderCounts.ready})
          </TabsTrigger>
          <TabsTrigger value="out_for_delivery" className="text-xs sm:text-sm">
            Out ({orderCounts.out_for_delivery})
          </TabsTrigger>
          <TabsTrigger value="delivered" className="text-xs sm:text-sm">
            Done ({orderCounts.delivered})
          </TabsTrigger>
        </TabsList>

        {['all', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered'].map((status) => (
          <TabsContent key={status} value={status} className="space-y-4">
            {isLoading ? (
              <div className="space-y-4">
                {[...Array(3)].map((_, i) => (
                  <Card key={i} className="p-6">
                    <div className="animate-pulse space-y-3">
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                      <div className="h-4 bg-muted rounded w-1/2"></div>
                      <div className="h-4 bg-muted rounded w-1/3"></div>
                    </div>
                  </Card>
                ))}
              </div>
            ) : getTabOrders(status).length === 0 ? (
              <Card className="p-8">
                <div className="text-center">
                  <Package className="h-8 w-8 mx-auto text-muted-foreground mb-2" />
                  <p className="font-medium">No delivery orders found</p>
                  <p className="text-sm text-muted-foreground">
                    {status === 'all' 
                      ? 'No delivery orders match the current filters' 
                      : `No ${status.replace('_', ' ')} orders to display`
                    }
                  </p>
                </div>
              </Card>
            ) : (
              <div className="space-y-4">
                {getTabOrders(status).map((order) => (
                  <DeliveryOrderCard
                    key={order.id}
                    order={order}
                    onUpdate={refetch}
                  />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}