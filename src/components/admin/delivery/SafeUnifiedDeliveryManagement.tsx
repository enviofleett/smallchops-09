import React from 'react';
import OrderErrorBoundary from '@/components/orders/OrderErrorBoundary';
import { UnifiedDeliveryManagement } from './UnifiedDeliveryManagement';

interface SafeUnifiedDeliveryManagementProps {
  mode: 'ready' | 'all' | 'overdue';
  selectedDate?: Date;
  typeFilter?: 'all' | 'delivery' | 'pickup';
  statusFilter?: string[];
  ordersOverride?: any[];
}

/**
 * Production-safe wrapper for UnifiedDeliveryManagement with comprehensive error boundaries
 */
export function SafeUnifiedDeliveryManagement(props: SafeUnifiedDeliveryManagementProps) {
  return (
    <OrderErrorBoundary
      context="Delivery Management"
      onRetry={() => window.location.reload()}
    >
      <UnifiedDeliveryManagement {...props} />
    </OrderErrorBoundary>
  );
}