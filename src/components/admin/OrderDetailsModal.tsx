import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { Button } from '@/components/ui/button';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { OrderDetailsHeader } from '@/components/orders/details/OrderDetailsHeader';
import { OrderDetailsTabs } from '@/components/orders/details/OrderDetailsTabs';
import { OrderDetailsFooter } from '@/components/orders/details/OrderDetailsFooter';
import { 
  Printer,
  Package
} from 'lucide-react';

// Force refresh timestamp: 1727279220

interface OrderDetailsModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

// Force refresh timestamp: 1727279220

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ 
  order, 
  isOpen, 
  onClose 
}) => {
  const [selectedTab, setSelectedTab] = useState('summary');
  const [isUpdatingStatus, setIsUpdatingStatus] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  const { data: detailedOrderData, isLoading: isLoadingDetailed, error } = useDetailedOrderData(order?.id);
  
  if (!order) {
    return null;
  }

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: `Order-${order.order_number}`,
    onAfterPrint: () => toast.success('Order details printed successfully'),
    onPrintError: () => toast.error('Failed to print order details')
  });

  const handleStatusUpdate = async (newStatus: string) => {
    setIsUpdatingStatus(true);
    try {
      // TODO: Implement status update logic here
      // await updateOrderStatus(order.id, newStatus);
      toast.success(`Order status updated to ${newStatus}`);
    } catch (error) {
      toast.error('Failed to update order status');
    } finally {
      setIsUpdatingStatus(false);
    }
  };

  // Show error toast but don't block UI
  if (error) {
    toast.error('Failed to load detailed order information');
  }

  return (
    <AdaptiveDialog
      open={isOpen}
      onOpenChange={onClose}
      size="xl"
      title={`Order #${order.order_number}`}
      className="max-w-7xl h-[95vh]"
    >
      <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-muted/10" ref={printRef}>
        <OrderDetailsHeader
          order={order}
          onPrint={handlePrint}
        />
        <OrderDetailsTabs
          order={order}
          deliverySchedule={undefined}
          detailedOrderData={detailedOrderData}
          isLoading={isLoadingDetailed}
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