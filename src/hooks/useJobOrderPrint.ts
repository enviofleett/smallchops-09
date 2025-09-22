import { useRef, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { JobOrderPrint } from '@/components/orders/JobOrderPrint';
import { OrderWithItems } from '@/api/orders';
import { useToast } from '@/hooks/use-toast';
import React from 'react';

export const useJobOrderPrint = () => {
  const { toast } = useToast();

  const printJobOrder = useCallback((
    order: OrderWithItems,
    items?: any[],
    deliverySchedule?: any,
    pickupPoint?: any,
    adminName?: string
  ) => {
    // CRITICAL: Production data validation
    if (!order) {
      console.error('❌ Print failed: Order data is missing');
      toast({
        title: 'Print Error',
        description: 'Order data is missing. Cannot generate print.',
        variant: 'destructive'
      });
      return;
    }

    if (!order.order_number) {
      console.error('❌ Print failed: Order number is missing');
      toast({
        title: 'Print Error', 
        description: 'Order number is missing. Cannot generate print.',
        variant: 'destructive'
      });
      return;
    }

    console.log('🖨️ Starting job order print for:', order.order_number);

    try {
      // Create a temporary container with better positioning
      const printContainer = document.createElement('div');
      printContainer.style.position = 'fixed';
      printContainer.style.left = '-99999px';
      printContainer.style.top = '-99999px';
      printContainer.style.width = '210mm';
      printContainer.style.height = 'auto';
      printContainer.style.backgroundColor = 'white';
      printContainer.style.zIndex = '-1000';
      document.body.appendChild(printContainer);

      // Create React root with error boundary
      const root = createRoot(printContainer);
      
      // FIXED: Use proper JSX syntax instead of function call
      const jobOrderElement = React.createElement(JobOrderPrint, {
        order,
        items: items || order.order_items || [],
        deliverySchedule,
        pickupPoint,
        adminName: adminName || 'Admin User'
      });

      console.log('🔄 Rendering job order component...');

      // Render with proper async handling
      root.render(jobOrderElement);

      // FIXED: Wait for React rendering to complete with proper timeout
      const renderTimeout = setTimeout(() => {
        try {
          // Validate that content was rendered
          const content = printContainer.innerHTML;
          
          if (!content || content.trim().length < 100) {
            throw new Error('Rendered content is empty or too small');
          }

          console.log('✅ Job order rendered successfully, content length:', content.length);

          // Create print window with better configuration
          const printWindow = window.open('', '_blank', 
            'width=800,height=600,scrollbars=yes,resizable=yes,toolbar=no,menubar=no,location=no,status=no'
          );
          
          if (!printWindow) {
            throw new Error('Unable to open print window. Please check your popup blocker.');
          }

          // Enhanced HTML template with better print styles
          const printHTML = `
            <!DOCTYPE html>
            <html lang="en">
              <head>
                <title>Job Order - ${order.order_number}</title>
                <meta charset="utf-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <style>
                  @media print {
                    @page {
                      margin: 10mm;
                      size: A4;
                    }
                    body {
                      margin: 0;
                      padding: 0;
                      -webkit-print-color-adjust: exact;
                      print-color-adjust: exact;
                      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                    }
                    * {
                      -webkit-print-color-adjust: exact;
                      print-color-adjust: exact;
                    }
                  }
                  @media screen {
                    body {
                      padding: 20px;
                      background: #f5f5f5;
                    }
                    .job-order-print {
                      background: white;
                      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
                      border-radius: 8px;
                      overflow: hidden;
                    }
                  }
                </style>
              </head>
              <body>
                ${content}
                <script>
                  // Auto-print when page loads
                  window.onload = function() {
                    setTimeout(function() {
                      window.print();
                    }, 250);
                  };
                  
                  // Close window after printing (with fallback)
                  window.onafterprint = function() {
                    setTimeout(function() {
                      window.close();
                    }, 1000);
                  };
                  
                  // Fallback close for browsers that don't support onafterprint
                  setTimeout(function() {
                    if (!window.closed) {
                      window.close();
                    }
                  }, 10000);
                </script>
              </body>
            </html>
          `;

          // Write content to print window
          printWindow.document.write(printHTML);
          printWindow.document.close();

          // Focus the print window
          printWindow.focus();

          console.log('✅ Job order sent to print window successfully');

          toast({
            title: 'Print Ready',
            description: `Job order for #${order.order_number} has been sent to printer.`,
          });

        } catch (printError) {
          console.error('❌ Print window error:', printError);
          toast({
            title: 'Print Error',
            description: printError instanceof Error ? printError.message : 'Failed to generate print window.',
            variant: 'destructive'
          });
        } finally {
          // FIXED: Proper cleanup with error handling
          try {
            root.unmount();
            if (document.body.contains(printContainer)) {
              document.body.removeChild(printContainer);
            }
          } catch (cleanupError) {
            console.warn('⚠️ Cleanup warning:', cleanupError);
          }
        }
      }, 500); // Increased timeout for better reliability

      // Cleanup timeout if component unmounts
      return () => {
        clearTimeout(renderTimeout);
        try {
          root.unmount();
          if (document.body.contains(printContainer)) {
            document.body.removeChild(printContainer);
          }
        } catch (error) {
          console.warn('⚠️ Cleanup error:', error);
        }
      };

    } catch (error) {
      console.error('❌ Critical print error:', error);
      toast({
        title: 'Print System Error',
        description: 'Critical error in print system. Please contact support.',
        variant: 'destructive'
      });
    }
  }, [toast]);

  return { printJobOrder };
};