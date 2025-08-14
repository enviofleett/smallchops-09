import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { useToast } from '@/hooks/use-toast';
import { 
  Package, 
  Clock, 
  Truck, 
  CheckCircle,
  AlertCircle,
  DollarSign,
  TrendingUp,
  Download,
  RefreshCw
} from 'lucide-react';
import { useDeliveryScheduleDashboard } from '@/hooks/useDeliveryScheduleDashboard';
import { DeliveryCard } from './DeliveryCard';
import { FilterBar } from './FilterBar';
import { PriceDisplay } from '@/components/ui/price-display';

export function DeliveryScheduleDashboard() {
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    dateRange: 'today' as const,
    customStartDate: undefined as string | undefined,
    customEndDate: undefined as string | undefined,
    status: [] as string[],
    timeSlot: undefined as 'morning' | 'afternoon' | 'evening' | undefined,
  });

  const { orders, metrics, isLoading, error, refetch } = useDeliveryScheduleDashboard(filters);

  const handleStatusUpdate = async (orderId: string, newStatus: string) => {
    try {
      // This would typically call an API to update the order status
      // For now, we'll just show a toast and refetch
      toast({
        title: "Status Updated",
        description: `Order status updated to ${newStatus.replace('_', ' ')}`,
      });
      refetch();
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to update order status",
        variant: "destructive",
      });
    }
  };

  const handleExport = () => {
    // Export functionality - would generate CSV/PDF of current filtered orders
    toast({
      title: "Export Started",
      description: "Your delivery schedule export is being prepared",
    });
  };

  if (error) {
    return (
      <Card className="p-6">
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
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold">Delivery Schedule</h1>
          <p className="text-muted-foreground">
            Manage and track delivery orders with scheduled delivery times
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            onClick={() => refetch()}
            disabled={isLoading}
            size="sm"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button 
            onClick={handleExport}
            size="sm"
          >
            <Download className="w-4 h-4 mr-2" />
            Export
          </Button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Total</p>
                <p className="text-lg font-bold">
                  {isLoading ? <Skeleton className="h-6 w-8" /> : metrics.totalOrders}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Pending</p>
                <p className="text-lg font-bold">
                  {isLoading ? <Skeleton className="h-6 w-8" /> : metrics.pendingOrders}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-yellow-100 text-yellow-600 rounded-lg">
                <Package className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Preparing</p>
                <p className="text-lg font-bold">
                  {isLoading ? <Skeleton className="h-6 w-8" /> : metrics.preparingOrders}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                <Truck className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Out</p>
                <p className="text-lg font-bold">
                  {isLoading ? <Skeleton className="h-6 w-8" /> : metrics.outForDelivery}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                <CheckCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Completed</p>
                <p className="text-lg font-bold">
                  {isLoading ? <Skeleton className="h-6 w-8" /> : metrics.completedOrders}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-red-100 text-red-600 rounded-lg">
                <AlertCircle className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Urgent</p>
                <p className="text-lg font-bold">
                  {isLoading ? <Skeleton className="h-6 w-8" /> : metrics.urgentOrders}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                <DollarSign className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Revenue</p>
                <div className="text-sm font-bold">
                  {isLoading ? (
                    <Skeleton className="h-5 w-12" />
                  ) : (
                    <PriceDisplay 
                      originalPrice={metrics.totalRevenue} 
                      size="sm"
                      className="text-green-600"
                    />
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <FilterBar 
        filters={filters}
        onFiltersChange={setFilters}
        totalCount={metrics.totalOrders}
      />

      {/* Orders List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <Card key={i}>
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
              </Card>
            ))}
          </div>
        ) : orders.length === 0 ? (
          <Card className="p-8">
            <div className="text-center space-y-4">
              <Package className="w-12 h-12 text-muted-foreground mx-auto" />
              <div>
                <h3 className="font-semibold text-lg">No Delivery Orders Found</h3>
                <p className="text-muted-foreground">
                  No delivery orders match your current filters. Try adjusting your search criteria.
                </p>
              </div>
              <Button 
                variant="outline" 
                onClick={() => setFilters({
                  dateRange: 'today',
                  status: [],
                  timeSlot: undefined,
                  customStartDate: undefined,
                  customEndDate: undefined
                })}
              >
                Clear Filters
              </Button>
            </div>
          </Card>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <DeliveryCard 
                key={order.id} 
                order={order} 
                onStatusUpdate={handleStatusUpdate}
              />
            ))}
          </div>
        )}
      </div>

      {/* Load More Button for large datasets */}
      {orders.length >= 50 && (
        <div className="text-center pt-4">
          <Button variant="outline">
            Load More Orders
          </Button>
        </div>
      )}
    </div>
  );
}