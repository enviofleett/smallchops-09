import React, { useRef } from 'react';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { OrderDetailsModalProps } from '@/types/orderDetailsModal';
import { useOrderDetails } from '@/hooks/useOrderDetails';
import { useIsMobile } from '@/hooks/useIsMobile';
import { OrderHeader } from './OrderHeader';
import { CustomerSection } from './CustomerSection';
import { OrderInfoSection } from './OrderInfoSection';
import { OrderItemsSection } from './OrderItemsSection';
import { DeliveryPickupSection } from './DeliveryPickupSection';
import { TimelineSection } from './TimelineSection';
import { ActionsSection } from './ActionsSection';
import { LoadingSkeleton } from './LoadingSkeleton';
import { ErrorState } from './ErrorState';
import { PrintableOrderView } from './PrintableOrderView';

export const OrderDetailsModal: React.FC<OrderDetailsModalProps> = ({
  isOpen,
  onClose,
  orderId,
}) => {
  const printRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  
  const {
    order,
    isLoading,
    error,
    isUpdatingStatus,
    refetch,
    connectionStatus,
    lastUpdated,
  } = useOrderDetails(orderId);

  const handleClose = () => {
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent
        className={`
          ${isMobile 
            ? 'w-screen h-screen max-w-none max-h-none rounded-none m-0 p-0' 
            : 'max-w-4xl max-h-[90vh] w-full'
          }
          overflow-hidden
        `}
        aria-labelledby="order-details-title"
        aria-describedby="order-details-description"
      >
        <div className="flex flex-col h-full">
          {/* Printable content */}
          <div ref={printRef} className="flex-1 overflow-auto">
            <PrintableOrderView order={order} />
            
            {/* Screen-only content */}
            <div className="no-print">
              {isLoading ? (
                <LoadingSkeleton />
              ) : error ? (
                <ErrorState 
                  error={error} 
                  onRetry={refetch}
                  onClose={handleClose}
                />
              ) : order ? (
                <div className="space-y-6 p-6">
                  <OrderHeader 
                    order={order}
                    onClose={handleClose}
                    connectionStatus={connectionStatus}
                    lastUpdated={lastUpdated}
                  />
                  
                  <div className="grid gap-6 md:grid-cols-2">
                    <div className="space-y-6">
                      <CustomerSection order={order} />
                      <OrderInfoSection 
                        order={order}
                        isUpdatingStatus={isUpdatingStatus}
                        onStatusUpdate={() => refetch()}
                      />
                    </div>
                    
                    <div className="space-y-6">
                      <OrderItemsSection order={order} />
                      <DeliveryPickupSection order={order} />
                    </div>
                  </div>
                  
                  <TimelineSection order={order} />
                </div>
              ) : (
                <ErrorState 
                  error="Order not found" 
                  onRetry={refetch}
                  onClose={handleClose}
                />
              )}
            </div>
          </div>

          {/* Actions - always visible */}
          {!isLoading && !error && order && (
            <div className="no-print border-t bg-background p-4">
              <ActionsSection 
                order={order}
                printRef={printRef}
                onClose={handleClose}
                onStatusUpdate={() => refetch()}
                isUpdatingStatus={isUpdatingStatus}
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};