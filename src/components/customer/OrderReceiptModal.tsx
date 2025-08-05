import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OrderReceiptCard } from './OrderReceiptCard';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

interface OrderReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

export function OrderReceiptModal({ isOpen, onClose, order }: OrderReceiptModalProps) {
  const { data: businessSettings } = useBusinessSettings();

  const handleDownload = () => {
    // Trigger browser print dialog for PDF download
    window.print();
  };

  const handleEmailReceipt = () => {
    // TODO: Implement email receipt functionality
    console.log('Email receipt for order:', order.order_number);
  };

  const businessInfo = businessSettings ? {
    name: businessSettings.name,
    address: businessSettings.address || 'Address not set',
    phone: businessSettings.phone || 'Phone not set',
    email: businessSettings.email || 'Email not set',
  } : undefined;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Order Receipt</DialogTitle>
        </DialogHeader>
        <OrderReceiptCard
          order={order}
          businessInfo={businessInfo}
          onDownload={handleDownload}
          onEmailReceipt={handleEmailReceipt}
        />
      </DialogContent>
    </Dialog>
  );
}