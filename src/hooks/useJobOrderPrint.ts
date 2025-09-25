import { useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { JobOrderPrint } from '@/components/orders/JobOrderPrint';
import { OrderWithItems } from '@/api/orders';
import { useToast } from '@/hooks/use-toast';

export const useJobOrderPrint = () => {
  const { toast } = useToast();

  const printJobOrder = useCallback((
    order: OrderWithItems,
    items?: any[],
    deliverySchedule?: any,
    pickupPoint?: any
  ) => {
    try {
      // Create a temporary container
      const printContainer = document.createElement('div');
      printContainer.style.position = 'absolute';
      printContainer.style.left = '-9999px';
      printContainer.style.top = '0';
      document.body.appendChild(printContainer);

      // Create React root and render the job order
      const root = createRoot(printContainer);
      
      const jobOrderElement = JobOrderPrint({
        order,
        items,
        deliverySchedule,
        pickupPoint
      });

      root.render(jobOrderElement);

      // Wait for rendering to complete
      setTimeout(() => {
        // Create a new window for printing
        const printWindow = window.open('', '_blank', 'width=800,height=600');
        
        if (!printWindow) {
          toast({
            title: 'Print Error',
            description: 'Unable to open print window. Please check your popup blocker.',
            variant: 'destructive'
          });
          return;
        }

        // Get the rendered HTML content
        const content = printContainer.innerHTML;

        // Write to the print window
        printWindow.document.write(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Job Order - ${order.order_number}</title>
              <meta charset="utf-8">
              <style>
                @media print {
                  @page {
                    margin: 15mm;
                    size: A4;
                  }
                  body {
                    margin: 0;
                    padding: 0;
                    -webkit-print-color-adjust: exact;
                    print-color-adjust: exact;
                  }
                }
              </style>
            </head>
            <body>
              ${content}
            </body>
          </html>
        `);

        printWindow.document.close();

        // Focus and print
        printWindow.focus();
        
        // Delay printing to ensure content is fully loaded
        setTimeout(() => {
          printWindow.print();
          
          // Close the window after printing
          setTimeout(() => {
            printWindow.close();
          }, 1000);
        }, 500);

        // Clean up
        root.unmount();
        document.body.removeChild(printContainer);

        toast({
          title: 'Job Order Ready',
          description: 'Job order has been sent to printer.'
        });

      }, 100);

    } catch (error) {
      console.error('Print error:', error);
      toast({
        title: 'Print Error',
        description: 'Failed to generate job order for printing.',
        variant: 'destructive'
      });
    }
  }, [toast]);

  return { printJobOrder };
};