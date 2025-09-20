import React, { useState, useMemo, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getOrders, OrderWithItems } from '@/api/orders';
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
import { filterOrdersByDate, DeliveryFilterType } from '@/utils/dateFilterUtils';
import { useThermalPrint } from '@/hooks/useThermalPrint';
import { useOrderScheduleRecovery } from '@/hooks/useOrderScheduleRecovery';
import { AdminOrdersFilters } from './AdminOrdersFilters';
import { AdminOrdersStats } from './AdminOrdersStats';
import { AdminOrdersList } from './AdminOrdersList';

export function AdminOrdersContent() {
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | OrderStatus | 'overdue'>('all');
  const [deliveryFilter, setDeliveryFilter] = useState<DeliveryFilterType>('all');
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

  // Reset pagination when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, debouncedSearchQuery, deliveryFilter, selectedDay, selectedHour, selectedOverdueDateFilter]);

  // Reset hourly filters when changing tabs (except for confirmed tab)
  useEffect(() => {
    if (activeTab !== 'confirmed') {
      setSelectedDay(null);
      setSelectedHour(null);
    }
    // Reset overdue filters when changing tabs (except for overdue tab)
    if (activeTab !== 'overdue') {
      setSelectedOverdueDateFilter(null);
    }
  }, [activeTab]);

  // Fetch orders with pagination and filters
  const {
    data: ordersData,
    isLoading,
    error,
    refetch
  } = useQuery({
    queryKey: ['admin-orders', currentPage, statusFilter, debouncedSearchQuery],
    queryFn: () => getOrders({
      page: currentPage,
      pageSize: 20,
      status: statusFilter === 'all' || statusFilter === 'overdue' ? undefined : statusFilter,
      searchQuery: debouncedSearchQuery || undefined
    }),
    refetchInterval: 30000, // Refresh every 30 seconds
    placeholderData: (previousData) => previousData // Keep previous data while loading new data
  });
  
  const orders = ordersData?.orders || [];
  const totalCount = ordersData?.count || 0;
  const totalPages = Math.ceil(totalCount / 20);

  // Use the overdue orders logic hook
  const {
    overdueOrders,
    overdueStats,
    isLoading: isOverdueLoading
  } = useOverdueOrdersLogic();

  // Extract delivery schedules from orders (now included in admin function)
  const deliverySchedules = useMemo(() => {
    const scheduleMap: Record<string, any> = {};
    orders.forEach((order: any) => {
      if (order.delivery_schedule) {
        scheduleMap[order.id] = order.delivery_schedule;
      }
    });
    return scheduleMap;
  }, [orders]);

  // Priority sort and filter orders
  const prioritySortedOrders = useMemo(() => {
    let ordersCopy = [...orders];
    
    // Filter for overdue orders
    if (statusFilter === 'overdue') {
      ordersCopy = orders.filter(order => {
        const schedule = deliverySchedules[order.id];
        if (!schedule) return false;
        
        // Only show paid orders that are overdue and haven't been delivered
        return order.payment_status === 'paid' && 
               isOrderOverdue(schedule.delivery_date, schedule.delivery_time_end) && 
               ['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(order.status);
      });
      
      // Sort overdue orders by how long they've been overdue (most critical first)
      ordersCopy.sort((a, b) => {
        const scheduleA = deliverySchedules[a.id];
        const scheduleB = deliverySchedules[b.id];
        
        if (!scheduleA || !scheduleB) return 0;
        
        const deadlineA = new Date(`${scheduleA.delivery_date}T${scheduleA.delivery_time_end}`);
        const deadlineB = new Date(`${scheduleB.delivery_date}T${scheduleB.delivery_time_end}`);
        
        // Most overdue orders come first (earlier deadlines first)
        return deadlineA.getTime() - deadlineB.getTime();
      });
    }
    
    // Filter and sort confirmed orders - ONLY PAID ORDERS
    if (statusFilter === 'confirmed') {
      // First filter: only paid confirmed orders
      ordersCopy = orders.filter(order => 
        order.status === 'confirmed' && order.payment_status === 'paid'
      );
      
      // Sort with today's orders first, then by delivery schedule
      ordersCopy.sort((a, b) => {
        const scheduleA = deliverySchedules[a.id];
        const scheduleB = deliverySchedules[b.id];
        
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        // Check if orders are scheduled for today
        const aIsToday = scheduleA && new Date(scheduleA.delivery_date).setHours(0, 0, 0, 0) === today.getTime();
        const bIsToday = scheduleB && new Date(scheduleB.delivery_date).setHours(0, 0, 0, 0) === today.getTime();
        
        // Today's orders come first
        if (aIsToday && !bIsToday) return -1;
        if (!aIsToday && bIsToday) return 1;
        
        // Among today's orders, overdue ones get highest priority
        if (aIsToday && bIsToday) {
          const aOverdue = scheduleA && isOrderOverdue(scheduleA.delivery_date, scheduleA.delivery_time_end);
          const bOverdue = scheduleB && isOrderOverdue(scheduleB.delivery_date, scheduleB.delivery_time_end);
          
          if (aOverdue && !bOverdue) return -1;
          if (!aOverdue && bOverdue) return 1;
          
          // Both today - sort by time slot
          if (scheduleA && scheduleB) {
            const timeA = new Date(`${scheduleA.delivery_date}T${scheduleA.delivery_time_start}`);
            const timeB = new Date(`${scheduleB.delivery_date}T${scheduleB.delivery_time_start}`);
            return timeA.getTime() - timeB.getTime();
          }
        }
        
        // For non-today orders, sort by delivery date + time
        if (scheduleA && scheduleB) {
          const dateTimeA = new Date(`${scheduleA.delivery_date}T${scheduleA.delivery_time_start}`);
          const dateTimeB = new Date(`${scheduleB.delivery_date}T${scheduleB.delivery_time_start}`);
          return dateTimeA.getTime() - dateTimeB.getTime();
        }
        
        // Orders with schedules come first
        if (scheduleA && !scheduleB) return -1;
        if (!scheduleA && scheduleB) return 1;
        
        // Fallback to order time (most recent first for unscheduled orders)
        return new Date(b.order_time || b.created_at).getTime() - 
               new Date(a.order_time || a.created_at).getTime();
      });
    }
    
    return ordersCopy;
  }, [orders, deliverySchedules, statusFilter]);

  // Filter orders by delivery schedule with defensive date handling + hourly filtering
  const filteredOrders = useMemo(() => {
    // Use overdue orders for the overdue tab, regular orders for others  
    let result = statusFilter === 'overdue' ? overdueOrders : prioritySortedOrders;
    
    // Apply comprehensive delivery/pickup date filter using utility functions
    if (deliveryFilter !== 'all' && (statusFilter as string) !== 'overdue') {
      try {
        result = filterOrdersByDate(result, deliveryFilter, deliverySchedules);
      } catch (error) {
        console.error('Error applying date filter:', error);
        result = statusFilter === 'overdue' ? overdueOrders : prioritySortedOrders;
      }
    }
    
    // Apply hourly filtering for confirmed tab
    if (activeTab === 'confirmed' && (selectedDay || selectedHour)) {
      const today = startOfDay(new Date());
      const tomorrow = startOfDay(addDays(new Date(), 1));
      
      result = result.filter(order => {
        // Only filter delivery orders with paid status that have schedules
        if (order.order_type !== 'delivery' || order.payment_status !== 'paid') {
          return false;
        }
        
        const schedule = deliverySchedules[order.id];
        if (!schedule?.delivery_date) return false;
        
        try {
          const deliveryDate = new Date(schedule.delivery_date);
          
          // Validate delivery date
          if (isNaN(deliveryDate.getTime())) {
            console.warn('Invalid delivery date for order:', order.id, schedule.delivery_date);
            return false;
          }
          
          const normalizedDeliveryDate = startOfDay(deliveryDate);
          
          // Filter by selected day - must match exactly
          if (selectedDay) {
            const targetDate = selectedDay === 'today' ? today : tomorrow;
            if (normalizedDeliveryDate.getTime() !== targetDate.getTime()) {
              return false;
            }
          }
          
          // Filter by selected hour - more robust hour matching
          if (selectedHour && schedule.delivery_time_start) {
            const orderTimeComponents = schedule.delivery_time_start.split(':');
            const selectedTimeComponents = selectedHour.split(':');
            
            if (orderTimeComponents.length < 2 || selectedTimeComponents.length < 2) {
              console.warn('Invalid time format for order:', order.id, schedule.delivery_time_start);
              return false;
            }
            
            const orderHour = parseInt(orderTimeComponents[0], 10);
            const selectedHourInt = parseInt(selectedTimeComponents[0], 10);
            
            if (isNaN(orderHour) || isNaN(selectedHourInt) || orderHour !== selectedHourInt) {
              return false;
            }
          }
          
          return true;
        } catch (error) {
          console.warn('Error processing delivery schedule for order:', order.id, error);
          return false;
        }
      });
    }
    
    return result;
  }, [prioritySortedOrders, overdueOrders, deliverySchedules, deliveryFilter, statusFilter, selectedDay, selectedHour, activeTab]);

  return (
    <>
      <AdminOrdersFilters
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        deliveryFilter={deliveryFilter}
        setDeliveryFilter={setDeliveryFilter}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        selectedDay={selectedDay}
        setSelectedDay={setSelectedDay}
        selectedHour={selectedHour}
        setSelectedHour={setSelectedHour}
        selectedOverdueDateFilter={selectedOverdueDateFilter}
        setSelectedOverdueDateFilter={setSelectedOverdueDateFilter}
        isMobile={isMobile}
        refetch={refetch}
        orders={orders}
        deliverySchedules={deliverySchedules}
      />
      
      <AdminOrdersStats
        orders={orders}
        overdueOrders={overdueOrders}
        activeTab={activeTab}
        showDeliveryReport={showDeliveryReport}
        setShowDeliveryReport={setShowDeliveryReport}
      />
      
      <AdminOrdersList
        orders={filteredOrders}
        isLoading={isLoading}
        error={error}
        selectedOrder={selectedOrder}
        setSelectedOrder={setSelectedOrder}
        setIsDialogOpen={setIsDialogOpen}
        deliverySchedules={deliverySchedules}
        activeTab={activeTab}
        statusFilter={statusFilter}
        currentPage={currentPage}
        setCurrentPage={setCurrentPage}
        totalPages={totalPages}
        showPreview={(order) => showPreview(order, deliverySchedules[order.id], businessInfo)}
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