import React, { useCallback } from 'react';
import { OrderWithItems } from '@/api/orders';
import { OrderReceiptPrint } from '@/components/orders/OrderReceiptPrint';

export const useOrderReceiptPrint = () => {
  const printOrderReceipt = useCallback((
    order: OrderWithItems,
    items?: any[],
    deliverySchedule?: any,
    pickupPoint?: any,
    businessInfo?: {
      name: string;
      address: string;
      phone: string;
      email: string;
    }
  ) => {
    try {
      // Validate required data
      if (!order) {
        console.error('Order data is required for printing');
        return;
      }

      console.log('Starting order receipt print process...', {
        orderNumber: order.order_number,
        hasItems: items && items.length > 0,
        hasDeliverySchedule: !!deliverySchedule,
        hasPickupPoint: !!pickupPoint,
        hasBusinessInfo: !!businessInfo
      });

      // Create a temporary container for rendering the React component
      const tempContainer = document.createElement('div');
      tempContainer.style.position = 'absolute';
      tempContainer.style.left = '-9999px';
      tempContainer.style.top = '-9999px';
      tempContainer.style.width = '1px';
      tempContainer.style.height = '1px';
      tempContainer.style.overflow = 'hidden';
      tempContainer.setAttribute('data-testid', 'temp-print-container');
      document.body.appendChild(tempContainer);

      // Create React element and render it
      const receiptElement = React.createElement(OrderReceiptPrint, {
        order,
        items: items || order.order_items || [],
        deliverySchedule,
        pickupPoint,
        businessInfo
      });

      console.log('Rendering receipt component...');

      // Use ReactDOM to render the component
      import('react-dom/client').then(({ createRoot }) => {
        const root = createRoot(tempContainer);
        
        root.render(receiptElement);

        // Wait for rendering to complete with content validation
        setTimeout(() => {
          const renderedContent = tempContainer.innerHTML;
          
          // Validate that content was rendered properly
          if (!renderedContent || renderedContent.length < 100) {
            console.error('Receipt content was not rendered properly');
            document.body.removeChild(tempContainer);
            root.unmount();
            return;
          }

          console.log('Receipt content rendered successfully, opening print window...');

          // Create new print window
          const printWindow = window.open('', '_blank', 'width=800,height=600');
          
          if (!printWindow) {
            console.error('Could not open print window - popup blocked?');
            document.body.removeChild(tempContainer);
            root.unmount();
            return;
          }

          // Write the content to the print window
          printWindow.document.write(`
            <!DOCTYPE html>
            <html>
            <head>
              <meta charset="utf-8">
              <title>Order Receipt - ${order.order_number}</title>
              <style>
                @page {
                  margin: 0.5in;
                  size: auto;
                }
                body {
                  margin: 0;
                  padding: 0;
                  font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
                  background: white;
                  color: black;
                  font-weight: 900 !important;
                }
                * {
                  font-weight: 900 !important;
                  color: #000000 !important;
                  box-sizing: border-box;
                }
                .no-print { display: none !important; }
              </style>
            </head>
            <body>
              ${renderedContent}
            </body>
            </html>
          `);

          printWindow.document.close();

          // Set up cleanup function
          const cleanup = () => {
            console.log('Cleaning up after print...');
            try {
              printWindow.close();
            } catch (e) {
              console.warn('Could not close print window:', e);
            }
            
            try {
              document.body.removeChild(tempContainer);
              root.unmount();
            } catch (e) {
              console.warn('Could not clean up temp container:', e);
            }
          };

          // Wait for the document to load, then print
          printWindow.onload = () => {
            console.log('Print window loaded, initiating print...');
            
            setTimeout(() => {
              try {
                printWindow.print();
                
                // Listen for print events
                printWindow.addEventListener('afterprint', cleanup);
                
                // Fallback cleanup after 3 seconds
                setTimeout(cleanup, 3000);
                
              } catch (printError) {
                console.error('Print initiation failed:', printError);
                cleanup();
              }
            }, 500);
          };

          // Fallback if onload doesn't fire
          setTimeout(() => {
            if (printWindow && !printWindow.closed) {
              console.log('Fallback print initiation...');
              try {
                printWindow.print();
              } catch (e) {
                console.warn('Fallback print failed:', e);
              }
            }
          }, 2000);

        }, 500); // Increased timeout to ensure complete rendering

      }).catch((error) => {
        console.error('Failed to import ReactDOM:', error);
        document.body.removeChild(tempContainer);
      });

    } catch (error) {
      console.error('Order receipt print failed:', error);
    }
  }, []);

  return { printOrderReceipt };
};