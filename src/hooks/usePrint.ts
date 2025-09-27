import { useCallback } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { PrintOptions } from '@/types/orderDetailsModal';

interface UsePrintReturn {
  handlePrint: () => void;
  isPrinting: boolean;
}

export const usePrint = (
  contentRef: React.RefObject<HTMLElement>,
  documentTitle?: string,
  options?: PrintOptions
): UsePrintReturn => {
  
  const reactToPrintFn = useReactToPrint({
    contentRef,
    documentTitle: documentTitle || 'Order Details',
    onBeforePrint: () => {
      // Add print-specific styles
      const printStyles = document.createElement('style');
      printStyles.innerHTML = `
        @media print {
          .no-print { display: none !important; }
          .print-only { display: block !important; }
          body { -webkit-print-color-adjust: exact; }
          .bg-primary { background-color: #3b82f6 !important; }
          .text-primary { color: #3b82f6 !important; }
          .border { border: 1px solid #e5e7eb !important; }
          .shadow { box-shadow: none !important; }
          .rounded { border-radius: 0 !important; }
          .page-break { page-break-before: always; }
          .keep-together { page-break-inside: avoid; }
        }
      `;
      document.head.appendChild(printStyles);
      return Promise.resolve();
    },
    onAfterPrint: () => {
      // Clean up print styles
      const printStyles = document.head.querySelector('style:last-child');
      if (printStyles) {
        document.head.removeChild(printStyles);
      }
      toast.success('Order details printed successfully');
    },
    onPrintError: (error) => {
      console.error('Print error:', error);
      toast.error('Failed to print order details');
    },
  });

  const handlePrint = useCallback(() => {
    if (!contentRef.current) {
      toast.error('Nothing to print');
      return;
    }

    try {
      reactToPrintFn();
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print order details');
    }
  }, [reactToPrintFn, contentRef]);

  return {
    handlePrint,
    isPrinting: false, // react-to-print doesn't provide loading state
  };
};