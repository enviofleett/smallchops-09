import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Printer, X, Eye, FileText } from 'lucide-react';
import { OrderWithItems } from '@/api/orders';
import { JobOrderPrint } from './JobOrderPrint';
import { OrderReceiptPrint } from './OrderReceiptPrint';

interface PrintPreviewDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onPrint: () => void;
  order: OrderWithItems;
  items?: any[];
  deliverySchedule?: any;
  pickupPoint?: any;
  businessInfo?: {
    name: string;
    address: string;
    phone: string;
    email: string;
  };
  printType: 'job-order' | 'receipt';
  adminName?: string;
}

export function PrintPreviewDialog({
  isOpen,
  onClose,
  onPrint,
  order,
  items,
  deliverySchedule,
  pickupPoint,
  businessInfo,
  printType,
  adminName
}: PrintPreviewDialogProps) {
  const [isConfirming, setIsConfirming] = useState(false);

  const handleConfirmPrint = () => {
    setIsConfirming(true);
    onPrint();
    setTimeout(() => {
      setIsConfirming(false);
      onClose();
    }, 1000);
  };

  const getPreviewTitle = () => {
    return printType === 'job-order' ? 'Job Order Print Preview' : 'Receipt Print Preview';
  };

  const getPreviewDescription = () => {
    return printType === 'job-order' 
      ? 'Review the job order details before printing'
      : 'Review the receipt details before printing';
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0 pb-4 border-b">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/10 rounded-lg">
                {printType === 'job-order' ? (
                  <FileText className="h-5 w-5 text-primary" />
                ) : (
                  <Eye className="h-5 w-5 text-primary" />
                )}
              </div>
              <div>
                <DialogTitle className="text-lg font-semibold">
                  {getPreviewTitle()}
                </DialogTitle>
                <p className="text-sm text-muted-foreground mt-1">
                  {getPreviewDescription()}
                </p>
              </div>
            </div>
            <Badge variant="outline" className="ml-auto">
              Order #{order.order_number}
            </Badge>
          </div>
        </DialogHeader>

        {/* Preview Content - Scrollable */}
        <div className="flex-1 overflow-y-auto py-4">
          <div className="bg-white border rounded-lg shadow-sm">
            {printType === 'job-order' ? (
              <JobOrderPrint
                order={order}
                items={items}
                deliverySchedule={deliverySchedule}
                pickupPoint={pickupPoint}
                adminName={adminName}
              />
            ) : (
              <OrderReceiptPrint
                order={order}
                items={items}
                deliverySchedule={deliverySchedule}
                pickupPoint={pickupPoint}
                businessInfo={businessInfo}
              />
            )}
          </div>
        </div>

        <Separator className="flex-shrink-0" />

        {/* Actions - Fixed at bottom */}
        <DialogFooter className="flex-shrink-0 pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Print Format:</span> Professional layout optimized for A4 and thermal printers
            </div>
            <div className="flex gap-3">
              <Button
                onClick={onClose}
                variant="outline"
                disabled={isConfirming}
              >
                <X className="w-4 h-4 mr-2" />
                Cancel
              </Button>
              <Button
                onClick={handleConfirmPrint}
                disabled={isConfirming}
                className="min-w-[120px]"
              >
                {isConfirming ? (
                  <>
                    <div className="w-4 h-4 mr-2 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                    Printing...
                  </>
                ) : (
                  <>
                    <Printer className="w-4 h-4 mr-2" />
                    Print Now
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}