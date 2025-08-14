import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { DeliveryErrorBoundary } from './DeliveryErrorBoundary';
import { useDeliveryMonitoring } from '@/hooks/useDeliveryMonitoring';
import { Package, Clock, Truck, CheckCircle, AlertCircle, DollarSign, TrendingUp, Download, RefreshCw } from 'lucide-react';
import { useDeliveryScheduleDashboard } from '@/hooks/useDeliveryScheduleDashboard';
import { useDeliveryRealtime } from '@/hooks/useDeliveryRealtime';
import { DeliveryCard } from './DeliveryCard';
import { FilterBar } from './FilterBar';
import { DeliveryMetricsWidget } from './DeliveryMetricsWidget';
import { PriceDisplay } from '@/components/ui/price-display';
export function DeliveryScheduleDashboard() {
  const {
    toast
  } = useToast();
  const [filters, setFilters] = useState({
    dateRange: 'today' as const,
    customStartDate: undefined as string | undefined,
    customEndDate: undefined as string | undefined,
    status: [] as string[],
    timeSlot: undefined as 'morning' | 'afternoon' | 'evening' | undefined
  });
  const {
    orders,
    metrics,
    isLoading,
    error,
    refetch
  } = useDeliveryScheduleDashboard(filters);
  const [localOrders, setLocalOrders] = useState(orders);

  // Update local orders when data changes
  React.useEffect(() => {
    setLocalOrders(orders);
  }, [orders]);

  // Delivery monitoring for alerts and performance
  useDeliveryMonitoring();

  // Enhanced real-time updates
  const {
    connectionStatus,
    lastUpdate
  } = useDeliveryRealtime(localOrders, updatedOrder => {
    setLocalOrders(prev => prev.map(order => order.id === updatedOrder.id ? updatedOrder : order));
  });
  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      const {
        updateOrderStatus
      } = await import('@/api/orderStatusApi');
      await updateOrderStatus(orderId, {
        status: newStatus as any,
        notes: `Status updated via delivery dashboard at ${new Date().toLocaleString()}`
      });
      toast({
        title: "Status Updated",
        description: `Order status updated to ${newStatus.replace('_', ' ')}`
      });

      // Refetch to get updated data
      refetch();
    } catch (error) {
      console.error('Failed to update order status:', error);
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to update order status",
        variant: "destructive"
      });
    }
  };
  const handleExport = () => {
    // Export functionality - would generate CSV/PDF of current filtered orders
    toast({
      title: "Export Started",
      description: "Your delivery schedule export is being prepared"
    });
  };
  if (error) {
    return <Card className="p-6">
        <div className="text-center space-y-4">
          <AlertCircle className="w-12 h-12 text-destructive mx-auto" />
          <div>
            <h3 className="font-semibold text-lg">Error Loading Delivery Schedule</h3>
            <p className="text-muted-foreground">
              Failed to load delivery schedule data. Please try again.
            </p>
          </div>
          <Button onClick={() => refetch()}>
            <RefreshCw className="w-4 h-4 mr-2" />
            Retry
          </Button>
        </div>
      </Card>;
  }
  return <DeliveryErrorBoundary>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            
            
          </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => refetch()} disabled={isLoading} size="sm">
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleExport} size="sm">
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Real-time Status Indicator */}
      {connectionStatus && <div className="flex items-center justify-between mb-4 p-2 bg-muted/50 rounded-lg">
          <div className="flex items-center gap-2 text-sm">
            <div className={`w-2 h-2 rounded-full ${connectionStatus === 'connected' ? 'bg-green-500' : connectionStatus === 'connecting' ? 'bg-yellow-500' : 'bg-red-500'}`} />
            <span>Real-time updates: {connectionStatus}</span>
          </div>
          {lastUpdate && <span className="text-xs text-muted-foreground">
              Last update: {lastUpdate.toLocaleTimeString()}
            </span>}
        </div>}

      {/* Metrics Cards */}
      <DeliveryMetricsWidget metrics={metrics} isLoading={isLoading} />

      {/* Filters */}
      <FilterBar filters={filters} onFiltersChange={setFilters} totalCount={metrics.totalOrders} />

      {/* Orders List */}
      <div className="space-y-4">
        {isLoading ? <div className="space-y-4">
            {[...Array(5)].map((_, i) => <Card key={i}>
                <CardContent className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Skeleton className="h-5 w-32" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                    <Skeleton className="h-4 w-64" />
                    <div className="flex justify-between">
                      <Skeleton className="h-4 w-20" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                  </div>
                </CardContent>
              </Card>)}
          </div> : orders.length === 0 ? <Card className="p-8">
            <div className="text-center space-y-4">
              <Package className="w-12 h-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-semibold text-lg">No Delivery Orders Found</h3>
                <p className="text-muted-foreground">
                  No delivery orders match your current filters. Try adjusting your search criteria.
                </p>
              </div>
              <Button variant="outline" onClick={() => setFilters({
              dateRange: 'today',
              status: [],
              timeSlot: undefined,
              customStartDate: undefined,
              customEndDate: undefined
            })}>
                Clear Filters
              </Button>
            </div>
          </Card> : <div className="space-y-3">
            {localOrders.map(order => <DeliveryCard key={order.id} order={order} onStatusUpdate={handleStatusUpdate} />)}
          </div>}
      </div>

      {/* Load More Button for large datasets */}
      {localOrders.length >= 50 && <div className="text-center pt-4">
          <Button variant="outline">
            Load More Orders
          </Button>
        </div>}
    </div>
    </DeliveryErrorBoundary>;
}