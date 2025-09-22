import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { OrderWithItems } from '@/api/orders';
import { useOrdersNew, useOrdersRealTime } from '@/hooks/useOrdersNew';
import { adaptNewOrdersToOld } from '@/utils/orderDataAdapter';
import { OrderStatus } from '@/types/orders';
import OrderDetailsDialog from '@/components/orders/OrderDetailsDialog';
import { ThermalReceiptPreview } from '@/components/orders/ThermalReceiptPreview';
import { useIsMobile } from '@/hooks/use-mobile';
import { supabase } from '@/integrations/supabase/client';
import { useOverdueOrdersLogic } from '@/hooks/useOverdueOrdersLogic';
import { isOrderOverdue } from '@/utils/scheduleTime';
import { useToast } from '@/hooks/use-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useDebounce } from '@/hooks/useDebounce';
import { addDays, startOfDay } from 'date-fns';
import { useThermalPrint } from '@/hooks/useThermalPrint';
import { useOrderScheduleRecovery } from '@/hooks/useOrderScheduleRecovery';
import { AdminOrdersFilters } from './AdminOrdersFilters';
import { AdminOrdersStats } from './AdminOrdersStats';
import { AdminOrdersList } from './AdminOrdersList';

export function AdminOrdersContent() {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus>('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [activeTab, setActiveTab] = useState('all');
  const [showDeliveryReport, setShowDeliveryReport] = useState(false);
  
  // Production-safe schedule recovery with circuit breaker
  const { attemptScheduleRecovery, getRecoveryStatus } = useOrderScheduleRecovery();
  
  // Hourly delivery filter state for confirmed tab
  const [selectedDay, setSelectedDay] = useState<'today' | 'tomorrow' | null>(null);
  const [selectedHour, setSelectedHour] = useState<string | null>(null);
  
  // Overdue date filter state for overdue tab
  const [selectedOverdueDateFilter, setSelectedOverdueDateFilter] = useState<string | null>(null);
  
  const isMobile = useIsMobile();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
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
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      
      if (error) {
        console.warn('Could not fetch business info:', error);
        return null;
      }
      
      return data;
    },
    staleTime: 5 * 60 * 1000, // Cache for 5 minutes
  });

  // Debounce search query to avoid excessive API calls
  const debouncedSearchQuery = useDebounce(searchQuery, 500);

  // Handle category click from stats cards
  const handleCategoryClick = (category: 'all' | 'confirmed' | 'preparing' | 'ready' | 'out_for_delivery' | 'delivered') => {
    setActiveTab(category);
    
    // Map category to status filter
    if (category === 'all') {
      setStatusFilter('all');
    } else {
      setStatusFilter(category as OrderStatus);
    }
    
    // Reset pagination and filters when switching categories
    setCurrentPage(1);
    setSearchQuery('');
    
    // Reset category-specific filters
    if (category !== 'confirmed') {
      setSelectedDay(null);
      setSelectedHour(null);
    }
  };

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearchQuery, selectedDay, selectedHour, selectedOverdueDateFilter]);

  // Use new order management hooks
  const { data: newOrdersData, isLoading, error, refetch } = useOrdersNew({
    status: statusFilter === 'all' ? undefined : statusFilter,
    search: debouncedSearchQuery || undefined,
    page: currentPage,
    pageSize: 20
  });
  
  // Real-time updates
  const { subscribe } = useOrdersRealTime();
  
  useEffect(() => {
    const unsubscribe = subscribe();
    return unsubscribe;
  }, [subscribe]);
  
  // Adapt new orders data to old structure
  const orders = useMemo(() => {
    if (!newOrdersData?.orders) return [];
    return adaptNewOrdersToOld(newOrdersData.orders);
  }, [newOrdersData?.orders]);
  
  const totalCount = newOrdersData?.total_count || 0;
  const totalPages = Math.ceil(totalCount / 20);

  // Use the overdue orders logic hook
  const {
    overdueOrders,
    overdueStats,
    isLoading: isOverdueLoading
  } = useOverdueOrdersLogic();


  // Priority sort and filter orders
  const prioritySortedOrders = useMemo(() => {
    let ordersCopy = [...orders];
    
    // Filter and sort confirmed orders - ONLY PAID ORDERS
    if (statusFilter === 'confirmed') {
      // First filter: only paid confirmed orders
      ordersCopy = orders.filter(order => 
        order.status === 'confirmed' && order.payment_status === 'paid'
      );
      
      // Simple sort by order creation time (most recent first)
      ordersCopy.sort((a, b) => {
        return new Date(b.order_time || b.created_at).getTime() - 
               new Date(a.order_time || a.created_at).getTime();
      });
    }
    
    return ordersCopy;
  }, [orders, statusFilter]);

  // Filter orders by delivery schedule with defensive date handling + hourly filtering
  const filteredOrders = useMemo(() => {
    // Use regular orders for filtering - simplified without delivery schedules
    return prioritySortedOrders;
  }, [prioritySortedOrders]);

  return (
    <>
      <AdminOrdersFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedDay={selectedDay}
        setSelectedDay={setSelectedDay}
        selectedHour={selectedHour}
        setSelectedHour={setSelectedHour}
        isMobile={isMobile}
        refetch={refetch}
        orders={orders}
      />
      
      <AdminOrdersStats
        orders={orders}
        activeTab={activeTab}
        showDeliveryReport={showDeliveryReport}
        setShowDeliveryReport={setShowDeliveryReport}
        onCategoryClick={handleCategoryClick}
        isLoading={isLoading}
      />
      
      <AdminOrdersList
        orders={filteredOrders}
        isLoading={isLoading}
        error={error}
        selectedOrder={selectedOrder}
        setSelectedOrder={setSelectedOrder}
        setIsDialogOpen={setIsDialogOpen}
        deliverySchedules={{}}
        activeTab={activeTab}
        statusFilter={statusFilter}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        showPreview={(order) => showPreview(order, null, businessInfo)}
        isMobile={isMobile}
      />

      {/* Thermal Receipt Preview Modal */}
      {isPreviewOpen && previewOrder && (
        <ThermalReceiptPreview
          isOpen={isPreviewOpen}
          order={previewOrder}
          deliverySchedule={previewDeliverySchedule}
          businessInfo={previewBusinessInfo}
          onClose={closePreview}
          onPrint={printFromPreview}
          isPrinting={isPrinting}
        />
      )}

      {/* Order Details Modal */}
      {selectedOrder && (
        <OrderDetailsDialog
          order={selectedOrder}
          isOpen={isDialogOpen}
          onClose={() => {
            setIsDialogOpen(false);
            setSelectedOrder(null);
          }}
        />
      )}
    </>
  );
}