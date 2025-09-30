import React from 'react';
import { useCustomerOrders } from '@/hooks/useCustomerOrders';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';
import { useCustomerOrderSchedules } from '@/hooks/useCustomerOrderSchedules';
import { usePickupPoint } from '@/hooks/usePickupPoints';
import { useErrorHandler } from '@/hooks/useErrorHandler';
import { EnhancedOrderCard } from '@/components/orders/EnhancedOrderCard';
import { NewOrderDetailsModal } from '@/components/orders/NewOrderDetailsModal';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ShoppingBag, AlertTriangle, Filter, X, Calendar, RefreshCw } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

// Loading skeleton component
const ContentSkeleton = () => (
  <div className="space-y-4">
    {[1, 2, 3].map(i => (
      <Card key={i} className="p-6">
        <div className="space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-4 w-2/3" />
          <Skeleton className="h-4 w-1/2" />
        </div>
      </Card>
    ))}
  </div>
);

export function EnhancedOrdersSection() {
  const { isAuthenticated, customerAccount, user } = useCustomerAuth();
  const { data: ordersData, isLoading: ordersLoading, error: ordersError, refetch } = useCustomerOrders();
  const { handleError } = useErrorHandler();
  const [selectedOrder, setSelectedOrder] = React.useState<any>(null);
  const [isModalOpen, setIsModalOpen] = React.useState(false);
  const [isInitialLoad, setIsInitialLoad] = React.useState(true);
  const [showAllOrders, setShowAllOrders] = React.useState(false);
  const [isRefreshing, setIsRefreshing] = React.useState(false);
  
  // Filter states
  const [showFilters, setShowFilters] = React.useState(false);
  const [statusFilter, setStatusFilter] = React.useState<string>('all');
  const [startDate, setStartDate] = React.useState<string>('');
  const [endDate, setEndDate] = React.useState<string>('');
  
  // Log auth state on mount
  React.useEffect(() => {
    console.log('🔍 EnhancedOrdersSection mounted with auth state:', {
      isAuthenticated,
      hasUser: !!user,
      hasCustomerAccount: !!customerAccount,
      userEmail: user?.email,
      customerEmail: customerAccount?.email,
      customerAccountId: customerAccount?.id
    });
  }, [isAuthenticated, user, customerAccount]);
  
  // Handle initial load state
  React.useEffect(() => {
    if (!ordersLoading && isInitialLoad) {
      setIsInitialLoad(false);
    }
  }, [ordersLoading, isInitialLoad]);
  
  // Filter and process orders
  const filteredOrders = React.useMemo(() => {
    if (!ordersData?.orders || !Array.isArray(ordersData.orders)) {
      console.log('⚠️ No valid orders data found');
      return [];
    }
    
    let filtered = ordersData.orders.filter(order => order && order.id);
    
    // Apply status filter
    if (statusFilter !== 'all') {
      filtered = filtered.filter(order => {
        if (statusFilter === 'in_progress') {
          return ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status);
        }
        return order.status === statusFilter;
      });
    }
    
    // Apply date filters
    if (startDate) {
      const start = new Date(startDate);
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.order_time || order.created_at);
        return orderDate >= start;
      });
    }
    
    if (endDate) {
      const end = new Date(endDate + 'T23:59:59');
      filtered = filtered.filter(order => {
        const orderDate = new Date(order.order_time || order.created_at);
        return orderDate <= end;
      });
    }
    
    return filtered;
  }, [ordersData, statusFilter, startDate, endDate]);
  
  const orders = filteredOrders;
  const orderIds = React.useMemo(() => orders.map(order => order.id), [orders]);
  const { schedules } = useCustomerOrderSchedules(orderIds);
  
  // Manual refresh function
  const handleManualRefresh = async () => {
    setIsRefreshing(true);
    try {
      await refetch();
    } finally {
      setTimeout(() => setIsRefreshing(false), 500);
    }
  };
  
  // Clear filters function
  const clearFilters = () => {
    setStatusFilter('all');
    setStartDate('');
    setEndDate('');
  };
  
  // Check if any filters are active
  const hasActiveFilters = statusFilter !== 'all' || startDate || endDate;
  
  // Get pickup point for selected order if it's a pickup order
  const { data: pickupPoint } = usePickupPoint(
    selectedOrder?.order_type === 'pickup' ? selectedOrder?.pickup_point_id : undefined
  );

  // Handle query errors
  if (ordersError) {
    console.error('Orders query error:', ordersError);
    handleError(ordersError, 'loading orders');
    return (
      <Card className="p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <h3 className="text-lg font-semibold mb-2">Unable to load orders</h3>
        <p className="text-gray-500 mb-4">There was a problem loading your orders. Please try again.</p>
        <Button onClick={() => window.location.reload()}>
          Refresh Page
        </Button>
      </Card>
    );
  }

  if (ordersLoading || isInitialLoad) {
    return <ContentSkeleton />;
  }

  // No orders found with filters applied
  if (orders.length === 0 && hasActiveFilters) {
    return (
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold mb-2">My Orders</h2>
            <p className="text-gray-500">Track and manage your orders</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 self-start sm:self-center"
          >
            <Filter className="w-4 h-4" />
            Filter
            <Badge variant="destructive" className="w-2 h-2 p-0 rounded-full" />
          </Button>
        </div>

        {showFilters && (
          <Card className="p-4 border-2 border-dashed border-orange-200 bg-orange-50/50">
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-orange-800">Filter Orders</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowFilters(false)}
                  className="h-6 w-6 p-0 text-orange-600 hover:text-orange-800"
                >
                  <X className="w-4 h-4" />
                </Button>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-orange-700">Status</Label>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="h-8 bg-white border-orange-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="bg-white border border-orange-200 shadow-lg z-50">
                      <SelectItem value="all">All Orders</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="confirmed">Confirmed</SelectItem>
                      <SelectItem value="preparing">Preparing</SelectItem>
                      <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                      <SelectItem value="delivered">Delivered</SelectItem>
                      <SelectItem value="cancelled">Cancelled</SelectItem>
                      <SelectItem value="in_progress">In Progress</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-orange-700">From Date</Label>
                  <Input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 bg-white border-orange-200"
                  />
                </div>
                
                <div className="space-y-2">
                  <Label className="text-xs font-medium text-orange-700">To Date</Label>
                  <Input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 bg-white border-orange-200"
                  />
                </div>
              </div>
              
              <div className="flex justify-end pt-2 border-t border-orange-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-orange-600 hover:text-orange-800 hover:bg-orange-100"
                >
                  Clear Filters
                </Button>
              </div>
            </div>
          </Card>
        )}

        <Card className="p-8 text-center">
          <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No orders match your filters</h3>
          <p className="text-gray-500 mb-4">Try adjusting your filter criteria to see more orders</p>
          <Button onClick={clearFilters} variant="outline">
            Clear All Filters
          </Button>
        </Card>
      </div>
    );
  }

  // No orders at all
  if (orders.length === 0) {
    return (
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-2xl font-bold mb-2">My Orders</h2>
            <p className="text-gray-500">Track and manage your orders</p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
        
        <Card className="p-8 text-center">
          <ShoppingBag className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
          <p className="text-gray-500 mb-4">You haven't placed any orders yet</p>
          
          {/* Debug info in development */}
          {import.meta.env.DEV && (
            <div className="mt-4 p-4 bg-gray-50 rounded text-left text-xs space-y-1">
              <p className="font-semibold text-gray-700">Debug Info:</p>
              <p>Auth: {isAuthenticated ? '✅' : '❌'}</p>
              <p>User: {user?.email || 'None'}</p>
              <p>Customer: {customerAccount?.email || 'None'}</p>
              <p>Account ID: {customerAccount?.id || 'None'}</p>
              <p className="text-blue-600">Check browser console for detailed logs</p>
            </div>
          )}
          <Button onClick={() => window.location.href = '/products'}>
            Start Shopping
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold mb-2">My Orders</h2>
          <p className="text-gray-500">Track and manage your orders</p>
        </div>
        
        {/* Filter Toggle Button and Refresh */}
        <div className="flex items-center gap-2">
          {hasActiveFilters && (
            <Badge variant="secondary" className="px-2 py-1 text-xs">
              {filteredOrders.length} of {ordersData?.orders?.length || 0} orders
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2"
          >
            <Filter className="w-4 h-4" />
            Filter
            {hasActiveFilters && <Badge variant="destructive" className="w-2 h-2 p-0 rounded-full" />}
          </Button>
        </div>
      </div>

      {/* Collapsible Filter Section */}
      {showFilters && (
        <Card className="p-4 border-2 border-dashed border-orange-200 bg-orange-50/50">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-medium text-orange-800">Filter Orders</h3>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowFilters(false)}
                className="h-6 w-6 p-0 text-orange-600 hover:text-orange-800"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Status Filter */}
              <div className="space-y-2">
                <Label htmlFor="status-filter" className="text-xs font-medium text-orange-700">Status</Label>
                <Select value={statusFilter} onValueChange={setStatusFilter}>
                  <SelectTrigger className="h-8 bg-white border-orange-200 focus:border-orange-400">
                    <SelectValue placeholder="All statuses" />
                  </SelectTrigger>
                  <SelectContent className="bg-white border border-orange-200 shadow-lg z-50">
                    <SelectItem value="all">All Orders</SelectItem>
                    <SelectItem value="pending">Pending</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="preparing">Preparing</SelectItem>
                    <SelectItem value="out_for_delivery">Out for Delivery</SelectItem>
                    <SelectItem value="delivered">Delivered</SelectItem>
                    <SelectItem value="cancelled">Cancelled</SelectItem>
                    <SelectItem value="in_progress">In Progress</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Start Date Filter */}
              <div className="space-y-2">
                <Label htmlFor="start-date" className="text-xs font-medium text-orange-700">From Date</Label>
                <div className="relative">
                  <Input
                    id="start-date"
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="h-8 bg-white border-orange-200 focus:border-orange-400 pr-8"
                  />
                  <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-orange-400 pointer-events-none" />
                </div>
              </div>
              
              {/* End Date Filter */}
              <div className="space-y-2">
                <Label htmlFor="end-date" className="text-xs font-medium text-orange-700">To Date</Label>
                <div className="relative">
                  <Input
                    id="end-date"
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="h-8 bg-white border-orange-200 focus:border-orange-400 pr-8"
                  />
                  <Calendar className="absolute right-2 top-1/2 transform -translate-y-1/2 w-3 h-3 text-orange-400 pointer-events-none" />
                </div>
              </div>
            </div>
            
            {/* Filter Actions */}
            {hasActiveFilters && (
              <div className="flex justify-end pt-2 border-t border-orange-200">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearFilters}
                  className="text-orange-600 hover:text-orange-800 hover:bg-orange-100"
                >
                  Clear Filters
                </Button>
              </div>
            )}
          </div>
        </Card>
      )}
      
      {/* Order summary stats positioned immediately after title */}
      {(ordersData?.orders?.length || 0) > 0 && (
        <div className="p-4 bg-muted/50 rounded-lg">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-bold text-primary">
                {hasActiveFilters ? orders.length : (ordersData?.orders?.length || 0)}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">
                {hasActiveFilters ? 'Filtered' : 'Total'} Orders
              </p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-bold text-primary">
                ₦{orders.reduce((sum, order) => sum + (order.total_amount || 0), 0).toLocaleString()}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">Total Spent</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-bold text-green-600">
                {orders.filter(order => order.status === 'delivered').length}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">Delivered</p>
            </div>
            <div className="space-y-1">
              <p className="text-2xl sm:text-3xl font-bold text-orange-600">
                {orders.filter(order => ['pending', 'confirmed', 'preparing', 'out_for_delivery'].includes(order.status)).length}
              </p>
              <p className="text-xs sm:text-sm text-muted-foreground">In Progress</p>
            </div>
          </div>
        </div>
      )}
      
      {/* Mobile-first responsive orders list */}
      <div className="space-y-4">
        {orders.slice(0, showAllOrders ? orders.length : 10).map((order) => {
          try {
            return (
              <div 
                key={order?.id || Math.random()}
                onClick={() => {
                  setSelectedOrder(order);
                  setIsModalOpen(true);
                }}
                className="cursor-pointer transition-transform hover:scale-[1.02] active:scale-[0.98]"
              >
                <EnhancedOrderCard
                  order={order}
                  deliverySchedule={schedules[order.id]}
                  showExpandedByDefault={false}
                />
              </div>
            );
          } catch (error) {
            console.error('Error rendering order card:', error);
            return (
              <Card key={order?.id || Math.random()} className="p-4 sm:p-6 border border-red-200">
                <p className="text-red-600 text-sm">Error loading order details</p>
              </Card>
            );
          }
        })}
        
        {orders.length > 10 && !showAllOrders && (
          <div className="text-center pt-4">
            <Button 
              variant="outline" 
              onClick={() => setShowAllOrders(true)}
              className="w-full sm:w-auto"
            >
              View All Orders ({orders.length})
            </Button>
          </div>
        )}
        
        {showAllOrders && orders.length > 10 && (
          <div className="text-center pt-4">
            <Button 
              variant="ghost" 
              onClick={() => setShowAllOrders(false)}
              className="w-full sm:w-auto"
            >
              Show Less
            </Button>
          </div>
        )}
      </div>

      <NewOrderDetailsModal
        order={selectedOrder}
        open={isModalOpen && selectedOrder !== null}
        onClose={() => {
          setIsModalOpen(false);
          setSelectedOrder(null);
        }}
      />
    </div>
  );
}