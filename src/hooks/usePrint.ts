import { useCallback, useState } from 'react';
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
  const [isPrinting, setIsPrinting] = useState(false);
  
  const reactToPrintFn = useReactToPrint({
    contentRef,
    documentTitle: documentTitle || 'Order Details',
    pageStyle: `
      @page {
        size: A4 portrait;
        margin: 0.5in;
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
          color-adjust: exact !important;
        }
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
      }
    `,
    onBeforePrint: async () => {
      console.log('🖨️ Preparing A4 print...');
      setIsPrinting(true);
      
      // Ensure print styles are loaded
      await new Promise(resolve => setTimeout(resolve, 100));
      
      return Promise.resolve();
    },
    onAfterPrint: () => {
      console.log('✅ Print completed successfully');
      setIsPrinting(false);
      toast.success('Document printed successfully', {
        description: 'Order details sent to printer'
      });
    },
    onPrintError: (errorLocation, error) => {
      console.error('❌ Print error:', errorLocation, error);
      setIsPrinting(false);
      toast.error('Print failed', {
        description: 'Unable to print document. Please try again.'
      });
    },
  });

  const handlePrint = useCallback(() => {
    if (!contentRef.current) {
      toast.error('Nothing to print', {
        description: 'No content available for printing'
      });
      return;
    }

    if (isPrinting) {
      toast.info('Print in progress', {
        description: 'Please wait for current print to complete'
      });
      return;
    }

    try {
      console.log('🖨️ Initiating A4 print for:', documentTitle);
      reactToPrintFn();
    } catch (error) {
      console.error('❌ Print initiation error:', error);
      setIsPrinting(false);
      toast.error('Failed to start print', {
        description: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [reactToPrintFn, contentRef, isPrinting, documentTitle]);

  return {
    handlePrint,
    isPrinting,
  };
};