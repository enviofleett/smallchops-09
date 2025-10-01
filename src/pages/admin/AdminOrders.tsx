import React, { useMemo, useEffect } from 'react';
import '../../styles/thermal-print.css';
import { Helmet } from 'react-helmet-async';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useQuery } from '@tanstack/react-query';
import { getOrders } from '@/api/orders';
import { OrderStatus } from '@/types/orders';
import { NewOrderDetailsModal } from '@/components/orders/NewOrderDetailsModal';
import { EnhancedOrderCard } from '@/components/admin/EnhancedOrderCard';
import { ThermalReceiptPreview } from '@/components/orders/ThermalReceiptPreview';
import { MobileOrderTabs } from '@/components/admin/orders/MobileOrderTabs';
import { useIsMobile } from '@/hooks/use-mobile';
import { Search, Download, Package, TrendingUp, Clock, CheckCircle, Plus, BarChart3, RefreshCw, Calendar, Printer, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { HourlyDeliveryFilter } from '@/components/admin/orders/HourlyDeliveryFilter';
import { DeliveryDateFilter } from '@/components/admin/orders/DeliveryDateFilter';
import { OrderTabDropdown } from '@/components/admin/orders/OrderTabDropdown';
import { getFilterDescription, getFilterStats } from '@/utils/dateFilterUtils';
import { useThermalPrint } from '@/hooks/useThermalPrint';
import { OrderDetailsTestButton } from '@/components/admin/OrderDetailsTestButton';
import { useAdminOrdersState } from '@/hooks/useAdminOrdersState';
import { useAdminOrdersFilters } from '@/hooks/useAdminOrdersFilters';
import { 
  extractDeliverySchedules, 
  prioritySortOrders, 
  applyDeliveryDateFilter, 
  applyHourlyFilter,
  calculateHourlyOrderCounts,
  calculateOrderCounts,
  detectOrderWarnings 
} from '@/utils/adminOrdersLogic';
import { OrdersErrorBoundary } from '@/components/admin/orders/OrdersErrorBoundary';
import { OrdersEmptyState, OrdersErrorState, OrdersLoadingSkeleton } from '@/components/admin/orders/OrdersEmptyStates';
import { OrdersStatusIndicators } from '@/components/admin/orders/OrdersStatusIndicators';
import { toast } from 'sonner';

function AdminOrdersContent() {
  const isMobile = useIsMobile();
  
  // Consolidated state management
  const {
    state,
    setSelectedOrder,
    closeDialog,
    setCurrentPage,
    setActiveTab: setActiveTabState,
    toggleDeliveryReport,
    toggleSimpleMode,
    resetToFirstPage,
  } = useAdminOrdersState();

  // Filter management with debouncing
  const {
    filters,
    debouncedSearchQuery,
    setSearchQuery,
    setStatusFilter,
    setDeliveryFilter,
    setSelectedDay,
    setSelectedHour,
    clearFilters,
    clearHourlyFilters,
    hasActiveFilters,
  } = useAdminOrdersFilters(resetToFirstPage);
  
  // Thermal printing functionality
  const { 
    showPreview, 
    closePreview, 
    printFromPreview, 
    isPrinting, 
    isPreviewOpen, 
    previewOrder, 
    previewDeliverySchedule, 
    previewBusinessInfo 
  } = useThermalPrint();

  // Fetch business info for receipts
  const { data: businessInfo } = useQuery({
    queryKey: ['business-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('business_settings')
        .select('name, admin_notification_email, whatsapp_support_number, logo_url')
        .single();
      
      if (error) {
        console.warn('Could not fetch business info:', error);
        return null;
      }
      
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Reset hourly filters when changing tabs
  useEffect(() => {
    if (state.activeTab !== 'confirmed') {
      clearHourlyFilters();
    }
  }, [state.activeTab, clearHourlyFilters]);

  // Fetch orders with pagination and filters
  const {
    data: ordersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['admin-orders', state.currentPage, filters.statusFilter, debouncedSearchQuery],
    queryFn: () => getOrders({
      page: state.currentPage,
      pageSize: 20,
      status: filters.statusFilter === 'all' ? undefined : filters.statusFilter,
      searchQuery: debouncedSearchQuery || undefined
    }),
    refetchInterval: 30000,
    placeholderData: (previousData) => previousData
  });
  
  const orders = ordersData?.orders || [];
  const totalCount = ordersData?.count || 0;
  const totalPages = Math.ceil(totalCount / 20);


  // Extract delivery schedules and detect warnings
  const deliverySchedules = useMemo(() => 
    extractDeliverySchedules(orders), 
  [orders]);

  const orderWarnings = useMemo(() => 
    detectOrderWarnings(orders, deliverySchedules),
  [orders, deliverySchedules]);

  // Priority sort orders using extracted logic
  const prioritySortedOrders = useMemo(() => 
    prioritySortOrders(orders, deliverySchedules, filters.statusFilter),
  [orders, deliverySchedules, filters.statusFilter]);

  // Apply filters using extracted logic
  const filteredOrders = useMemo(() => {
    let result = prioritySortedOrders;
    
    // Apply delivery date filter
    if (filters.deliveryFilter !== 'all') {
      try {
        result = applyDeliveryDateFilter(result, filters.deliveryFilter, deliverySchedules);
      } catch (error) {
        console.error('[PRODUCTION] Error applying date filter:', error);
        result = prioritySortedOrders;
      }
    }
    
    // Apply hourly filter for confirmed tab
    if (state.activeTab === 'confirmed' && (filters.selectedDay || filters.selectedHour)) {
      result = applyHourlyFilter(result, filters.selectedDay, filters.selectedHour, deliverySchedules);
    }
    
    return result;
  }, [prioritySortedOrders, deliverySchedules, filters.deliveryFilter, filters.selectedDay, filters.selectedHour, state.activeTab]);

  // Calculate hourly counts using extracted logic
  const hourlyOrderCounts = useMemo(() => {
    if (state.activeTab !== 'confirmed') return { today: {}, tomorrow: {} };
    return calculateHourlyOrderCounts(prioritySortedOrders, deliverySchedules);
  }, [prioritySortedOrders, deliverySchedules, state.activeTab]);

  // Calculate order counts using extracted logic
  const orderCounts = useMemo(() => 
    calculateOrderCounts(orders, totalCount),
  [orders, totalCount]);

  const handleOrderClick = (order: any) => {
    setSelectedOrder(order);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
  };

  const handleTabChange = (value: string) => {
    setActiveTabState(value);
    setStatusFilter(value as 'all' | OrderStatus);
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'delivered':
        return 'bg-green-100 text-green-800';
      case 'out_for_delivery':
        return 'bg-blue-100 text-blue-800';
      case 'preparing':
        return 'bg-orange-100 text-orange-800';
      case 'confirmed':
        return 'bg-yellow-100 text-yellow-800';
      case 'pending':
        return 'bg-gray-100 text-gray-800';
      case 'cancelled':
        return 'bg-red-100 text-red-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <>
      <Helmet>
        <title>Order Management - Admin Dashboard</title>
        <meta name="description" content="Manage all orders, track deliveries, and monitor order status in real-time." />
      </Helmet>

      <div className="space-y-6">
        {/* Header - Mobile Responsive */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">Order Management</h1>
            <p className="text-muted-foreground text-sm sm:text-base">
              Monitor and manage all customer orders and deliveries
            </p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              className="w-full sm:w-auto"
              onClick={toggleDeliveryReport}
            >
              <BarChart3 className="w-4 h-4 mr-2" />
              Delivery Report
            </Button>
            <OrderDetailsTestButton />
            <Button className="w-full sm:w-auto">
              <Plus className="w-4 h-4 mr-2" />
              Create Order
            </Button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-orange-100 text-orange-600 rounded-lg">
                  <Clock className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Ready Orders</p>
                  <p className="text-2xl font-bold">{orderCounts.ready}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                  <Package className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold">
                    {orderCounts.preparing + orderCounts.out_for_delivery}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-green-100 text-green-600 rounded-lg">
                  <CheckCircle className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Delivered</p>
                  <p className="text-2xl font-bold">{orderCounts.delivered}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                  <TrendingUp className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Total Orders</p>
                  <p className="text-2xl font-bold">{orderCounts.all}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Delivery Report Section */}
        {state.showDeliveryReport && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="w-5 h-5" />
                Daily Delivery Summary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <p className="text-2xl font-bold text-blue-600">
                    {filteredOrders.filter(o => o.status === 'out_for_delivery').length}
                  </p>
                  <p className="text-sm text-blue-600">Out for Delivery</p>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <p className="text-2xl font-bold text-green-600">
                    {filteredOrders.filter(o => o.status === 'delivered').length}
                  </p>
                  <p className="text-sm text-green-600">Delivered Today</p>
                </div>
                <div className="text-center p-4 bg-gray-50 rounded-lg">
                  <p className="text-2xl font-bold text-gray-600">
                    {filteredOrders.filter(o => o.status === 'ready').length}
                  </p>
                  <p className="text-sm text-gray-600">Ready for Pickup</p>
                </div>
              </div>
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <p className="text-sm text-muted-foreground">
                  <strong>Upcoming deliveries:</strong> {filteredOrders.filter(o => 
                    o.status === 'confirmed' || o.status === 'preparing'
                  ).length} orders ready for dispatch
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Filters - Mobile Responsive */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-4">
              <form onSubmit={handleSearch} className="flex flex-col sm:flex-row gap-2 sm:gap-4">
                <div className="flex-1">
                  <Input 
                    type="text" 
                    placeholder="Search by order number, customer name, or email..." 
                    value={filters.searchQuery} 
                    onChange={e => setSearchQuery(e.target.value)} 
                    className="w-full" 
                  />
                </div>
                <div className="flex gap-2">
                  <Button 
                    type="button" 
                    variant={state.useSimpleMode ? "default" : "outline"} 
                    size="sm"
                    onClick={toggleSimpleMode}
                    className="flex-1 sm:flex-none"
                  >
                    <RefreshCw className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">{state.useSimpleMode ? 'Simple' : 'Advanced'}</span>
                  </Button>
                  <Button type="submit" variant="outline" className="flex-1 sm:flex-none">
                    <Search className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Search</span>
                  </Button>
                  <Button variant="outline" className="flex-1 sm:flex-none">
                    <Download className="w-4 h-4 mr-2" />
                    <span className="hidden sm:inline">Export</span>
                  </Button>
                </div>
              </form>
              
              <DeliveryDateFilter
                value={filters.deliveryFilter}
                onChange={setDeliveryFilter}
                orderCounts={useMemo(() => {
                  const stats = getFilterStats(prioritySortedOrders, deliverySchedules);
                  return {
                    all: stats.all,
                    today: stats.today,
                    tomorrow: stats.tomorrow,
                    future: stats.future
                  };
                }, [prioritySortedOrders, deliverySchedules])}
              />
              
              {/* Filter Feedback */}
              {filters.deliveryFilter !== 'all' && (
                <div className="mt-3 p-3 bg-primary/5 border border-primary/20 rounded-lg">
                  <div className="flex items-start gap-3">
                    <Calendar className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground">
                        {getFilterDescription(filters.deliveryFilter, filteredOrders.length, prioritySortedOrders.length).split(':')[0]}
                      </p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {getFilterDescription(filters.deliveryFilter, filteredOrders.length, prioritySortedOrders.length)}
                      </p>
                      {filteredOrders.length === 0 && (
                        <OrdersEmptyState 
                          searchQuery={filters.searchQuery}
                          hasFilters={hasActiveFilters}
                          onClearFilters={clearFilters}
                        />
                      )}
                      
                      {/* Quick Stats for Current Filter */}
                      {filteredOrders.length > 0 && (
                        <div className="mt-2 flex items-center gap-4 text-xs">
                          <span className="text-muted-foreground">
                            Pickup: {filteredOrders.filter(o => o.order_type === 'pickup').length}
                          </span>
                          <span className="text-muted-foreground">
                            Delivery: {filteredOrders.filter(o => o.order_type === 'delivery').length}
                          </span>
                          <span className="text-muted-foreground">
                            Paid: {filteredOrders.filter(o => o.payment_status === 'paid').length}
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Orders Tabs */}
        <Tabs value={state.activeTab} onValueChange={handleTabChange}>
          <div className="relative">
            {/* Mobile & Tablet: Dropdown */}
            <div className="block md:hidden mb-4">
              <OrderTabDropdown
                activeTab={state.activeTab}
                onTabChange={handleTabChange}
                orderCounts={orderCounts}
              />
            </div>
            
            {/* Desktop: Full grid layout */}
            <div className="hidden md:block">
              <TabsList className="grid w-full grid-cols-6 gap-1 p-1 bg-muted rounded-lg">
                <TabsTrigger value="all" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  All Orders ({orderCounts.all})
                </TabsTrigger>
                <TabsTrigger value="confirmed" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Confirmed ({orderCounts.confirmed})
                </TabsTrigger>
                <TabsTrigger value="preparing" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Preparing ({orderCounts.preparing})
                </TabsTrigger>
                <TabsTrigger value="ready" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Ready ({orderCounts.ready})
                </TabsTrigger>
                <TabsTrigger value="out_for_delivery" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Out for Delivery ({orderCounts.out_for_delivery})
                </TabsTrigger>
                <TabsTrigger value="delivered" className="text-sm px-2 py-2 data-[state=active]:bg-background">
                  Delivered ({orderCounts.delivered})
                </TabsTrigger>
              </TabsList>
            </div>
          </div>

          {/* Status Indicators */}
          {orderWarnings.length > 0 && (
            <OrdersStatusIndicators warnings={orderWarnings} />
          )}

          {/* Mobile and Desktop Content */}
          {isMobile ? (
            <MobileOrderTabs
              orders={filteredOrders}
              activeTab={state.activeTab}
              onTabChange={handleTabChange}
              onOrderSelect={handleOrderClick}
              deliverySchedules={deliverySchedules}
              orderCounts={orderCounts}
              useSimpleMode={state.useSimpleMode}
            />
          ) : (
            <TabsContent value={state.activeTab} className="space-y-4">
              {/* Hourly Delivery Filter - Only show for confirmed tab */}
              {state.activeTab === 'confirmed' && (
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-lg flex items-center gap-2">
                      <Clock className="w-5 h-5" />
                      Delivery Time Filters
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <HourlyDeliveryFilter
                      selectedDay={filters.selectedDay}
                      selectedHour={filters.selectedHour}
                      onDayChange={setSelectedDay}
                      onHourChange={setSelectedHour}
                      orderCounts={hourlyOrderCounts}
                    />
                  </CardContent>
                </Card>
              )}

            {isLoading ? (
              <OrdersLoadingSkeleton />
            ) : error ? (
              <OrdersErrorState onRetry={refetch} />
            ) : filteredOrders.length === 0 ? (
              <OrdersEmptyState 
                searchQuery={filters.searchQuery}
                hasFilters={hasActiveFilters}
                onClearFilters={clearFilters}
              />
            ) : (
              <>
                {/* Orders List */}
                <div className="space-y-4">
                  {filteredOrders.map(order => (
                    <div key={order.id} className="flex items-center gap-2">
                      <div onClick={() => handleOrderClick(order)} className="flex-1 cursor-pointer transition-transform hover:scale-[1.01]">
                        <EnhancedOrderCard 
                          order={order} 
                          deliverySchedule={deliverySchedules[order.id]} 
                          onOrderSelect={handleOrderClick}
                          useSimpleMode={state.useSimpleMode}
                        />
                      </div>
                      {/* Print Receipt Button */}
                      {order.payment_status === 'paid' && (
                        <Button
                          onClick={(e) => {
                            e.stopPropagation();
                            showPreview(order, deliverySchedules[order.id], businessInfo);
                          }}
                          disabled={isPrinting}
                          size="sm"
                          variant="outline"
                          className="flex-shrink-0"
                          title="Preview thermal receipt"
                        >
                          {isPrinting ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Printer className="h-4 w-4" />
                          )}
                        </Button>
                      )}
                    </div>
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      Showing {(state.currentPage - 1) * 20 + 1} to{' '}
                      {Math.min(state.currentPage * 20, totalCount)} of {totalCount} orders
                    </p>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setCurrentPage(Math.max(1, state.currentPage - 1))} 
                        disabled={state.currentPage === 1}
                      >
                        Previous
                      </Button>
                      <span className="px-3 py-1 text-sm">
                        Page {state.currentPage} of {totalPages}
                      </span>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setCurrentPage(Math.min(totalPages, state.currentPage + 1))} 
                        disabled={state.currentPage === totalPages}
                      >
                        Next
                      </Button>
                    </div>
                  </div>
                )}
              </>
            )}
            </TabsContent>
          )}
        </Tabs>

        {/* Order Details Modal */}
        <NewOrderDetailsModal 
          order={state.selectedOrder} 
          open={state.isDialogOpen && state.selectedOrder !== null}
          onClose={closeDialog}
        />

        {/* Thermal Receipt Preview Modal */}
        <ThermalReceiptPreview
          isOpen={isPreviewOpen}
          onClose={closePreview}
          onPrint={printFromPreview}
          order={previewOrder}
          deliverySchedule={previewDeliverySchedule}
          businessInfo={previewBusinessInfo}
        />
      </div>
    </>
  );
}

export default function AdminOrders() {
  return (
    <OrdersErrorBoundary>
      <AdminOrdersContent />
    </OrdersErrorBoundary>
  );
}
