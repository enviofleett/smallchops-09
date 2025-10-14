import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { OrderReceiptCard } from './OrderReceiptCard';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import { useCustomerReceiptPDF } from '@/hooks/useCustomerReceiptPDF';

interface OrderReceiptModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: any;
}

export function OrderReceiptModal({ isOpen, onClose, order }: OrderReceiptModalProps) {
  const { data: businessSettings } = useBusinessSettings();
  const { downloadReceipt, isGenerating } = useCustomerReceiptPDF();

  const handleDownload = () => {
    downloadReceipt(order, businessInfo);
  };

  const handleEmailReceipt = () => {
    // TODO: Implement email receipt functionality
    console.log('Email receipt for order:', order.order_number);
  };

  const businessInfo = businessSettings ? {
    name: 'Starters',
    address: '2B Close Off 11Crescent Kado Estate, Kado',
    phone: '0807 301 1100',
    email: 'store@startersmallchops.com',
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
          isDownloading={isGenerating}
        />
      </DialogContent>
    </Dialog>
  );
}