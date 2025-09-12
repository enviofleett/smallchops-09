import { useState } from 'react';
import { OrderWithItems } from '@/api/orders';
import { useToast } from '@/hooks/use-toast';

interface BusinessInfo {
  name: string;
  admin_notification_email?: string;
  whatsapp_support_number?: string;
  logo_url?: string;
}

export const useThermalPrint = () => {
  const [isPrinting, setIsPrinting] = useState(false);
  const { toast } = useToast();

  const printThermalReceipt = async (
    order: OrderWithItems,
    deliverySchedule?: any,
    businessInfo?: BusinessInfo
  ) => {
    if (!order) {
      toast({
        title: "Print Error",
        description: "No order data available for printing",
        variant: "destructive",
      });
      return;
    }

    setIsPrinting(true);

    try {
      // Import the thermal print styles
      if (!document.querySelector('#thermal-print-styles')) {
        const link = document.createElement('link');
        link.id = 'thermal-print-styles';
        link.rel = 'stylesheet';
        link.href = '/src/styles/thermal-print.css';
        document.head.appendChild(link);
      }

      // Create a temporary div for the receipt
      const printContainer = document.createElement('div');
      printContainer.className = 'thermal-receipt';
      
      const formatCurrency = (amount: number) => {
        return `₦${amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`;
      };

      const getOrderTypeDisplay = () => {
        return order.order_type === 'delivery' ? 'Delivery' : 'Pickup';
      };

      const getDeliveryInfo = () => {
        if (order.order_type === 'delivery' && order.delivery_address) {
          const address = typeof order.delivery_address === 'string' 
            ? order.delivery_address 
            : (order.delivery_address as any)?.formatted_address || 'Address on file';
          
          const instructions = typeof order.delivery_address === 'object'
            ? (order.delivery_address as any)?.instructions
            : null;

          return { address, instructions };
        }
        return null;
      };

      const getItemDetails = (item: any) => {
        const product = item.products || {};
        const details = [];
        
        if (product.description) {
          details.push(`Desc: ${product.description}`);
        }
        
        if (product.ingredients && Array.isArray(product.ingredients)) {
          details.push(`Ingredients: ${product.ingredients.join(', ')}`);
        }
        
        if (product.features && Array.isArray(product.features)) {
          details.push(`Features: ${product.features.join(', ')}`);
        }
        
        return details;
      };

      const deliveryInfo = getDeliveryInfo();
      
      // Generate the receipt HTML
      printContainer.innerHTML = `
        <div class="receipt-content">
          <div class="text-center mb-2">
            <div class="business-name">${businessInfo?.name || 'STARTERS SMALL CHOPS'}</div>
            ${businessInfo?.whatsapp_support_number ? 
              `<div class="contact">Contact: ${businessInfo.whatsapp_support_number}</div>` : ''}
          </div>
          
          <div class="divider">================================</div>
          
          <div class="order-info">
            <div>ORDER #: ${order.order_number}</div>
            <div>Date: ${new Date(order.created_at).toLocaleString('en-GB', {
              year: 'numeric',
              month: '2-digit',
              day: '2-digit',
              hour: '2-digit',
              minute: '2-digit'
            })}</div>
            <div>Type: ${getOrderTypeDisplay()}</div>
            <div>Status: ${order.status?.replace('_', ' ').toUpperCase()}</div>
          </div>
          
          <div class="divider">================================</div>
          
          <div class="customer-info">
            <div class="section-header">CUSTOMER INFO:</div>
            <div>Name: ${order.customer_name}</div>
            ${order.customer_phone ? `<div>Phone: ${order.customer_phone}</div>` : ''}
            ${order.customer_email ? `<div>Email: ${order.customer_email}</div>` : ''}
          </div>
          
          <div class="divider">================================</div>
          
          <div class="schedule-info">
            <div class="section-header">${getOrderTypeDisplay().toUpperCase()} SCHEDULE:</div>
            ${deliverySchedule ? `
              <div>Date: ${new Date(deliverySchedule.delivery_date).toLocaleDateString('en-GB')}</div>
              <div>Time: ${deliverySchedule.delivery_time_start} - ${deliverySchedule.delivery_time_end}</div>
              ${deliveryInfo?.address ? `<div>Address: ${deliveryInfo.address}</div>` : ''}
              ${deliveryInfo?.instructions ? `<div>Instructions: ${deliveryInfo.instructions}</div>` : ''}
              ${deliverySchedule.special_instructions ? 
                `<div>Special Notes: ${deliverySchedule.special_instructions}</div>` : ''}
            ` : ''}
            ${!deliverySchedule && order.order_type === 'delivery' && deliveryInfo?.address ? 
              `<div>Address: ${deliveryInfo.address}</div>` : ''}
          </div>
          
          <div class="divider">================================</div>
          
          <div class="items-section">
            <div class="section-header">ORDER ITEMS & DETAILS:</div>
            <div class="divider">--------------------------------</div>
            
            ${order.order_items?.map((item, index) => {
              const itemDetails = getItemDetails(item);
              return `
                <div class="item-block">
                  <div class="item-header">
                    <span>${item.product_name}</span>
                    <span class="item-total">${formatCurrency(item.total_price || 0)}</span>
                  </div>
                  <div class="item-meta">
                    Qty: ${item.quantity}${item.unit_price ? 
                      ` @ ${formatCurrency(item.unit_price)}` : ''}
                  </div>
                  
                  ${itemDetails.map(detail => 
                    `<div class="item-detail">${detail}</div>`
                  ).join('')}
                  
                  ${index < order.order_items.length - 1 ? '<div class="item-spacer"></div>' : ''}
                </div>
              `;
            }).join('') || '<div>No items found</div>'}
            
            <div class="divider">--------------------------------</div>
          </div>
          
          <div class="order-summary">
            <div class="summary-line">
              <span>Subtotal:</span>
              <span>${formatCurrency(order.subtotal || 0)}</span>
            </div>
            ${order.delivery_fee && order.delivery_fee > 0 ? `
              <div class="summary-line">
                <span>Delivery Fee:</span>
                <span>${formatCurrency(order.delivery_fee)}</span>
              </div>
            ` : ''}
            ${order.total_vat && order.total_vat > 0 ? `
              <div class="summary-line">
                <span>VAT (${((order.total_vat / (order.subtotal || 1)) * 100).toFixed(1)}%):</span>
                <span>${formatCurrency(order.total_vat)}</span>
              </div>
            ` : ''}
            
            <div class="divider">--------------------------------</div>
            
            <div class="total-line">
              <span>TOTAL:</span>
              <span>${formatCurrency(order.total_amount)}</span>
            </div>
          </div>
          
          <div class="divider">================================</div>
          
          <div class="payment-info">
            <div>Payment: ${order.payment_status?.toUpperCase()}</div>
            ${order.payment_method ? `<div>Method: ${order.payment_method}</div>` : ''}
            ${order.payment_reference ? `<div>Ref: ${order.payment_reference}</div>` : ''}
          </div>
          
          <div class="divider">================================</div>
          
          ${(order.admin_notes || deliverySchedule?.special_instructions || deliveryInfo?.instructions) ? `
            <div class="prep-notes">
              <div class="section-header">PREPARATION NOTES:</div>
              ${order.admin_notes ? `<div>- ${order.admin_notes}</div>` : ''}
              ${deliverySchedule?.special_instructions ? 
                `<div>- ${deliverySchedule.special_instructions}</div>` : ''}
              ${deliveryInfo?.instructions ? 
                `<div>- Delivery: ${deliveryInfo.instructions}</div>` : ''}
            </div>
            <div class="divider">================================</div>
          ` : ''}
          
          <div class="receipt-footer text-center">
            <div>Thank you for your order!</div>
            <div>Estimated prep time: 25-30 mins</div>
            ${businessInfo?.whatsapp_support_number ? 
              `<div>For support: ${businessInfo.whatsapp_support_number}</div>` : ''}
            ${businessInfo?.admin_notification_email ? 
              `<div>Email: ${businessInfo.admin_notification_email}</div>` : ''}
          </div>
        </div>
      `;

      // Add the receipt to the document temporarily
      document.body.appendChild(printContainer);
      
      // Wait for styles to load
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Print
      window.print();
      
      // Clean up
      document.body.removeChild(printContainer);
      
      toast({
        title: "Receipt Printed",
        description: `Thermal receipt for order ${order.order_number} sent to printer`,
        variant: "default",
      });

    } catch (error) {
      console.error('Print error:', error);
      toast({
        title: "Print Failed",
        description: "Unable to print receipt. Please check your printer connection.",
        variant: "destructive",
      });
    } finally {
      setIsPrinting(false);
    }
  };

  return {
    printThermalReceipt,
    isPrinting
  };
};