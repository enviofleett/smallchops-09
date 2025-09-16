import React from 'react';
import OrderErrorBoundary from '@/components/orders/OrderErrorBoundary';
import { MobileOrderTabs } from './MobileOrderTabs';
import { OrderWithItems } from '@/api/orders';

interface MobileOrderTabsProps {
  orders: OrderWithItems[];
  activeTab: string;
  onTabChange: (tab: string) => void;
  onOrderSelect?: (order: OrderWithItems) => void;
  deliverySchedules: Record<string, any>;
  orderCounts: {
    all: number;
    confirmed: number;
    preparing: number;
    ready: number;
    out_for_delivery: number;
    delivered: number;
    overdue: number;
  };
}

/**
 * Production-safe wrapper for MobileOrderTabs with error boundaries
 */
export function SafeMobileOrderTabs(props: MobileOrderTabsProps) {
  return (
    <OrderErrorBoundary
      context="Mobile Order Management"
      onRetry={() => window.location.reload()}
    >
      <MobileOrderTabs {...props} />
    </OrderErrorBoundary>
  );
}