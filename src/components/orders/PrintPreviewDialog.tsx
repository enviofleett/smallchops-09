import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Printer, X, Eye, FileText } from 'lucide-react';
import { OrderWithItems } from '@/api/orders';
import { JobOrderPrint } from './JobOrderPrint';
import { OrderReceiptPrint } from './OrderReceiptPrint';
import { ThermalOrderPrint } from './ThermalOrderPrint';

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

        {/* Preview Content - Thermal Optimized */}
        <div className="flex-1 overflow-y-auto py-4">
          {/* Thermal Preview Indicator */}
          <div className="mb-3 p-2 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-sm text-blue-700">
              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
              <span className="font-medium">80mm Thermal Print Preview</span>
              <span className="text-blue-600">• Max 2 pages • Optimized layout</span>
            </div>
          </div>

          {/* Thermal Print Container */}
          <div className="thermal-preview-container">
            <div className="thermal-preview-wrapper bg-white border rounded-lg shadow-sm">
              <ThermalOrderPrint
                order={order}
                items={items}
                deliverySchedule={deliverySchedule}
                pickupPoint={pickupPoint}
                businessInfo={businessInfo}
                printType={printType}
                adminName={adminName}
              />
            </div>

            {/* Thermal Preview Styles */}
            <style>{`
              .thermal-preview-container {
                max-width: 320px;
                margin: 0 auto;
                font-family: 'Courier New', monospace;
              }
              
              .thermal-preview-wrapper {
                width: 80mm;
                max-width: 320px;
                background: white;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
                border-radius: 8px;
                overflow: hidden;
                transform: scale(1);
                transform-origin: top center;
              }
              
              /* Enhanced preview for thermal print component */
              .thermal-preview-wrapper .thermal-print-container {
                width: 100% !important;
                max-width: 100% !important;
                margin: 0 !important;
                padding: 4mm !important;
                background: white !important;
                box-shadow: none !important;
              }
              
              /* Page break visualization */
              .thermal-preview-wrapper .page-break {
                border-top: 2px dashed #e74c3c !important;
                margin: 4mm 0 !important;
                padding-top: 2mm !important;
                position: relative;
              }
              
              .thermal-preview-wrapper .page-break::before {
                content: "PAGE 2";
                position: absolute;
                top: -10px;
                right: 0;
                font-size: 8px;
                background: #e74c3c;
                color: white;
                padding: 2px 6px;
                border-radius: 2px;
                font-weight: bold;
              }
            `}</style>
          </div>
        </div>

        <Separator className="flex-shrink-0" />

        {/* Actions - Fixed at bottom */}
        <DialogFooter className="flex-shrink-0 pt-4">
          <div className="flex items-center justify-between w-full">
            <div className="text-sm text-muted-foreground">
              <span className="font-medium">Print Format:</span> 80mm thermal printer optimized • Max 2 pages • Essential info only
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