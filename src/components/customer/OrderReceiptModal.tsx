import React, { useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OrderReceiptCard } from './OrderReceiptCard';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { usePrint } from '@/hooks/usePrint';

interface OrderReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

export function OrderReceiptModal({ isOpen, onClose, order }: OrderReceiptModalProps) {
  const { data: businessSettings } = useBusinessSettings();
  const printRef = useRef<HTMLDivElement>(null);
  
  // Use production-ready print hook
  const { handlePrint: handleDownload, isPrinting } = usePrint(
    printRef,
    `Receipt-${order.order_number}`
  );

  const handleEmailReceipt = () => {
    // TODO: Implement email receipt functionality
    console.log('Email receipt for order:', order.order_number);
  };

  const businessInfo = businessSettings ? {
    name: businessSettings.name,
    address: '2B Close Off 11Crescent Kado Estate, Kado',
    phone: '0807 301 1100',
    email: 'store@startersmallchops.com',
  } : undefined;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Order Receipt</DialogTitle>
          </DialogHeader>
          <div ref={printRef}>
            <OrderReceiptCard
              order={order}
              businessInfo={businessInfo}
              onDownload={handleDownload}
              onEmailReceipt={handleEmailReceipt}
            />
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}