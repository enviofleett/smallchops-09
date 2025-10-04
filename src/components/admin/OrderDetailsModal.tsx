import React, { useRef, useState } from 'react';
import { toast } from 'sonner';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { Button } from '@/components/ui/button';
import { useRealTimeOrderData } from '@/hooks/useRealTimeOrderData';
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
import { RealTimeConnectionStatus } from '@/components/common/RealTimeConnectionStatus';
import { AdminOrderPrintView } from './AdminOrderPrintView';
import { useAuth } from '@/contexts/AuthContext';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { usePrint } from '@/hooks/usePrint';
import '@/styles/admin-print.css';

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
  
  // Fetch live data with real-time updates
  const { data: detailedOrderData, isLoading: isLoadingDetailed, error, lastUpdated, connectionStatus, reconnect } = useRealTimeOrderData(order?.id);
  const { drivers, loading: driversLoading } = useDriverManagement();
  const { updateStatus, isUpdating } = useProductionStatusUpdate();
  
  // Get admin user info for print footer
  const { user } = useAuth();
  const { data: businessSettings } = useBusinessSettings();
  
  if (!order) {
    return null;
  }

  // Use production-ready print hook with A4 configuration
  const { handlePrint, isPrinting } = usePrint(
    printRef,
    `Order-${order.order_number}`
  );

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
    <>
      <AdaptiveDialog
        open={isOpen}
        onOpenChange={onClose}
        size="xl"
        title={`Order #${order.order_number}`}
        className="max-w-7xl h-[95vh]"
      >
        <div className="flex flex-col h-full bg-gradient-to-br from-background via-background to-muted/10">
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
            isPrinting={isPrinting}
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

      {/* Enhanced Print View (hidden on screen, visible when printing) */}
      <div ref={printRef} className="hidden">
        <AdminOrderPrintView
          order={order}
          businessSettings={businessSettings}
          adminName={user?.name}
          adminEmail={user?.email}
        />
      </div>
    </>
  );
};