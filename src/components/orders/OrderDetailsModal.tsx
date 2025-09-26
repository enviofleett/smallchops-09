import React, { useState, useRef } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { useRealTimeOrderData } from '@/hooks/useRealTimeOrderData';
import { OrderDetailsHeader } from './details/OrderDetailsHeader';
import { OrderDetailsTabs } from './details/OrderDetailsTabs';
import { OrderDetailsFooter } from './details/OrderDetailsFooter';
import { RealTimeConnectionStatus } from '@/components/common/RealTimeConnectionStatus';

interface OrderDetailsModalProps {
  order: any;
  deliverySchedule?: any;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * OrderDetailsModal - Main modal component for displaying comprehensive order details
 * 
 * @param order - Order object with all order information
 * @param deliverySchedule - Optional delivery schedule information  
 * @param isOpen - Boolean to control modal visibility
 * @param onClose - Function to handle modal close
 * 
 * @example
 * ```tsx
 * const order = {
 *   id: "123",
 *   order_number: "ORD-2025-001",
 *   status: "confirmed", 
 *   total_amount: 25500,
 *   order_type: "delivery",
 *   customer: { name: "John Doe", phone: "08012345678" },
 *   items: [{ name: "Meat Pie", quantity: 2, price: 400 }]
 * };
 * 
 * <OrderDetailsModal
 *   order={order}
 *   isOpen={isModalOpen}
 *   onClose={() => setIsModalOpen(false)}
 * />
 * ```
 */
export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  order,
  deliverySchedule,
  isOpen,
  onClose
}) => {
  const [selectedTab, setSelectedTab] = useState('summary');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  const { data: detailedOrderData, isLoading, error, lastUpdated, connectionStatus, reconnect } = useRealTimeOrderData(order?.id);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Order-${order?.order_number}`,
    onAfterPrint: () => toast.success('Order details printed successfully'),
    onPrintError: () => toast.error('Failed to print order details')
  });

  const handleStatusUpdate = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      // Implement your update logic here
      // await updateOrderStatus(order.id, newStatus);
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update order status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  if (!order) return null;

  return (
    <AdaptiveDialog
      open={isOpen}
      onOpenChange={onClose}
      size="xl"
      title={`Order #${order.order_number}`}
      className="max-w-7xl h-[95vh]"
    >
      <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-muted/10" ref={printRef}>
        {/* Real-time connection status */}
        <div className="px-6 pt-4">
          <RealTimeConnectionStatus
            connectionStatus={connectionStatus}
            lastUpdated={lastUpdated}
            onReconnect={reconnect}
            compact={true}
            className="mb-2"
          />
        </div>
        
        <OrderDetailsHeader
          order={order}
          onPrint={handlePrint}
        />
        <OrderDetailsTabs
          order={order}
          deliverySchedule={deliverySchedule}
          detailedOrderData={detailedOrderData}
          isLoading={isLoading}
          error={error}
          selectedTab={selectedTab}
          setSelectedTab={setSelectedTab}
          isUpdatingStatus={isUpdatingStatus}
          handleStatusUpdate={handleStatusUpdate}
        />
        <OrderDetailsFooter onClose={onClose} />
      </div>
    </AdaptiveDialog>
  );
};