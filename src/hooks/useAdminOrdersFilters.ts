import { useState, useCallback, useMemo, useEffect } from 'react';
import { OrderStatus } from '@/types/orders';
import { AdminOrderFilters, DeliveryFilterType, DayFilterType } from '@/types/adminOrders';
import { useDebounce } from '@/hooks/useDebounce';

/**
 * Filter state and logic management
 * Handles all filtering operations with proper debouncing and validation
 */
export const useAdminOrdersFilters = (resetToFirstPage: () => void) => {
  const [filters, setFilters] = useState<AdminOrderFilters>({
    searchQuery: '',
    statusFilter: 'all',
    deliveryFilter: 'all',
    selectedDay: null,
    selectedHour: null,
  });

  const debouncedSearchQuery = useDebounce(filters.searchQuery, 500);

  const setSearchQuery = useCallback((query: string) => {
    setFilters(prev => ({ ...prev, searchQuery: query }));
  }, []);

  const setStatusFilter = useCallback((status: 'all' | OrderStatus) => {
    setFilters(prev => ({ ...prev, statusFilter: status }));
  }, []);

  const setDeliveryFilter = useCallback((filter: DeliveryFilterType) => {
    setFilters(prev => ({ ...prev, deliveryFilter: filter }));
  }, []);

  const setSelectedDay = useCallback((day: DayFilterType) => {
    setFilters(prev => ({ ...prev, selectedDay: day }));
  }, []);

  const setSelectedHour = useCallback((hour: string | null) => {
    setFilters(prev => ({ ...prev, selectedHour: hour }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({
      searchQuery: '',
      statusFilter: 'all',
      deliveryFilter: 'all',
      selectedDay: null,
      selectedHour: null,
    });
  }, []);

  const clearHourlyFilters = useCallback(() => {
    setFilters(prev => ({
      ...prev,
      selectedDay: null,
      selectedHour: null,
    }));
  }, []);

  const hasActiveFilters = useMemo(() => {
    return filters.searchQuery !== '' || 
           filters.deliveryFilter !== 'all' ||
           filters.selectedDay !== null ||
           filters.selectedHour !== null;
  }, [filters]);

  // Reset pagination when filters change
  useEffect(() => {
    resetToFirstPage();
  }, [filters.statusFilter, debouncedSearchQuery, filters.deliveryFilter, filters.selectedDay, filters.selectedHour, resetToFirstPage]);

  return {
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
  };
};
