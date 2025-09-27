import React from 'react';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { ProductionOrderDetailsPage } from './ProductionOrderDetailsPage';

interface OrderDetailsModalRedesignProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Redesigned OrderDetailsModal using the new ProductionOrderDetailsPage
 * This provides a comprehensive, real-time, mobile-responsive order details interface
 */
export const OrderDetailsModalRedesign: React.FC<OrderDetailsModalRedesignProps> = ({
  order,
  isOpen,
  onClose
}) => {
  if (!order?.id) return null;

  return (
    <AdaptiveDialog
      open={isOpen}
      onOpenChange={onClose}
      size="full"
      title={`Order #${order.order_number}`}
      description="Complete order details with real-time updates"
      className="max-w-none w-screen h-screen m-0"
    >
      <div className="h-[calc(100vh-120px)] overflow-auto">
        <ProductionOrderDetailsPage 
          orderId={order.id} 
          onClose={onClose}
        />
      </div>
    </AdaptiveDialog>
  );
};