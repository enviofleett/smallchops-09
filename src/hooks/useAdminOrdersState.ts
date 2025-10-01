import { useState, useCallback } from 'react';
import { OrderWithItems } from '@/api/orders';
import { AdminOrdersState } from '@/types/adminOrders';

/**
 * Consolidated state management for admin orders page
 * Reduces state variables and provides clear state transitions
 */
export const useAdminOrdersState = () => {
  const [state, setState] = useState<AdminOrdersState>({
    selectedOrder: null,
    isDialogOpen: false,
    currentPage: 1,
    activeTab: 'all',
    showDeliveryReport: false,
    useSimpleMode: false,
  });

  const setSelectedOrder = useCallback((order: OrderWithItems | null) => {
    setState(prev => ({
      ...prev,
      selectedOrder: order,
      isDialogOpen: order !== null,
    }));
  }, []);

  const closeDialog = useCallback(() => {
    setState(prev => ({
      ...prev,
      selectedOrder: null,
      isDialogOpen: false,
    }));
  }, []);

  const setCurrentPage = useCallback((page: number) => {
    setState(prev => ({ ...prev, currentPage: page }));
  }, []);

  const setActiveTab = useCallback((tab: string) => {
    setState(prev => ({ ...prev, activeTab: tab }));
  }, []);

  const toggleDeliveryReport = useCallback(() => {
    setState(prev => ({ ...prev, showDeliveryReport: !prev.showDeliveryReport }));
  }, []);

  const toggleSimpleMode = useCallback(() => {
    setState(prev => ({ ...prev, useSimpleMode: !prev.useSimpleMode }));
  }, []);

  const resetToFirstPage = useCallback(() => {
    setState(prev => ({ ...prev, currentPage: 1 }));
  }, []);

  return {
    state,
    setSelectedOrder,
    closeDialog,
    setCurrentPage,
    setActiveTab,
    toggleDeliveryReport,
    toggleSimpleMode,
    resetToFirstPage,
  };
};
