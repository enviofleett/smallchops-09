import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { Button } from '@/components/ui/button';
import { useDetailedOrderData } from '@/hooks/useDetailedOrderData';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { useProductionStatusUpdate } from '@/hooks/useProductionStatusUpdate';
import { OrderDetailsHeader } from '@/components/orders/details/OrderDetailsHeader';
import { OrderDetailsTabs } from '@/components/orders/details/OrderDetailsTabs';
import { OrderDetailsFooter } from '@/components/orders/details/OrderDetailsFooter';
import { supabase } from '@/integrations/supabase/client';
import { 
  Printer,
  Package
} from 'lucide-react';

interface OrderDetailsModalProps {
  order: any;
  isOpen: boolean;
  onClose: () => void;
}

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({ 
  order, 
  isOpen, 
  onClose 
}) => {
  const [selectedTab, setSelectedTab] = useState('summary');
  const [assignedRiderId, setAssignedRiderId] = useState<string | null>(order?.assigned_rider_id || null);
  const [isAssigningRider, setIsAssigningRider] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);
  
  // Fetch live data
  const { data: detailedOrderData, isLoading: isLoadingDetailed, error } = useDetailedOrderData(order?.id);
  const { drivers, loading: driversLoading } = useDriverManagement();
  const { updateStatus, isUpdating } = useProductionStatusUpdate();
  
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
    try {
      await updateStatus({ orderId: order.id, status: newStatus });
    } catch (error) {
      console.error('Status update failed:', error);
    }
  };

  const handleRiderAssignment = async (riderId: string | null) => {
    if (isAssigningRider) return;
    
    setIsAssigningRider(true);
    try {
      if (riderId) {
        const { data, error } = await supabase.rpc('assign_rider_to_order', {
          p_order_id: order.id,
          p_rider_id: riderId
        });
        
        if (error) throw error;
        
        setAssignedRiderId(riderId);
        const rider = drivers.find(d => d.id === riderId);
        toast.success(`Rider ${rider?.name} assigned successfully`);
      } else {
        // Unassign rider
        const { error } = await supabase
          .from('orders')
          .update({ assigned_rider_id: null })
          .eq('id', order.id);
        
        if (error) throw error;
        
        setAssignedRiderId(null);
        toast.success('Rider unassigned successfully');
      }
    } catch (error) {
      console.error('Rider assignment failed:', error);
      toast.error('Failed to assign rider');
    } finally {
      setIsAssigningRider(false);
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
          isUpdatingStatus={isUpdating}
          handleStatusUpdate={handleStatusUpdate}
          drivers={drivers}
          driversLoading={driversLoading}
          assignedRiderId={assignedRiderId}
          onRiderAssignment={handleRiderAssignment}
          isAssigningRider={isAssigningRider}
        />
        <OrderDetailsFooter onClose={onClose} />
      </div>
    </AdaptiveDialog>
  );
};